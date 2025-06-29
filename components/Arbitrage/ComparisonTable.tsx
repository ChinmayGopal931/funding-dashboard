"use client"

import React, { useState, useCallback, useEffect, useMemo, memo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, AlertCircle, Info, ChevronUp, ChevronDown, ArrowUpDown, Search, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip as TooltipComponent, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useWebSocket } from '@/contexts/WebSocketProvider';
import { fetchDriftContracts, fetchHyperliquidData, fetchGMXMarkets, LIGHTER_MARKET_IDS, GMXMarket, gmxRate8h, ParadexMarket, fetchParadexMarkets } from '@/lib/utils';
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

interface LighterStats {
  market_id: number;
  index_price: string;
  mark_price: string;
  last_trade_price: string;
  current_funding_rate: string;
  funding_rate: string;
  funding_timestamp: number;
  daily_base_token_volume: number;
  daily_quote_token_volume: number;
  daily_price_low: number;
  daily_price_high: number;
  daily_price_change: number;
}

interface PlatformData {
  rate: number;
  available: boolean;
}

// New interfaces for sorting and filtering
type SortableColumn = 'driftRate' | 'hyperliquidRate' | 'gmxRate' | 'lighterRate' | 'paradexRate' | 'maxSpread' | 'optimalAPR';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  column: SortableColumn;
  direction: SortDirection;
}

type Protocol = 'Hyperliquid' | 'Drift' | 'Lighter' | 'Paradex' | 'GMX' | 'Spot';


interface ArbitrageOpportunity {
  asset: string;
  driftData: PlatformData;
  hyperliquidData: PlatformData;
  lighterData: PlatformData;
  gmxData: PlatformData;
  paradexData: PlatformData; // Add this
  maxSpread: number;
  currentAPR: number;
  bestStrategy: string;
  openInterest: number;
  openInterestDrift: number;
  openInterestHyperliquid: number;
  openInterestLighter: number;
  openInterestParadex: number; // Add this
  gmxMarket?: GMXMarket;
  paradexMarket?: ParadexMarket; // Add this
  maxPriceDeviation: number;
  driftContract?: DriftContract;
  hyperliquidContext?: HyperliquidAssetContext;
  lighterStats?: LighterStats;
}

