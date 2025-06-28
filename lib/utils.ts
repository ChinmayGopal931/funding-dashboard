/* eslint-disable @typescript-eslint/no-explicit-any */
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { DriftContract, HyperliquidAsset, HyperliquidAssetContext } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Add these interfaces and functions to your utils file (lib/utils.ts)

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