import { CONFIG } from "./config";
import { WalletChecker } from "./services/WalletChecker";
import { CsvExporter } from "./services/CsvExporter";
import { UIService } from "./services/UIService";
import { ConfigManager } from "./services/ConfigManager";
import { PriceService } from "./services/PriceService";
import { Network, CheckerConfig, WalletBalance, AllNetworksCheckResult, loadWalletsFromFile } from "./types";
import { AllNetworksChecker } from "./services/AllNetworksChecker";
import { SETTINGS } from "./config/settings";

const configManager = new ConfigManager();
const ui = new UIService();

ui.showHeader();

// Validate configuration
const configValidation = configManager.validateConfig();
if (!configValidation.isValid) {
  ui.showError("Configuration errors:");
  configValidation.errors.forEach(error => ui.showError(`  - ${error}`));
  process.exit(1);
}

const appConfig = configManager.getAppConfig();

// Load wallets
const wallets = await loadWalletsFromFile(appConfig.walletsFile);

if (wallets.length === 0) {
  ui.showError(`No wallets found in ${appConfig.walletsFile}`);
  process.exit(1);
}

const exporter = new CsvExporter(appConfig.dustThresholdUsd);

// ============================================================================
// Helpers
// ============================================================================

// Prices: one batched DefiLlama request per run (scales with token count,
// not wallet count). On failure we continue without USD.
async function fetchPricesSafe(networks: Network[]): Promise<PriceService | null> {
  if (!appConfig.enableUsdPrices) return null;

  const priceService = new PriceService();
  try {
    await priceService.fetchPrices(networks);
    return priceService;
  } catch (error) {
    ui.showWarning(`Failed to fetch token prices (${(error as Error).message}). Continuing without USD valuation.`);
    return null;
  }
}

function formatAmount(value: number): string {
  if (value === 0) return "0";
  if (value >= 1000) return value.toFixed(2);
  if (value >= 1) return value.toFixed(4);
  const formatted = value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  return formatted === "0" ? "<0.000001" : formatted;
}

