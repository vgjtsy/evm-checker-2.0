import { ethers } from "ethers";
import { MulticallClient } from "./MulticallClient";
import { BalanceProvider, TokenInfo, DEFAULT_DECIMALS, ERC20_ABI, MULTICALL3_ABI } from "../types";

const erc20Iface = new ethers.Interface(ERC20_ABI);
const multicallIface = new ethers.Interface(MULTICALL3_ABI);

export class NativeBalanceProvider implements BalanceProvider {
  constructor(private client: MulticallClient) {}

  async getBalance(address: string): Promise<string> {
    const balances = await this.getBatchBalances([address]);
    return balances.get(address) || "0";
  }

  async getBatchBalances(addresses: string[]): Promise<Map<string, string>> {
    const calls = addresses.map((address) => ({
      target: this.client.multicallAddress,
      allowFailure: true,
      callData: multicallIface.encodeFunctionData("getEthBalance", [address]),
    }));

    const results = await this.client.aggregate3(calls);

    const balanceMap = new Map<string, string>();
    addresses.forEach((address, i) => {
      const result = results[i];
      if (result?.success && result.returnData !== "0x") {
        const [balance] = multicallIface.decodeFunctionResult("getEthBalance", result.returnData);
        balanceMap.set(address, ethers.formatEther(balance));
      } else {
        balanceMap.set(address, "0");
      }
    });

    return balanceMap;
  }
}

export class ERC20BalanceProvider implements BalanceProvider {
  private tokenInfo: TokenInfo;

  constructor(private client: MulticallClient, tokenAddress: string) {
    this.tokenInfo = {
      address: tokenAddress,
      symbol: "",
      decimals: DEFAULT_DECIMALS,
      name: "",
    };
  }

  async initialize(): Promise<void> {
    const calls = ["symbol", "decimals"].map((method) => ({
      target: this.tokenInfo.address,
      allowFailure: true,
      callData: erc20Iface.encodeFunctionData(method, []),
    }));

    const [symbolResult, decimalsResult] = await this.client.aggregate3(calls);

    if (symbolResult?.success && symbolResult.returnData !== "0x") {
      try {
        const [symbol] = erc20Iface.decodeFunctionResult("symbol", symbolResult.returnData);
        if (symbol) this.tokenInfo.symbol = String(symbol);
      } catch {
        // Some tokens (e.g. MKR) return symbol as bytes32
        try {
          this.tokenInfo.symbol = ethers.decodeBytes32String(symbolResult.returnData);
        } catch {
          // leave empty — WalletChecker will use a fallback header
        }
      }
    }

    if (decimalsResult?.success && decimalsResult.returnData !== "0x") {
      try {
        const [decimals] = erc20Iface.decodeFunctionResult("decimals", decimalsResult.returnData);
        const parsed = Number(decimals);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 255) {
          this.tokenInfo.decimals = parsed;
        }
      } catch {
        // keep DEFAULT_DECIMALS
      }
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
    const calls = addresses.map((address) => ({
      target: this.tokenInfo.address,
      allowFailure: true,
      callData: erc20Iface.encodeFunctionData("balanceOf", [address]),
    }));

    const results = await this.client.aggregate3(calls);

    const balanceMap = new Map<string, string>();
    addresses.forEach((address, i) => {
      const result = results[i];
      if (result?.success && result.returnData !== "0x") {
        try {
          const [balance] = erc20Iface.decodeFunctionResult("balanceOf", result.returnData);
          balanceMap.set(address, ethers.formatUnits(balance, this.tokenInfo.decimals));
        } catch {
          balanceMap.set(address, "0");
        }
      } else {
        balanceMap.set(address, "0");
      }
    });

    return balanceMap;
  }
}
