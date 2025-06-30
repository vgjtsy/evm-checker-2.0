import { Network } from "../types";

// Единая конфигурация всех сетей
export const NETWORKS_CONFIG = {
  [Network.ABSTRACT]: {
    RPC_URL: "https://api.mainnet.abs.xyz",
    NAME: "Abstract",
    NATIVE_CURRENCY: "ETH",
    TOKENS: {
      
    }
  },

  [Network.APECHAIN]: {
    RPC_URL: "https://rpc.apechain.com",
    NAME: "ApeChain",
    NATIVE_CURRENCY: "APE",
    TOKENS: {}
  },

  [Network.ARBITRUM]: {
    RPC_URL: "https://arbitrum-one.public.blastapi.io",
    NAME: "Arbitrum",
    NATIVE_CURRENCY: "ETH",
    TOKENS: {
      USDC: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
      USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      // DAI: "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1",
      // ARB: "0x912ce59144191c1204e64559fe8253a0e49e6548",
      WETH: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
    }
  },

  [Network.ARBITRUM_NOVA]: {
    RPC_URL: "https://arbitrum-nova.public.blastapi.io",
    NAME: "Arbitrum Nova",
    NATIVE_CURRENCY: "ETH",
    TOKENS: {
      USDC: "0x750ba8b76187092b0d1e87e28daaf484d1b5273b",
      DAI: "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1",
      ARB: "0xf823c3cd3cebe0a1fa952ba88dc9eef8e0bf46ad",
    }
  },

  [Network.AVALANCHE]: {
    RPC_URL: "https://ava-mainnet.public.blastapi.io/ext/bc/C/rpc",
    NAME: "Avalanche",
    NATIVE_CURRENCY: "AVAX",
    TOKENS: {
      // USDC: "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e",
      // USDT: "0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7",
      NFT: "0xd38a5dd253e9819722f6a22d09dfe994b79fec9f",
      // EURA: "0xaec8318a9a59baeb39861d10ff6c7f7bf1f96c57",
      // LZagEUR: "0x14c00080f97b9069ae3b4eb506ee8a633f8f5434",
    }
  },

  [Network.BASE]: {
    RPC_URL: "https://base-mainnet.public.blastapi.io",
    NAME: "Base",
    NATIVE_CURRENCY: "ETH",
    TOKENS: {
      WETH: "0x4200000000000000000000000000000000000006",
      // USDC: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      // mWETH: "0x628ff693426583d9a7fb391e54366292f509d457",
      // aBasWETH: "0xd4a0e0b9149bcee3c920d2e00b5de09138fd8bb7",
      // cWETHv3: "0x46e6b214b524310239732d51387075e0e70970bf",
      // aBaseWETH: "0x48bf8fcd44e2977c8a9a744658431a8e6c0d866c", 
      // KAITO: "0x98d0baa52b2d063e780de12f615f963fe8537553",
      IBGT: "0x2c3f2ce253e04cc01b1c91d23c1161f6e8674059",
    }
  },

  [Network.BASE_GOERLI]: {
    RPC_URL: "https://base-goerli.public.blastapi.io",
    NAME: "Base Goerli",
    NATIVE_CURRENCY: "ETH",
    TOKENS: {
      USDC: "0xf175520c52418dfe19c8098071a252da48cd1c19",
      BASEBUILDER: "0xac6564f3718837caadd42eed742d75c12b90a052",
    }
  },

  [Network.BASE_SEPOLIA]: {
    RPC_URL: "https://sepolia.base.org",
    NAME: "Base Sepolia",
    NATIVE_CURRENCY: "ETH",
    TOKENS: {
      USDC: "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
      WETH: "0x4200000000000000000000000000000000000006",
      NFT_BASECAMP_1: "0x075eB9Dc52177Aa3492E1D26f0fDE3d729625d2F",
      NFT_BASECAMP_2: "0xF4D953A3976F392aA5509612DEfF395983f22a84",
      NFT_BASECAMP_3: "0x567452C6638c0D2D9778C20a3D59749FDCaa7aB3",
      NFT_BASECAMP_4: "0x5B0F80cA6f5bD60Cc3b64F0377f336B2B2A56CdF",
      NFT_BASECAMP_5: "0xD32E3ACe3272e2037003Ca54CA7E5676f9b8D06C",
      NFT_BASECAMP_6: "0x9eB1Fa4cD9bd29ca2C8e72217a642811c1F6176d",
      NFT_BASECAMP_7: "0xF90dA05e77a33Fe6D64bc2Df84e7dd0069A2111C",
      NFT_BASECAMP_8: "0x8dD188Ec36084D59948F90213AFCd04429E33c0c",
      NFT_BASECAMP_9: "0xC1BD0d9A8863f2318001BC5024c7f5F58a2236F7",
      NFT_BASECAMP_10: "0x4f21e69d0CDE8C21cF82a6b37Dda5444716AFA46",
      NFT_BASECAMP_12: "0x4F333c49B820013e5E6Fe86634DC4Da88039CE50",
      NFT_BASECAMP_13: "0x15534ED3d1dBA55148695B2Ba4164F147E47a10c",
    }
  },

  [Network.BERACHAIN]: {
    RPC_URL: "https://berachain-rpc.publicnode.com",
    NAME: "Berachain",
    NATIVE_CURRENCY: "BERA",
    TOKENS: {
      IBGT: "0xac03caba51e17c86c921e1f6cbfbdc91f8bb2e6b",
      WBERA: "0x6969696969696969696969696969696969696969",
      HONEY: "0xfcbd14dc51f0a4d49d5e53c2e0950e0bc26d0dce",
    }
  },

  [Network.BLAST]: {
    RPC_URL: "https://blastl2-mainnet.public.blastapi.io",
    NAME: "Blast",
    NATIVE_CURRENCY: "ETH",
    TOKENS: {
      USDB: "0x4300000000000000000000000000000000000003",
      WETH: "0x4300000000000000000000000000000000000004",
      BLAST: "0xb1a5700fa2358173fe465e6ea4ff52e36e88e2ad",
    }
  },

  [Network.BNB]: {
    RPC_URL: "https://bsc-mainnet.public.blastapi.io",
    NAME: "BNB Chain",
    NATIVE_CURRENCY: "BNB",
    TOKENS: {
      USDT: "0x55d398326f99059ff775485246999027b3197955",
      USDC: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
      WBNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
      EURA: "0x12f31b73d812c6bb0d735a218c086d44d5fe5f89",
    }
  },

  [Network.CELO]: {
    RPC_URL: "https://celo.drpc.org",
    NAME: "Celo",
    NATIVE_CURRENCY: "CELO",
    TOKENS: {
      EURA: "0xc16b81af351ba9e64c1a069e3ab18c244a1e3049",
      agEURA: "0xf1dDcACA7D17f8030Ab2eb54f2D9811365EFe123",
    }
  },

  [Network.ETHEREUM]: {
    RPC_URL: "https://eth.drpc.org",
    NAME: "Ethereum",
    NATIVE_CURRENCY: "ETH",
    TOKENS: {
      // USDC: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      // USDT: "0xdac17f958d2ee523a2206206994597c13d831ec7",
      // DAI: "0x6b175474e89094c44da98b954eedeac495271d0f",
    }
  },

  [Network.ETHEREUM_SEPOLIA]: {
    RPC_URL: "https://ethereum-sepolia.publicnode.com",
    NAME: "Ethereum Sepolia",
    NATIVE_CURRENCY: "ETH",
    TOKENS: {
      USDC: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238",
    }
  },

  [Network.FANTOM]: {
    RPC_URL: "https://fantom-mainnet.public.blastapi.io",
    NAME: "Fantom",
    NATIVE_CURRENCY: "FTM",
    TOKENS: {
      USDC: "0x04068da6c83afcfa0e13ba15a6696662335d5b75",
      USDT: "0x049d68029688eabf473097a2fc38ef61633a3c7a",
      DAI: "0x8d11ec38a3eb5e956b052f67da8bdc9bef8abf3e",
      WFTM: "0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83",
    }
  },

  [Network.GNOSIS]: {
    RPC_URL: "https://gnosis-mainnet.public.blastapi.io",
    NAME: "Gnosis",
    NATIVE_CURRENCY: "xDAI",
    TOKENS: {
      EURA: "0x4b1e2c2762667331bc91648052f646d1b0d35984",
    }
  },

  [Network.HARMONY]: {
    RPC_URL: "https://1rpc.io/one",
    NAME: "Harmony",
    NATIVE_CURRENCY: "ONE",
    TOKENS: {

    }
  },

  [Network.LINEA]: {
    RPC_URL: "https://linea-mainnet.public.blastapi.io",
    NAME: "Linea",
    NATIVE_CURRENCY: "ETH",
    TOKENS: {
      USDC: "0x176211869ca2b568f2a7d4ee941e073a821ee1ff",
      USDT: "0xa219439258ca9da29e9cc4ce5596924745e12b93",
      LXP: "0xd83af4fbd77f3ab65c3b1dc4b38d7e67aecf599a",
      WETH: "0xe5d7c2a44ffddf6b295a15c148167daaaf5cf34f",
      WBTC: "0x3aab2285ddcddad8edf438c1bab47e1a9d05a9b4",
    }
  },

  [Network.MEGAETH]: {
    RPC_URL: "https://carrot.megaeth.com/rpc",
    NAME: "MegaETH",
    NATIVE_CURRENCY: "ETH",
    TOKENS: {

    }
  },

  [Network.MONAD_TESTNET]: {
    RPC_URL: "https://testnet-rpc.monad.xyz",
    NAME: "Monad Testnet",
    NATIVE_CURRENCY: "MON",
    TOKENS: {
      CHOG: "0xE0590015A873bF326bd645c3E1266d4db41C4E6B",
      YAKI: "0xfe140e1dCe99Be9F4F15d657CD9b7BF622270C50",
      DAK: "0x0F0BDEbF0F83cD1EE3974779Bcb7315f9808c714",
      WETH: "0x836047a99e11F376522B447bffb6e3495Dd0637c",
    }
  },

  [Network.OPTIMISM]: {
    RPC_URL: "https://optimism-mainnet.public.blastapi.io",
    NAME: "Optimism",
    NATIVE_CURRENCY: "ETH",
    TOKENS: {
      // USDC: "0x7f5c764cbc14f9669b88837ca1490cca17c31607",
      // USDT: "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58",
      // DAI: "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1",
      // OP: "0x4200000000000000000000000000000000000042",
      // WETH: "0x4200000000000000000000000000000000000006",
    }
  },

  [Network.POLYGON]: {
    RPC_URL: "https://polygon-mainnet.public.blastapi.io",
    NAME: "Polygon",
    NATIVE_CURRENCY: "MATIC",
    TOKENS: {
      USDC: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
      USDT: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
      EURA: "0xe0b52e49357fd4daf2c15e02058dce6bc0057db4",
      LZagEUR: "0x0c1ebbb61374da1a8c57cb6681bf27178360d36f",
    }
  },

  [Network.POLYGON_ZKEVM]: {
    RPC_URL: "https://polygon-zkevm-mainnet.public.blastapi.io",
    NAME: "Polygon zkEVM",
    NATIVE_CURRENCY: "ETH",
    TOKENS: {
    }
  },

  [Network.RONIN]: {
    RPC_URL: "https://api.roninchain.com/rpc",
    NAME: "Ronin",
    NATIVE_CURRENCY: "RON",
    TOKENS: {
      WRON: "0xe514d9deb7966c8be0ca922de8a064264ea6bcd4",
      AXS: "0x97a9107c1793bc407d6f527b77e7fff4d812bece",
      SLP: "0xa8754b9fa15fc18bb59458815510e40a12cd2014",
    }
  },

  [Network.SCROLL]: {
    RPC_URL: "https://scroll-mainnet.public.blastapi.io",
    NAME: "Scroll",
    NATIVE_CURRENCY: "ETH",
    TOKENS: {
      USDC: "0x06efdbff2a14a7c8e15944d1f4a48f9f95f663a4",
      USDT: "0xf55bec9cafdbe8730f096aa55dad6d22d44099df",
      DAI: "0xca77eb3fefe3725dc33bccb54edefc3d9f764f97",
      WETH: "0x5300000000000000000000000000000000000004",
    }
  },

  [Network.SHAPE]: {
    RPC_URL: "https://mainnet.shape.network",
    NAME: "Shape",
    NATIVE_CURRENCY: "ETH",
    TOKENS: {
    }
  },

  [Network.SONEIUM]: {
    RPC_URL: "https://rpc.soneium.org",
    NAME: "Soneium",
    NATIVE_CURRENCY: "ETH",
    TOKENS: {
      WETH: "0x4200000000000000000000000000000000000006",
    }
  },

  [Network.UNICHAIN]: {
    RPC_URL: "https://unichain-rpc.publicnode.com",
    NAME: "Unichain",
    NATIVE_CURRENCY: "ETH",
    TOKENS: {
      UNI: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
    }
  },

  [Network.XTERIO]: {
    RPC_URL: "https://xterio.alt.technology",
    NAME: "Xterio",
    NATIVE_CURRENCY: "BNB",
    TOKENS: {
    }
  },

  [Network.ZKSYNC]: {
    RPC_URL: "https://zksync-mainnet.public.blastapi.io",
    NAME: "zkSync",
    NATIVE_CURRENCY: "ETH",
    MULTICALL3_CONTRACT: "0x47898B2C52C957663aE9AB46922dCec150a2272c",
    TOKENS: {
      USDC: "0x3355df6d4c9c3035724fd0e3914de96a5a83aaf4",
      USDT: "0x493257fd37edb34451f62edf8d2a0c418852ba4c",
      DAI: "0x4b9eb6c0b6ea15176bbf62841c6b2a8a398cb656",
      WETH: "0xf00DAD97284D0c6F06dc4Db3c32454D4292c6813",
      WBTC: "0xbbeb516fb02a01611cbbe0453fe3c580d7281011",
    }
  },

  [Network.ZORA]: {
    RPC_URL: "https://rpc.zerion.io/v1/zora",
    NAME: "Zora",
    NATIVE_CURRENCY: "ETH",
    TOKENS: {
      WETH: "0x4200000000000000000000000000000000000006",
      EHJOY: "0xa6b280b42cb0b7c4a4f789ec6ccc3a7609a1bc39",
      IMAGINE: "0x078540eecc8b6d89949c9c7d5e8e91eab64f6696",
    }
  },

  [Network.ZERO]: {
    RPC_URL: "https://rpc.zerion.io/v1/zero",
    NAME: "Zero",
    NATIVE_CURRENCY: "ETH",
    TOKENS: {
      CLNY: "0x1a90dd3dd89e2d2095ed1b40ecc1fe2bbb7614a1",
      NFT_DNA: "0xde0295449f96330d536dfed2477a13b7974876c5",
      NFT_CLNY_AVATAR: "0xa3468e60d28402a51f1ff54ede10f7cda56d1a72",
    }
  },
}; 