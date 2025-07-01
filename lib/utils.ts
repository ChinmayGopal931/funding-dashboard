/* eslint-disable @typescript-eslint/no-explicit-any */
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { DriftContract, HyperliquidAsset, HyperliquidAssetContext } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Interfaces for historical funding data
export interface DriftFundingRate {
  ts: number | string; // Can be Unix timestamp or string
  txSig: string;
  slot: number;
  recordId: string;
  marketIndex: number;
  fundingRate: string;
  cumulativeFundingRateLong: string;
  cumulativeFundingRateShort: string;
  oraclePriceTwap: string;
  markPriceTwap: string;
  fundingRateLong: string;
  fundingRateShort: string;
  periodRevenue: string;
  baseAssetAmountWithAmm: string;
  baseAssetAmountWithUnsettledLp: string;
}

export interface ParadexMarket {
  symbol: string;
  mark_price: string;
  last_traded_price: string;
  bid: string;
  ask: string;
  volume_24h: string;
  underlying_price: string;
  open_interest: string;
  funding_rate: string;
  price_change_rate_24h: string;
}



export interface HyperliquidFundingEntry {
  coin: string;
  fundingRate: string;
  premium: string;
  time: number;
}

export interface LighterFundingEntry {
  timestamp: number;
  value: string;
  rate: string;
  direction: string;
}

// API functions
export const fetchDriftFundingHistory = async (marketSymbol: string): Promise<DriftFundingRate[]> => {
  try {
    const response = await fetch(`https://data.api.drift.trade/fundingRates?marketName=${marketSymbol}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.fundingRates || [];
  } catch (error) {
    console.error(`Error fetching Drift funding history for ${marketSymbol}:`, error);
    return [];
  }
};

// Fetch Paradex markets
export const fetchParadexMarkets = async (): Promise<ParadexMarket[]> => {
  try {
    const response = await fetch('https://api.prod.paradex.trade/v1/markets/summary?market=ALL', {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    
    // Filter only perpetual markets (ending with -USD-PERP)
    return (data.results || []).filter((market: ParadexMarket) => 
      market.symbol.endsWith('-USD-PERP')
    );
  } catch (error) {
    console.error('Error fetching Paradex markets:', error);
    return [];
  }
};


export const fetchHyperliquidFundingHistory = async (coin: string, startTime: number, endTime: number): Promise<HyperliquidFundingEntry[]> => {
  try {
    const response = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'fundingHistory',
        coin: coin,
        startTime: startTime,
        endTime: endTime
      })
    });
    
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data: HyperliquidFundingEntry[] = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching Hyperliquid funding history for ${coin}:`, error);
    return [];
  }
};

export const fetchLighterFundingHistory = async (marketId: number, startTime: number, endTime: number): Promise<LighterFundingEntry[]> => {
  try {
    const response = await fetch(
      `https://mainnet.zklighter.elliot.ai/api/v1/fundings?market_id=${marketId}&resolution=1h&start_timestamp=${startTime}&end_timestamp=${endTime}&count_back=1000`,
      { headers: { 'accept': 'application/json' } }
    );
    
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.fundings || [];
  } catch (error) {
    console.error(`Error fetching Lighter funding history for market ${marketId}:`, error);
    return [];
  }
};

export interface LighterMarket {
  market_id: number;
  symbol: string;
  latestRate?: number;
  funding_rate?: string;
}

// Helper function to introduce delay between API calls
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Cache for Lighter markets data to reduce API calls
let lighterMarketsCache: {
  timestamp: number;
  markets: LighterMarket[];
} | null = null;

// Cache expiration time (5 minutes)
const CACHE_EXPIRATION = 5 * 60 * 1000;