interface ExternalData {
  drift: DriftContract[];
  hyperliquid: { assets: HyperliquidAsset[], contexts: HyperliquidAssetContext[] };
  gmx: GMXMarket[];
  paradex: ParadexMarket[]; // Add this
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
  <HoverCard>
    <HoverCardTrigger asChild>
      <tr className="border-b hover:bg-blue-50 cursor-pointer transition-colors"
          onClick={() => onClick(opportunity)} 
      >    
        <td className="pl-4 py-3 font-medium">{opportunity.asset}</td>
        <td className={`pr-1 py-3 ${
          !opportunity.driftData.available ? "" :
          opportunity.driftData.rate > 0 ? "text-green-600" : 
          opportunity.driftData.rate < 0 ? "text-red-600" : ""
        }`}>
          {opportunity.driftData.available ? formatRate(opportunity.driftData.rate) : "-"}
        </td>
        <td className={`px-1 py-3 ${
          !opportunity.hyperliquidData.available ? "" :
          opportunity.hyperliquidData.rate > 0 ? "text-green-600" : 
          opportunity.hyperliquidData.rate < 0 ? "text-red-600" : ""
        }`}>
          {opportunity.hyperliquidData.available ? formatRate(opportunity.hyperliquidData.rate) : "-"}
        </td>
        <td className={`px-1 py-3 ${
          !opportunity.gmxData.available ? "" :
          opportunity.gmxData.rate > 0 ? "text-green-600" : 
          opportunity.gmxData.rate < 0 ? "text-red-600" : ""
        }`}>
          {opportunity.gmxData.available ? formatRate(opportunity.gmxData.rate) : "-"}
        </td>
        <td className={`px-1 py-3 ${
          !opportunity.lighterData.available ? "" :
          opportunity.lighterData.rate > 0 ? "text-green-600" : 
          opportunity.lighterData.rate < 0 ? "text-red-600" : ""
        }`}>
          {opportunity.lighterData.available ? formatRate(opportunity.lighterData.rate) : "-"}
        </td>
        <td className={`px-1 py-3 ${
          !opportunity.paradexData.available ? "" :
          opportunity.paradexData.rate > 0 ? "text-green-600" : 
          opportunity.paradexData.rate < 0 ? "text-red-600" : ""
        }`}>
          {opportunity.paradexData.available ? formatRate(opportunity.paradexData.rate) : "-"}
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
        <td className="px-4 py-3 text-xs flex flex-col space-y-0.5">
          {opportunity.openInterestHyperliquid ? (
            <div className="whitespace-nowrap">H - {formatSmallOI(opportunity.openInterestHyperliquid)}</div>
          ) : null}
          {opportunity.openInterestLighter ? (
            <div className="whitespace-nowrap">L - {formatSmallOI(opportunity.openInterestLighter)}</div>
          ) : null}
          {opportunity.openInterestDrift ? (
            <div className="whitespace-nowrap">D - {formatSmallOI(opportunity.openInterestDrift)}</div>
          ) : null}
          {opportunity.gmxMarket?.openInterestLong && opportunity.gmxMarket?.openInterestShort ? (
            <div className="whitespace-nowrap">G - {formatSmallOI((parseFloat(opportunity.gmxMarket.openInterestLong) + parseFloat(opportunity.gmxMarket.openInterestShort)) / 1e30)}</div>
          ) : null}
          {opportunity.gmxMarket?.openInterestLong && opportunity.gmxMarket?.openInterestShort && opportunity.gmxMarket?.indexPrice ? (
            <div className="whitespace-nowrap">S - {  ((parseFloat(opportunity.gmxMarket.openInterestLong) + parseFloat(opportunity.gmxMarket.openInterestShort)) / 1e30) *
          parseFloat(opportunity.gmxMarket.indexPrice)
        }</div>
          ) : null}
          {opportunity.openInterestParadex ? (
            <div className="whitespace-nowrap">P - {formatSmallOI(opportunity.openInterestParadex)}</div>
          ) : null}
        </td>
        {/* <td className="px-4 py-3">{opportunity.maxPriceDeviation.toFixed(3)}%</td> */}
      </tr>
    </HoverCardTrigger>
    <HoverCardContent className="w-80 text-xs space-y-3 p-4 border shadow-lg rounded-md bg-popover text-popover-foreground dark:bg-zinc-900 dark:text-zinc-100">
      {opportunity.driftContract && (
        <div>
          <h4 className="font-medium text-sm mb-1">Drift</h4>
          <ul className="space-y-0.5">
            <li>Funding: {formatRate(opportunity.driftData.rate)}</li>
            <li>OI: {formatSmallOI(opportunity.openInterestDrift)}</li>
            <li>Price: {parseFloat(opportunity.driftContract.index_price).toFixed(3)}</li>
            <li>24h Vol: {parseFloat(opportunity.driftContract.quote_volume).toLocaleString(undefined, { maximumFractionDigits: 0 })}</li>
          </ul>
        </div>
      )}
      {opportunity.hyperliquidContext && (
        <div>
          <h4 className="font-medium text-sm mb-1">Hyperliquid</h4>
          <ul className="space-y-0.5">
            <li>Funding: {formatRate(opportunity.hyperliquidData.rate)}</li>
            <li>OI: {formatSmallOI(opportunity.openInterestHyperliquid)}</li>
            <li>Mark Px: {parseFloat(opportunity.hyperliquidContext.markPx).toFixed(3)}</li>
            <li>24h Vlm: {parseFloat(opportunity.hyperliquidContext.dayNtlVlm).toLocaleString(undefined, { maximumFractionDigits: 0 })}</li>
          </ul>
        </div>
      )}
      {opportunity.gmxMarket && (
        <div>
          <h4 className="font-medium text-sm mb-1">GMX</h4>
          <ul className="space-y-0.5">
            <li>Funding: {formatRate(opportunity.gmxData.rate)}</li>
            {opportunity.gmxMarket.openInterestLong && opportunity.gmxMarket.openInterestShort && (
              <li>
                OI L/S: {formatSmallOI(parseFloat(opportunity.gmxMarket.openInterestLong) / 1e30)} / {formatSmallOI(parseFloat(opportunity.gmxMarket.openInterestShort) / 1e30)}
              </li>
            )}
            {opportunity.gmxMarket.indexPrice && (
              <li>Index Px: {(parseFloat(opportunity.gmxMarket.indexPrice) / 1e30).toFixed(2)}</li>
            )}
            {opportunity.gmxMarket.volume24h && (
              <li>24h Vol: {(parseFloat(opportunity.gmxMarket.volume24h) / 1e30).toLocaleString(undefined, { maximumFractionDigits: 0 })}</li>
            )}
          </ul>
        </div>
      )}
      {opportunity.lighterStats && (
        <div>
          <h4 className="font-medium text-sm mb-1">Lighter</h4>
          <ul className="space-y-0.5">
            <li>Funding: {formatRate(opportunity.lighterData.rate)}</li>
            <li>OI: {formatSmallOI(opportunity.openInterestLighter)}</li>
            <li>Index Px: {parseFloat(opportunity.lighterStats.index_price).toFixed(3)}</li>
            <li>24h Vol: {opportunity.lighterStats.daily_quote_token_volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</li>
          </ul>
        </div>
      )}
      {opportunity.paradexMarket && (
        <div>
          <h4 className="font-medium text-sm mb-1">Paradex</h4>
          <ul className="space-y-0.5">
            <li>Funding: {formatRate(opportunity.paradexData.rate)}</li>
            <li>OI: {formatSmallOI(opportunity.openInterestParadex)}</li>
            <li>Underlying Px: {parseFloat(opportunity.paradexMarket.underlying_price).toFixed(3)}</li>
            <li>24h Vol: {parseFloat(opportunity.paradexMarket.volume_24h).toLocaleString(undefined, { maximumFractionDigits: 0 })}</li>
          </ul>
        </div>
      )}
      <div className="pt-2 text-[11px] italic text-muted-foreground">Click row to view historical data</div>
    </HoverCardContent>
  </HoverCard>
));

