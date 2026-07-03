import fs from "fs";
import path from "path";
import { WalletBalance, CheckerConfig, AllNetworksCheckResult, Network } from "../types";
import { CONFIG } from "../config";
import { SETTINGS } from "../config/settings";
import { PriceService } from "./PriceService";

const CSV_DELIMITER = SETTINGS.output.csvDelimiter;
const RESULTS_FOLDER = SETTINGS.resultsDir;

// Wallet row before writing: cells + data for the dust filter
interface WalletRow {
  cells: string[];
  hasBalance: boolean; // at least one token with balance > 0
  hasUnpricedBalance: boolean; // has balance in a token without a known price
  totalUsd: number | null; // null — prices unavailable
}

export interface ExportResult {
  mainFile: string;
  nonZeroFile: string | null; // null — no wallets passed the filter
  nonZeroCount: number;
}

export class CsvExporter {
  constructor(private dustThresholdUsd: number = 0) {}

  async exportSingleNetwork(
    data: WalletBalance[],
    config: CheckerConfig,
    tokenHeaders: string[],
    prices: PriceService | null = null
  ): Promise<ExportResult> {
    const network = config.network;
    const usdEnabled = prices?.isAvailable() ?? false;

    const hasPrivateKeys = data.some(d => d.wallet.privateKey);
    const walletColumns = hasPrivateKeys ? ["Address", "PrivateKey"] : ["Address"];
    const header = [...walletColumns, ...tokenHeaders, ...(usdEnabled ? ["Total USD"] : [])];

    const rows: WalletRow[] = data.map(walletData => {
      const walletInfo = hasPrivateKeys
        ? [walletData.wallet.address, walletData.wallet.privateKey || ""]
        : [walletData.wallet.address];

      const balances = config.tokens.map(token => walletData.balances.get(token) || "0");

      let hasBalance = false;
      let hasUnpricedBalance = false;
      let totalUsd: number | null = usdEnabled ? 0 : null;

      config.tokens.forEach((token, i) => {
        const amount = parseFloat(balances[i]);
        if (isNaN(amount) || amount <= 0) return; // "ERROR" or zero
        hasBalance = true;

        if (usdEnabled) {
          const price = prices!.getPrice(network, token);
          if (price !== undefined) {
            totalUsd = (totalUsd || 0) + amount * price;
          } else {
            hasUnpricedBalance = true;
          }
        }
      });

      const cells = [
        ...walletInfo,
        ...balances,
        ...(usdEnabled ? [this.formatUsd(totalUsd || 0)] : [])
      ];

      return { cells, hasBalance, hasUnpricedBalance, totalUsd };
    });

    const numericColCount = tokenHeaders.length + (usdEnabled ? 1 : 0);
    const mainFile = path.join(RESULTS_FOLDER, `${network}.csv`);
    this.writeCsvFile(mainFile, header, rows, walletColumns.length, numericColCount, data.length);

    const nonZeroRows = rows.filter(row => this.passesDustFilter(row));
    let nonZeroFile: string | null = null;
    if (nonZeroRows.length > 0) {
      nonZeroFile = path.join(RESULTS_FOLDER, `${network}_nonzero.csv`);
      this.writeCsvFile(nonZeroFile, header, nonZeroRows, walletColumns.length, numericColCount, nonZeroRows.length);
    }

    return { mainFile, nonZeroFile, nonZeroCount: nonZeroRows.length };
  }

