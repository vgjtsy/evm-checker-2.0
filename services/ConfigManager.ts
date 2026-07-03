import { Network, Config } from '../types';
import { CONFIG } from '../config';
import { SETTINGS } from '../config/settings';
import fs from 'fs';
import path from 'path';

export interface AppConfig {
  // Core settings
  defaultNetwork?: Network;
  defaultBatchSize: number;
  defaultRetryAttempts: number;
  defaultRetryDelay: number;

  // File paths
  walletsFile: string;
  resultsDir: string;

  // RPC settings (multiple comma-separated URLs act as fallbacks)
  customRpcUrls: Partial<Record<Network, string[]>>;
  maxConcurrentRequests: number; // concurrent RPC request limit per network

  // USD valuation
  enableUsdPrices: boolean;
  dustThresholdUsd: number; // dust threshold for *_nonzero.csv (0 = any non-zero balance)

  // "All networks" mode
  excludeTestnets: boolean;
  allNetworksConcurrency: number; // how many networks to check in parallel

  // Logging
  enableLogging: boolean;

  // UI settings
  enableProgressBar: boolean;
}

export interface NetworkConfig {
  name: string;
  nativeCurrency: string;
  rpcUrl: string;
  multicallContract?: string;
  tokens: string[];
}

export class ConfigManager {
  private config: AppConfig;
  private networkConfigs: Map<Network, NetworkConfig>;
  private envLoaded: boolean = false;

  constructor() {
    this.config = this.getDefaultConfig();
    this.networkConfigs = new Map();
    this.loadEnvironmentVariables();
    this.initializeNetworkConfigs();
  }

  // Default configuration — pulled from config/settings.ts (single source of truth)
  private getDefaultConfig(): AppConfig {
    return {
      defaultNetwork: SETTINGS.defaultNetwork ? (SETTINGS.defaultNetwork as Network) : undefined,

      defaultBatchSize: SETTINGS.performance.batchSize,
      defaultRetryAttempts: SETTINGS.performance.retryAttempts,
      defaultRetryDelay: SETTINGS.performance.retryDelay,

      walletsFile: SETTINGS.walletsFile,
      resultsDir: SETTINGS.resultsDir,

      customRpcUrls: {},
      maxConcurrentRequests: SETTINGS.performance.maxConcurrentRequests,

      enableUsdPrices: SETTINGS.usd.enablePrices,
      dustThresholdUsd: SETTINGS.usd.dustThresholdUsd,

      excludeTestnets: SETTINGS.allNetworks.excludeTestnets,
      allNetworksConcurrency: SETTINGS.allNetworks.concurrency,

      enableLogging: SETTINGS.logging.enableLogging,

      enableProgressBar: SETTINGS.logging.enableProgressBar
    };
  }

