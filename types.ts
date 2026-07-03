// ============================================================================
// EVM CHECKER TYPES AND INTERFACES
// ============================================================================

import { ethers } from "ethers";

// Networks
export enum Network {
  ABSTRACT = "abstract",
  APECHAIN = "apechain",
  ARBITRUM = "arbitrum",
  ARBITRUM_NOVA = "arbitrum-nova",
  AVALANCHE = "avalanche",
  BASE = "base",
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
  OPTIMISM = "optimism",
  POLYGON = "polygon",
  RONIN = "ronin",
  SCROLL = "scroll",
  SHAPE = "shape",
  SONEIUM = "soneium",
  UNICHAIN = "unichain",
  ZERO = "zero",
  ZKSYNC = "zksync",
  ZORA = "zora",
  MANTLE = "mantle",
  METIS = "metis",
  MODE = "mode",
  OPBNB = "opbnb",
  MOONBEAM = "moonbeam",
  MOONRIVER = "moonriver",
  KAVA = "kava",
  MANTA = "manta",
  PULSECHAIN = "pulsechain",
  SONIC = "sonic",
  TAIKO = "taiko",
  WORLDCHAIN = "worldchain",
  INK = "ink",
  GRAVITY = "gravity",
}

// Network configuration
export type Config = {
  [key in Network]: {
    RPC_URL: string;
    FALLBACK_RPC_URLS?: string[]; // backup RPCs, used when the primary fails
    CHAIN_ID?: number; // explicit chainId — skips the eth_chainId request on startup
    COLUMNS: string[];
    TOKENS: Record<string, string>; // symbol -> contract address
    MULTICALL3_CONTRACT?: string;
    NAME?: string;
    NATIVE_CURRENCY?: string;
  };
};

// ============================================================================
// INTERFACES
// ============================================================================

// Token info
export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  name?: string;
}

// Balance check result
export interface BalanceResult {
  header: string;
  balances: string[];
  tokenInfo?: TokenInfo;
}

// Wallet data
export interface WalletData {
  address: string;
  privateKey?: string;
}

// Check result for a single wallet
export interface WalletBalance {
  wallet: WalletData;
  balances: Map<string, string>;
  errors?: Map<string, Error>;
}

// Check result for all networks
export interface AllNetworksCheckResult {
  network: Network;
  results: WalletBalance[];
  tokenHeaders: string[];
}

// Checker configuration
export interface CheckerConfig {
  network: Network;
  wallets: WalletData[];
  tokens: string[]; // "native" or token contract addresses
  rpcUrls?: string[]; // RPC list (custom from .env + primary + fallbacks)
  options?: CheckerOptions;
}

// Checker options
export interface CheckerOptions {
  batchSize?: number;
  retryAttempts?: number;
  retryDelay?: number;
  showProgress?: boolean;
  logErrors?: boolean;
  maxConcurrentRequests?: number; // concurrent RPC request limit per network
}

// Balance provider interface
export interface BalanceProvider {
  getBalance(address: string): Promise<string>;
  getBatchBalances(addresses: string[]): Promise<Map<string, string>>;
}

// Check statistics
export interface CheckerStats {
  totalWallets: number;
  totalTokens: number;
  successfulChecks: number;
  failedChecks: number;
  duration: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const MULTICALL3_CONTRACT = "0xcA11bde05977b3631167028862bE2a173976CA11";
export const DEFAULT_DECIMALS = 18;

// CSV error marker: the RPC failed after all retries.
// Never write "0" here — a funded wallet would look empty.
export const BALANCE_ERROR = "ERROR";

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
// UTILITIES
// ============================================================================

// Mask input in logs: private keys must never end up in the console / shell history
function maskInput(input: string): string {
  if (input.length <= 10) return `${input.slice(0, 4)}...`;
  return `${input.slice(0, 6)}...${input.slice(-4)} (length ${input.length})`;
}

// Parses a wallets.txt line: an address or a private key. null — invalid line.
export function parseWalletLine(input: string): WalletData | null {
  const cleanInput = input.trim();

  // Private key: 64 hex chars (with or without 0x)
  if (/^(0x)?[0-9a-fA-F]{64}$/.test(cleanInput)) {
    try {
      const wallet = new ethers.Wallet(cleanInput.startsWith("0x") ? cleanInput : `0x${cleanInput}`);
      return { address: wallet.address, privateKey: cleanInput };
    } catch {
      return null;
    }
  }

  // Address: normalize to checksum format
  try {
    return { address: ethers.getAddress(cleanInput.toLowerCase()) };
  } catch {
    return null;
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
    const seen = new Set<string>();
    let invalidCount = 0;
    let duplicateCount = 0;

    for (const line of lines) {
      const wallet = parseWalletLine(line);

      if (!wallet) {
        invalidCount++;
        console.warn(`⚠️  Skipped invalid line: ${maskInput(line)}`);
        continue;
      }

      const key = wallet.address.toLowerCase();
      if (seen.has(key)) {
        duplicateCount++;
        continue;
      }
      seen.add(key);
      wallets.push(wallet);
    }

    if (invalidCount > 0) {
      console.warn(`⚠️  Invalid lines skipped: ${invalidCount}`);
    }
    if (duplicateCount > 0) {
      console.warn(`⚠️  Duplicate addresses skipped: ${duplicateCount}`);
    }

    return wallets;
  } catch (error) {
    console.error(`Error loading wallets from ${filename}:`, error);
    return [];
  }
}