  async exportAllNetworks(
    allNetworksResults: AllNetworksCheckResult[],
    prices: PriceService | null = null,
    filename: string = "all_networks_balances.csv"
  ): Promise<ExportResult> {
    const usdEnabled = prices?.isAvailable() ?? false;

    // Unique wallets (address -> privateKey)
    const uniqueWallets = new Map<string, string | undefined>();
    allNetworksResults.forEach(netResult => {
      netResult.results.forEach(wb => {
        if (!uniqueWallets.has(wb.wallet.address)) {
          uniqueWallets.set(wb.wallet.address, wb.wallet.privateKey);
        }
      });
    });

    const hasPrivateKeys = Array.from(uniqueWallets.values()).some(pk => pk !== undefined);
    const walletColumns = hasPrivateKeys ? ["Address", "PrivateKey"] : ["Address"];

    // Columns: (network, token). The checker's tokenHeaders follow the order of
    // the config COLUMNS, so we resolve the token key by index — no fragile
    // header parsing.
    interface Column {
      network: Network;
      header: string;
      tokenKey: string; // "native" or token address
      displayHeader: string;
      nativeCurrency: string;
    }

    const columns: Column[] = [];
    const seenColumns = new Set<string>();

    allNetworksResults.forEach(netResult => {
      const networkConfig = CONFIG[netResult.network];
      const networkName = networkConfig?.NAME || netResult.network;
      const nativeCurrency = networkConfig?.NATIVE_CURRENCY || "ETH";

      netResult.tokenHeaders.forEach((header, i) => {
        const key = `${netResult.network}_${header}`;
        if (seenColumns.has(key)) return;
        seenColumns.add(key);

        columns.push({
          network: netResult.network,
          header,
          tokenKey: networkConfig?.COLUMNS[i] || "native",
          displayHeader: `${header} (${networkName})`,
          nativeCurrency
        });
      });
    });

    // Sort: ETH-native networks first, then by network name; within a network
    // the native currency comes first, remaining tokens alphabetically
    columns.sort((a, b) => {
      const isANativeETH = a.nativeCurrency === "ETH";
      const isBNativeETH = b.nativeCurrency === "ETH";
      if (isANativeETH !== isBNativeETH) return isANativeETH ? -1 : 1;

      const networkNameA = CONFIG[a.network]?.NAME || a.network;
      const networkNameB = CONFIG[b.network]?.NAME || b.network;
      const networkCompare = networkNameA.localeCompare(networkNameB);
      if (networkCompare !== 0) return networkCompare;

      const isANative = a.tokenKey === "native";
      const isBNative = b.tokenKey === "native";
      if (isANative !== isBNative) return isANative ? -1 : 1;

      return a.header.localeCompare(b.header);
    });

    const header = [
      ...walletColumns,
      ...columns.map(c => c.displayHeader),
      ...(usdEnabled ? ["Total USD"] : [])
    ];

    // Fast lookup: network -> address (lowercase) -> wallet result
    const resultsByNetwork = new Map<Network, Map<string, WalletBalance>>();
    allNetworksResults.forEach(netResult => {
      const walletMap = new Map<string, WalletBalance>();
      netResult.results.forEach(wb => walletMap.set(wb.wallet.address.toLowerCase(), wb));
      resultsByNetwork.set(netResult.network, walletMap);
    });

    const rows: WalletRow[] = [];
    for (const [address, privateKey] of uniqueWallets.entries()) {
      const walletInfo = hasPrivateKeys ? [address, privateKey || ""] : [address];

      let hasBalance = false;
      let hasUnpricedBalance = false;
      let totalUsd: number | null = usdEnabled ? 0 : null;

      const balances = columns.map(column => {
        const wb = resultsByNetwork.get(column.network)?.get(address.toLowerCase());
        const balance = wb?.balances.get(column.tokenKey) || "0";

        const amount = parseFloat(balance);
        if (!isNaN(amount) && amount > 0) {
          hasBalance = true;
          if (usdEnabled) {
            const price = prices!.getPrice(column.network, column.tokenKey);
            if (price !== undefined) {
              totalUsd = (totalUsd || 0) + amount * price;
            } else {
              hasUnpricedBalance = true;
            }
          }
        }

        return balance;
      });

      const cells = [
        ...walletInfo,
        ...balances,
        ...(usdEnabled ? [this.formatUsd(totalUsd || 0)] : [])
      ];

      rows.push({ cells, hasBalance, hasUnpricedBalance, totalUsd });
    }

    const numericColCount = columns.length + (usdEnabled ? 1 : 0);
    const mainFile = path.join(RESULTS_FOLDER, filename);
    this.writeCsvFile(mainFile, header, rows, walletColumns.length, numericColCount, rows.length);

    const nonZeroRows = rows.filter(row => this.passesDustFilter(row));
    let nonZeroFile: string | null = null;
    if (nonZeroRows.length > 0) {
      nonZeroFile = path.join(
        RESULTS_FOLDER,
        filename.replace(/\.csv$/, "") + "_nonzero.csv"
      );
      this.writeCsvFile(nonZeroFile, header, nonZeroRows, walletColumns.length, numericColCount, nonZeroRows.length);
    }

    return { mainFile, nonZeroFile, nonZeroCount: nonZeroRows.length };
  }

  // Dust filter: threshold 0 — any non-zero balance; threshold > 0 — by USD.
  // Balances in unpriced tokens are kept — a false positive beats missing money.
  private passesDustFilter(row: WalletRow): boolean {
    if (!row.hasBalance) return false;
    if (this.dustThresholdUsd <= 0) return true;
    if (row.totalUsd === null) return true; // prices unavailable — skip the USD filter
    return row.totalUsd >= this.dustThresholdUsd || row.hasUnpricedBalance;
  }

  private writeCsvFile(
    filePath: string,
    header: string[],
    rows: WalletRow[],
    walletColCount: number,
    numericColCount: number,
    totalWallets: number
  ): void {
    if (!fs.existsSync(RESULTS_FOLDER)) {
      fs.mkdirSync(RESULTS_FOLDER, { recursive: true });
    }

    const lines: string[] = [header.join(CSV_DELIMITER)];
    rows.forEach(row => lines.push(row.cells.join(CSV_DELIMITER)));

    // Totals row ("ERROR" values are excluded from the sum)
    if (rows.length > 0) {
      const totals: string[] = ["Total balance:", ...Array(walletColCount - 1).fill("")];
      for (let col = walletColCount; col < walletColCount + numericColCount; col++) {
        const sum = rows.reduce((acc, row) => {
          const value = parseFloat(row.cells[col]);
          return acc + (isNaN(value) ? 0 : value);
        }, 0);
        totals.push(this.formatNumber(sum));
      }
      lines.push("");
      lines.push(totals.join(CSV_DELIMITER));
    }

    fs.writeFileSync(filePath, lines.join("\n") + "\n");
  }

  private formatUsd(value: number): string {
    return value.toFixed(2);
  }

  // Number without scientific notation or trailing zeros
  private formatNumber(value: number): string {
    return value.toFixed(18).replace(/(\.0*|(?<=(\.\d*?[1-9]))0+)$/, "");
  }
}