  // Load environment variables: .env file first, then process.env (takes priority)
  private loadEnvironmentVariables(): void {
    try {
      const envPath = path.join(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        const envVars = this.parseEnvFile(envContent);
        this.applyEnvironmentVariables(envVars);
        this.envLoaded = true;
      }
    } catch (error) {
      console.warn('⚠️  Failed to load .env file:', error);
    }

    // Process environment variables override .env
    const processEnvVars: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) processEnvVars[key] = value;
    }
    this.applyEnvironmentVariables(processEnvVars);
  }

  // Parse the .env file
  private parseEnvFile(content: string): Record<string, string> {
    const envVars: Record<string, string> = {};
    
    content.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          envVars[key.trim()] = value.replace(/^["']|["']$/g, ''); // Strip quotes
        }
      }
    });
    
    return envVars;
  }

  // Apply environment variables
  private applyEnvironmentVariables(envVars: Record<string, string>): void {
    // Core settings
    if (envVars.DEFAULT_NETWORK) {
      this.config.defaultNetwork = envVars.DEFAULT_NETWORK as Network;
    }
    if (envVars.BATCH_SIZE) {
      this.config.defaultBatchSize = parseInt(envVars.BATCH_SIZE) || this.config.defaultBatchSize;
    }
    if (envVars.RETRY_ATTEMPTS) {
      this.config.defaultRetryAttempts = parseInt(envVars.RETRY_ATTEMPTS) || this.config.defaultRetryAttempts;
    }
    if (envVars.RETRY_DELAY) {
      this.config.defaultRetryDelay = parseInt(envVars.RETRY_DELAY) || this.config.defaultRetryDelay;
    }

    // File paths
    if (envVars.WALLETS_FILE) {
      this.config.walletsFile = envVars.WALLETS_FILE;
    }
    if (envVars.RESULTS_DIR) {
      this.config.resultsDir = envVars.RESULTS_DIR;
    }

    // Logging
    if (envVars.ENABLE_LOGGING) {
      this.config.enableLogging = envVars.ENABLE_LOGGING.toLowerCase() === 'true';
    }

    // UI settings
    if (envVars.ENABLE_PROGRESS_BAR) {
      this.config.enableProgressBar = envVars.ENABLE_PROGRESS_BAR.toLowerCase() === 'true';
    }

    // USD valuation and dust filter
    if (envVars.ENABLE_USD_PRICES) {
      this.config.enableUsdPrices = envVars.ENABLE_USD_PRICES.toLowerCase() === 'true';
    }
    if (envVars.DUST_THRESHOLD_USD !== undefined && envVars.DUST_THRESHOLD_USD !== '') {
      const threshold = parseFloat(envVars.DUST_THRESHOLD_USD);
      if (!isNaN(threshold) && threshold >= 0) {
        this.config.dustThresholdUsd = threshold;
      }
    }

    // RPC and concurrency
    if (envVars.MAX_CONCURRENT_REQUESTS) {
      this.config.maxConcurrentRequests = parseInt(envVars.MAX_CONCURRENT_REQUESTS) || this.config.maxConcurrentRequests;
    }
    if (envVars.EXCLUDE_TESTNETS) {
      this.config.excludeTestnets = envVars.EXCLUDE_TESTNETS.toLowerCase() === 'true';
    }
    if (envVars.ALL_NETWORKS_CONCURRENCY) {
      this.config.allNetworksConcurrency = parseInt(envVars.ALL_NETWORKS_CONCURRENCY) || this.config.allNetworksConcurrency;
    }

    // Custom RPC URLs (multiple comma-separated)
    Object.keys(envVars).forEach(key => {
      if (key.startsWith('RPC_URL_')) {
        const networkName = key.replace('RPC_URL_', '').toLowerCase().replace(/_/g, '-');
        const network = Object.values(Network).find(n => n === networkName);
        if (network) {
          const urls = envVars[key].split(',').map(u => u.trim()).filter(u => u.length > 0);
          if (urls.length > 0) {
            this.config.customRpcUrls[network] = urls;
          }
        }
      }
    });
  }

  // Initialize network configs
  private initializeNetworkConfigs(): void {
    Object.entries(CONFIG).forEach(([networkKey, networkData]) => {
      const network = networkKey as Network;
      
      const networkConfig: NetworkConfig = {
        name: this.getNetworkName(network),
        nativeCurrency: this.getNativeCurrency(network),
        rpcUrl: this.getRpcUrls(network)[0],
        multicallContract: networkData.MULTICALL3_CONTRACT,
        tokens: networkData.COLUMNS
      };
      
      this.networkConfigs.set(network, networkConfig);
    });
  }

  // Network display name
  private getNetworkName(network: Network): string {
    return CONFIG[network]?.NAME || network;
  }

  // Native currency
  private getNativeCurrency(network: Network): string {
    return CONFIG[network]?.NATIVE_CURRENCY || "ETH";
  }

  // Public config accessors
  getAppConfig(): AppConfig {
    return { ...this.config };
  }

  getNetworkConfig(network: Network): NetworkConfig | undefined {
    return this.networkConfigs.get(network);
  }

  // Full RPC list for a network: custom from .env (priority) + primary + fallbacks
  getRpcUrls(network: Network): string[] {
    const custom = this.config.customRpcUrls[network] || [];
    const networkData = CONFIG[network];
    const urls = [...custom, networkData.RPC_URL, ...(networkData.FALLBACK_RPC_URLS || [])];
    return [...new Set(urls)];
  }

  getAllNetworkConfigs(): Map<Network, NetworkConfig> {
    return new Map(this.networkConfigs);
  }

  // Config validation
  validateConfig(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Core settings checks
    if (this.config.defaultBatchSize <= 0) {
      errors.push('defaultBatchSize must be greater than 0');
    }
    if (this.config.defaultRetryAttempts < 0) {
      errors.push('defaultRetryAttempts cannot be negative');
    }
    if (this.config.defaultRetryDelay < 0) {
      errors.push('defaultRetryDelay cannot be negative');
    }

    // File path checks
    if (!this.config.walletsFile) {
      errors.push('walletsFile cannot be empty');
    }
    if (!this.config.resultsDir) {
      errors.push('resultsDir cannot be empty');
    }

    // Network config checks
    this.networkConfigs.forEach((config, network) => {
      if (!config.rpcUrl) {
        errors.push(`RPC URL for network ${network} is not set`);
      }
      if (!config.name) {
        errors.push(`Name for network ${network} is not set`);
      }
      if (!config.nativeCurrency) {
        errors.push(`Native currency for network ${network} is not set`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Info about the loaded configuration
  getConfigInfo(): {
    envLoaded: boolean;
    networksCount: number;
    customRpcCount: number;
    validationResult: { isValid: boolean; errors: string[] };
  } {
    return {
      envLoaded: this.envLoaded,
      networksCount: this.networkConfigs.size,
      customRpcCount: Object.keys(this.config.customRpcUrls).length,
      validationResult: this.validateConfig()
    };
  }
} 