export const fetchAllLighterMarkets = async (): Promise<LighterMarket[]> => {
  try {
    // Check if we have valid cached data
    const now = Date.now();
    if (lighterMarketsCache && (now - lighterMarketsCache.timestamp) < CACHE_EXPIRATION) {
      console.log('Using cached Lighter markets data');
      return lighterMarketsCache.markets;
    }
    
    // Get the current time and 1 hour ago
    const oneHourAgo = now - (1 * 60 * 60 * 1000);
    
    // Create a list of all market IDs from LIGHTER_MARKET_IDS
    const allMarkets: LighterMarket[] = Object.entries(LIGHTER_MARKET_IDS).map(([symbol, market_id]) => ({
      market_id,
      symbol,
      latestRate: undefined
    }));
    
    // Use only the most popular markets to reduce API calls
    const popularMarkets = ['BTC', 'ETH', 'SOL', 'AVAX', 'DOGE', 'WIF', 'XRP', 'LINK', 'NEAR', 'DOT', 'SUI', 'JUP', 'BNB', 'APT'];
    const priorityMarkets = allMarkets.filter(market => popularMarkets.includes(market.symbol));
    
    // Process markets in batches with delay to avoid rate limiting
    const batchSize = 3; // Process 3 markets at a time
    const delayMs = 1000; // 1 second delay between batches
    const marketsWithRates: LighterMarket[] = [];
    
    // Process priority markets first
    for (let i = 0; i < priorityMarkets.length; i += batchSize) {
      const batch = priorityMarkets.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (market) => {
          try {
            const fundingData = await fetchLighterFundingHistory(market.market_id, oneHourAgo, now);
            if (fundingData.length > 0) {
              const latestEntry = fundingData[fundingData.length - 1];
              market.latestRate = parseFloat(latestEntry.rate);
              market.funding_rate = latestEntry.rate; // Set funding_rate for use in selection cards
            }
            return market;
          } catch (error) {
            console.error(`Error fetching data for market ${market.symbol}:`, error);
            return market;
          }
        })
      );
      
      marketsWithRates.push(...batchResults);
      
      // Add delay between batches to avoid rate limiting
      if (i + batchSize < priorityMarkets.length) {
        await delay(delayMs);
      }
    }
    
    // Filter out markets with no rates and sort by absolute funding rate (highest first)
    const sortedMarkets = marketsWithRates
      .filter(market => market.latestRate !== undefined)
      .sort((a, b) => Math.abs(b.latestRate!) - Math.abs(a.latestRate!));
    
    // Cache the results
    lighterMarketsCache = {
      timestamp: now,
      markets: sortedMarkets
    };
    
    return sortedMarkets;
      
  } catch (error) {
    console.error('Error fetching all Lighter markets:', error);
    return [];
  }
};
  
    export   const fetchHyperliquidSpotData = async (): Promise<{ 
        tokens: any[], 
        pairs: any[], 
        contexts: any[] 
      }> => {
        try {
          const response = await fetch('https://api.hyperliquid.xyz/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'spotMetaAndAssetCtxs' })
          });
          
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          const data = await response.json();
          
          return {
            tokens: data[0]?.tokens || [],
            pairs: data[0]?.universe || [],
            contexts: data[1] || []
          };
        } catch (error) {
          console.error('Error fetching Hyperliquid spot data:', error);
          return { tokens: [], pairs: [], contexts: [] };
        }
      };
    

      export   const fetchHyperliquidData = async (): Promise<{ assets: HyperliquidAsset[], contexts: HyperliquidAssetContext[] }> => {
          try {
            const response = await fetch('https://api.hyperliquid.xyz/info', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'metaAndAssetCtxs' })
            });
            
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            
            return {
              assets: data[0]?.universe || [],
              contexts: data[1] || []
            };
          } catch (error) {
            console.error('Error fetching Hyperliquid data:', error);
            return { assets: [], contexts: [] };
          }
        };


        export const fetchDriftContracts = async (): Promise<DriftContract[]> => {
            try {
              const response = await fetch('https://data.api.drift.trade/contracts');
              if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
              const data = await response.json();
              return data.contracts?.filter((contract: DriftContract) => 
                contract.product_type === 'PERP' && 
                contract.ticker_id && 
                contract.next_funding_rate !== null
              ) || [];
            } catch (error) {
              console.error('Error fetching Drift contracts:', error);
              return [];
            }
          };


