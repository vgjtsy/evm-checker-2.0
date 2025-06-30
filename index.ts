import { CONFIG } from "./config";
import { WalletChecker } from "./services/WalletChecker";
import { CsvExporter } from "./services/CsvExporter";
import { UIService } from "./services/UIService";
import { ConfigManager } from "./services/ConfigManager";
import { Network, CheckerConfig, loadWalletsFromFile } from "./types";
import { AllNetworksChecker } from "./services/AllNetworksChecker";

// Создаем менеджер конфигурации
const configManager = new ConfigManager();

// Создаем UI сервис
const ui = new UIService();

// Показываем заголовок
ui.showHeader();

// Валидируем конфигурацию
const configValidation = configManager.validateConfig();
if (!configValidation.isValid) {
  ui.showError("Ошибки в конфигурации:");
  configValidation.errors.forEach(error => ui.showError(`  - ${error}`));
  process.exit(1);
}

// Получаем конфигурацию приложения
const appConfig = configManager.getAppConfig();

// Загружаем кошельки
const wallets = await loadWalletsFromFile(appConfig.walletsFile);

if (wallets.length === 0) {
  ui.showError(`Не найдены кошельки в файле ${appConfig.walletsFile}`);
  process.exit(1);
}

const exporter = new CsvExporter();

// Определяем режим работы: одна сеть или все сети
const networkOrModeArg = process.argv[2];
let mode: 'single' | 'all';
let selectedNetwork: Network | undefined;

// Если передан аргумент 'all', устанавливаем режим 'all'
if (networkOrModeArg === 'all') {
  mode = 'all';
} else if (networkOrModeArg && Object.values(Network).includes(networkOrModeArg as Network)) {
  // Если передан аргумент - название сети, устанавливаем режим 'single' и выбранную сеть
  mode = 'single';
  selectedNetwork = networkOrModeArg as Network;
} else {
  // Если аргументов нет или они невалидны, предлагаем выбрать режим
  const modeResponse = await ui.selectCheckMode();
  mode = modeResponse.mode;
}

try {
  if (mode === 'single') {
    // Логика для проверки одной сети
    let network = selectedNetwork || appConfig.defaultNetwork;

    if (!network || !CONFIG[network]) {
      network = await ui.selectNetwork();
    }

    if (!CONFIG[network]) {
      ui.showError(`Конфигурация для сети ${network} не найдена`);
      process.exit(1);
    }

    const networkConfig = configManager.getNetworkConfig(network);
    if (!networkConfig) {
      ui.showError(`Конфигурация для сети ${network} не найдена`);
      process.exit(1);
    }
    
    // Показываем информацию о проверке
    ui.showNetworkInfo(network, wallets.length, networkConfig.tokens);

    const checkerConfig: CheckerConfig = {
      network,
      wallets,
      tokens: networkConfig.tokens,
      options: {
        showProgress: appConfig.enableProgressBar,
        logErrors: appConfig.enableLogging,
        batchSize: appConfig.defaultBatchSize,
        retryAttempts: appConfig.defaultRetryAttempts,
        retryDelay: appConfig.defaultRetryDelay
      }
    };

    const checker = new WalletChecker(checkerConfig);
    const results = await checker.check();
    const tokenHeaders = checker.getTokenHeaders();
    
    await exporter.exportSingleNetwork(results, checkerConfig, tokenHeaders);
    
    const walletsWithBalance = results.filter(r => 
      Array.from(r.balances.values()).some(b => parseFloat(b) > 0)
    ).length;
    
    const stats = checker.getStats();
    ui.showStatistics({
      totalWallets: stats.totalWallets,
      totalTokens: stats.totalTokens,
      totalChecks: stats.successfulChecks + stats.failedChecks,
      walletsWithBalance,
      totalBalance: 0, // Это поле не используется в текущей статистике
      duration: stats.duration / 1000,
      errors: stats.failedChecks
    }, network);
    
    ui.showSuccess(`Результаты для сети ${CONFIG[network].NAME || network} сохранены в ${appConfig.resultsDir}/${network}.csv`);

  } else if (mode === 'all') {
    // Логика для проверки всех сетей
    const allNetworksChecker = new AllNetworksChecker(wallets, configManager, ui);
    const allResults = await allNetworksChecker.checkAllNetworks();

    await exporter.exportAllNetworks(allResults);

    // TODO: Добавить сводную статистику для всех сетей
    ui.showSuccess(`Сводные результаты по всем сетям сохранены в ${appConfig.resultsDir}/all_networks_balances.csv`);
  }
} catch (error) {
  ui.showError("Ошибка при выполнении проверки", error as Error);
  process.exit(1);
}
