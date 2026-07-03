# EVM Checker 🐆

Fast multi-chain balance checker for EVM wallets. Checks native coins and ERC-20 tokens across **25+ networks** via Multicall3 — thousands of wallets in seconds, with USD valuation and clean CSV reports.

> Built by [@polydao](https://x.com/polydao) — follow for updates.

## Features

- ⚡ **Fast** — Multicall3 batching + parallel requests: ~1,000 wallets × 4 tokens on one network in ~6 seconds; all 25 networks in under a minute.
- 🌐 **25+ networks** — Ethereum, Arbitrum, Base, Optimism, Polygon, BNB, zkSync, Linea, Scroll, Blast, Berachain, ApeChain and more.
- 💵 **USD valuation** — prices from DefiLlama (free, no API key), a `Total USD` column per wallet and grand totals. One batched price request per run, no matter how many wallets you check.
- 🧹 **Dust filter** — a separate `*_nonzero.csv` with only funded wallets; optional USD threshold (`DUST_THRESHOLD_USD=5` → only wallets worth $5+).
- 📊 **Terminal summary** — top-10 wallets table with totals right in your terminal, no need to open the CSV.
- 🔁 **RPC failover** — every network has backup RPCs and switches automatically on errors; add your own (including private ones) via `.env`.
- 🛡️ **Honest errors** — if an RPC fails after all retries, the cell says `ERROR`, never a fake `0`. A funded wallet will never look empty.
- 🔒 **Safe input handling** — private keys are never printed to the console; addresses are checksum-validated and deduplicated.

## Installation

```bash
npm install
```

The `wallets.txt` file is created automatically.

## Quick Start

1. Put wallet addresses into `wallets.txt`, one per line (EVM addresses `0x...`, or private keys if you want them included in the results).
2. Run:

```bash
npm start              # interactive menu
npm start base         # check a single network
npm run arbitrum       # same, via npm script
npx tsx index.ts all   # check ALL networks at once
```

## Configuration

**All settings live in one editable file: [`config/settings.ts`](config/settings.ts)** — open it, change the values, done. Every option is documented inline. Full reference: [SETTINGS.md](SETTINGS.md).

`.env` is optional and overrides `settings.ts` at runtime (handy for private RPC keys you don't want in code).

### .env (optional)

Copy `.env.example` to `.env` and adjust:

- `BATCH_SIZE` — number of addresses per RPC request.
- `RETRY_ATTEMPTS` / `RETRY_DELAY` — retry handling for network errors (exponential backoff).
- `RPC_URL_[NETWORK]` — custom/private RPCs (e.g. `RPC_URL_ARBITRUM="..."`). Multiple URLs separated by commas act as automatic fallbacks.
- `ENABLE_USD_PRICES` — USD valuation via DefiLlama (default `true`).
- `DUST_THRESHOLD_USD` — dust filter for `*_nonzero.csv` (`0` = any non-zero balance).
- `MAX_CONCURRENT_REQUESTS` — concurrent RPC request limit per network (default `5`).
- `EXCLUDE_TESTNETS` / `ALL_NETWORKS_CONCURRENCY` — "all networks" mode: skip testnets (default `true`) and how many networks to check in parallel (default `3`).

📖 **Full list of every option, default, and range → [SETTINGS.md](SETTINGS.md)**

### Adding tokens

Open `config/networks.ts`, find your network in `NETWORKS_CONFIG` and add entries to its `TOKENS` object (`"SYMBOL": "contract address"`):

```typescript
[Network.ETHEREUM]: {
  NAME: "Ethereum",
  NATIVE_CURRENCY: "ETH",
  TOKENS: {
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0CE3606eB48",
    UNI: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
  }
},
```

Token symbols and decimals are detected automatically from the contract.

## Output

- `results/<network>.csv` — all wallets with balances and a `Total USD` column.
- `results/<network>_nonzero.csv` — only wallets that pass the dust filter.
- `results/all_networks_balances.csv` (+ `_nonzero`) — combined report for the "all networks" mode.
- A top-10 wallets summary table is printed in the terminal after each run.
- Cells marked `ERROR` mean the RPC failed after all retries — this is **not** a zero balance.

## Supported networks

Abstract, ApeChain, Arbitrum, Arbitrum Nova, Avalanche, Base, Base Sepolia, Berachain, Blast, BNB Chain, Celo, Ethereum, Ethereum Sepolia, Fantom, Gnosis, Gravity, Harmony, Ink, Kava, Linea, Manta Pacific, Mantle, Metis, Mode, Moonbeam, Moonriver, opBNB, Optimism, Polygon, PulseChain, Ronin, Scroll, Shape, Soneium, Sonic, Taiko, Unichain, World Chain, Zero, zkSync, Zora.

Which networks the `all` mode checks is controlled by the `allNetworksList` array at the top of [`config/settings.ts`](config/settings.ts) — comment out a line to skip it.

## Author

**polydao** — [x.com/polydao](https://x.com/polydao)

## License

MIT — see [LICENSE](LICENSE).