// Your mapping array
const rawMapping = [
  // { market_id: 14, symbol: "POL" },
  // { market_id: 15, symbol: "TRUMP" },
  // { market_id: 38, symbol: "ONDO" },
  // { market_id: 20, symbol: "BERA" },
  // { market_id: 32, symbol: "SEI" },
  // { market_id: 34, symbol: "IP" },
  // { market_id: 5, symbol: "WIF" },
  { market_id: 2, symbol: "SOL" },
  // { market_id: 35, symbol: "LTC" },
  // { market_id: 3, symbol: "DOGE" },
  // { market_id: 29, symbol: "ENA" },
  { market_id: 9, symbol: "AVAX" },
  // { market_id: 25, symbol: "BNB" },
  // { market_id: 8, symbol: "LINK" },
  // { market_id: 30, symbol: "UNI" },
  { market_id: 1, symbol: "BTC" },
  { market_id: 0, symbol: "ETH" },
  // { market_id: 21, symbol: "FARTCOIN" },
  // { market_id: 22, symbol: "AI16Z" },
  // { market_id: 42, symbol: "SPX" },
  // { market_id: 41, symbol: "VIRTUAL" },
  // { market_id: 6, symbol: "WLD" },
  // { market_id: 33, symbol: "KAITO" },
  // { market_id: 18, symbol: "1000BONK" },
  // { market_id: 12, symbol: "TON" },
  // { market_id: 23, symbol: "POPCAT" },
  // { market_id: 37, symbol: "PENDLE" },
  // { market_id: 26, symbol: "JUP" },
  // { market_id: 11, symbol: "DOT" },
  // { market_id: 31, symbol: "APT" },
  // { market_id: 39, symbol: "ADA" },
  // { market_id: 4, symbol: "1000PEPE" },
  // { market_id: 13, symbol: "TAO" },
  // { market_id: 24, symbol: "HYPE" },
  // { market_id: 40, symbol: "S" },
  // { market_id: 10, symbol: "NEAR" },
  // { market_id: 7, symbol: "XRP" },
  // { market_id: 36, symbol: "CRV" },
  // { market_id: 19, symbol: "1000FLOKI" },
  // { market_id: 16, symbol: "SUI" },
  // { market_id: 17, symbol: "1000SHIB" },
  // { market_id: 28, symbol: "MKR" },
  // { market_id: 27, symbol: "AAVE" },
];

// Base colors you gave for previous tokens (without -PERP suffix)
const BASE_COLORS: Record<string, string> = {
  SOL: "#8b5cf6",
  ETH: "#627eea",
  BTC: "#f7931a",
  JTO: "#06d6a0",
  WIF: "#f59e0b",
  JUP: "#22c55e",
  PYTH: "#ef4444",
  BONK: "#ff6b6b",
  RNDR: "#4ecdc4",
  AVAX: "#45b7d1",
};

export const ParadexPerpMarkets: string[] = [
  "MORPHO-USD-PERP",
  "MUBARAK-USD-PERP",
  "WCT-USD-PERP",
  "AVAX-USD-PERP",
  "SUI-USD-PERP",
  "LAYER-USD-PERP",
  "BTC-USD-PERP",
  "BNB-USD-PERP",
  "MOODENG-USD-PERP",
  "WIF-USD-PERP",
  "POPCAT-USD-PERP",
  "MELANIA-USD-PERP",
  "XMR-USD-PERP",
  "RED-USD-PERP",
  "BCH-USD-PERP",
  "PENGU-USD-PERP",
  "SPX-USD-PERP",
  "UNI-USD-PERP",
  "RESOLV-USD-PERP",
  "APT-USD-PERP",
  "ZRO-USD-PERP",
  "BMT-USD-PERP",
  "DYDX-USD-PERP",
  "JUP-USD-PERP",
  "TST-USD-PERP",
  "ONDO-USD-PERP",
  "PYTH-USD-PERP",
  "SEI-USD-PERP",
  "NEAR-USD-PERP",
  "RAY-USD-PERP",
  "kBONK-USD-PERP",
  "TRUMP-USD-PERP",
  "BERA-USD-PERP",
  "NIL-USD-PERP",
  "NEWT-USD-PERP",
  "kPEPE-USD-PERP",
  "SYRUP-USD-PERP",
  "ENA-USD-PERP",
  "OM-USD-PERP",
  "GRASS-USD-PERP",
  "PNUT-USD-PERP",
  "EIGEN-USD-PERP",
  "USUAL-USD-PERP",
  "TRB-USD-PERP",
  "WAL-USD-PERP",
  "ETHFI-USD-PERP",
  "SCR-USD-PERP",
  "LINK-USD-PERP",
  "ETH-USD-PERP",
  "XRP-USD-PERP",
  "FIL-USD-PERP",
  "WLD-USD-PERP",
  "NEIRO-USD-PERP",
  "TON-USD-PERP",
  "FARTCOIN-USD-PERP",
  "S-USD-PERP",
  "PLUME-USD-PERP",
  "kFLOKI-USD-PERP",
  "VINE-USD-PERP",
  "FLOW-USD-PERP",
  "KAITO-USD-PERP",
  "LTC-USD-PERP",
  "COOKIE-USD-PERP",
  "VVV-USD-PERP",
  "DOT-USD-PERP",
  "HYPER-USD-PERP",
  "INJ-USD-PERP",
  "ZORA-USD-PERP",
  "TRX-USD-PERP",
  "ADA-USD-PERP",
  "AIXBT-USD-PERP",
  "PENDLE-USD-PERP",
  "GOAT-USD-PERP",
  "IP-USD-PERP",
  "TIA-USD-PERP",
  "LDO-USD-PERP",
  "SOL-USD-PERP",
  "HYPE-USD-PERP",
  "INIT-USD-PERP",
  "ORDI-USD-PERP",
  "RUNE-USD-PERP",
  "DOGE-USD-PERP",
  "OP-USD-PERP",
  "XLM-USD-PERP",
  "HUMA-USD-PERP",
  "ALCH-USD-PERP",
  "JTO-USD-PERP",
  "TAO-USD-PERP",
  "VIRTUAL-USD-PERP",
  "STRK-USD-PERP",
  "ARB-USD-PERP",
  "AI16Z-USD-PERP",
  "SOPH-USD-PERP",
  "PAXG-USD-PERP",
  "MOVE-USD-PERP",
  "kSHIB-USD-PERP",
  "AAVE-USD-PERP",
  "MKR-USD-PERP"
];

