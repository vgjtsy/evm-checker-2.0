import { NativeBalanceProvider, ERC20BalanceProvider } from "./BalanceService";
import { MulticallClient } from "./MulticallClient";
import {
  CheckerConfig,
  WalletBalance,
  CheckerStats,
  Network,
  BALANCE_ERROR,
  MULTICALL3_CONTRACT
} from "../types";
import { UIService } from "./UIService";
import { CONFIG } from "../config";
import { SETTINGS } from "../config/settings";
import fs from "fs";
import path from "path";

export class WalletChecker {
  private config: CheckerConfig;
  private stats: CheckerStats;
  private startTime: number;
  private tokenHeaders: string[] = [];
  private ui: UIService;
  private client: MulticallClient;

  private logError(message: string): void {
    try {
      if (!fs.existsSync(SETTINGS.resultsDir)) {
        fs.mkdirSync(SETTINGS.resultsDir, { recursive: true });
      }
      const logPath = path.join(SETTINGS.resultsDir, "error_log.txt");
      const timestamp = new Date().toISOString();
      fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`);
    } catch (e) {
      // ignore logging errors
    }
  }

  // Get token name by address from the network config
  private getTokenNameByAddress(address: string): string | null {
    const networkConfig = CONFIG[this.config.network];
    if (!networkConfig || !networkConfig.TOKENS) return null;

    // Look up the token by address (case-insensitive)
    for (const [name, tokenAddress] of Object.entries(networkConfig.TOKENS)) {
      if (tokenAddress.toLowerCase() === address.toLowerCase()) {
        return name;
      }
    }
    return null;
  }

  constructor(config: CheckerConfig) {
    this.config = {
      options: {
        batchSize: SETTINGS.performance.batchSize,
        retryAttempts: SETTINGS.performance.retryAttempts,
        retryDelay: SETTINGS.performance.retryDelay,
        showProgress: true,
        logErrors: true,
        ...config.options
      },
      ...config
    };

    this.stats = {
      totalWallets: config.wallets.length,
      totalTokens: config.tokens.length,
      successfulChecks: 0,
      failedChecks: 0,
      duration: 0
    };

    this.startTime = Date.now();
    this.ui = new UIService();

    // One client per network: shared concurrency limit and shared RPC rotation
    const networkConfig = CONFIG[config.network];
    const rpcUrls = this.config.rpcUrls && this.config.rpcUrls.length > 0
      ? this.config.rpcUrls
      : [networkConfig.RPC_URL, ...(networkConfig.FALLBACK_RPC_URLS || [])];

    this.client = new MulticallClient(
      rpcUrls,
      networkConfig.MULTICALL3_CONTRACT ?? MULTICALL3_CONTRACT,
      this.config.options?.maxConcurrentRequests ?? SETTINGS.performance.maxConcurrentRequests,
      networkConfig.CHAIN_ID
    );
  }

  async check(): Promise<WalletBalance[]> {
    if (this.config.options?.showProgress) {
      this.ui.startProgress(
        `Initializing: ${this.config.wallets.length} addresses, ${this.config.tokens.length} tokens`
      );
    }

    // Addresses to check
    const addresses = this.config.wallets.map(w => w.address);

    // Initialize token providers and collect headers
    let initCount = 0;
    const tokenInitPromises = this.config.tokens.map(async (token) => {
      let provider: NativeBalanceProvider | ERC20BalanceProvider;
      let header: string;

      if (token === "native") {
        provider = new NativeBalanceProvider(this.client);
        header = CONFIG[this.config.network].NATIVE_CURRENCY || "Native";
      } else {
        provider = new ERC20BalanceProvider(this.client, token);
        try {
          await provider.initialize();
          const tokenInfo = (provider as ERC20BalanceProvider).getTokenInfo();
          // contract symbol -> config name -> truncated address
          header = tokenInfo.symbol || this.getTokenNameByAddress(token) || `Token_${token.slice(0, 6)}`;
        } catch (error) {
          if (this.config.options?.logErrors) {
            this.logError(`Error initializing token ${token}: ${error}`);
          }
          header = this.getTokenNameByAddress(token) || `Token_${token.slice(0, 6)}`;
        }
      }

      initCount++;
      if (this.config.options?.showProgress) {
        this.ui.updateProgress({
          current: initCount,
          total: this.config.tokens.length,
          currentItem: "Initializing tokens"
        });
      }

      return { token, provider, header };
    });

    const tokenProviders = await Promise.all(tokenInitPromises);
    this.tokenHeaders = tokenProviders.map(p => p.header);

    if (this.config.options?.showProgress) {
      this.ui.updateProgress({
        current: 0,
        total: tokenProviders.length * addresses.length,
        currentItem: "Checking balances"
      });
    }

    // Check all tokens in PARALLEL
    let completedChecks = 0;
    const totalChecks = tokenProviders.length * addresses.length;

    const tokenBalancePromises = tokenProviders.map(async ({ token, provider, header }) => {
      try {
        const balances = await this.getBatchedBalances(provider, addresses);
        this.stats.successfulChecks += addresses.length;
        completedChecks += addresses.length;

        if (this.config.options?.showProgress) {
          this.ui.updateProgress({
            current: completedChecks,
            total: totalChecks,
            currentItem: header
          });
        }

        return { token, balances, error: null };
      } catch (error) {
        this.stats.failedChecks += addresses.length;
        completedChecks += addresses.length;

        if (this.config.options?.showProgress) {
          this.ui.updateProgress({
            current: completedChecks,
            total: totalChecks,
            currentItem: header
          });
        }

        if (this.config.options?.logErrors) {
          this.logError(`Error checking token ${token}: ${error}`);
        }
        // Mark as ERROR, not "0" — otherwise a funded wallet looks empty
        const errorBalances = new Map<string, string>();
        addresses.forEach(addr => errorBalances.set(addr, BALANCE_ERROR));
        return { token, balances: errorBalances, error: error as Error };
      }
    });

    // Wait for all checks to finish
    const tokenResults = await Promise.all(tokenBalancePromises);

    // Build per-wallet results
    const results: WalletBalance[] = this.config.wallets.map(wallet => ({
      wallet,
      balances: new Map(),
      errors: new Map()
    }));

    // Fill in the results
    tokenResults.forEach(({ token, balances, error }) => {
      addresses.forEach((address, index) => {
        const balance = balances.get(address) || "0";
        results[index].balances.set(token, balance);

        if (error) {
          if (!results[index].errors) {
            results[index].errors = new Map();
          }
          results[index].errors!.set(token, error);
        }
      });
    });

    this.stats.duration = Date.now() - this.startTime;

    if (this.config.options?.showProgress) {
      this.ui.succeedProgress(`Check completed in ${(this.stats.duration / 1000).toFixed(2)}s`);
    }

    return results;
  }

  private async getBatchedBalances(
    provider: NativeBalanceProvider | ERC20BalanceProvider,
    addresses: string[]
  ): Promise<Map<string, string>> {
    const batchSize = this.config.options?.batchSize || 100;

    // Few addresses — process them all at once
    if (addresses.length <= batchSize) {
      return await this.getBatchWithRetry(provider, addresses);
    }

    // Many addresses — parallel batches
    const batches: string[][] = [];
    for (let i = 0; i < addresses.length; i += batchSize) {
      batches.push(addresses.slice(i, i + batchSize));
    }

    // Process all batches in parallel
    const batchPromises = batches.map(batch =>
      this.getBatchWithRetry(provider, batch)
    );

    const batchResults = await Promise.all(batchPromises);

    // Merge the results
    const allBalances = new Map<string, string>();
    batchResults.forEach(batchBalances => {
      batchBalances.forEach((balance, address) => {
        allBalances.set(address, balance);
      });
    });

    return allBalances;
  }

  private async getBatchWithRetry(
    provider: NativeBalanceProvider | ERC20BalanceProvider,
    addresses: string[]
  ): Promise<Map<string, string>> {
    let attempts = 0;
    const maxAttempts = this.config.options?.retryAttempts || 3;
    let currentDelay = this.config.options?.retryDelay || 1000;

    while (attempts < maxAttempts) {
      try {
        return await provider.getBatchBalances(addresses);
      } catch (error) {
        attempts++;
        if (attempts < maxAttempts) {
          if (this.config.options?.logErrors) {
            this.logError(`RPC error for batch, retrying attempt ${attempts}/${maxAttempts}. Delay: ${currentDelay}ms. Error: ${error}`);
          }
          await this.delay(currentDelay);
          currentDelay *= 2; // Exponential backoff
        } else {
          throw error;
        }
      }
    }

    // Fallback — should never be reached
    const emptyBalances = new Map<string, string>();
    addresses.forEach(addr => emptyBalances.set(addr, "0"));
    return emptyBalances;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStats(): CheckerStats {
    return { ...this.stats };
  }

  // Returns the (already initialized) token headers
  getTokenHeaders(): string[] {
    return [...this.tokenHeaders];
  }

  // Returns the UI service
  getUIService(): UIService {
    return this.ui;
  }
} 