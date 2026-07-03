import { Network } from "../types";
import { CONFIG } from "../config";
import { SETTINGS } from "../config/settings";

// DefiLlama chain slugs (https://coins.llama.fi). Testnets are absent — they have no prices.
const LLAMA_CHAIN_SLUGS: Partial<Record<Network, string>> = {
  [Network.ABSTRACT]: "abstract",
  [Network.APECHAIN]: "apechain",
  [Network.ARBITRUM]: "arbitrum",
  [Network.ARBITRUM_NOVA]: "arbitrum_nova",
  [Network.AVALANCHE]: "avax",
  [Network.BASE]: "base",
  [Network.BERACHAIN]: "berachain",
  [Network.BLAST]: "blast",
  [Network.BNB]: "bsc",
  [Network.CELO]: "celo",
  [Network.ETHEREUM]: "ethereum",
  [Network.FANTOM]: "fantom",
  [Network.GNOSIS]: "xdai",
  [Network.HARMONY]: "harmony",
  [Network.LINEA]: "linea",
  [Network.OPTIMISM]: "optimism",
  [Network.POLYGON]: "polygon",
  [Network.RONIN]: "ronin",
  [Network.SCROLL]: "scroll",
  [Network.SHAPE]: "shape",
  [Network.SONEIUM]: "soneium",
  [Network.UNICHAIN]: "unichain",
  [Network.ZKSYNC]: "era",
  [Network.ZORA]: "zora",
  [Network.ZERO]: "zero_network",
  [Network.MANTLE]: "mantle",
  [Network.METIS]: "metis",
  [Network.MODE]: "mode",
  [Network.OPBNB]: "op_bnb",
  [Network.MOONBEAM]: "moonbeam",
  [Network.MOONRIVER]: "moonriver",
  [Network.KAVA]: "kava",
  [Network.MANTA]: "manta",
  [Network.PULSECHAIN]: "pulse",
  [Network.SONIC]: "sonic",
  [Network.TAIKO]: "taiko",
  [Network.WORLDCHAIN]: "wc",
  [Network.INK]: "ink",
  [Network.GRAVITY]: "gravity",
};

// CoinGecko ids for native currencies (DefiLlama accepts coingecko:<id> keys)
const NATIVE_COINGECKO_IDS: Record<string, string> = {
  ETH: "ethereum",
  BNB: "binancecoin",
  MATIC: "matic-network",
  POL: "polygon-ecosystem-token",
  AVAX: "avalanche-2",
  FTM: "fantom",
  CELO: "celo",
  xDAI: "xdai",
  APE: "apecoin",
  BERA: "berachain-bera",
  ONE: "harmony",
  RON: "ronin",
  MNT: "mantle",
  METIS: "metis-token",
  GLMR: "moonbeam",
  MOVR: "moonriver",
  KAVA: "kava",
  PLS: "pulsechain",
  S: "sonic-3",
  G: "g-token",
};

const PRICE_API_URL = SETTINGS.usd.priceApiUrl;
const FETCH_TIMEOUT_MS = SETTINGS.usd.priceFetchTimeoutMs;
// Coins per request cap — keeps the URL at a reasonable length
const COINS_PER_REQUEST = SETTINGS.usd.coinsPerRequest;

/**
 * Token prices via DefiLlama (free, no API key).
 * The number of requests depends ONLY on the number of tokens in the config,
 * not on the number of wallets: with the current config that's a single
 * HTTP request per run — whether you check 1,000 or 100,000 wallets.
 */
export class PriceService {
  // key: `${network}:${"native"|lowercase address}` -> USD price
  private prices = new Map<string, number>();
  private fetched = false;

  static priceKey(network: Network, token: string): string {
    return `${network}:${token.toLowerCase()}`;
  }

  /** true if prices were fetched successfully */
  isAvailable(): boolean {
    return this.fetched;
  }

  getPrice(network: Network, token: string): number | undefined {
    return this.prices.get(PriceService.priceKey(network, token));
  }

  /**
   * Fetches prices for native currencies and all configured tokens of the
   * given networks. Throws on API errors — the caller shows a warning and
   * continues without USD.
   */
  async fetchPrices(networks: Network[]): Promise<void> {
    // llamaCoinId -> list of our keys (multiple ETH networks share coingecko:ethereum)
    const coinToKeys = new Map<string, string[]>();

    const addCoin = (coinId: string, key: string) => {
      const keys = coinToKeys.get(coinId) || [];
      keys.push(key);
      coinToKeys.set(coinId, keys);
    };

    for (const network of networks) {
      const networkConfig = CONFIG[network];
      if (!networkConfig) continue;

      const nativeCurrency = networkConfig.NATIVE_CURRENCY || "ETH";
      const geckoId = NATIVE_COINGECKO_IDS[nativeCurrency];
      if (geckoId) {
        addCoin(`coingecko:${geckoId}`, PriceService.priceKey(network, "native"));
      }

      const slug = LLAMA_CHAIN_SLUGS[network];
      if (slug) {
        for (const address of Object.values(networkConfig.TOKENS)) {
          addCoin(`${slug}:${address.toLowerCase()}`, PriceService.priceKey(network, address));
        }
      }
    }

    const coinIds = [...coinToKeys.keys()];
    if (coinIds.length === 0) {
      this.fetched = true;
      return;
    }

    for (let i = 0; i < coinIds.length; i += COINS_PER_REQUEST) {
      const chunk = coinIds.slice(i, i + COINS_PER_REQUEST);
      const response = await this.fetchWithTimeout(PRICE_API_URL + chunk.join(","));

      const data = (await response.json()) as {
        coins: Record<string, { price: number }>;
      };

      for (const [coinId, info] of Object.entries(data.coins || {})) {
        if (typeof info?.price !== "number") continue;
        for (const key of coinToKeys.get(coinId) || []) {
          this.prices.set(key, info.price);
        }
      }
    }

    this.fetched = true;
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`DefiLlama API: HTTP ${response.status}`);
      }
      return response;
    } finally {
      clearTimeout(timer);
    }
  }
}
