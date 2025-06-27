// hooks/useLighterMarkets.ts
import { useMemo } from 'react';
import { useWebSocket } from '@/contexts/WebSocketProvider';

interface LighterMarketData {
  market_id: number;
  asset: string;
  funding_rate: number;
  last_update: number;
}

// Asset to Market ID mapping
const ASSET_TO_MARKET_ID: Record<string, number> = {
  'BTC': 0,
  'ETH': 1,
  'SOL': 2,
  // Add more as needed
};

const MARKET_ID_TO_ASSET: Record<number, string> = Object.entries(ASSET_TO_MARKET_ID)
  .reduce((acc, [asset, id]) => ({ ...acc, [id]: asset }), {});

/**
 * Custom hook to get Lighter market data in a format optimized for the dashboard
 */
export function useLighterMarkets(): Map<string, LighterMarketData> {
  const { marketData, lastUpdateTime } = useWebSocket();
  
  return useMemo(() => {
    const lighterMarkets = new Map<string, LighterMarketData>();
    
    marketData.forEach((stats, marketId) => {
      const asset = MARKET_ID_TO_ASSET[marketId];
      if (!asset) return;
      
      const fundingRate = parseFloat(stats.current_funding_rate || stats.funding_rate || '0');
      
      lighterMarkets.set(asset, {
        market_id: marketId,
        asset,
        funding_rate: fundingRate,
        last_update: stats.funding_timestamp || Date.now()
      });
    });
    
    return lighterMarkets;
  }, [marketData, lastUpdateTime]);
}

/**
 * Custom hook to get a specific asset's Lighter funding rate
 */
export function useLighterFundingRate(asset: string): number {
  const lighterMarkets = useLighterMarkets();
  const marketData = lighterMarkets.get(asset.toUpperCase());
  return marketData?.funding_rate || 0;
}

/**
 * Hook to check if we have fresh data for an asset
 */
export function useIsLighterDataFresh(asset: string, maxAgeMs: number = 60000): boolean {
  const lighterMarkets = useLighterMarkets();
  const marketData = lighterMarkets.get(asset.toUpperCase());
  
  if (!marketData) return false;
  
  const age = Date.now() - marketData.last_update;
  return age < maxAgeMs;
}