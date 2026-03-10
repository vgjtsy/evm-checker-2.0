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
    // Настройка prompts для лучшего UX
    prompts.override({
      onCancel: () => {
        console.log(chalk.yellow('\n👋 Операция отменена пользователем'));
        process.exit(0);
      }
    });
  }

  // Красивый заголовок приложения
  showHeader(): void {
    console.clear();
    console.log(chalk.cyan.bold('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan.bold('║                        EVM CHECKER                          ║'));
    console.log(chalk.cyan.bold('║                  Проверка балансов кошельков                ║'));
    console.log(chalk.cyan.bold('╚══════════════════════════════════════════════════════════════╝'));
    console.log();
  }

  // Получить название сети
  private getNetworkName(network: Network): string {
    return CONFIG[network]?.NAME || network;
  }

  // Получить название нативной валюты
  private getNativeCurrency(network: Network): string {
    return CONFIG[network]?.NATIVE_CURRENCY || 'ETH';
  }

  // Простое меню выбора сети в алфавитном порядке
  async selectNetwork(): Promise<Network> {
    console.log(chalk.cyan('🌐 Выберите сеть для проверки:'));
    console.log();

    // Получаем все доступные сети и сортируем по алфавиту
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

    // Добавляем опцию выхода
    choices.push({ title: chalk.red("Выход"), value: "exit" });

    const response = await prompts({
      type: "autocomplete",
      name: "network",
      message: "Сеть (начните вводить название):",
      choices,
      suggest: async (input: string, choices: prompts.Choice[]) => {
        return choices.filter((choice: any) =>
          choice.title.toLowerCase().includes(input.toLowerCase()) ||
          (choice.value === "exit" && "выход".includes(input.toLowerCase()))
        );
      }
    });

    if (!response.network || response.network === "exit") {
      console.log(chalk.yellow("\n👋 До свидания!"));
      process.exit(0);
    }

    return response.network as Network;
  }

  // Выбор режима проверки: одна сеть или все
  async selectCheckMode(): Promise<{ mode: 'single' | 'all' }> {
    console.log(chalk.cyan('⚙️  Выберите режим проверки:'));
    console.log();

    const choices: prompts.Choice[] = [
      { title: 'Проверить ОДНУ сеть', value: 'single', description: 'Проверка балансов в одной выбранной сети' },
      { title: 'Проверить ВСЕ сети', value: 'all', description: 'Проверка балансов во всех доступных сетях' },
      { title: chalk.red("Выход"), value: "exit" }
    ];

    const response = await prompts({
      type: "select",
      name: "mode",
      message: "Режим:",
      choices,
      initial: 0,
    });

    if (!response.mode || response.mode === "exit") {
      console.log(chalk.yellow("\n👋 До свидания!"));
      process.exit(0);
    }

    return { mode: response.mode as 'single' | 'all' };
  }

  // Показать информацию о выбранной сети
  showNetworkInfo(network: Network, walletCount: number, tokenAddresses: string[]): void {
    console.log(chalk.blue('📊 Информация о проверке:'));
    console.log(chalk.gray('  ├─ Сеть:'), chalk.white.bold(this.getNetworkName(network)));
    console.log(chalk.gray('  ├─ Нативная валюта:'), chalk.green(this.getNativeCurrency(network)));
    console.log(chalk.gray('  ├─ Кошельков:'), chalk.yellow(walletCount.toLocaleString()));
    console.log(chalk.gray('  ├─ Токенов:'), chalk.cyan(tokenAddresses.length + 1)); // +1 для нативного
    console.log(chalk.gray('  └─ Всего проверок:'), chalk.magenta((walletCount * (tokenAddresses.length + 1)).toLocaleString()));
    console.log();
  }

  // Запуск прогресс-бара
  startProgress(message: string): void {
    this.spinner = ora({ text: message, spinner: 'dots12', color: 'cyan' }).start();
  }

  // Обновление прогресса
  updateProgress(info: ProgressInfo): void {
    if (!this.spinner) return;

    const percentage = Math.round((info.current / info.total) * 100);
    const progressBar = this.createProgressBar(percentage);

    let text = `${progressBar} ${percentage}% (${info.current}/${info.total})`;
    if (info.currentItem) text += ` - ${info.currentItem}`;
    if (info.details) text += ` ${chalk.gray(info.details)}`;

    this.spinner.text = text;
  }

  // Создание прогресс-бара
  private createProgressBar(percentage: number, width: number = 20): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return `[${chalk.green('█'.repeat(filled))}${chalk.gray('░'.repeat(empty))}]`;
  }

  // Успешное завершение
  succeedProgress(message: string): void {
    if (this.spinner) {
      this.spinner.succeed(chalk.green(message));
      this.spinner = null;
    }
  }

  // Ошибка
  failProgress(message: string): void {
    if (this.spinner) {
      this.spinner.fail(chalk.red(message));
      this.spinner = null;
    }
  }

  // Остановка прогресса
  stopProgress(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  // Показать детальную статистику
  showStatistics(stats: StatisticsInfo, network: Network): void {
    console.log();
    console.log(chalk.cyan.bold('📈 СТАТИСТИКА ПРОВЕРКИ'));
    console.log(chalk.cyan('═'.repeat(50)));

    // Основные метрики
    console.log(chalk.blue('📊 Основные метрики:'));
    console.log(chalk.gray('  ├─ Проверено кошельков:'), chalk.yellow(stats.totalWallets.toLocaleString()));
    console.log(chalk.gray('  ├─ Проверено токенов:'), chalk.cyan(stats.totalTokens));
    console.log(chalk.gray('  ├─ Всего проверок:'), chalk.magenta(stats.totalChecks.toLocaleString()));
    console.log(chalk.gray('  └─ Время выполнения:'), chalk.white(`${stats.duration.toFixed(2)} сек`));

    // Результаты
    console.log();
    console.log(chalk.green('💰 Результаты:'));
    console.log(chalk.gray('  ├─ Кошельков с балансом:'), chalk.green.bold(stats.walletsWithBalance.toLocaleString()));
    console.log(chalk.gray('  ├─ Процент активных:'), chalk.green(`${((stats.walletsWithBalance / stats.totalWallets) * 100).toFixed(1)}%`));
    console.log(chalk.gray('  └─ Ошибок:'), stats.errors > 0 ? chalk.red(stats.errors.toLocaleString()) : chalk.green('0'));

    // Производительность
    console.log();
    console.log(chalk.magenta('⚡ Производительность:'));
    const checksPerSecond = stats.totalChecks / stats.duration;
    console.log(chalk.gray('  ├─ Проверок в секунду:'), chalk.magenta.bold(checksPerSecond.toFixed(0)));
    console.log(chalk.gray('  └─ Сеть:'), chalk.white(this.getNetworkName(network)));
    console.log();
  }

  // Показать ошибку
  showError(message: string, error?: Error): void {
    console.log();
    console.log(chalk.red.bold('❌ ОШИБКА'));
    console.log(chalk.red(message));
    if (error) console.log(chalk.gray('Детали:'), chalk.red(error.message));
    console.log();
  }

  // Показать предупреждение
  showWarning(message: string): void {
    console.log(chalk.yellow('⚠️  ' + message));
  }

  // Показать информацию
  showInfo(message: string): void {
    console.log(chalk.blue('ℹ️  ' + message));
  }

  // Показать успех
  showSuccess(message: string): void {
    console.log(chalk.green('✅ ' + message));
  }

  // Подтверждение действия
  async confirm(message: string, initial: boolean = false): Promise<boolean> {
    const response = await prompts({
      type: 'confirm',
      name: 'confirmed',
      message: chalk.yellow(message),
      initial
    });
    return response.confirmed ?? false;
  }

  // Ввод текста
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