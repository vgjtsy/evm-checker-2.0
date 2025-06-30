import fs, { WriteStream } from "fs";
import path from "path";
import { ResultExporter, WalletBalance, CheckerConfig, AllNetworksCheckResult, Network } from "../types";
import { CONFIG } from "../config";

export class CsvExporter implements ResultExporter {
  private stream: WriteStream | null = null;
  private rows: (string | number)[][] = [];
  private readonly CSV_DELIMITER = ";";
  private readonly RESULTS_FOLDER = "results";

  async exportSingleNetwork(
    data: WalletBalance[], 
    config: CheckerConfig,
    tokenHeaders: string[]
  ): Promise<void> {
    // Создаем папку results если её нет
    if (!fs.existsSync(this.RESULTS_FOLDER)) {
      fs.mkdirSync(this.RESULTS_FOLDER, { recursive: true });
    }

    const filename = path.join(this.RESULTS_FOLDER, `${config.network}.csv`);
    this.stream = fs.createWriteStream(filename);

    try {
      // Формируем заголовок CSV
      const hasPrivateKeys = data.some(d => d.wallet.privateKey);
      const walletColumns = hasPrivateKeys ? ["Address", "PrivateKey"] : ["Address"];
      const csvHeader = [...walletColumns, ...tokenHeaders];
      
      this.writeRow(csvHeader);

      // Записываем данные
      for (const walletData of data) {
        const walletInfo = hasPrivateKeys 
          ? [walletData.wallet.address, walletData.wallet.privateKey || ""]
          : [walletData.wallet.address];
        
        const balances = config.tokens.map(token => 
          walletData.balances.get(token) || "0"
        );
        
        const row = [...walletInfo, ...balances];
        this.writeRow(row);
      }

      // Добавляем итоговую строку
      this.addTotalRow(hasPrivateKeys, tokenHeaders.length, data.length);

      // Закрываем поток
      await this.close();
      
      console.log(`✅ Результаты для сети ${CONFIG[config.network].NAME || config.network} сохранены в ${filename}`);
    } catch (error) {
      console.error("Ошибка при экспорте в CSV:", error);
      throw error;
    }
  }