function formatUsd(value: number): string {
  return "$" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const shortAddress = (address: string) => `${address.slice(0, 8)}...${address.slice(-6)}`;

// Cap token columns in the terminal table so it fits on screen
const MAX_TOKEN_COLUMNS = SETTINGS.terminal.maxTokenColumns;
const TOP_WALLETS_COUNT = SETTINGS.terminal.topWalletsCount;

// Single-network summary: top wallets + totals
function showSingleNetworkSummary(
  results: WalletBalance[],
  config: CheckerConfig,
  tokenHeaders: string[],
  prices: PriceService | null
): void {
  const usdEnabled = prices?.isAvailable() ?? false;
  const shownTokens = Math.min(tokenHeaders.length, MAX_TOKEN_COLUMNS);

  const walletRows = results.map(r => {
    const amounts = config.tokens.map(token => {
      const value = parseFloat(r.balances.get(token) || "0");
      return isNaN(value) ? 0 : value;
    });

    let totalUsd = 0;
    if (usdEnabled) {
      config.tokens.forEach((token, i) => {
        if (amounts[i] <= 0) return;
        const price = prices!.getPrice(config.network, token);
        if (price !== undefined) totalUsd += amounts[i] * price;
      });
    }

    return {
      address: r.wallet.address,
      amounts,
      totalUsd,
      // without prices we rank by the raw sum of amounts — rough, but fine for a top list
      sortKey: usdEnabled ? totalUsd : amounts.reduce((a, b) => a + b, 0),
      hasBalance: amounts.some(a => a > 0)
    };
  });

  const topWallets = walletRows
    .filter(w => w.hasBalance)
    .sort((a, b) => b.sortKey - a.sortKey)
    .slice(0, TOP_WALLETS_COUNT);

  if (topWallets.length === 0) {
    ui.showInfo("No wallets with balance found — summary table skipped.");
    return;
  }

  const headers = [
    "#",
    "Address",
    ...tokenHeaders.slice(0, shownTokens),
    ...(usdEnabled ? ["Total USD"] : [])
  ];

  const rows = topWallets.map((w, i) => [
    String(i + 1),
    shortAddress(w.address),
    ...w.amounts.slice(0, shownTokens).map(formatAmount),
    ...(usdEnabled ? [formatUsd(w.totalUsd)] : [])
  ]);

  const tokenTotals = config.tokens.map((_, col) =>
    walletRows.reduce((acc, w) => acc + w.amounts[col], 0)
  );
  const usdTotal = walletRows.reduce((acc, w) => acc + w.totalUsd, 0);

  const footer = [
    "",
    `TOTAL (${results.length} wallets)`,
    ...tokenTotals.slice(0, shownTokens).map(formatAmount),
    ...(usdEnabled ? [formatUsd(usdTotal)] : [])
  ];

  ui.showSummaryTable({
    title: `💰 TOP-${topWallets.length} WALLETS — ${CONFIG[config.network].NAME || config.network}`,
    headers,
    rows,
    footer
  });

  if (tokenHeaders.length > shownTokens) {
    ui.showInfo(`Showing the first ${shownTokens} of ${tokenHeaders.length} tokens — full data is in the CSV.`);
  }
}

// All-networks summary: top wallets by total USD
function showAllNetworksSummary(
  allResults: AllNetworksCheckResult[],
  prices: PriceService | null
): void {
  const usdEnabled = prices?.isAvailable() ?? false;

  // address -> { networks with balance, total USD }
  const walletTotals = new Map<string, { address: string; networks: number; totalUsd: number }>();

  allResults.forEach(netResult => {
    const columns = CONFIG[netResult.network]?.COLUMNS || ["native"];
    netResult.results.forEach(wb => {
      const key = wb.wallet.address.toLowerCase();
      const entry = walletTotals.get(key) || { address: wb.wallet.address, networks: 0, totalUsd: 0 };

      let hasBalanceInNetwork = false;
      columns.forEach(token => {
        const amount = parseFloat(wb.balances.get(token) || "0");
        if (isNaN(amount) || amount <= 0) return;
        hasBalanceInNetwork = true;
        if (usdEnabled) {
          const price = prices!.getPrice(netResult.network, token);
          if (price !== undefined) entry.totalUsd += amount * price;
        }
      });

      if (hasBalanceInNetwork) entry.networks++;
      walletTotals.set(key, entry);
    });
  });

  const withBalance = [...walletTotals.values()].filter(w => w.networks > 0);
  if (withBalance.length === 0) {
    ui.showInfo("No wallets with balance found — summary table skipped.");
    return;
  }

  const topWallets = withBalance
    .sort((a, b) => (usdEnabled ? b.totalUsd - a.totalUsd : b.networks - a.networks))
    .slice(0, TOP_WALLETS_COUNT);

  const headers = ["#", "Address", "Chains w/ balance", ...(usdEnabled ? ["Total USD"] : [])];
  const rows = topWallets.map((w, i) => [
    String(i + 1),
    shortAddress(w.address),
    String(w.networks),
    ...(usdEnabled ? [formatUsd(w.totalUsd)] : [])
  ]);

  const usdTotal = withBalance.reduce((acc, w) => acc + w.totalUsd, 0);
  const footer = [
    "",
    `TOTAL (${walletTotals.size} wallets)`,
    `with balance: ${withBalance.length}`,
    ...(usdEnabled ? [formatUsd(usdTotal)] : [])
  ];

  ui.showSummaryTable({
    title: `💰 TOP-${topWallets.length} WALLETS — ALL NETWORKS`,
    headers,
    rows,
    footer
  });
}

// ============================================================================
// Determine run mode: single network or all networks
// ============================================================================

const networkOrModeArg = process.argv[2];
let mode: 'single' | 'all';
let selectedNetwork: Network | undefined;

if (networkOrModeArg === 'all') {
  mode = 'all';
} else if (networkOrModeArg && Object.values(Network).includes(networkOrModeArg as Network)) {
  mode = 'single';
  selectedNetwork = networkOrModeArg as Network;
} else {
  // No (or invalid) argument — ask interactively
  const modeResponse = await ui.selectCheckMode();
  mode = modeResponse.mode;
}

try {
  if (mode === 'single') {
    let network = selectedNetwork || appConfig.defaultNetwork;

    if (!network || !CONFIG[network]) {
      network = await ui.selectNetwork();
    }

    if (!CONFIG[network]) {
      ui.showError(`No configuration found for network ${network}`);
      process.exit(1);
    }

    const networkConfig = configManager.getNetworkConfig(network);
    if (!networkConfig) {
      ui.showError(`No configuration found for network ${network}`);
      process.exit(1);
    }

    ui.showNetworkInfo(network, wallets.length, networkConfig.tokens);

    const checkerConfig: CheckerConfig = {
      network,
      wallets,
      tokens: networkConfig.tokens,
      rpcUrls: configManager.getRpcUrls(network),
      options: {
        showProgress: appConfig.enableProgressBar,
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

    // Prices (one request) and export
    const prices = await fetchPricesSafe([network]);
    const exportResult = await exporter.exportSingleNetwork(results, checkerConfig, tokenHeaders, prices);

    const walletsWithBalance = results.filter(r =>
      Array.from(r.balances.values()).some(b => parseFloat(b) > 0)
    ).length;

    const stats = checker.getStats();
    ui.showStatistics({
      totalWallets: stats.totalWallets,
      totalTokens: stats.totalTokens,
      totalChecks: stats.successfulChecks + stats.failedChecks,
      walletsWithBalance,
      duration: stats.duration / 1000,
      errors: stats.failedChecks
    }, network);

    showSingleNetworkSummary(results, checkerConfig, tokenHeaders, prices);

    ui.showSuccess(`Results for ${CONFIG[network].NAME || network} saved to ${exportResult.mainFile}`);
    if (exportResult.nonZeroFile) {
      ui.showSuccess(`Wallets with balance (${exportResult.nonZeroCount}) — saved to ${exportResult.nonZeroFile}`);
    }
    if (stats.failedChecks > 0) {
      ui.showWarning(`Some checks failed due to RPC errors — those cells are marked "ERROR" in the CSV (this is NOT a zero balance).`);
    }

  } else if (mode === 'all') {
    const allNetworksChecker = new AllNetworksChecker(wallets, configManager, ui);
    const allResults = await allNetworksChecker.checkAllNetworks();

    if (allResults.length === 0) {
      ui.showError("No network was checked successfully.");
      process.exit(1);
    }

    // Prices for all checked networks — still just 1-2 requests total
    const prices = await fetchPricesSafe(allResults.map(r => r.network));
    const exportResult = await exporter.exportAllNetworks(allResults, prices);

    showAllNetworksSummary(allResults, prices);

    ui.showSuccess(`Combined results for all networks saved to ${exportResult.mainFile}`);
    if (exportResult.nonZeroFile) {
      ui.showSuccess(`Wallets with balance (${exportResult.nonZeroCount}) — saved to ${exportResult.nonZeroFile}`);
    }
  }
} catch (error) {
  ui.showError("Check failed", error as Error);
  process.exit(1);
}
