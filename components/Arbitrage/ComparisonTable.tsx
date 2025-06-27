"use client"

import React, { useState, useCallback, useEffect, useMemo, memo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, AlertCircle, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip as TooltipComponent, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useWebSocket } from '@/contexts/WebSocketProvider';

// Interfaces
interface DriftContract {
  base_currency: string;
  base_volume: string;
  contract_index: number;
  end_timestamp: string;
  funding_rate: string;
  high: string;
  index_currency: string;
  index_name: string;
  index_price: string;
  last_price: string;
  low: string;
  next_funding_rate: string;
  next_funding_rate_timestamp: string;
  open_interest: string;
  product_type: string;
  quote_currency: string;
  quote_volume: string;
  start_timestamp: string;
  ticker_id: string;
}

interface HyperliquidAsset {
  name: string;
  szDecimals: number;
  maxLeverage: number;
  onlyIsolated?: boolean;
}

interface HyperliquidAssetContext {
  dayNtlVlm: string;
  funding: string;
  impactPxs: string[];
  markPx: string;
  midPx: string;
  openInterest: string;
  oraclePx: string;
  premium: string;
  prevDayPx: string;
}

interface ArbitrageOpportunity {
  asset: string;
  driftRate: number;
  hyperliquidRate: number;
  lighterRate: number;
  maxSpread: number;
  currentAPR: number;
  bestStrategy: string;
  openInterest: number;
  maxPriceDeviation: number;
}

interface ExternalData {
  drift: DriftContract[];
  hyperliquid: { assets: HyperliquidAsset[], contexts: HyperliquidAssetContext[] };
}

// Market ID mapping for Lighter
const LIGHTER_MARKET_IDS: { [key: string]: number } = {
  'BTC': 0,
  'ETH': 1,
  'SOL': 2,
  // Add more mappings as needed
};

// Memoized table row component
const OpportunityRow = memo(({ 
  opportunity, 
  formatRate, 
  formatAPR, 
  formatOI 
}: {
  opportunity: ArbitrageOpportunity;
  formatRate: (rate: number) => string;
  formatAPR: (apr: number) => string;
  formatOI: (oi: number) => string;
}) => (
  <tr className="border-b hover:bg-muted/50">
    <td className="px-4 py-3 font-medium">{opportunity.asset}</td>
    <td className={`px-4 py-3 ${opportunity.driftRate > 0 ? "text-green-600" : opportunity.driftRate < 0 ? "text-red-600" : ""}`}>
      {formatRate(opportunity.driftRate)}
    </td>
    <td className={`px-4 py-3 ${opportunity.hyperliquidRate > 0 ? "text-green-600" : opportunity.hyperliquidRate < 0 ? "text-red-600" : ""}`}>
      {formatRate(opportunity.hyperliquidRate)}
    </td>
    <td className={`px-4 py-3 ${opportunity.lighterRate > 0 ? "text-green-600" : opportunity.lighterRate < 0 ? "text-red-600" : ""}`}>
      {formatRate(opportunity.lighterRate)}
    </td>
    <td className="px-4 py-3">
      <Badge variant={opportunity.maxSpread > 0.001 ? "default" : "secondary"}>
        {formatRate(opportunity.maxSpread)}
      </Badge>
    </td>
    <td className="px-4 py-3">
      <div className="flex items-center gap-1">
        <span className={
          opportunity.currentAPR > 20 ? "text-green-600 font-semibold" : 
          opportunity.currentAPR > 10 ? "text-yellow-600" : ""
        }>
          {formatAPR(opportunity.currentAPR)}
        </span>
      </div>
    </td>
    <td className="px-4 py-3 text-sm">{opportunity.bestStrategy}</td>
    <td className="px-4 py-3">{formatOI(opportunity.openInterest)}</td>
    <td className="px-4 py-3">{opportunity.maxPriceDeviation.toFixed(3)}%</td>
  </tr>
));

OpportunityRow.displayName = 'OpportunityRow';

