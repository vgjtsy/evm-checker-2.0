# EVM Checker 🐆

[🇬🇧 English Version](#english-version) | [🇷🇺 Русская версия](#русская-версия)

---

<a name="english-version"></a>
# 🇬🇧 English Version

## Installation

```bash
npm install
```
After running this command, the `wallets.txt` file will be created automatically.

## Configuration

### Configuration via .env (Optional)
The application supports a `.env` file for advanced settings. Copy `.env.example` to `.env` and modify the parameters if necessary:
- `BATCH_SIZE` - number of addresses in a single RPC request.
- `RETRY_ATTEMPTS` and `RETRY_DELAY` - delay management for network errors (uses exponential backoff).
- `RPC_URL_[NETWORK]` - custom private RPC setup (e.g., `RPC_URL_ARBITRUM="..."`).

### Preparing the Wallets File
1. Add wallet addresses to the `wallets.txt` file, one per line.
2. Formats supported:
   - EVM address (0x...)
   - Private key (if you want it included in the results)

### Configuring Tokens to Check
1. Navigate to the `config` folder.
2. Open the `networks.ts` file.
3. Inside, you will find the `NETWORKS_CONFIG` object, which contains configurations for all supported networks.
4. Find the network you need (e.g., `[Network.ETHEREUM]`) and locate the `TOKENS` field inside its configuration object.
    - The `TOKENS` field is an object where keys are **token symbols** and values are their **contract addresses**.
5. For each token you want to track, add a new `"TOKEN_SYMBOL": "CONTRACT_ADDRESS"` pair.
    - **Example:** Adding the `UNI` token to Ethereum:
        ```typescript
        [Network.ETHEREUM]: {
          NAME: "Ethereum",
          NATIVE_CURRENCY: "ETH",
          TOKENS: {
            USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0CE3606eB48",
            // Adding UNI token
            UNI: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", 
          }
        },
        ```

## Usage

The application supports two modes: checking one specific network or checking all available networks.

### Interactive Mode (Network/Mode Selection)
```bash
npm start
```
- Launches an interactive menu: "Check ONE network" or "Check ALL networks".
- If "Check ONE network" is selected, you will be prompted to choose a network from a list with convenient **autocomplete** (start typing the network name).
- Use the up/down arrows to navigate and press Enter to confirm.

### Running a Specific Network (via Argument)
```bash
npm start arbitrum    # for Arbitrum
npm start ethereum    # for Ethereum
npm start polygon     # for Polygon
npm start shape       # for Shape
# etc.
```

### Running ALL Networks (via Argument)
```bash
npm start all
```
- Starts balance checking for all available networks.
- Results will be saved into a single consolidated file.

## Results

1. After the check is complete, results are saved in the `results` folder.
2. **For a single network check (`npm start [network]`):**
    - The file is named after the network (e.g., `ethereum.csv`).
    - It uses `;` as a separator.
    - The last row contains the total sums for all tokens in that network.
3. **For checking all networks (`npm start all`):**
    - Results are saved in `all_networks_balances.csv`.
    - Columns format: First the wallet address (and private key if provided). Then token balances grouped by network (ETH-native networks first, followed by others). Inside each network, the native currency comes first, followed by ERC-20 tokens in alphabetical order.
    - The last row contains overall totals for all tokens and networks.

---

**Supported Networks (27):**

1. Abstract, 2. Apechain, 3. Arbitrum, 4. Arbitrum Nova, 5. Avalanche, 6. Base, 7. Base Sepolia, 8. Berachain, 9. Blast, 10. BNB, 11. Celo, 12. Ethereum, 13. Ethereum Sepolia, 14. Fantom, 15. Gnosis, 16. Harmony, 17. Linea, 18. Optimism, 19. Polygon, 20. Ronin, 21. Scroll, 22. Shape, 23. Soneium, 24. Unichain, 25. zkSync, 26. Zora, 27. Zero.

---

<br><br><br>

<a name="русская-версия"></a>
# 🇷🇺 Русская версия

## Установка

```bash
npm install
```
После запуска этой команды файл `wallets.txt` сам появится.

## Настройки

### Конфигурация через .env (Опционально)
Приложение поддерживает файл `.env` для тонкой настройки. Скопируйте `.env.example` в `.env` и при необходимости измените параметры:
- `BATCH_SIZE` - количество адресов в одном запросе к RPC.
- `RETRY_ATTEMPTS` и `RETRY_DELAY` - управление задержками при сетевых ошибках (используется экспоненциальная задержка).
- `RPC_URL_[СЕТЬ]` - установка приватных RPC (например, `RPC_URL_ARBITRUM="..."`).

### Подготовка файла с адресами
1. Добавьте в файл `wallets.txt` адреса кошельков, по одному на строку.
2. Формат адресов:
   - EVM-адрес (0x...)
   - Или приватный ключ (если хотите видеть его в результатах).

### Настройка токенов для проверки
1. Перейдите в папку `config`.
2. Откройте файл `networks.ts`.
3. Внутри этого файла вы найдете объект `NETWORKS_CONFIG`, который содержит конфигурации для всех поддерживаемых сетей.
4. Найдите нужную вам сеть (например, `[Network.ETHEREUM]`) и внутри её объекта конфигурации найдите поле `TOKENS`.
    - Поле `TOKENS` — это объект, где ключи — это **символы токенов**, а значения — их **адреса контрактов**.
5. Для каждого токена, который вы хотите отслеживать, добавьте новую пару `"СИМВОЛ_ТОКЕНА": "АДРЕС_КОНТРАКТА"`.
    - **Пример:** Если вы хотите добавить токен `UNI` в сеть Ethereum:
        ```typescript
        [Network.ETHEREUM]: {
          NAME: "Ethereum",
          NATIVE_CURRENCY: "ETH",
          TOKENS: {
            USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0CE3606eB48",
            // Добавляем токен UNI
            UNI: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", 
          }
        },
        ```

## Запуск

Приложение поддерживает два режима работы: проверка одной выбранной сети или проверка всех доступных сетей.

### Интерактивный режим (выбор сети/режима)
```bash
npm start
```
- Запустится интерактивное меню выбора режима: "Проверить ОДНУ сеть" или "Проверить ВСЕ сети".
- Если выбран режим "Проверить ОДНУ сеть", будет предложено выбрать сеть из списка с удобным **автодополнением** (начните вводить название сети).
- Используйте стрелки вверх/вниз для выбора, нажмите Enter для подтверждения.

### Запуск одной конкретной сети (через аргумент)
```bash
npm start arbitrum    # для Arbitrum
npm start ethereum    # для Ethereum
npm start polygon     # для Polygon
npm start shape       # для Shape
# и т.д.
```

### Запуск проверки ВСЕХ сетей (через аргумент)
```bash
npm start all
```
- Запустит проверку балансов для всех доступных сетей.
- Результаты будут сохранены в одном сводном файле.

## Результаты

1. После завершения проверки результаты сохранятся в папке `results`.
2. **Для проверки одной сети (`npm start [network]`):**
    - Файл будет назван по имени сети (например, `ethereum.csv`).
    - Формат CSV с разделителем `;`.
    - В конце таблицы будет строка с итогами по всем токенам для этой сети.
3. **Для проверки всех сетей (`npm start all`):**
    - Результаты будут сохранены в одном сводном файле `all_networks_balances.csv`.
    - **Формат столбцов:** Сначала указывается адрес кошелька (и приватный ключ). Затем идут столбцы с балансами токенов, сгруппированные по сети (сначала сети на ETH). Внутри каждой сети: сначала нативная валюта, затем токены по алфавиту.
    - В конце таблицы будет общая итоговая строка.

---

**Доступные сети (27):**

1. Abstract, 2. Apechain, 3. Arbitrum, 4. Arbitrum Nova, 5. Avalanche, 6. Base, 7. Base Sepolia, 8. Berachain, 9. Blast, 10. BNB, 11. Celo, 12. Ethereum, 13. Ethereum Sepolia, 14. Fantom, 15. Gnosis, 16. Harmony, 17. Linea, 18. Optimism, 19. Polygon, 20. Ronin, 21. Scroll, 22. Shape, 23. Soneium, 24. Unichain, 25. zkSync, 26. Zora, 27. Zero.