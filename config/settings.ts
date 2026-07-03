// ============================================================================
// ⚙️  EVM CHECKER — ALL SETTINGS IN ONE PLACE
// ============================================================================
//
// Edit the values below to configure the tool. Everything tunable lives here.
//
// Precedence: values here are the defaults. A `.env` file (if present) OVERRIDES
// them at runtime, and a real OS environment variable overrides `.env`. So use
// this file for your permanent setup, and `.env` / env vars for one-off runs or
// secrets (e.g. a private RPC key you don't want committed).
//
// RPC endpoints per network live in `config/networks.ts`, not here.
//
// by @polydao — https://x.com/polydao
// ============================================================================

export const SETTINGS = {
  // ==========================================================================
  // 🌐 NETWORKS CHECKED IN "ALL" MODE  (npx tsx index.ts all)
  // ==========================================================================
  // Comment out any line (add "//") to exclude that network from the `all` run.
  // Testnets are intentionally not listed here.
  // Add a new network to config/networks.ts first, then add its id here.
  // Leave the array EMPTY ([]) to auto-include every configured mainnet.
  allNetworksList: [
    "ethereum",
    "arbitrum",
    "arbitrum-nova",
    "optimism",
    "base",
    "polygon",
    "bnb",
    "opbnb",
    "avalanche",
    "zksync",
    "linea",
    "scroll",
    "blast",
    "mantle",
    "mode",
    "manta",
    "metis",
    "taiko",
    "worldchain",
    "ink",
    "unichain",
    "soneium",
    "zora",
    "zero",
    "shape",
    "abstract",
    "sonic",
    "fantom",
    "gnosis",
    "celo",
    "moonbeam",
    "moonriver",
    "kava",
    "harmony",
    "ronin",
    "apechain",
    "berachain",
    "gravity",
    "pulsechain",
  ],

  // --------------------------------------------------------------------------
  // Files
  // --------------------------------------------------------------------------

  // Input file with wallet addresses / private keys (one per line).
  walletsFile: "wallets.txt",

  // Folder for CSV reports and error_log.txt.
  resultsDir: "results",

  // Network checked by default when no argument is passed and no menu choice is
  // made. Empty string = always show the interactive menu.
  // Examples: "arbitrum", "base", "ethereum".
  defaultNetwork: "",

  // --------------------------------------------------------------------------
  // Performance & reliability
  // --------------------------------------------------------------------------
  performance: {
    // Addresses per Multicall3 request. Higher = fewer requests, heavier payload.
    // Lower to ~100 if an RPC rejects large calls.
    batchSize: 200,

    // Max simultaneous RPC requests PER NETWORK. Main throttle against public-RPC
    // rate limits. Raise with private/paid RPCs; lower to 2-3 if you see rate-limit
    // errors in error_log.txt.
    maxConcurrentRequests: 5,

    // How many times a failed batch is retried before the cell is marked "ERROR".
    retryAttempts: 3,

    // Base delay (ms) before the first retry. Exponential backoff: each retry
    // doubles the wait. 1000 -> 1s, 2s, 4s...
    retryDelay: 1000,

    // Per-request RPC timeout (ms). If an RPC doesn't answer in time, the client
    // fails over to the next RPC for that network.
    rpcCallTimeoutMs: 30_000,
  },

  // --------------------------------------------------------------------------
  // USD valuation & dust filter
  // --------------------------------------------------------------------------
  usd: {
    // Fetch token prices from DefiLlama and add a "Total USD" column.
    // false = no pricing, no calls to DefiLlama.
    enablePrices: true,

    // Filter for the *_nonzero.csv file:
    //   0 = any wallet with a non-zero balance
    //   5 = only wallets worth >= $5
    // The main CSV always contains everything. Wallets holding a token with no
    // known price are always kept (so you never miss money).
    dustThresholdUsd: 0,

    // Price API endpoint (DefiLlama, free, no key).
    priceApiUrl: "https://coins.llama.fi/prices/current/",

    // Timeout (ms) for the price request.
    priceFetchTimeoutMs: 15_000,

    // Max coins per price request (keeps the URL length sane; auto-splits above this).
    coinsPerRequest: 80,
  },

  // --------------------------------------------------------------------------
  // "All networks" mode (npx tsx index.ts all)
  // --------------------------------------------------------------------------
  allNetworks: {
    // Skip testnets (Base Sepolia, Ethereum Sepolia). false = include them.
    excludeTestnets: true,

    // How many NETWORKS to check in parallel. Each network still respects
    // maxConcurrentRequests. Higher = faster sweep but more total load.
    concurrency: 3,
  },

  // --------------------------------------------------------------------------
  // CSV output
  // --------------------------------------------------------------------------
  output: {
    // Column separator in CSV files. Use "," if your spreadsheet expects commas.
    csvDelimiter: ";",
  },

  // --------------------------------------------------------------------------
  // Terminal summary table
  // --------------------------------------------------------------------------
  terminal: {
    // Number of wallets shown in the summary table (CSV always has all).
    topWalletsCount: 10,

    // Max token columns shown so the table fits on screen (CSV always has all).
    maxTokenColumns: 6,
  },

  // --------------------------------------------------------------------------
  // Logging & UI
  // --------------------------------------------------------------------------
  logging: {
    // Write RPC errors / retries to results/error_log.txt.
    enableLogging: true,

    // Show the animated progress bar during a single-network check.
    enableProgressBar: true,
  },
};

export type Settings = typeof SETTINGS;