export default function FundingArbitrageDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [externalData, setExternalData] = useState<ExternalData>({
    drift: [],
    hyperliquid: { assets: [], contexts: [] }
  });
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Use the optimized WebSocket context
  const { isConnected: lighterWsConnected, marketData: lighterData, lastUpdateTime } = useWebSocket();

  // API Fetching Functions (memoized to prevent recreation)
  const fetchDriftContracts = useCallback(async (): Promise<DriftContract[]> => {
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
  }, []);

  const fetchHyperliquidData = useCallback(async (): Promise<{ assets: HyperliquidAsset[], contexts: HyperliquidAssetContext[] }> => {
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
  }, []);

  // Fetch external data (Drift and Hyperliquid)
  const fetchExternalData = useCallback(async () => {
    try {
      setError(null);
      const [driftContracts, hyperliquidData] = await Promise.all([
        fetchDriftContracts(),
        fetchHyperliquidData()
      ]);
      
      setExternalData({
        drift: driftContracts,
        hyperliquid: hyperliquidData
      });
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching external data:', error);
      setError('Failed to fetch data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchDriftContracts, fetchHyperliquidData]);

  // Calculate opportunities - memoized based on data dependencies
  const opportunities = useMemo(() => {
    const opportunityMap = new Map<string, ArbitrageOpportunity>();

    // Process Drift data
    externalData.drift.forEach(contract => {
      const asset = contract.base_currency.toUpperCase();
      const fundingRate = parseFloat( contract.funding_rate || '0') / 100;
      const openInterest = parseFloat(contract.open_interest || '0');
      opportunityMap.set(asset, {
        asset,
        driftRate: fundingRate,
        hyperliquidRate: 0,
        lighterRate: 0,
        maxSpread: 0,
        currentAPR: 0,
        bestStrategy: '',
        openInterest: openInterest,
        maxPriceDeviation: 0
      });
    });

    // Process Hyperliquid data
    externalData.hyperliquid.assets.forEach((asset, index) => {
      const context = externalData.hyperliquid.contexts[index];
      if (!context) return;
      
      const assetName = asset.name.toUpperCase();
      const fundingRate = parseFloat(context.funding || '0') * 10;
      const openInterest = parseFloat(context.openInterest || '0');
      
      const existing = opportunityMap.get(assetName) || {
        asset: assetName,
        driftRate: 0,
        hyperliquidRate: 0,
        lighterRate: 0,
        maxSpread: 0,
        currentAPR: 0,
        bestStrategy: '',
        openInterest: 0,
        maxPriceDeviation: 0
      };
      
      existing.hyperliquidRate = fundingRate;
      existing.openInterest += openInterest;
      opportunityMap.set(assetName, existing);
    });

    // Process Lighter data from WebSocket
    lighterData.forEach((stats, marketId) => {
      const asset = Object.entries(LIGHTER_MARKET_IDS).find(([, id]) => id === marketId)?.[0];
      if (!asset) return;
      
      const fundingRate = parseFloat(stats.current_funding_rate || stats.funding_rate || '0');
      
      const existing = opportunityMap.get(asset) || {
        asset,
        driftRate: 0,
        hyperliquidRate: 0,
        lighterRate: 0,
        maxSpread: 0,
        currentAPR: 0,
        bestStrategy: '',
        openInterest: 0,
        maxPriceDeviation: 0
      };
      
      existing.lighterRate = fundingRate / 10;
      opportunityMap.set(asset, existing);
    });

    // Calculate max spreads and best strategies
    opportunityMap.forEach(opp => {
        const rates = [
          { name: 'Spot', rate: 0 },
          { name: 'Drift', rate: opp.driftRate },
          { name: 'Hyperliquid', rate: opp.hyperliquidRate },
          { name: 'Lighter', rate: opp.lighterRate }
        ];
        
        // Sort rates from most negative to most positive
        const sortedRates = [...rates].sort((a, b) => a.rate - b.rate);
        
        // Best long position: most negative rate (shorts pay longs)
        const bestLong = sortedRates[0];
        
        // Best short position: most positive rate (longs pay shorts)
        const bestShort = sortedRates[sortedRates.length - 1];
        
        // Calculate the delta (spread)
        const maxSpread = bestShort.rate - bestLong.rate;
        
        // Format strategy string
        let bestStrategy = '';
        if (bestLong.name === 'Spot') {
          bestStrategy = `Buy Spot / Short ${bestShort.name}`;
        } else if (bestShort.name === 'Spot') {
          bestStrategy = `Long ${bestLong.name} / Sell Spot`;
        } else {
          bestStrategy = `Long ${bestLong.name} / Short ${bestShort.name}`;
        }
        
        opp.maxSpread = maxSpread;
        opp.currentAPR = maxSpread * 365 * 100; // Convert to annual percentage
        opp.bestStrategy = bestStrategy;
        
        // Calculate max price deviation (simplified)
        const maxRate = Math.max(Math.abs(opp.driftRate), Math.abs(opp.hyperliquidRate), Math.abs(opp.lighterRate));
        opp.maxPriceDeviation = maxRate * 100;
      });
  

    const opportunitiesArray = Array.from(opportunityMap.values());
    opportunitiesArray.sort((a, b) => b.currentAPR - a.currentAPR);
    
    return opportunitiesArray;
  }, [externalData, lighterData, lastUpdateTime]); // Only recalculate when data changes

  // Initial load
  useEffect(() => {
    fetchExternalData();
  }, []);



  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchExternalData();
  }, [fetchExternalData]);

  // Memoized formatters
  const formatRate = useCallback((rate: number) => {
    return `${(rate * 100).toFixed(4)}%`;
  }, []);

  const formatAPR = useCallback((apr: number) => {
    return `${apr.toFixed(2)}%`;
  }, []);

  const formatOI = useCallback((oi: number) => {
    if (oi >= 1e9) return `$${(oi / 1e9).toFixed(2)}B`;
    if (oi >= 1e6) return `$${(oi / 1e6).toFixed(2)}M`;
    if (oi >= 1e3) return `$${(oi / 1e3).toFixed(2)}K`;
    return `$${oi.toFixed(2)}`;
  }, []);

  return (
    <div className="w-full max-w-7xl mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl">Funding Rate Arbitrage Dashboard</CardTitle>
              <CardDescription>
                Delta-neutral strategies across Drift, Hyperliquid, and Lighter
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={lighterWsConnected ? "default" : "secondary"}>
                {lighterWsConnected ? "Live" : "Offline"}
              </Badge>
              <Button
                onClick={handleRefresh}
                disabled={refreshing}
                size="sm"
              >
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {lastUpdate && (
            <div className="text-sm text-muted-foreground mb-4">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </div>
          )}

          <div className="rounded-md border overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Asset</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    <TooltipProvider>
                      <TooltipComponent>
                        <TooltipTrigger>Drift Rate</TooltipTrigger>
                        <TooltipContent>8-hour funding rate</TooltipContent>
                      </TooltipComponent>
                    </TooltipProvider>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    <TooltipProvider>
                      <TooltipComponent>
                        <TooltipTrigger>Hyperliquid Rate</TooltipTrigger>
                        <TooltipContent>8-hour funding rate</TooltipContent>
                      </TooltipComponent>
                    </TooltipProvider>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    <TooltipProvider>
                      <TooltipComponent>
                        <TooltipTrigger>Lighter Rate</TooltipTrigger>
                        <TooltipContent>Hourly funding rate</TooltipContent>
                      </TooltipComponent>
                    </TooltipProvider>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Max Spread</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    <TooltipProvider>
                      <TooltipComponent>
                        <TooltipTrigger>Current APR</TooltipTrigger>
                        <TooltipContent>Annualized return from spread</TooltipContent>
                      </TooltipComponent>
                    </TooltipProvider>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Best Strategy</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Open Interest</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    <TooltipProvider>
                      <TooltipComponent>
                        <TooltipTrigger>Max Deviation</TooltipTrigger>
                        <TooltipContent>Estimated max price impact</TooltipContent>
                      </TooltipComponent>
                    </TooltipProvider>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : opportunities.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-muted-foreground">
                      No opportunities found
                    </td>
                  </tr>
                ) : (
                  opportunities.map((opp) => (
                    <OpportunityRow
                      key={opp.asset}
                      opportunity={opp}
                      formatRate={formatRate}
                      formatAPR={formatAPR}
                      formatOI={formatOI}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-4 bg-muted rounded-lg">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Info className="h-4 w-4" />
              Strategy Information
            </h3>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>• <strong>Spot/Short</strong>: Buy spot asset on DEX, short perpetual futures</p>
              <p>• <strong>Long/Short</strong>: Long perpetual on one protocol, short on another</p>
              <p>• Funding rates shown are per funding period (8 hours for most, 1 hour for Lighter)</p>
              <p>• APR calculation assumes continuous compounding of funding payments</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}