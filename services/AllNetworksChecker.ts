import { WalletChecker } from "./WalletChecker";
import { ConfigManager } from "./ConfigManager";
import { UIService } from "./UIService";
import { WalletData, Network, AllNetworksCheckResult } from "../types";
import { CONFIG } from "../config";
import { SETTINGS } from "../config/settings";

const TESTNETS: Network[] = [Network.BASE_SEPOLIA, Network.ETHEREUM_SEPOLIA];

export class AllNetworksChecker {
  private configManager: ConfigManager;
  private ui: UIService;
  private wallets: WalletData[];

  constructor(wallets: WalletData[], configManager: ConfigManager, ui: UIService) {
    this.wallets = wallets;
    this.configManager = configManager;
    this.ui = ui;
  }

  async checkAllNetworks(): Promise<AllNetworksCheckResult[]> {
    const appConfig = this.configManager.getAppConfig();

    let allNetworks: Network[];

    if (SETTINGS.allNetworksList.length > 0) {
      // Explicit list from config/settings.ts defines which networks to check.
      // Preserves the order written there; warns on unknown / unconfigured ids.
      const configured = new Set(Object.values(Network).filter(n => CONFIG[n]));
      const seen = new Set<Network>();
      allNetworks = [];

      for (const id of SETTINGS.allNetworksList) {
        const network = id as Network;
        if (!configured.has(network)) {
          this.ui.showWarning(`Unknown network id "${id}" in allNetworksList — skipped.`);
          continue;
        }
        if (seen.has(network)) continue;
        seen.add(network);
        allNetworks.push(network);
      }
    } else {
      // Empty list = auto-include every configured mainnet (testnets skipped
      // unless EXCLUDE_TESTNETS=false).
      const networksToExclude: Network[] = appConfig.excludeTestnets ? TESTNETS : [];
      allNetworks = Object.values(Network)
        .filter(network => CONFIG[network] && !networksToExclude.includes(network))
        .sort((a, b) => {
          const nameA = CONFIG[a]?.NAME || a;
          const nameB = CONFIG[b]?.NAME || b;
          return nameA.localeCompare(nameB);
        });
    }

    const totalNetworks = allNetworks.length;
    // Networks are checked in parallel (each talks to its own RPC)
    const concurrency = Math.max(1, Math.min(appConfig.allNetworksConcurrency, totalNetworks));
    let completedNetworks = 0;
    let nextIndex = 0;

    this.ui.startProgress(
      `Checking ${totalNetworks} networks (${concurrency} at a time)...`
    );

    const allResults: AllNetworksCheckResult[] = [];

    const worker = async (): Promise<void> => {
      while (true) {
        const index = nextIndex++;
        if (index >= allNetworks.length) return;

        const network = allNetworks[index];
        const networkName = CONFIG[network].NAME || network;

        try {
          const networkConfig = this.configManager.getNetworkConfig(network);
          if (!networkConfig) {
            this.ui.showWarning(`Skipped network ${networkName}: no configuration found.`);
            continue;
          }

          const checkerConfig = {
            network,
            wallets: this.wallets,
            tokens: networkConfig.tokens,
            rpcUrls: this.configManager.getRpcUrls(network),
            options: {
              showProgress: false, // Disable the inner progress bar — the outer one is enough
              logErrors: appConfig.enableLogging,
              batchSize: appConfig.defaultBatchSize,
              retryAttempts: appConfig.defaultRetryAttempts,
              retryDelay: appConfig.defaultRetryDelay,
              maxConcurrentRequests: appConfig.maxConcurrentRequests
            }
          };

          const checker = new WalletChecker(checkerConfig);
          const results = await checker.check();
          const tokenHeaders = checker.getTokenHeaders();

          allResults.push({ network, results, tokenHeaders });
        } catch (error) {
          this.ui.showError(`❌ Error while checking ${networkName}`, error as Error);
        } finally {
          completedNetworks++;
          this.ui.updateProgress({
            current: completedNetworks,
            total: totalNetworks,
            currentItem: `Networks checked`,
            details: `last: ${networkName}`
          });
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    // Stable result order regardless of which network finished first
    allResults.sort((a, b) => {
      const nameA = CONFIG[a.network]?.NAME || a.network;
      const nameB = CONFIG[b.network]?.NAME || b.network;
      return nameA.localeCompare(nameB);
    });

    this.ui.succeedProgress(`All networks checked (${allResults.length}/${totalNetworks}).`);
    return allResults;
  }
}
