# ⚙️ Settings Reference

Every configurable option in EVM Checker, in one place.

👉 **The single editable settings file is [`config/settings.ts`](config/settings.ts).** Open it, change the values, done — every option below lives there with inline comments.

Configuration layers (later overrides earlier):

1. **`config/settings.ts`** — the main config file. Your permanent setup.
2. **`.env`** (optional) — overrides `settings.ts` at runtime. Good for secrets like a private RPC key you don't want in code. Copy `.env.example` → `.env`.
3. **Real OS environment variables** — override `.env`, e.g. `DUST_THRESHOLD_USD=50 npx tsx index.ts base`.

This doc explains what every value means; `config/settings.ts` is where you actually change them. The `.env` variable names below map 1:1 to the fields in that file.

> Built by [@polydao](https://x.com/polydao)

---

## 1. `.env` variables

### Core

| Variable | Default | What it does |
|---|---|---|
| `DEFAULT_NETWORK` | *(unset)* | Network to check when you run `npm start` without an argument and without picking from the menu. E.g. `arbitrum`, `base`. Leave unset to always get the interactive menu. |
| `WALLETS_FILE` | `wallets.txt` | Path to the input file with wallet addresses / private keys (one per line). |
| `RESULTS_DIR` | `results` | Folder where CSV reports and `error_log.txt` are written. |

### Performance & reliability

| Variable | Default | Range | What it does |
|---|---|---|---|
| `BATCH_SIZE` | `200` | 1–∞ | How many addresses go into a single Multicall3 request. Higher = fewer requests but heavier per-call payload. If an RPC rejects large calls, lower this (e.g. `100`). |
| `MAX_CONCURRENT_REQUESTS` | `5` | ≥1 | Max simultaneous RPC requests **per network**. This is the main throttle protecting you from public-RPC rate limits. Raise it with private/paid RPCs; lower it (e.g. `2`–`3`) if you see rate-limit errors in `error_log.txt`. |
| `RETRY_ATTEMPTS` | `3` | ≥0 | How many times a failed batch is retried before the cell is marked `ERROR`. |
| `RETRY_DELAY` | `1000` | ≥0 (ms) | Base delay before the first retry. Uses **exponential backoff**: 1st retry waits `RETRY_DELAY`, 2nd waits `2×`, 3rd `4×`… So `1000` → 1s, 2s, 4s. |

### USD valuation & dust filter

| Variable | Default | What it does |
|---|---|---|
| `ENABLE_USD_PRICES` | `true` | Fetch token prices from DefiLlama and add a `Total USD` column. Set `false` to skip pricing entirely (no network calls to DefiLlama). One batched price request per run — independent of wallet count. |
| `DUST_THRESHOLD_USD` | `0` | Filter for the `*_nonzero.csv` file. `0` = include any wallet with a non-zero balance. `5` = only wallets worth **≥ $5**. Wallets holding a token with no known price are always kept (so you never miss money). The main CSV always contains everything regardless of this setting. |

### "All networks" mode

| Variable | Default | What it does |
|---|---|---|
| `EXCLUDE_TESTNETS` | `true` | Skip testnets (Base Sepolia, Ethereum Sepolia) in `all` mode. Set `false` to include them. |
| `ALL_NETWORKS_CONCURRENCY` | `3` | How many **networks** are checked in parallel in `all` mode. Each network still respects its own `MAX_CONCURRENT_REQUESTS`. Higher = faster full sweep but more total load; `3` is a safe default for public RPCs. |

### Logging & UI

| Variable | Default | What it does |
|---|---|---|
| `ENABLE_LOGGING` | `true` | Write RPC errors / retries to `results/error_log.txt`. |
| `ENABLE_PROGRESS_BAR` | `true` | Show the animated progress bar during a single-network check. |

### Custom RPCs (per network)

| Variable | Default | What it does |
|---|---|---|
| `RPC_URL_[NETWORK]` | *(built-in)* | Override the RPC(s) for a network. **Multiple URLs separated by commas** become an automatic fallback chain — the checker moves to the next one on error. |

Format: uppercase network id, dashes become underscores.

```env
RPC_URL_ARBITRUM="https://arb1.arbitrum.io/rpc"
RPC_URL_ARBITRUM_NOVA="https://nova.arbitrum.io/rpc"
RPC_URL_BASE="https://mainnet.base.org,https://base-rpc.publicnode.com,https://base.drpc.org"
RPC_URL_POLYGON="https://polygon-bor-rpc.publicnode.com"
```

Your custom URLs are tried **first**, then the built-in primary, then the built-in fallbacks. Best place to plug in a private/paid RPC (Alchemy, Infura, dRPC paid, etc.) for higher rate limits.

Valid network ids: `abstract`, `apechain`, `arbitrum`, `arbitrum-nova`, `avalanche`, `base`, `base-sepolia`, `berachain`, `blast`, `bnb`, `celo`, `ethereum`, `ethereum-sepolia`, `fantom`, `gnosis`, `harmony`, `linea`, `optimism`, `polygon`, `ronin`, `scroll`, `shape`, `soneium`, `unichain`, `zero`, `zksync`, `zora`. (In the variable name use underscores: `RPC_URL_ARBITRUM_NOVA`.)

---

## 2. Advanced tuning — also in `config/settings.ts`

These live in the same [`config/settings.ts`](config/settings.ts) file (grouped under `performance`, `usd`, `output`, `terminal`). Most people never touch them.

| Field in `settings.ts` | Default | What it does |
|---|---|---|
| `performance.rpcCallTimeoutMs` | `30000` | Per-request RPC timeout (ms). If an RPC doesn't answer in time, the client fails over to the next RPC. |
| `usd.priceFetchTimeoutMs` | `15000` | Timeout (ms) for the DefiLlama price request. |
| `usd.coinsPerRequest` | `80` | Max coins per DefiLlama request (keeps the URL length sane). With a huge number of tokens, prices auto-split into several requests. |
| `usd.priceApiUrl` | `https://coins.llama.fi/prices/current/` | Price API endpoint. |
| `terminal.topWalletsCount` | `10` | Number of wallets shown in the terminal summary table (CSV always has all). |
| `terminal.maxTokenColumns` | `6` | Max token columns shown in the terminal table so it fits on screen (CSV always has all). |
| `output.csvDelimiter` | `;` | Column separator in the CSV files. Change to `,` if your spreadsheet expects commas. |

A few low-level constants still live in source (rarely changed):

| Constant | Value | File | What it does |
|---|---|---|---|
| `TESTNETS` | Base Sepolia, Ethereum Sepolia | `services/AllNetworksChecker.ts` | Which networks count as testnets for `EXCLUDE_TESTNETS`. |
| `MULTICALL3_CONTRACT` | `0xcA11…CA11` | `types.ts` | Default Multicall3 address (same on almost every chain). Per-network overrides live in `config/networks.ts` (e.g. zkSync). |
| `DEFAULT_DECIMALS` | `18` | `types.ts` | Fallback decimals when a token's `decimals()` can't be read. |
| `BALANCE_ERROR` | `ERROR` | `types.ts` | The marker written into a CSV cell when an RPC fails after all retries (never a fake `0`). |

---

## 3. Per-network config (`config/networks.ts`)

Each network entry supports:

| Field | Required | What it does |
|---|---|---|
| `CHAIN_ID` | recommended | Explicit chain id — skips the `eth_chainId` handshake and avoids "failed to detect network" retry loops when an RPC is down. |
| `RPC_URL` | ✅ | Primary RPC endpoint. |
| `FALLBACK_RPC_URLS` | optional | Array of backup RPCs, tried in order after the primary fails. |
| `MULTICALL3_CONTRACT` | optional | Override the Multicall3 address for chains that use a non-standard one (e.g. zkSync). |
| `NAME` | ✅ | Human-readable network name (used in headers and reports). |
| `NATIVE_CURRENCY` | ✅ | Symbol of the native coin (`ETH`, `BNB`, `MATIC`, …). Drives native-token pricing. |
| `TOKENS` | optional | `{ "SYMBOL": "0xcontract" }` map of ERC-20 tokens to check. Symbols/decimals are still auto-detected on-chain; the config key is just a fallback label. |

---

*Made by [@polydao](https://x.com/polydao) — https://x.com/polydao*