OpportunityRow.displayName = 'OpportunityRow';

export default function FundingArbitrageDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [externalData, setExternalData] = useState<ExternalData>({
    drift: [],
    hyperliquid: { assets: [], contexts: [] },
    gmx: [],
    paradex: []
  });
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<ArbitrageOpportunity | null>(null);
  const [showHistoricalAnalysis, setShowHistoricalAnalysis] = useState(false);
  
  // New state for filtering and sorting
  const [assetSearch, setAssetSearch] = useState<string>('');
  const [selectedProtocols, setSelectedProtocols] = useState<Protocol[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    column: 'maxSpread',
    direction: 'desc'
  });

  // Use the optimized WebSocket context
  const { isConnected: lighterWsConnected, marketData: lighterData, lastUpdateTime } = useWebSocket();

  // Fetch external data (Drift and Hyperliquid)
  const fetchExternalData = useCallback(async () => {
    try {
      setError(null);
      const [driftContracts, hyperliquidData, gmxMarkets, paradexMarkets] = await Promise.all([
        fetchDriftContracts(),
        fetchHyperliquidData(),
        fetchGMXMarkets(),
        fetchParadexMarkets() // Add this
      ]);
      
      setExternalData({
        drift: driftContracts,
        hyperliquid: hyperliquidData,
        gmx: gmxMarkets,
        paradex: paradexMarkets // Add this
      });
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching external data:', error);
      setError('Failed to fetch data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  
  // Handler for asset search input changes
  const handleAssetSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAssetSearch(e.target.value);
  }, []);

  // Handler for clearing asset search
  const handleClearAssetSearch = useCallback(() => {
    setAssetSearch('');
  }, []);

  // Handler for sorting column
  const handleSortColumn = useCallback((column: SortableColumn) => {
    setSortConfig(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  }, []);

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

    // GMX assets
    externalData.gmx.forEach(market => {
      const symbol = market.name.split('/')[0].toUpperCase();
      allAssets.add(symbol);
    });

    externalData.paradex.forEach(market => {
      const symbol = market.symbol.split('-')[0].toUpperCase();
      // Handle special cases like kBONK -> 1000BONK
      const asset = symbol.startsWith('K') && ['BONK', 'PEPE', 'FLOKI', 'SHIB'].includes(symbol.slice(1)) 
        ? `1000${symbol.slice(1)}` 
        : symbol;
      allAssets.add(asset);
    });

    // Initialize opportunities for all assets
    allAssets.forEach(asset => {
      opportunityMap.set(asset, {
        asset,
        driftData: { rate: 0, available: false },
        hyperliquidData: { rate: 0, available: false },
        lighterData: { rate: 0, available: false },
        gmxData: { rate: 0, available: false },
        paradexData: { rate: 0, available: false }, // Add this
        maxSpread: 0,
        currentAPR: 0,
        bestStrategy: '',
        openInterest: 0,
        openInterestDrift: 0,
        openInterestHyperliquid: 0,
        openInterestLighter: 0,
        openInterestParadex: 0, // Add this
        maxPriceDeviation: 0,
        driftContract: undefined,
        hyperliquidContext: undefined,
        lighterStats: undefined,
        gmxMarket: undefined,
        paradexMarket: undefined, // Add this
      });
    });

    // Process Drift data
    externalData.drift.forEach(contract => {
      const asset = contract.base_currency.toUpperCase();
      const fundingRate = parseFloat(contract.funding_rate || '0') / 100;
      const openInterest = parseFloat(contract.open_interest || '0') * parseFloat(contract.last_price || '0');
      
      const opp = opportunityMap.get(asset)!;
      opp.driftData = { rate: fundingRate, available: true };
      opp.openInterest += openInterest;
      opp.openInterestDrift = openInterest;
      opp.driftContract = contract;
    });

    // Process Hyperliquid data
    externalData.hyperliquid.assets.forEach((asset, index) => {
      const context = externalData.hyperliquid.contexts[index];
      if (!context) return;
      
      const assetName = asset.name.toUpperCase();
      const fundingRate = parseFloat(context.funding || '0') * 10;
      const openInterest = parseFloat(context.openInterest || '0') * parseFloat(context.midPx || '0');
      
      const opp = opportunityMap.get(assetName);
      if (opp) {
        opp.hyperliquidData = { rate: fundingRate, available: true };
        opp.openInterest += openInterest;
        opp.openInterestHyperliquid = openInterest;
        opp.hyperliquidContext = context;
      }
    });

    // Process Lighter data from WebSocket
    lighterData.forEach((stats, marketId) => {
      const asset = Object.entries(LIGHTER_MARKET_IDS).find(([, id]) => id === marketId)?.[0];
      if (!asset) return;
      
      const fundingRate = parseFloat(stats.current_funding_rate || stats.funding_rate || '0');
      
      // Calculate open interest in USD terms (token OI * price)
      const openInterestTokens = parseFloat(stats.open_interest || '0');
      const openInterest =  openInterestTokens 

      
      const opp = opportunityMap.get(asset);
      if (opp) {
        opp.lighterData = { rate: fundingRate / 10, available: true };
        opp.openInterest += openInterest;
        opp.openInterestLighter = openInterest;
        opp.lighterStats = stats as unknown as LighterStats;
      }
    });

    externalData.paradex.forEach(market => {
      const symbol = market.symbol.split('-')[0].toUpperCase();
      // Handle special cases like kBONK -> 1000BONK
      const asset = symbol.startsWith('K') && ['BONK', 'PEPE', 'FLOKI', 'SHIB'].includes(symbol.slice(1)) 
        ? `1000${symbol.slice(1)}` 
        : symbol;
      
      const fundingRate = parseFloat(market.funding_rate || '0'); // Already in decimal format
      const openInterest = parseFloat(market.open_interest || '0') * parseFloat(market.underlying_price || '0');
      
      const opp = opportunityMap.get(asset);
      if (opp) {
        opp.paradexData = { rate: fundingRate, available: true };
        opp.openInterest += openInterest;
        opp.openInterestParadex = openInterest;
        opp.paradexMarket = market;
      }
    });
    // Process GMX data
    externalData.gmx.forEach(market => {
      const symbol = market.name.split('/')[0].toUpperCase();
      const rateLong = gmxRate8h(market.netRateLong || market.fundingRateLong || '0');
      const rateShort = gmxRate8h(market.netRateShort || market.fundingRateShort || '0');

      // Choose the rate corresponding to holding a long perp position (positive means longs receive)
      // Here we take negative of rateShort since GMX defines short side rate; adjust as needed
      const fundingRate = rateLong !== 0 ? rateLong : -rateShort;

      const opp = opportunityMap.get(symbol);
      if (opp) {
        opp.gmxData = { rate: fundingRate, available: true };
        opp.gmxMarket = market;
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

      if (opp.paradexData.available) {
        availablePlatforms.push({ name: 'Paradex', rate: opp.paradexData.rate });
      }
      if (opp.hyperliquidData.available) {
        availablePlatforms.push({ name: 'Hyperliquid', rate: opp.hyperliquidData.rate });
      }
      
      if (opp.gmxData.available) {
        availablePlatforms.push({ name: 'GMX', rate: opp.gmxData.rate });
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

    // Filter out opportunities with no available platforms (except spot)
    const opportunitiesArray = Array.from(opportunityMap.values())
      .filter(opp => 
        opp.driftData.available || 
        opp.hyperliquidData.available || 
        opp.gmxData.available || 
        opp.lighterData.available || 
        opp.paradexData.available
      );
    
    return opportunitiesArray;
  }, [externalData, lighterData, lastUpdateTime]);

  // Apply filters and sorting to opportunities
  const filteredAndSortedOpportunities = useMemo(() => {
    return opportunities
      // Filter by asset search term
      .filter(opp => {
        if (!assetSearch.trim()) return true;
        return opp.asset.toLowerCase().includes(assetSearch.toLowerCase());
      })
      // Filter by selected protocols in Best Strategy
      .filter(opp => {
        if (selectedProtocols.length === 0) return true;
        
        // Extract protocols from bestStrategy
        // Example bestStrategy: "Long Hyperliquid / Short Drift"
        const bestStrategy = opp.bestStrategy.toLowerCase();
        return selectedProtocols.some(protocol => 
          bestStrategy.includes(protocol.toLowerCase())
        );
      })
      // Apply sorting
      .sort((a, b) => {
        let valueA: number = 0;
        let valueB: number = 0;
        
        switch (sortConfig.column) {
          case 'driftRate':
            valueA = a.driftData.available ? a.driftData.rate : -999;
            valueB = b.driftData.available ? b.driftData.rate : -999;
            break;
          case 'hyperliquidRate':
            valueA = a.hyperliquidData.available ? a.hyperliquidData.rate : -999;
            valueB = b.hyperliquidData.available ? b.hyperliquidData.rate : -999;
            break;
          case 'gmxRate':
            valueA = a.gmxData.available ? a.gmxData.rate : -999;
            valueB = b.gmxData.available ? b.gmxData.rate : -999;
            break;
          case 'lighterRate':
            valueA = a.lighterData.available ? a.lighterData.rate : -999;
            valueB = b.lighterData.available ? b.lighterData.rate : -999;
            break;
          case 'paradexRate':
            valueA = a.paradexData.available ? a.paradexData.rate : -999;
            valueB = b.paradexData.available ? b.paradexData.rate : -999;
            break;
          case 'maxSpread':
            valueA = a.maxSpread;
            valueB = b.maxSpread;
            break;
          case 'optimalAPR':
            valueA = a.currentAPR;
            valueB = b.currentAPR;
            break;
        }
        
        // Apply sort direction
        return sortConfig.direction === 'asc' 
          ? valueA - valueB 
          : valueB - valueA;
      });
  }, [opportunities, assetSearch, selectedProtocols, sortConfig]);

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

  console.log(opportunities)

  return (
    <div className="w-full max-w-7xl mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl">Funding Rate Comparison</CardTitle>
              <CardDescription>
                Delta-neutral strategies across Drift, Hyperliquid, GMX, Lighter and Paradex
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
            <div className="text-sm text-muted-foreground mb-2">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </div>
          )}

          {/* Asset search input */}
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>
              <Input
                type="text"
                placeholder="Search by asset..."
                value={assetSearch}
                onChange={handleAssetSearchChange}
                className="pl-10 pr-10 h-9"
              />
              {assetSearch && (
                <button 
                  onClick={handleClearAssetSearch}
                  className="absolute inset-y-0 right-0 flex items-center pr-3"
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>

            {/* Best Strategy protocol filter */}
            <Select 
              value={selectedProtocols.length > 0 ? 'filtered' : 'all'}
              onValueChange={(value) => {
                if (value === 'all') {
                  setSelectedProtocols([]);
                }
              }}
            >
              <SelectTrigger className="h-9 w-[220px]">
                <SelectValue>
                  {selectedProtocols.length > 0 
                    ? selectedProtocols.length === 1 
                      ? selectedProtocols[0] 
                      : `${selectedProtocols.length} protocols selected`
                    : "All protocols"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All protocols</SelectItem>
                {['Hyperliquid', 'Drift', 'Lighter', 'Paradex', 'GMX'].map((protocol) => (
                  <div 
                    key={protocol} 
                    className="flex items-center space-x-2 px-2 py-1.5 cursor-pointer hover:bg-accent"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedProtocols(prev => {
                        const protocolTyped = protocol as Protocol;
                        if (prev.includes(protocolTyped)) {
                          return prev.filter(p => p !== protocolTyped);
                        } else {
                          return [...prev, protocolTyped];
                        }
                      });
                    }}
                  >
                    <div className={`w-4 h-4 border rounded ${selectedProtocols.includes(protocol as Protocol) ? 'bg-primary border-primary' : 'border-input'}`}>
                      {selectedProtocols.includes(protocol as Protocol) && (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 text-primary-foreground">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <span>{protocol}</span>
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Asset</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    <button
                      className="flex items-center space-x-1 hover:text-primary transition-colors" 
                      onClick={() => handleSortColumn('driftRate')}
                    >
                      <TooltipProvider>
                        <TooltipComponent>
                          <TooltipTrigger asChild>
                            <div className="flex items-center space-x-1">
                              <span>Drift Rate</span>
                              {sortConfig.column === 'driftRate' && (
                                sortConfig.direction === 'asc' ? 
                                  <ChevronUp className="h-3 w-3" /> : 
                                  <ChevronDown className="h-3 w-3" />
                              )}
                              {sortConfig.column !== 'driftRate' && <ArrowUpDown className="h-3 w-3 opacity-50" />}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>8-hour funding rate</TooltipContent>
                        </TooltipComponent>
                      </TooltipProvider>
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    <button
                      className="flex items-center space-x-1 hover:text-primary transition-colors" 
                      onClick={() => handleSortColumn('hyperliquidRate')}
                    >
                      <TooltipProvider>
                        <TooltipComponent>
                          <TooltipTrigger asChild>
                            <div className="flex items-center space-x-1">
                              <span>Hyperliquid Rate</span>
                              {sortConfig.column === 'hyperliquidRate' && (
                                sortConfig.direction === 'asc' ? 
                                  <ChevronUp className="h-3 w-3" /> : 
                                  <ChevronDown className="h-3 w-3" />
                              )}
                              {sortConfig.column !== 'hyperliquidRate' && <ArrowUpDown className="h-3 w-3 opacity-50" />}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>8-hour funding rate</TooltipContent>
                        </TooltipComponent>
                      </TooltipProvider>
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    <button
                      className="flex items-center space-x-1 hover:text-primary transition-colors" 
                      onClick={() => handleSortColumn('gmxRate')}
                    >
                      <TooltipProvider>
                        <TooltipComponent>
                          <TooltipTrigger asChild>
                            <div className="flex items-center space-x-1">
                              <span>GMX Rate</span>
                              {sortConfig.column === 'gmxRate' && (
                                sortConfig.direction === 'asc' ? 
                                  <ChevronUp className="h-3 w-3" /> : 
                                  <ChevronDown className="h-3 w-3" />
                              )}
                              {sortConfig.column !== 'gmxRate' && <ArrowUpDown className="h-3 w-3 opacity-50" />}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>Hourly funding rate (approx)</TooltipContent>
                        </TooltipComponent>
                      </TooltipProvider>
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    <button
                      className="flex items-center space-x-1 hover:text-primary transition-colors" 
                      onClick={() => handleSortColumn('lighterRate')}
                    >
                      <TooltipProvider>
                        <TooltipComponent>
                          <TooltipTrigger asChild>
                            <div className="flex items-center space-x-1">
                              <span>Lighter Rate</span>
                              {sortConfig.column === 'lighterRate' && (
                                sortConfig.direction === 'asc' ? 
                                  <ChevronUp className="h-3 w-3" /> : 
                                  <ChevronDown className="h-3 w-3" />
                              )}
                              {sortConfig.column !== 'lighterRate' && <ArrowUpDown className="h-3 w-3 opacity-50" />}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>Hourly funding rate</TooltipContent>
                        </TooltipComponent>
                      </TooltipProvider>
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    <button
                      className="flex items-center space-x-1 hover:text-primary transition-colors" 
                      onClick={() => handleSortColumn('paradexRate')}
                    >
                      <TooltipProvider>
                        <TooltipComponent>
                          <TooltipTrigger asChild>
                            <div className="flex items-center space-x-1">
                              <span>Paradex Rate</span>
                              {sortConfig.column === 'paradexRate' && (
                                sortConfig.direction === 'asc' ? 
                                  <ChevronUp className="h-3 w-3" /> : 
                                  <ChevronDown className="h-3 w-3" />
                              )}
                              {sortConfig.column !== 'paradexRate' && <ArrowUpDown className="h-3 w-3 opacity-50" />}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>8-hour funding rate</TooltipContent>
                        </TooltipComponent>
                      </TooltipProvider>
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    <button
                      className="flex items-center space-x-1 hover:text-primary transition-colors" 
                      onClick={() => handleSortColumn('maxSpread')}
                    >
                      <span>Max Spread</span>
                      {sortConfig.column === 'maxSpread' && (
                        sortConfig.direction === 'asc' ? 
                          <ChevronUp className="h-3 w-3" /> : 
                          <ChevronDown className="h-3 w-3" />
                      )}
                      {sortConfig.column !== 'maxSpread' && <ArrowUpDown className="h-3 w-3 opacity-50" />}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    <button
                      className="flex items-center space-x-1 hover:text-primary transition-colors" 
                      onClick={() => handleSortColumn('optimalAPR')}
                    >
                      <TooltipProvider>
                        <TooltipComponent>
                          <TooltipTrigger asChild>
                            <div className="flex items-center space-x-1">
                              <span>Optimal APR</span>
                              {sortConfig.column === 'optimalAPR' && (
                                sortConfig.direction === 'asc' ? 
                                  <ChevronUp className="h-3 w-3" /> : 
                                  <ChevronDown className="h-3 w-3" />
                              )}
                              {sortConfig.column !== 'optimalAPR' && <ArrowUpDown className="h-3 w-3 opacity-50" />}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>Annualized return from spread</TooltipContent>
                        </TooltipComponent>
                      </TooltipProvider>
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Best Strategy</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Open Interest</th>
                  {/* <th className="px-4 py-3 text-left text-sm font-medium">
                    <TooltipProvider>
                      <TooltipComponent>
                        <TooltipTrigger>Max Deviation</TooltipTrigger>
                        <TooltipContent>Estimated max price impact</TooltipContent>
                      </TooltipComponent>
                    </TooltipProvider>
                  </th> */}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="text-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : filteredAndSortedOpportunities.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-muted-foreground">
                      {assetSearch || selectedProtocols.length > 0 ? 'No matches found for current filters' : 'No opportunities found'}
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedOpportunities.map((opp) => (
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
              <p>• Funding rates shown are per funding period (8 hours for most, 1 hour for Lighter and GMX)</p>
              <p>• APR calculation assumes continuous compounding of funding payments</p>
              <p>• &rdquo;-&rdquo; indicates market not available on that platform</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}