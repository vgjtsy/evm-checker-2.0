// ============================================================================
// ТИПЫ И ИНТЕРФЕЙСЫ EVM CHECKER
// ============================================================================

// Сети
export enum Network {
  ABSTRACT = "abstract",
  APECHAIN = "apechain",
  ARBITRUM = "arbitrum",
  ARBITRUM_NOVA = "arbitrum-nova",
  AVALANCHE = "avalanche",
  BASE = "base",
  BASE_GOERLI = "base-goerli",
  BASE_SEPOLIA = "base-sepolia",
  BERACHAIN = "berachain",
  BLAST = "blast",
  BNB = "bnb",
  CELO = "celo",
  ETHEREUM = "ethereum",
  ETHEREUM_SEPOLIA = "ethereum-sepolia",
  FANTOM = "fantom",
  GNOSIS = "gnosis",
  HARMONY = "harmony",
  LINEA = "linea",
  MEGAETH = "megaeth",
  MONAD_TESTNET = "monad-testnet",
  OPTIMISM = "optimism",
  POLYGON = "polygon",
  POLYGON_ZKEVM = "polygon_zkevm",
  RONIN = "ronin",
  SCROLL = "scroll",
  SHAPE = "shape",
  SONEIUM = "soneium",
  UNICHAIN = "unichain",
  XTERIO = "xterio",
  ZERO = "zero",
  ZKSYNC = "zksync",
  ZORA = "zora",
}

// Конфигурация сети
export type Config = {
  [key in Network]: {
    RPC_URL: string;
    COLUMNS: string[];
    TOKENS: Record<string, string>; // название -> адрес
    MULTICALL3_CONTRACT?: string;
    NAME?: string;
    NATIVE_CURRENCY?: string;
  };
};

// ============================================================================
// ИНТЕРФЕЙСЫ
// ============================================================================

// Информация о токене
export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  name?: string;
}

// Результат проверки баланса
export interface BalanceResult {
  header: string;
  balances: string[];
  tokenInfo?: TokenInfo;
}

// Данные кошелька
export interface WalletData {
  address: string;
  privateKey?: string;
}

// Результат проверки для одного кошелька
export interface WalletBalance {
  wallet: WalletData;
  balances: Map<string, string>;
  errors?: Map<string, Error>;
}

// Результат проверки всех сетей
export interface AllNetworksCheckResult {
  network: Network;
  results: WalletBalance[];
  tokenHeaders: string[];
}

// Конфигурация для проверки
export interface CheckerConfig {
  network: Network;
  wallets: WalletData[];
  tokens: string[]; // "native" или адреса токенов
  options?: CheckerOptions;
}

// Опции для чекера
export interface CheckerOptions {
  batchSize?: number;
  retryAttempts?: number;
  retryDelay?: number;
  showProgress?: boolean;
  logErrors?: boolean;
}

// Интерфейс для провайдера балансов
export interface BalanceProvider {
  getBalance(address: string): Promise<string>;
  getBatchBalances(addresses: string[]): Promise<Map<string, string>>;
}

// Интерфейс для экспорта результатов
export interface ResultExporter {
  exportSingleNetwork(data: WalletBalance[], config: CheckerConfig, tokenHeaders: string[]): Promise<void>;
  exportAllNetworks(allNetworksResults: AllNetworksCheckResult[], filename?: string): Promise<void>;
}

// Статистика проверки
export interface CheckerStats {
  totalWallets: number;
  totalTokens: number;
  successfulChecks: number;
  failedChecks: number;
  duration: number;
}

// ============================================================================
// КОНСТАНТЫ
// ============================================================================

export const MULTICALL3_CONTRACT = "0xcA11bde05977b3631167028862bE2a173976CA11";
export const DEFAULT_DECIMALS = 18;

export const ERC20_ABI = [
  "function allowance(address _owner, address _spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function name() view returns (string)",
  "function transfer(address _recipient, uint256 _amount) returns (bool)",
  "function symbol() view returns (string)",
];

export const MULTICALL3_ABI = [
  "function aggregate(tuple(address target, bytes callData)[] calls) payable returns (uint256 blockNumber, bytes[] returnData)",
  "function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)",
  "function aggregate3Value(tuple(address target, bool allowFailure, uint256 value, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)",
  "function blockAndAggregate(tuple(address target, bytes callData)[] calls) payable returns (uint256 blockNumber, bytes32 blockHash, tuple(bool success, bytes returnData)[] returnData)",
  "function getBasefee() view returns (uint256 basefee)",
  "function getBlockHash(uint256 blockNumber) view returns (bytes32 blockHash)",
  "function getBlockNumber() view returns (uint256 blockNumber)",
  "function getChainId() view returns (uint256 chainid)",
  "function getCurrentBlockCoinbase() view returns (address coinbase)",
  "function getCurrentBlockDifficulty() view returns (uint256 difficulty)",
  "function getCurrentBlockGasLimit() view returns (uint256 gaslimit)",
  "function getCurrentBlockTimestamp() view returns (uint256 timestamp)",
  "function getEthBalance(address addr) view returns (uint256 balance)",
  "function getLastBlockHash() view returns (bytes32 blockHash)",
  "function tryAggregate(bool requireSuccess, tuple(address target, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)",
  "function tryBlockAndAggregate(bool requireSuccess, tuple(address target, bytes callData)[] calls) payable returns (uint256 blockNumber, bytes32 blockHash, tuple(bool success, bytes returnData)[] returnData)",
];

// ============================================================================
// УТИЛИТЫ
// ============================================================================

export async function getAddressFromWallet(input: string): Promise<string> {
  const cleanInput = input.trim();
  
  // Проверяем, является ли это адресом (начинается с 0x и имеет 42 символа)
  if (cleanInput.startsWith("0x") && cleanInput.length === 42) {
    return cleanInput;
  }
  
  // Если это приватный ключ, конвертируем в адрес
  try {
    const ethers = await import("ethers");
    const wallet = new ethers.Wallet(cleanInput);
    return wallet.address;
  } catch (error) {
    console.error(`Invalid wallet input: ${cleanInput}`);
    return cleanInput; // Возвращаем как есть, если не можем обработать
  }
}

export async function loadWalletsFromFile(filename: string): Promise<WalletData[]> {
  try {
    const fs = await import("fs");
    const fileContent = fs.readFileSync(filename, "utf-8");
    const lines = fileContent
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    
    const wallets: WalletData[] = [];
    
    for (const line of lines) {
      const address = await getAddressFromWallet(line);
      
      // Если строка длиннее 42 символов, это вероятно приватный ключ
      if (line.length > 42 && line !== address) {
        wallets.push({ address, privateKey: line });
      } else {
        wallets.push({ address });
      }
    }
    
    return wallets;
  } catch (error) {
    console.error(`Error loading wallets from ${filename}:`, error);
    return [];
  }
}
