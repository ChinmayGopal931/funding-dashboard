"use client"

import React, { useState, useCallback, useEffect, useMemo, memo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, AlertCircle, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip as TooltipComponent, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useWebSocket } from '@/contexts/WebSocketProvider';
import { fetchDriftContracts, fetchHyperliquidData, LIGHTER_MARKET_IDS } from '@/lib/utils';
import HistoricalAnalysis from './HistoricalAnalysis';

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

interface PlatformData {
  rate: number;
  available: boolean;
}

interface ArbitrageOpportunity {
  asset: string;
  driftData: PlatformData;
  hyperliquidData: PlatformData;
  lighterData: PlatformData;
  maxSpread: number;
  currentAPR: number;
  bestStrategy: string;
  // Aggregate OI (kept for any existing usage)
  openInterest: number;
  // Per-protocol open interest
  openInterestDrift: number;
  openInterestHyperliquid: number;
  openInterestLighter: number;
  maxPriceDeviation: number;
}

interface ExternalData {
  drift: DriftContract[];
  hyperliquid: { assets: HyperliquidAsset[], contexts: HyperliquidAssetContext[] };
}

// Memoized table row component
const OpportunityRow = memo(({ 
  opportunity, 
  formatRate, 
  formatAPR, 
  formatSmallOI,
  onClick
}: {
  opportunity: ArbitrageOpportunity;
  formatRate: (rate: number) => string;
  formatAPR: (apr: number) => string;
  formatSmallOI: (oi: number) => string;
  onClick: (opportunity: ArbitrageOpportunity) => void;
}) => (
<tr className="border-b hover:bg-muted/50 cursor-pointer transition-colors"
        onClick={() => onClick(opportunity)} 
    >    
    <td className="px-4 py-3 font-medium">{opportunity.asset}</td>
    <td className={`px-4 py-3 ${
      !opportunity.driftData.available ? "" :
      opportunity.driftData.rate > 0 ? "text-green-600" : 
      opportunity.driftData.rate < 0 ? "text-red-600" : ""
    }`}>
      {opportunity.driftData.available ? formatRate(opportunity.driftData.rate) : "-"}
    </td>
    <td className={`px-4 py-3 ${
      !opportunity.hyperliquidData.available ? "" :
      opportunity.hyperliquidData.rate > 0 ? "text-green-600" : 
      opportunity.hyperliquidData.rate < 0 ? "text-red-600" : ""
    }`}>
      {opportunity.hyperliquidData.available ? formatRate(opportunity.hyperliquidData.rate) : "-"}
    </td>
    <td className={`px-4 py-3 ${
      !opportunity.lighterData.available ? "" :
      opportunity.lighterData.rate > 0 ? "text-green-600" : 
      opportunity.lighterData.rate < 0 ? "text-red-600" : ""
    }`}>
      {opportunity.lighterData.available ? formatRate(opportunity.lighterData.rate) : "-"}
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
    <td className="px-4 py-3 text-xs flex flex-wrap">
      {opportunity.openInterestHyperliquid ? `H-${formatSmallOI(opportunity.openInterestHyperliquid)} ` : ''}
      {opportunity.openInterestLighter ? `L-${formatSmallOI(opportunity.openInterestLighter)} ` : ''}
      {opportunity.openInterestDrift ? `D-${formatSmallOI(opportunity.openInterestDrift)}` : ''}
    </td>
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
  const [selectedOpportunity, setSelectedOpportunity] = useState<ArbitrageOpportunity | null>(null);
const [showHistoricalAnalysis, setShowHistoricalAnalysis] = useState(false);

  // Use the optimized WebSocket context
  const { isConnected: lighterWsConnected, marketData: lighterData, lastUpdateTime } = useWebSocket();

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

    // First, collect all unique assets from all platforms
    const allAssets = new Set<string>();
    
    externalData.drift.forEach(contract => {
      allAssets.add(contract.base_currency.toUpperCase());
    });
    
    externalData.hyperliquid.assets.forEach(asset => {
      allAssets.add(asset.name.toUpperCase());
    });
    
    Object.keys(LIGHTER_MARKET_IDS).forEach(asset => {
      allAssets.add(asset);
    });

    // Initialize opportunities for all assets
    allAssets.forEach(asset => {
      opportunityMap.set(asset, {
        asset,
        driftData: { rate: 0, available: false },
        hyperliquidData: { rate: 0, available: false },
        lighterData: { rate: 0, available: false },
        maxSpread: 0,
        currentAPR: 0,
        bestStrategy: '',
        // Aggregate OI (kept for any existing usage)
        openInterest: 0,
        // Per-protocol open interest
        openInterestDrift: 0,
        openInterestHyperliquid: 0,
        openInterestLighter: 0,
        maxPriceDeviation: 0
      });
    });

    // Process Drift data
    externalData.drift.forEach(contract => {
      const asset = contract.base_currency.toUpperCase();
      const fundingRate = parseFloat(contract.funding_rate || '0') / 100;
      const openInterest = parseFloat(contract.open_interest || '0');
      
      const opp = opportunityMap.get(asset)!;
      opp.driftData = { rate: fundingRate, available: true };
      opp.openInterest += openInterest;
      opp.openInterestDrift = openInterest;
    });

    // Process Hyperliquid data
    externalData.hyperliquid.assets.forEach((asset, index) => {
      const context = externalData.hyperliquid.contexts[index];
      if (!context) return;
      
      const assetName = asset.name.toUpperCase();
      const fundingRate = parseFloat(context.funding || '0') * 10;
      const openInterest = parseFloat(context.openInterest || '0');
      
      const opp = opportunityMap.get(assetName);
      if (opp) {
        opp.hyperliquidData = { rate: fundingRate, available: true };
        opp.openInterest += openInterest;
        opp.openInterestHyperliquid = openInterest;
      }
    });

    // Process Lighter data from WebSocket
    lighterData.forEach((stats, marketId) => {
      const asset = Object.entries(LIGHTER_MARKET_IDS).find(([, id]) => id === marketId)?.[0];
      if (!asset) return;
      
      const fundingRate = parseFloat(stats.current_funding_rate || stats.funding_rate || '0');
      
      const opp = opportunityMap.get(asset);
      if (opp) {
        opp.lighterData = { rate: fundingRate / 10, available: true };
        // Currently Lighter WebSocket does not provide open interest; leave as 0
      }
    });

    // Calculate max spreads and best strategies
    opportunityMap.forEach(opp => {
      const availablePlatforms: { name: string; rate: number }[] = [];
      
      // Always include spot as available
      availablePlatforms.push({ name: 'Spot', rate: 0 });
      
      if (opp.driftData.available) {
        availablePlatforms.push({ name: 'Drift', rate: opp.driftData.rate });
      }
      
      if (opp.hyperliquidData.available) {
        availablePlatforms.push({ name: 'Hyperliquid', rate: opp.hyperliquidData.rate });
      }
      
      if (opp.lighterData.available) {
        availablePlatforms.push({ name: 'Lighter', rate: opp.lighterData.rate });
      }

      if (availablePlatforms.length === 1) {
        // Only spot is available, no arbitrage opportunity
        opp.maxSpread = 0;
        opp.currentAPR = 0;
        opp.bestStrategy = 'No arbitrage available';
        return;
      }

      // Sort platforms by rate (most negative to most positive)
      const sortedPlatforms = [...availablePlatforms].sort((a, b) => a.rate - b.rate);

      // Determine the best long (most negative rate)
      const bestLong = sortedPlatforms[0];

      // Determine the best short (most positive rate) EXCLUDING spot
      const shortCandidates = sortedPlatforms.filter(p => p.name !== 'Spot');
      if (shortCandidates.length === 0) {
        // No derivative platform to short against
        opp.maxSpread = 0;
        opp.currentAPR = 0;
        opp.bestStrategy = 'No arbitrage available';
        return;
      }
      const bestShort = shortCandidates[shortCandidates.length - 1];

      // Prevent pairing a long with itself
      if (bestLong.name === bestShort.name) {
        opp.maxSpread = 0;
        opp.currentAPR = 0;
        opp.bestStrategy = 'No arbitrage available';
        return;
      }

      // Calculate the spread
      const maxSpread = bestShort.rate - bestLong.rate;

      // Build strategy string under the rules:
      // - Longs can only be paired with shorts
      // - Shorts can be paired with longs or spot (handled by allowing Spot as long only)
      let bestStrategy = '';
      if (bestLong.name === 'Spot') {
        // Spot as long position (allowed) paired with derivative short
        bestStrategy = `Buy Spot / Short ${bestShort.name}`;
      } else {
        // Both positions are derivatives
        bestStrategy = `Long ${bestLong.name} / Short ${bestShort.name}`;
      }

      opp.maxSpread = maxSpread;
      opp.currentAPR = maxSpread * 365 * 100; // Convert to annual percentage
      opp.bestStrategy = bestStrategy;
      
      // Calculate max price deviation from available rates
      const availableRates = availablePlatforms
        .filter(p => p.name !== 'Spot')
        .map(p => Math.abs(p.rate));
      
      const maxRate = availableRates.length > 0 ? Math.max(...availableRates) : 0;
      opp.maxPriceDeviation = maxRate * 100;
    });

    // Filter out opportunities with no available platforms (except spot) and sort by APR
    const opportunitiesArray = Array.from(opportunityMap.values())
      .filter(opp => opp.driftData.available || opp.hyperliquidData.available || opp.lighterData.available)
      .sort((a, b) => b.currentAPR - a.currentAPR);
    
    return opportunitiesArray;
  }, [externalData, lighterData, lastUpdateTime]);

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

  const handleRowClick = useCallback((opportunity: ArbitrageOpportunity) => {
    setSelectedOpportunity(opportunity);
    setShowHistoricalAnalysis(true);
  }, []);
  
  const handleBackFromAnalysis = useCallback(() => {
    setShowHistoricalAnalysis(false);
    setSelectedOpportunity(null);
  }, []);

  // Compact formatter for per-protocol OI strings (no $ prefix)
  const formatSmallOI = useCallback((oi: number) => {
    if (oi >= 1e9) return `${(oi / 1e9).toFixed(1)}B`;
    if (oi >= 1e6) return `${(oi / 1e6).toFixed(1)}M`;
    if (oi >= 1e3) return `${(oi / 1e3).toFixed(1)}K`;
    return oi.toFixed(0);
  }, []);

  if (showHistoricalAnalysis && selectedOpportunity) {
    return (
      <HistoricalAnalysis
        opportunity={selectedOpportunity}
        onBack={handleBackFromAnalysis}
        lighterMarketIds={LIGHTER_MARKET_IDS}
      />
    );
  }

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
                      formatSmallOI={formatSmallOI}
                      onClick={handleRowClick}
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
              <p>• <strong>Buy Spot/Short</strong>: Buy spot asset on DEX, short perpetual futures</p>
              <p>• <strong>Long/Short</strong>: Long perpetual on one protocol, short on another</p>
              <p>• Funding rates shown are per funding period (8 hours for most, 1 hour for Lighter)</p>
              <p>• APR calculation assumes continuous compounding of funding payments</p>
              <p>• &rdquo;-&rdquo; indicates market not available on that platform</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}