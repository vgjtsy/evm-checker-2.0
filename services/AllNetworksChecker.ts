import { WalletChecker } from "./WalletChecker";
import { ConfigManager } from "./ConfigManager";
import { UIService } from "./UIService";
import { WalletData, Network, WalletBalance, AllNetworksCheckResult } from "../types";
import { CONFIG } from "../config";

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
    const networksToExclude = [Network.BASE_GOERLI, Network.XTERIO];
    const allNetworks = Object.values(Network)
      .filter(network => CONFIG[network] && !networksToExclude.includes(network))
      .sort((a, b) => {
        const nameA = CONFIG[a]?.NAME || a;
        const nameB = CONFIG[b]?.NAME || b;
        return nameA.localeCompare(nameB);
      });
    const totalNetworks = allNetworks.length;
    let completedNetworks = 0;

    this.ui.startProgress(`Начинаем проверку всех ${totalNetworks} сетей...`);

    const allResults: AllNetworksCheckResult[] = [];

    for (const network of allNetworks) {
      this.ui.updateProgress({
        current: completedNetworks,
        total: totalNetworks,
        currentItem: `Проверка сети ${CONFIG[network].NAME || network}`,
        details: `(${completedNetworks + 1}/${totalNetworks})`
      });

      try {
        const networkConfig = this.configManager.getNetworkConfig(network);
        if (!networkConfig) {
          this.ui.showWarning(`Пропущена сеть ${CONFIG[network].NAME || network}: конфигурация не найдена.`);
          completedNetworks++;
          continue;
        }

        const checkerConfig = {
          network,
          wallets: this.wallets,
          tokens: networkConfig.tokens,
          options: {
            showProgress: false, // Отключаем внутренний прогресс-бар, т.к. есть внешний
            logErrors: this.configManager.getAppConfig().enableLogging,
            batchSize: this.configManager.getAppConfig().defaultBatchSize,
            retryAttempts: this.configManager.getAppConfig().defaultRetryAttempts,
            retryDelay: this.configManager.getAppConfig().defaultRetryDelay
          }
        };

        const checker = new WalletChecker(checkerConfig);
        const results = await checker.check();
        const tokenHeaders = checker.getTokenHeaders();

        allResults.push({ network, results, tokenHeaders });
        this.ui.showInfo(`✅ Сеть ${CONFIG[network].NAME || network} проверена.`);

      } catch (error) {
        this.ui.showError(`❌ Ошибка при проверке сети ${CONFIG[network].NAME || network}`, error as Error);
      } finally {
        completedNetworks++;
      }
    }

    this.ui.succeedProgress(`Проверка всех сетей завершена.`);
    return allResults;
  }
} 