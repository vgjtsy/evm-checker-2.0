import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import { Network } from '../types';
import { CONFIG } from '../config';

export interface ProgressInfo {
  current: number;
  total: number;
  currentItem?: string;
  details?: string;
}

export interface StatisticsInfo {
  totalWallets: number;
  totalTokens: number;
  totalChecks: number;
  walletsWithBalance: number;
  duration: number;
  errors: number;
}

export class UIService {
  private spinner: any | null = null;

  constructor() {
    prompts.override({
      onCancel: () => {
        console.log(chalk.yellow('\n👋 Cancelled by user'));
        process.exit(0);
      }
    });
  }

  // Application header
  showHeader(): void {
    console.clear();
    console.log(chalk.cyan.bold('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan.bold('║                         EVM CHECKER                          ║'));
    console.log(chalk.cyan.bold('║                  Multi-chain balance checker                 ║'));
    console.log(chalk.cyan.bold('╚══════════════════════════════════════════════════════════════╝'));
    console.log(chalk.gray('              by ') + chalk.cyan('@polydao') + chalk.gray(' — https://x.com/polydao'));
    console.log();
  }

  private getNetworkName(network: Network): string {
    return CONFIG[network]?.NAME || network;
  }

  private getNativeCurrency(network: Network): string {
    return CONFIG[network]?.NATIVE_CURRENCY || 'ETH';
  }

  // Network selection menu (alphabetical, with autocomplete)
  async selectNetwork(): Promise<Network> {
    console.log(chalk.cyan('🌐 Select a network to check:'));
    console.log();

    const availableNetworks = Object.values(Network)
      .filter(network => CONFIG[network])
      .sort((a, b) => this.getNetworkName(a).localeCompare(this.getNetworkName(b)));

    const choices: prompts.Choice[] = availableNetworks.map(network => {
      const name = this.getNetworkName(network);

      return {
        title: name,
        value: network,
      };
    });

    choices.push({ title: chalk.red("Exit"), value: "exit" });

    const response = await prompts({
      type: "autocomplete",
      name: "network",
      message: "Network (start typing to filter):",
      choices,
      suggest: async (input: string, choices: prompts.Choice[]) => {
        return choices.filter((choice: any) =>
          choice.title.toLowerCase().includes(input.toLowerCase()) ||
          (choice.value === "exit" && "exit".includes(input.toLowerCase()))
        );
      }
    });

    if (!response.network || response.network === "exit") {
      console.log(chalk.yellow("\n👋 Goodbye!"));
      process.exit(0);
    }

    return response.network as Network;
  }

  // Check mode selection: single network or all networks
  async selectCheckMode(): Promise<{ mode: 'single' | 'all' }> {
    console.log(chalk.cyan('⚙️  Select check mode:'));
    console.log();

    const choices: prompts.Choice[] = [
      { title: 'Check ONE network', value: 'single', description: 'Check balances on a single selected network' },
      { title: 'Check ALL networks', value: 'all', description: 'Check balances on all available networks' },
      { title: chalk.red("Exit"), value: "exit" }
    ];

    const response = await prompts({
      type: "select",
      name: "mode",
      message: "Mode:",
      choices,
      initial: 0,
    });

    if (!response.mode || response.mode === "exit") {
      console.log(chalk.yellow("\n👋 Goodbye!"));
      process.exit(0);
    }

    return { mode: response.mode as 'single' | 'all' };
  }

  // Info about the upcoming check
  showNetworkInfo(network: Network, walletCount: number, tokenAddresses: string[]): void {
    console.log(chalk.blue('📊 Check details:'));
    console.log(chalk.gray('  ├─ Network:'), chalk.white.bold(this.getNetworkName(network)));
    console.log(chalk.gray('  ├─ Native currency:'), chalk.green(this.getNativeCurrency(network)));
    console.log(chalk.gray('  ├─ Wallets:'), chalk.yellow(walletCount.toLocaleString()));
    console.log(chalk.gray('  ├─ Tokens:'), chalk.cyan(tokenAddresses.length + 1)); // +1 for native
    console.log(chalk.gray('  └─ Total checks:'), chalk.magenta((walletCount * (tokenAddresses.length + 1)).toLocaleString()));
    console.log();
  }

  startProgress(message: string): void {
    this.spinner = ora({ text: message, spinner: 'dots12', color: 'cyan' }).start();
  }

  updateProgress(info: ProgressInfo): void {
    if (!this.spinner) return;

    const percentage = Math.round((info.current / info.total) * 100);
    const progressBar = this.createProgressBar(percentage);

    let text = `${progressBar} ${percentage}% (${info.current}/${info.total})`;
    if (info.currentItem) text += ` - ${info.currentItem}`;
    if (info.details) text += ` ${chalk.gray(info.details)}`;

    this.spinner.text = text;
  }

  private createProgressBar(percentage: number, width: number = 20): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return `[${chalk.green('█'.repeat(filled))}${chalk.gray('░'.repeat(empty))}]`;
  }

  succeedProgress(message: string): void {
    if (this.spinner) {
      this.spinner.succeed(chalk.green(message));
      this.spinner = null;
    }
  }

  failProgress(message: string): void {
    if (this.spinner) {
      this.spinner.fail(chalk.red(message));
      this.spinner = null;
    }
  }

  stopProgress(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  // Detailed statistics
  showStatistics(stats: StatisticsInfo, network: Network): void {
    console.log();
    console.log(chalk.cyan.bold('📈 CHECK STATISTICS'));
    console.log(chalk.cyan('═'.repeat(50)));

    console.log(chalk.blue('📊 Metrics:'));
    console.log(chalk.gray('  ├─ Wallets checked:'), chalk.yellow(stats.totalWallets.toLocaleString()));
    console.log(chalk.gray('  ├─ Tokens checked:'), chalk.cyan(stats.totalTokens));
    console.log(chalk.gray('  ├─ Total checks:'), chalk.magenta(stats.totalChecks.toLocaleString()));
    console.log(chalk.gray('  └─ Duration:'), chalk.white(`${stats.duration.toFixed(2)}s`));

    console.log();
    console.log(chalk.green('💰 Results:'));
    console.log(chalk.gray('  ├─ Wallets with balance:'), chalk.green.bold(stats.walletsWithBalance.toLocaleString()));
    console.log(chalk.gray('  ├─ Active wallets:'), chalk.green(`${((stats.walletsWithBalance / stats.totalWallets) * 100).toFixed(1)}%`));
    console.log(chalk.gray('  └─ Errors:'), stats.errors > 0 ? chalk.red(stats.errors.toLocaleString()) : chalk.green('0'));

    console.log();
    console.log(chalk.magenta('⚡ Performance:'));
    const checksPerSecond = stats.totalChecks / stats.duration;
    console.log(chalk.gray('  ├─ Checks per second:'), chalk.magenta.bold(checksPerSecond.toFixed(0)));
    console.log(chalk.gray('  └─ Network:'), chalk.white(this.getNetworkName(network)));
    console.log();
  }

  // Terminal summary table (top wallets, totals)
  showSummaryTable(options: {
    title: string;
    headers: string[];
    rows: string[][];
    footer?: string[];
  }): void {
    const { title, headers, rows, footer } = options;

    const allRows = [headers, ...rows, ...(footer ? [footer] : [])];
    const widths = headers.map((_, col) =>
      Math.max(...allRows.map(row => (row[col] ?? '').length))
    );

    // First column left-aligned, numeric columns right-aligned
    const pad = (cell: string, col: number) =>
      col === 0 ? cell.padEnd(widths[col]) : cell.padStart(widths[col]);

    const renderRow = (cells: string[], colorize: (cell: string, col: number) => string) =>
      '  ' + cells.map((cell, col) => colorize(pad(cell ?? '', col), col)).join('  ');

    const totalWidth = widths.reduce((a, b) => a + b, 0) + widths.length * 2;

    console.log();
    console.log(chalk.cyan.bold(title));
    console.log(chalk.cyan('─'.repeat(Math.min(totalWidth, 120))));
    console.log(renderRow(headers, cell => chalk.white.bold(cell)));
    console.log(chalk.gray('─'.repeat(Math.min(totalWidth, 120))));

    rows.forEach(row => {
      console.log(renderRow(row, (cell, col) => {
        if (col === 0) return chalk.white(cell);
        const trimmed = cell.trim();
        if (trimmed === '0' || trimmed === '$0.00' || trimmed === '-') return chalk.gray(cell);
        if (trimmed === 'ERROR') return chalk.red(cell);
        if (trimmed.startsWith('$')) return chalk.yellow.bold(cell);
        return chalk.green(cell);
      }));
    });

    if (footer) {
      console.log(chalk.gray('─'.repeat(Math.min(totalWidth, 120))));
      console.log(renderRow(footer, cell => chalk.yellow.bold(cell)));
    }
    console.log();
  }

  showError(message: string, error?: Error): void {
    console.log();
    console.log(chalk.red.bold('❌ ERROR'));
    console.log(chalk.red(message));
    if (error) console.log(chalk.gray('Details:'), chalk.red(error.message));
    console.log();
  }

  showWarning(message: string): void {
    console.log(chalk.yellow('⚠️  ' + message));
  }

  showInfo(message: string): void {
    console.log(chalk.blue('ℹ️  ' + message));
  }

  showSuccess(message: string): void {
    console.log(chalk.green('✅ ' + message));
  }

  async confirm(message: string, initial: boolean = false): Promise<boolean> {
    const response = await prompts({
      type: 'confirm',
      name: 'confirmed',
      message: chalk.yellow(message),
      initial
    });
    return response.confirmed ?? false;
  }

  async input(message: string, initial?: string): Promise<string> {
    const response = await prompts({
      type: 'text',
      name: 'value',
      message: chalk.yellow(message),
      initial
    });
    return response.value ?? '';
  }
}
