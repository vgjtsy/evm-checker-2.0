import { ethers } from "ethers";
import { Multicall, ContractCallContext } from "ethereum-multicall";
import { BalanceProvider, TokenInfo, Network, DEFAULT_DECIMALS, ERC20_ABI, MULTICALL3_ABI, MULTICALL3_CONTRACT } from "../types";
import { CONFIG } from "../config";

export class NativeBalanceProvider implements BalanceProvider {
  private multicall: Multicall;
  private multicallAddress: string;

  constructor(network: Network) {
    const rpcUrl = CONFIG[network].RPC_URL;
    this.multicallAddress = CONFIG[network].MULTICALL3_CONTRACT ?? MULTICALL3_CONTRACT;
    
    this.multicall = new Multicall({
      nodeUrl: rpcUrl,
      tryAggregate: true,
      multicallCustomContractAddress: this.multicallAddress,
    });
  }

  async getBalance(address: string): Promise<string> {
    const balances = await this.getBatchBalances([address]);
    return balances.get(address) || "0";
  }

  async getBatchBalances(addresses: string[]): Promise<Map<string, string>> {
    const ballanceCalls: ContractCallContext[] = [{
      reference: "multicall3",
      contractAddress: this.multicallAddress,
      abi: MULTICALL3_ABI,
      calls: addresses.map((address) => ({
        reference: address,
        methodName: "getEthBalance",
        methodParameters: [address],
      })),
    }];

    const results = await this.multicall.call(ballanceCalls);
    const balanceMap = new Map<string, string>();

    const { callsReturnContext } = results.results.multicall3;
    for (const call of callsReturnContext) {
      const address = call.reference;
      try {
        const balance = BigInt(call.returnValues as unknown as string);
        balanceMap.set(address, balance ? ethers.formatEther(balance) : "0");
      } catch {
        balanceMap.set(address, "0");
      }
    }

    return balanceMap;
  }
}

export class ERC20BalanceProvider implements BalanceProvider {
  private multicall: Multicall;
  private tokenInfo: TokenInfo;
  private network: Network;

  constructor(network: Network, tokenAddress: string) {
    const rpcUrl = CONFIG[network].RPC_URL;
    
    this.multicall = new Multicall({
      nodeUrl: rpcUrl,
      tryAggregate: true,
      multicallCustomContractAddress: CONFIG[network].MULTICALL3_CONTRACT ?? MULTICALL3_CONTRACT,
    });

    this.tokenInfo = {
      address: tokenAddress,
      symbol: "",
      decimals: DEFAULT_DECIMALS,
      name: "",
    };

    this.network = network;
  }

  async initialize(): Promise<void> {
    // Быстрая инициализация - получаем только decimals и symbol
    try {
      const contractCallContext: ContractCallContext[] = [{
        reference: this.tokenInfo.address,
        contractAddress: this.tokenInfo.address,
        abi: ERC20_ABI,
        calls: [
          {
            reference: "symbol",
            methodName: "symbol",
            methodParameters: [],
          },
          {
            reference: "decimals",
            methodName: "decimals",
            methodParameters: [],
          }
        ],
      }];

      const results = await this.multicall.call(contractCallContext);
      const tokenResults = results.results[this.tokenInfo.address];
      
      if (tokenResults?.callsReturnContext) {
        for (const call of tokenResults.callsReturnContext) {
          if (call.success && call.returnValues) {
            if (call.reference === "symbol") {
              // Декодируем hex строку для symbol
              try {
                const hexValue = call.returnValues as unknown;
                if (typeof hexValue === 'string' && hexValue.startsWith('0x')) {
                  // Декодируем как string из ABI
                  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
                  const decoded = abiCoder.decode(['string'], hexValue);
                  if (decoded && decoded[0]) {
                    this.tokenInfo.symbol = decoded[0];
                  }
                }
              } catch (error) {
                // Игнорируем ошибки декодирования
              }
            } else if (call.reference === "decimals" && call.returnValues) {
              // Декодируем decimals
              try {
                const hexValue = call.returnValues as unknown as string;
                if (typeof hexValue === 'string' && hexValue.startsWith('0x')) {
                  // Decimals возвращается как uint8, просто парсим hex
                  const decimals = parseInt(hexValue, 16);
                  if (!isNaN(decimals) && decimals >= 0 && decimals <= 255) {
                    this.tokenInfo.decimals = decimals;
                  }
                }
              } catch (error) {
                // Игнорируем ошибки декодирования
              }
            }
          }
        }
      }

      // Если символ всё ещё пустой, попробуем получить его напрямую
      if (!this.tokenInfo.symbol || this.tokenInfo.symbol === '0') {
        try {
          const rpcUrl = CONFIG[this.network].RPC_URL;
          const provider = new ethers.JsonRpcProvider(rpcUrl);
          const contract = new ethers.Contract(this.tokenInfo.address, ERC20_ABI, provider);
          const symbol = await contract.symbol();
          if (symbol && typeof symbol === 'string' && symbol !== '0') {
            this.tokenInfo.symbol = symbol;
          }
        } catch {
          // Игнорируем ошибки прямого вызова
        }
      }



    } catch (error) {
      console.error(`Ошибка инициализации токена ${this.tokenInfo.address}:`, error);
      // Fallback значения при ошибке
      this.tokenInfo.symbol = "UNKNOWN";
      this.tokenInfo.decimals = DEFAULT_DECIMALS;
    }
  }

  getTokenInfo(): TokenInfo {
    return this.tokenInfo;
  }

  async getBalance(address: string): Promise<string> {
    const balances = await this.getBatchBalances([address]);
    return balances.get(address) || "0";
  }

  async getBatchBalances(addresses: string[]): Promise<Map<string, string>> {
    const contractCallContext: ContractCallContext[] = [{
      reference: this.tokenInfo.address,
      contractAddress: this.tokenInfo.address,
      abi: ERC20_ABI,
      calls: addresses.map((address) => ({
        reference: address,
        methodName: "balanceOf",
        methodParameters: [address],
      })),
    }];

    const results = await this.multicall.call(contractCallContext);
    const balanceMap = new Map<string, string>();

    const tokenResults = results.results[this.tokenInfo.address];
    
    if (tokenResults?.callsReturnContext) {
      for (const call of tokenResults.callsReturnContext) {
        const address = call.reference;
        try {
          if (call.success && call.returnValues) {
            // returnValues приходит как hex строка
            const rawBalance = call.returnValues;
            
            if (rawBalance && typeof rawBalance === 'string' && 
                rawBalance !== '0x' && 
                rawBalance !== '0x0' && 
                rawBalance !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
              const balance = ethers.formatUnits(rawBalance, this.tokenInfo.decimals);
              balanceMap.set(address, balance);
            } else {
              balanceMap.set(address, "0");
            }
          } else {
            balanceMap.set(address, "0");
          }
        } catch (error) {
          console.error(`❌ Ошибка обработки баланса для ${address}:`, error);
          balanceMap.set(address, "0");
        }
      }
    }

    // Убеждаемся что все адреса есть в результате
    addresses.forEach(address => {
      if (!balanceMap.has(address)) {
        balanceMap.set(address, "0");
      }
    });

    return balanceMap;
  }
} 