  async exportAllNetworks(
    allNetworksResults: AllNetworksCheckResult[],
    filename: string = "all_networks_balances.csv"
  ): Promise<void> {
    if (!fs.existsSync(this.RESULTS_FOLDER)) {
      fs.mkdirSync(this.RESULTS_FOLDER, { recursive: true });
    }

    const fullPath = path.join(this.RESULTS_FOLDER, filename);
    this.stream = fs.createWriteStream(fullPath);

    try {
      // Собираем все уникальные адреса кошельков
      const uniqueWallets = new Map<string, string | undefined>(); // address -> privateKey
      allNetworksResults.forEach(netResult => {
        netResult.results.forEach(walletBalance => {
          if (!uniqueWallets.has(walletBalance.wallet.address)) {
            uniqueWallets.set(walletBalance.wallet.address, walletBalance.wallet.privateKey);
          }
        });
      });

      const hasPrivateKeys = Array.from(uniqueWallets.values()).some(pk => pk !== undefined);
      const walletColumns = hasPrivateKeys ? ["Address", "PrivateKey"] : ["Address"];

      // Собираем все уникальные заголовки токенов по всем сетям и сортируем их
      const allTokenHeadersRaw: { network: Network; header: string; displayHeader: string; nativeCurrency: string }[] = [];
      const uniqueHeaderKeys = new Set<string>();

      allNetworksResults.forEach(netResult => {
        const networkName = CONFIG[netResult.network]?.NAME || netResult.network;
        const nativeCurrency = CONFIG[netResult.network]?.NATIVE_CURRENCY || 'ETH';

        netResult.tokenHeaders.forEach(header => {
          const uniqueHeaderKey = `${netResult.network}_${header}`;
          if (!uniqueHeaderKeys.has(uniqueHeaderKey)) {
            uniqueHeaderKeys.add(uniqueHeaderKey);
            allTokenHeadersRaw.push({
              network: netResult.network,
              header,
              displayHeader: `${header} (${networkName})`,
              nativeCurrency
            });
          }
        });
      });

      // Пользовательская сортировка:
      // 1. Сети с нативной валютой ETH, затем остальные
      // 2. Внутри группы - по названию сети (алфавитный порядок)
      // 3. Внутри сети - сначала нативная валюта, затем ERC-20 токены (алфавитный порядок)
      const sortedAllTokenHeaders = allTokenHeadersRaw.sort((a, b) => {
        // Группировка по типу нативной валюты (ETH сначала)
        const isANativeETH = a.nativeCurrency === 'ETH';
        const isBNativeETH = b.nativeCurrency === 'ETH';

        if (isANativeETH && !isBNativeETH) return -1;
        if (!isANativeETH && isBNativeETH) return 1;

        // Если нативные валюты одинакового типа, сортируем по названию сети
        const networkNameA = CONFIG[a.network]?.NAME || a.network;
        const networkNameB = CONFIG[b.network]?.NAME || b.network;
        const networkCompare = networkNameA.localeCompare(networkNameB);
        if (networkCompare !== 0) return networkCompare;

        // Внутри одной сети: сначала нативная валюта, затем остальные токены
        const isANativeToken = a.header === a.nativeCurrency || (a.header === 'Native' && a.nativeCurrency === 'ETH');
        const isBNativeToken = b.header === b.nativeCurrency || (b.header === 'Native' && b.nativeCurrency === 'ETH');

        if (isANativeToken && !isBNativeToken) return -1;
        if (!isANativeToken && isBNativeToken) return 1;

        // Если оба токена нативные или оба ERC-20, сортируем по заголовку токена
        return a.header.localeCompare(b.header);
      }).map(item => item.displayHeader);

      const csvHeader = [...walletColumns, ...sortedAllTokenHeaders];
      this.writeRow(csvHeader);

      // Записываем данные для каждого кошелька
      for (const [address, privateKey] of uniqueWallets.entries()) {
        const walletInfo = hasPrivateKeys 
          ? [address, privateKey || ""]
          : [address];
        
        const rowBalances: (string | number)[] = [];
        
        sortedAllTokenHeaders.forEach(displayHeader => {
          let foundBalance = "0";
          // Ищем баланс для текущего токена в нужной сети
          for (const netResult of allNetworksResults) {
            const networkName = CONFIG[netResult.network]?.NAME || netResult.network;
            // Определяем исходный заголовок токена из displayHeader
            const originalTokenHeader = displayHeader.replace(` (${networkName})`, '');
            
            const walletBalance = netResult.results.find(wb => wb.wallet.address === address);
            if (walletBalance) {
              // Находим токен по его originalTokenHeader или по его имени в Config.TOKENS
              const tokenAddressInConfig = Object.entries(CONFIG[netResult.network].TOKENS).find(([name]) => name === originalTokenHeader)?.[1];

              let balanceValue = "0";
              if (originalTokenHeader === CONFIG[netResult.network].NATIVE_CURRENCY || originalTokenHeader === "Native") {
                balanceValue = walletBalance.balances.get("native") || "0";
              } else if (tokenAddressInConfig) {
                balanceValue = walletBalance.balances.get(tokenAddressInConfig) || "0";
              } else {
                // Если заголовок не соответствует ни нативному, ни конфигу, ищем по тому, что пришло от чекера
                // Это может быть токен, у которого символ не совпал с названием в конфиге
                // Нам нужно найти соответствие между originalTokenHeader и фактическим символом токена, который вернул checker.getTokenHeaders()
                const checkerTokenIndex = netResult.tokenHeaders.indexOf(originalTokenHeader);
                if (checkerTokenIndex !== -1) {
                  const actualTokenAddress = CONFIG[netResult.network].COLUMNS[checkerTokenIndex];
                  balanceValue = walletBalance.balances.get(actualTokenAddress) || "0";
                }
              }
              
              if (parseFloat(balanceValue) > 0) {
                foundBalance = balanceValue;
                break; // Баланс найден, переходим к следующему заголовку
              }
            }
          }
          rowBalances.push(foundBalance);
        });
        this.writeRow([...walletInfo, ...rowBalances]);
      }
      
      this.addTotalRow(hasPrivateKeys, sortedAllTokenHeaders.length, uniqueWallets.size);

      await this.close();
      console.log(`✅ Сводные результаты по всем сетям сохранены в ${fullPath}`);

    } catch (error) {
      console.error("Ошибка при экспорте сводных данных в CSV:", error);
      throw error;
    }
  }

  private writeRow(data: (string | number)[]): void {
    if (!this.stream) return;
    
    this.rows.push(data);
    const line = data.join(this.CSV_DELIMITER) + "\n";
    this.stream.write(line);
  }

  private addTotalRow(hasPrivateKeys: boolean, tokenCount: number, totalWallets: number): void {
    if (this.rows.length < 2) return; 

    const dataRows = this.rows.slice(1); // Пропускаем заголовок
    const startColumn = hasPrivateKeys ? 2 : 1;
    
    const totals: (string | number)[] = [];
    
    totals.push("Total balance:");
    if (hasPrivateKeys) {
      totals.push("");
    }
    
    for (let colIndex = startColumn; colIndex < startColumn + tokenCount; colIndex++) {
      const sum = dataRows.reduce((acc, row) => {
        const value = parseFloat(row[colIndex] as string) || 0;
        return acc + value;
      }, 0);
      
      totals.push(sum.toFixed(6).replace(/\.?0+$/, ''));
    }

    this.stream?.write("\n");
    this.writeRow(totals);
  }

  private close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.stream) {
        resolve();
        return;
      }

      this.stream.close((err) => {
        if (err) reject(err); 
        else resolve();
      });
    });
  }
} 