// GMX Market interface and fetch function
export interface GMXMarket {
  name: string;
  netRateLong: string;
  netRateShort: string;
  fundingRateLong: string;
  fundingRateShort: string;
  // optional fields that may exist depending on endpoint version
  indexPrice?: string;
  volume24h?: string;
  openInterestLong?: string;
  openInterestShort?: string;
  availableLiquidityLong?: string;
  availableLiquidityShort?: string;
}

export const fetchGMXMarkets = async (): Promise<GMXMarket[]> => {
  try {
    const res = await fetch('https://arbitrum-api.gmxinfra.io/markets/info');
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    return (data.markets || []) as GMXMarket[];
  } catch (err) {
    console.error('Error fetching GMX markets:', err);
    return [];
  }
};

// Helper to convert GMX per-second fixed-point (1e30) rate into an 8-hour funding decimal (e.g. 0.001 = 0.1%)
export function gmxRate8h(raw: string | number): number {
  // Raw is stored as an ANNUAL rate in fixed-point. Some markets use 30-decimals, others 36-decimals.
  const rawStr = raw.toString();
  // Detect precision by digit length (ignore minus sign)
  const digits = rawStr.startsWith('-') ? rawStr.slice(1) : rawStr;
  const precision = digits.length <= 30 ? 30 : 36;

  const annualDecimal = parseFloat(rawStr) / Math.pow(10, precision); // e.g. 0.9245 => 92.45%
  // 8-hour decimal = annual / 1095 ( 8760 / 8 )
  return annualDecimal / 1095;
}

export const LIGHTER_MARKET_IDS: { [key: string]: number } = {
  'ETH': 0,
  'BTC': 1,
  'SOL': 2,
  'DOGE': 3,
  '1000PEPE': 4,
  'WIF': 5,
  'WLD': 6,
  'XRP': 7,
  'LINK': 8,
  'AVAX': 9,
  'NEAR': 10,
  'DOT': 11,
  'TON': 12,
  'TAO': 13,
  'POL': 14,
  'TRUMP': 15,
  'SUI': 16,
  '1000SHIB': 17,
  '1000BONK': 18,
  '1000FLOKI': 19,
  'BERA': 20,
  'FARTCOIN': 21,
  'AI16Z': 22,
  'POPCAT': 23,
  'HYPE': 24,
  'BNB': 25,
  'JUP': 26,
  'AAVE': 27,
  'MKR': 28,
  'ENA': 29,
  'UNI': 30,
  'APT': 31,
  'SEI': 32,
  'KAITO': 33,
  'IP': 34,
  'LTC': 35,
  'CRV': 36,
  'PENDLE': 37,
  'ONDO': 38,
  'ADA': 39,
  'S': 40,
  'VIRTUAL': 41,
  'SPX': 42
};
// Helper: generate consistent HSL color from string for new tokens
function generateColorFromString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

// MARKET_MAPPING: market_id -> symbol + "-PERP"
export const MARKET_MAPPING: Record<number, string> = {};
rawMapping.forEach(({ market_id, symbol }) => {
  MARKET_MAPPING[market_id] = symbol + "-PERP";
});

// COLORS: symbol + "-PERP" -> color
export const COLORS: Record<string, string> = {};
rawMapping.forEach(({ symbol }) => {
  const key = symbol + "-PERP";
  if (BASE_COLORS[symbol]) {
    COLORS[key] = BASE_COLORS[symbol];
  } else {
    COLORS[key] = generateColorFromString(symbol);
  }
});