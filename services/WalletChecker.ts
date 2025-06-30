import { NativeBalanceProvider, ERC20BalanceProvider } from "./BalanceService";
import { 
  CheckerConfig, 
  WalletBalance,
  CheckerStats,
  Network
} from "../types";
import { UIService } from "./UIService";
import { CONFIG } from "../config";

export class WalletChecker {
  private config: CheckerConfig;
  private stats: CheckerStats;
  private startTime: number;
  private tokenHeaders: string[] = [];
  private ui: UIService;

  // Получить название токена по адресу из конфигурации сети
  private getTokenNameByAddress(address: string): string | null {
    const networkConfig = CONFIG[this.config.network];
    if (!networkConfig || !networkConfig.TOKENS) return null;
    
    // Ищем токен по адресу (case-insensitive)
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
        batchSize: 100,
        retryAttempts: 3,
        retryDelay: 1000,
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
  }

  async check(): Promise<WalletBalance[]> {
    if (this.config.options?.showProgress) {
      this.ui.startProgress(
        `Инициализация: ${this.config.wallets.length} адресов, ${this.config.tokens.length} токенов`
      );
    }

    // Получаем адреса для проверки
    const addresses = this.config.wallets.map(w => w.address);

    // Инициализируем провайдеры токенов и получаем заголовки
    const tokenProviders: Array<{
      token: string;
      provider: NativeBalanceProvider | ERC20BalanceProvider;
      header: string;
    }> = [];

    let initCount = 0;
    for (const token of this.config.tokens) {
      if (token === "native") {
        const provider = new NativeBalanceProvider(this.config.network);
        const nativeName = CONFIG[this.config.network].NATIVE_CURRENCY || "Native";
        tokenProviders.push({ token, provider, header: nativeName });
        this.tokenHeaders.push(nativeName);
      } else {
        const provider = new ERC20BalanceProvider(this.config.network, token);
        
        // Сначала пытаемся получить название из конфигурации сети
        let header = this.getTokenNameByAddress(token);
        
        if (!header) {
          // Если в конфигурации нет, пытаемся получить из контракта
          try {
            await provider.initialize();
            const tokenInfo = provider.getTokenInfo();
            header = tokenInfo.symbol || `Token_${token.slice(0, 6)}`;
          } catch (error) {
            if (this.config.options?.logErrors) {
              console.error(`❌ Error initializing token ${token}:`, error);
            }
            header = `Token_${token.slice(0, 6)}`;
          }
        }
        
        tokenProviders.push({ token, provider, header });
        this.tokenHeaders.push(header);
      }
      
      initCount++;
      if (this.config.options?.showProgress) {
        this.ui.updateProgress({
          current: initCount,
          total: this.config.tokens.length,
          currentItem: "Инициализация токенов"
        });
      }
    }

    if (this.config.options?.showProgress) {
      this.ui.updateProgress({
        current: 0,
        total: tokenProviders.length * addresses.length,
        currentItem: "Проверка балансов"
      });
    }

    // ПАРАЛЛЕЛЬНО проверяем все токены одновременно
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
          console.error(`Error checking token ${token}:`, error);
        }
        // Возвращаем нулевые балансы при ошибке
        const emptyBalances = new Map<string, string>();
        addresses.forEach(addr => emptyBalances.set(addr, "0"));
        return { token, balances: emptyBalances, error: error as Error };
      }
    });

    // Ждем завершения всех проверок
    const tokenResults = await Promise.all(tokenBalancePromises);

    // Формируем результаты для каждого кошелька
    const results: WalletBalance[] = this.config.wallets.map(wallet => ({
      wallet,
      balances: new Map(),
      errors: new Map()
    }));

    // Заполняем результаты
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
      this.ui.succeedProgress(`Проверка завершена за ${(this.stats.duration / 1000).toFixed(2)}s`);
    }

    return results;
  }

  private async getBatchedBalances(
    provider: NativeBalanceProvider | ERC20BalanceProvider,
    addresses: string[]
  ): Promise<Map<string, string>> {
    const batchSize = this.config.options?.batchSize || 100;
    
    // Если адресов мало, обрабатываем все сразу
    if (addresses.length <= batchSize) {
      return await this.getBatchWithRetry(provider, addresses);
    }

    // Для большого количества адресов - параллельные батчи
    const batches: string[][] = [];
    for (let i = 0; i < addresses.length; i += batchSize) {
      batches.push(addresses.slice(i, i + batchSize));
    }

    // Обрабатываем все батчи параллельно
    const batchPromises = batches.map(batch => 
      this.getBatchWithRetry(provider, batch)
    );

    const batchResults = await Promise.all(batchPromises);
    
    // Объединяем результаты
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
    
    while (attempts < maxAttempts) {
      try {
        return await provider.getBatchBalances(addresses);
      } catch (error) {
        attempts++;
        if (attempts < maxAttempts) {
          await this.delay(this.config.options?.retryDelay || 1000);
        } else {
          throw error;
        }
      }
    }
    
    // Fallback - не должно сюда попасть
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

  // Метод для получения заголовков токенов (уже инициализированных)
  getTokenHeaders(): string[] {
    return [...this.tokenHeaders];
  }

  // Метод для получения UI сервиса
  getUIService(): UIService {
    return this.ui;
  }
} 