// "use client"
// import React, { useState, useEffect } from 'react';
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';
// import { Label } from '@/components/ui/label';
// import { Loader2, RefreshCw, TrendingUp, TrendingDown, AlertCircle, DollarSign } from 'lucide-react';
// import { Alert, AlertDescription } from '@/components/ui/alert';

// interface DriftContract {
//   base_currency: string;
//   base_volume: string;
//   contract_index: number;
//   end_timestamp: string;
//   funding_rate: string;
//   high: string;
//   index_currency: string;
//   index_name: string;
//   index_price: string;
//   last_price: string;
//   low: string;
//   next_funding_rate: string;
//   next_funding_rate_timestamp: string;
//   open_interest: string;
//   product_type: string;
//   quote_currency: string;
//   quote_volume: string;
//   start_timestamp: string;
//   ticker_id: string;
// }

// interface HyperliquidAsset {
//   name: string;
//   szDecimals: number;
//   maxLeverage: number;
//   onlyIsolated?: boolean;
// }

// interface HyperliquidAssetContext {
//   dayNtlVlm: string;
//   funding: string;
//   impactPxs: string[];
//   markPx: string;
//   midPx: string;
//   openInterest: string;
//   oraclePx: string;
//   premium: string;
//   prevDayPx: string;
// }

// interface ArbitrageOpportunity {
//   coin: string;
//   driftOI: number;
//   hyperliquidOI: number;
//   driftRate: number;
//   hyperliquidRate: number;
//   driftRateAPR: number;
//   hyperliquidRateAPR: number;
//   arbitrageSpread: number;
//   direction: 'long-drift' | 'long-hyperliquid' | 'neutral';
//   estimatedDailyProfit: number;
//   estimatedAnnualProfit: number;
//   driftMarkPrice: number;
//   hyperliquidMarkPrice: number;
//   priceDeviation: number;
// }

// function FundingArbitrageComparison() {
//   const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
//   const [loading, setLoading] = useState(false);
//   const [lastUpdate, setLastUpdate] = useState<string | null>(null);
//   const [positionSize, setPositionSize] = useState(10000);
//   const [minSpread, setMinSpread] = useState(0.01);

//   const fetchDriftContracts = async (): Promise<DriftContract[]> => {
//     try {
//       const response = await fetch('https://data.api.drift.trade/contracts');
//       if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
//       const data = await response.json();
//       return data.contracts?.filter((contract: DriftContract) => 
//         contract.product_type === 'PERP' && 
//         contract.ticker_id && 
//         contract.next_funding_rate !== null
//       ) || [];
//     } catch (error) {
//       console.error('Error fetching Drift contracts:', error);
//       return [];
//     }
//   };

//   const fetchHyperliquidData = async (): Promise<{ assets: HyperliquidAsset[], contexts: HyperliquidAssetContext[] }> => {
//     try {
//       const response = await fetch('https://api.hyperliquid.xyz/info', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ type: 'metaAndAssetCtxs' })
//       });
      
//       if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
//       const data = await response.json();
      
//       return {
//         assets: data[0]?.universe || [],
//         contexts: data[1] || []
//       };
//     } catch (error) {
//       console.error('Error fetching Hyperliquid data:', error);
//       return { assets: [], contexts: [] };
//     }
//   };

//   const calculateArbitrage = async () => {
//     setLoading(true);
//     try {
//       // Fetch data from both exchanges
//       const [driftContracts, hyperliquidData] = await Promise.all([
//         fetchDriftContracts(),
//         fetchHyperliquidData()
//       ]);

//       const { assets: hlAssets, contexts: hlContexts } = hyperliquidData;

//       // Create a map for quick lookup
//       const hlDataMap = new Map<string, { asset: HyperliquidAsset, context: HyperliquidAssetContext }>();
//       hlAssets.forEach((asset, index) => {
//         if (hlContexts[index]) {
//           hlDataMap.set(asset.name, { asset, context: hlContexts[index] });
//         }
//       });

//       // Find matching pairs and calculate arbitrage
//       const arbOpportunities: ArbitrageOpportunity[] = [];

//       driftContracts.forEach(driftContract => {
//         // Extract coin symbol from Drift ticker (e.g., "BTC-PERP" -> "BTC")
//         const coinSymbol = driftContract.ticker_id.replace('-PERP', '');
//         const hlData = hlDataMap.get(coinSymbol);

//         if (hlData) {
//           const driftRate = parseFloat(driftContract.next_funding_rate) * 100;
//           const hlRate = parseFloat(hlData.context.funding) * 100;
//           const spread = Math.abs(driftRate - hlRate);

//           // Only include if spread meets minimum threshold
//           if (spread >= minSpread) {
//             const driftMarkPrice = parseFloat(driftContract.last_price);
//             const hlMarkPrice = parseFloat(hlData.context.markPx);
//             const priceDeviation = Math.abs((driftMarkPrice - hlMarkPrice) / driftMarkPrice) * 100;

//             // Calculate profit estimates
//             const fundingPerDay = 3; // Funding paid 3 times per day (every 8 hours)
//             const dailyProfit = (spread / 100) * positionSize * fundingPerDay;
//             const annualProfit = dailyProfit * 365;

//             // Determine direction
//             let direction: 'long-drift' | 'long-hyperliquid' | 'neutral' = 'neutral';
//             if (spread > 0.001) {
//               direction = driftRate > hlRate ? 'long-hyperliquid' : 'long-drift';
//             }

//             arbOpportunities.push({
//               coin: coinSymbol,
//               driftOI: parseFloat(driftContract.open_interest),
//               hyperliquidOI: parseFloat(hlData.context.openInterest),
//               driftRate,
//               hyperliquidRate: hlRate,
//               driftRateAPR: driftRate * fundingPerDay * 365,
//               hyperliquidRateAPR: hlRate * fundingPerDay * 365,
//               arbitrageSpread: spread,
//               direction,
//               estimatedDailyProfit: dailyProfit,
//               estimatedAnnualProfit: annualProfit,
//               driftMarkPrice,
//               hyperliquidMarkPrice: hlMarkPrice,
//               priceDeviation
//             });
//           }
//         }
//       });

//       // Sort by profit potential
//       arbOpportunities.sort((a, b) => b.estimatedDailyProfit - a.estimatedDailyProfit);

//       setOpportunities(arbOpportunities);
//       setLastUpdate(new Date().toLocaleString());
//     } catch (error) {
//       console.error('Error calculating arbitrage:', error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     calculateArbitrage();
//   }, []);

//   const formatRate = (rate: number) => `${rate.toFixed(4)}%`;
//   const formatAPR = (rate: number) => `${rate.toFixed(1)}%`;
//   const formatMoney = (amount: number) => `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
//   const formatOI = (oi: number) => `$${(oi / 1000000).toFixed(2)}M`;

//   const getSpreadColor = (spread: number) => {
//     if (spread > 0.1) return 'text-green-600 font-bold';
//     if (spread > 0.05) return 'text-green-500';
//     if (spread > 0.02) return 'text-yellow-600';
//     return 'text-gray-500';
//   };

//   const getDirectionDisplay = (direction: string) => {
//     if (direction === 'long-drift') {
//       return (
//         <div className="flex items-center gap-1 text-xs">
//           <TrendingUp className="h-3 w-3 text-green-500" />
//           <span>Long Drift</span>
//           <span className="text-gray-400">/</span>
//           <TrendingDown className="h-3 w-3 text-red-500" />
//           <span>Short HL</span>
//         </div>
//       );
//     }
//     if (direction === 'long-hyperliquid') {
//       return (
//         <div className="flex items-center gap-1 text-xs">
//           <TrendingUp className="h-3 w-3 text-green-500" />
//           <span>Long HL</span>
//           <span className="text-gray-400">/</span>
//           <TrendingDown className="h-3 w-3 text-red-500" />
//           <span>Short Drift</span>
//         </div>
//       );
//     }
//     return <span className="text-xs text-gray-400">No Arb</span>;
//   };

//   return (
//     <div className="w-full mx-auto p-6 space-y-6">
//       {/* Controls */}
//       <Card>
//         <CardHeader>
//           <CardTitle className="flex items-center justify-between">
//             <span className="flex items-center gap-2">
//               <DollarSign className="h-5 w-5" />
//               Funding Rate Arbitrage Scanner
//             </span>
//             <Button 
//               onClick={calculateArbitrage} 
//               disabled={loading}
//               size="sm"
//               variant="outline"
//             >
//               {loading ? (
//                 <Loader2 className="h-4 w-4 animate-spin" />
//               ) : (
//                 <RefreshCw className="h-4 w-4" />
//               )}
//             </Button>
//           </CardTitle>
//           <CardDescription>
//             Live funding rate arbitrage opportunities between Drift and Hyperliquid
//             {lastUpdate && <span className="ml-2 text-xs">• Last updated: {lastUpdate}</span>}
//           </CardDescription>
//         </CardHeader>
//         <CardContent>
//           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//             <div>
//               <Label htmlFor="position-size">Position Size (USD)</Label>
//               <Input
//                 id="position-size"
//                 type="number"
//                 value={positionSize}
//                 onChange={(e) => setPositionSize(Number(e.target.value))}
//                 placeholder="10000"
//               />
//             </div>
//             <div>
//               <Label htmlFor="min-spread">Min Spread (%)</Label>
//               <Input
//                 id="min-spread"
//                 type="number"
//                 step="0.01"
//                 value={minSpread}
//                 onChange={(e) => setMinSpread(Number(e.target.value))}
//                 placeholder="0.01"
//               />
//             </div>
//             <div className="flex items-end">
//               <Button onClick={calculateArbitrage} className="w-full">
//                 Recalculate
//               </Button>
//             </div>
//           </div>
//         </CardContent>
//       </Card>

//       {/* Results Table */}
//       <Card>
//         <CardContent className="p-0">
//           {loading ? (
//             <div className="flex items-center justify-center h-64">
//               <Loader2 className="h-8 w-8 animate-spin" />
//               <span className="ml-2">Scanning for arbitrage opportunities...</span>
//             </div>
//           ) : opportunities.length === 0 ? (
//             <div className="flex items-center justify-center h-64">
//               <AlertCircle className="h-8 w-8 text-gray-400" />
//               <span className="ml-2 text-gray-500">No arbitrage opportunities found above {minSpread}% spread</span>
//             </div>
//           ) : (
//             <div className="overflow-x-auto">
//               <table className="w-full text-sm">
//                 <thead className="bg-gray-50">
//                   <tr>
//                     <th className="text-left py-3 px-4 font-medium">Asset</th>
//                     <th className="text-left py-3 px-4 font-medium">Drift Rate</th>
//                     <th className="text-left py-3 px-4 font-medium">HL Rate</th>
//                     <th className="text-left py-3 px-4 font-medium">Spread</th>
//                     <th className="text-left py-3 px-4 font-medium">Strategy</th>
//                     <th className="text-left py-3 px-4 font-medium">Daily Profit</th>
//                     <th className="text-left py-3 px-4 font-medium">APR</th>
//                     <th className="text-left py-3 px-4 font-medium">Open Interest</th>
//                     <th className="text-left py-3 px-4 font-medium">Price Dev</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {opportunities.map((opp) => (
//                     <tr key={opp.coin} className="border-b hover:bg-gray-50 transition-colors">
//                       <td className="py-3 px-4 font-medium">{opp.coin}</td>
//                       <td className={`py-3 px-4 ${opp.driftRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
//                         {formatRate(opp.driftRate)}
//                       </td>
//                       <td className={`py-3 px-4 ${opp.hyperliquidRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
//                         {formatRate(opp.hyperliquidRate)}
//                       </td>
//                       <td className={`py-3 px-4 ${getSpreadColor(opp.arbitrageSpread)}`}>
//                         {formatRate(opp.arbitrageSpread)}
//                       </td>
//                       <td className="py-3 px-4">{getDirectionDisplay(opp.direction)}</td>
//                       <td className="py-3 px-4 font-medium text-green-600">
//                         {formatMoney(opp.estimatedDailyProfit)}
//                       </td>
//                       <td className="py-3 px-4 text-sm">
//                         {formatAPR((opp.estimatedAnnualProfit / positionSize) * 100)}
//                       </td>
//                       <td className="py-3 px-4">
//                         <div className="text-xs">
//                           <div>D: {formatOI(opp.driftOI)}</div>
//                           <div>H: {formatOI(opp.hyperliquidOI)}</div>
//                         </div>
//                       </td>
//                       <td className={`py-3 px-4 text-xs ${opp.priceDeviation > 0.5 ? 'text-red-500' : 'text-gray-500'}`}>
//                         {opp.priceDeviation.toFixed(2)}%
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           )}
//         </CardContent>
//       </Card>

//       {/* Summary Stats */}
//       {opportunities.length > 0 && (
//         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//           <Card>
//             <CardHeader className="pb-3">
//               <CardTitle className="text-sm font-medium">Top Opportunity</CardTitle>
//             </CardHeader>
//             <CardContent>
//               <div className="text-2xl font-bold">{opportunities[0].coin}</div>
//               <p className="text-xs text-gray-500">
//                 {formatMoney(opportunities[0].estimatedDailyProfit)} daily profit
//               </p>
//             </CardContent>
//           </Card>

//           <Card>
//             <CardHeader className="pb-3">
//               <CardTitle className="text-sm font-medium">Total Daily Profit</CardTitle>
//             </CardHeader>
//             <CardContent>
//               <div className="text-2xl font-bold">
//                 {formatMoney(opportunities.reduce((sum, opp) => sum + opp.estimatedDailyProfit, 0))}
//               </div>
//               <p className="text-xs text-gray-500">
//                 Across {opportunities.length} opportunities
//               </p>
//             </CardContent>
//           </Card>

//           <Card>
//             <CardHeader className="pb-3">
//               <CardTitle className="text-sm font-medium">Average APR</CardTitle>
//             </CardHeader>
//             <CardContent>
//               <div className="text-2xl font-bold">
//                 {formatAPR(
//                   (opportunities.reduce((sum, opp) => sum + opp.estimatedAnnualProfit, 0) / 
//                   (opportunities.length * positionSize)) * 100
//                 )}
//               </div>
//               <p className="text-xs text-gray-500">
//                 Market neutral returns
//               </p>
//             </CardContent>
//           </Card>
//         </div>
//       )}

//       {/* Strategy Guide */}
//       <Alert>
//         <AlertCircle className="h-4 w-4" />
//         <AlertDescription>
//           <strong>Basis Trading Strategy:</strong> This scanner identifies funding rate disparities between exchanges. 
//           When you &quot;Long Drift / Short HL&quot;, you&apos;re earning the spread between the two funding rates every 8 hours. 
//           Consider transaction costs (~0.05% per trade), slippage, and maintain balanced positions to remain market neutral.
//         </AlertDescription>
//       </Alert>
//     </div>
//   );
// }

// export default FundingArbitrageComparison;


"use client"
// Funding Rate Arbitrage Scanner
// Compares two strategies:
// 1. Cross-exchange arbitrage: Long low-funding exchange, short high-funding exchange
// 2. Spot + Perp: Buy spot, then long/short perp based on funding direction
//    - Positive funding: shorts receive (buy spot + short perp)
//    - Negative funding: longs receive (buy spot + long perp)
// For Drift positions, assumes spot is available via Solana DEXs

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, RefreshCw, TrendingUp, TrendingDown, AlertCircle, DollarSign, Info, Coins } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

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

interface HyperliquidSpotToken {
  name: string;
  szDecimals: number;
  weiDecimals: number;
  index: number;
  tokenId: string;
  isCanonical: boolean;
  evmContract: string | null;
  fullName: string | null;
}

interface HyperliquidSpotPair {
  name: string;
  tokens: number[];
  index: number;
  isCanonical: boolean;
}

interface HyperliquidSpotContext {
  dayNtlVlm: string;
  markPx: string;
  midPx: string;
  prevDayPx: string;
}

interface ArbitrageOpportunity {
  coin: string;
  // Cross-exchange arbitrage data
  driftOI: number;
  hyperliquidOI: number;
  driftRate: number;
  hyperliquidRate: number;
  driftRateAPR: number;
  hyperliquidRateAPR: number;
  arbitrageSpread: number;
  crossExchangeDirection: 'long-drift' | 'long-hyperliquid' | 'neutral';
  crossExchangeDailyProfit: number;
  crossExchangeAnnualProfit: number;
  // Spot + Perp data
  hasSpotMarket: boolean;
  spotPrice?: number;
  spotPerpDailyProfit?: number;
  spotPerpAnnualProfit?: number;
  spotPerpExchange?: 'drift' | 'hyperliquid';
  spotPerpDirection?: 'long' | 'short';
  // Best strategy
  bestStrategy: 'cross-exchange' | 'spot-perp' | 'none';
  bestStrategyDailyProfit: number;
  bestStrategyAPR: number;
  // Price data
  driftMarkPrice: number;
  hyperliquidMarkPrice: number;
  priceDeviation: number;
}

function FundingArbitrageComparison() {
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [positionSize, setPositionSize] = useState(10000);
  const [minSpread, setMinSpread] = useState(0.01);
  const [minAbsoluteRate, setMinAbsoluteRate] = useState(0.05);

  const fetchDriftContracts = async (): Promise<DriftContract[]> => {
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

  const fetchHyperliquidData = async (): Promise<{ assets: HyperliquidAsset[], contexts: HyperliquidAssetContext[] }> => {
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

  const fetchHyperliquidSpotData = async (): Promise<{ 
    tokens: HyperliquidSpotToken[], 
    pairs: HyperliquidSpotPair[], 
    contexts: HyperliquidSpotContext[] 
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

  const calculateArbitrage = async () => {
    setLoading(true);
    try {
      // Fetch data from both exchanges
      const [driftContracts, hyperliquidData, hyperliquidSpotData] = await Promise.all([
        fetchDriftContracts(),
        fetchHyperliquidData(),
        fetchHyperliquidSpotData()
      ]);

      const { assets: hlAssets, contexts: hlContexts } = hyperliquidData;
      const { tokens: spotTokens, pairs: spotPairs, contexts: spotContexts } = hyperliquidSpotData;

      // Create maps for quick lookup
      const hlDataMap = new Map<string, { asset: HyperliquidAsset, context: HyperliquidAssetContext }>();
      hlAssets.forEach((asset, index) => {
        if (hlContexts[index]) {
          hlDataMap.set(asset.name, { asset, context: hlContexts[index] });
        }
      });

      // Create spot market map
      const spotMarketMap = new Map<string, { pair: HyperliquidSpotPair, context: HyperliquidSpotContext }>();
      spotPairs.forEach((pair, index) => {
        if (spotContexts[index] && pair.name.endsWith('/USDC')) {
          const tokenName = pair.name.replace('/USDC', '');
          spotMarketMap.set(tokenName, { pair, context: spotContexts[index] });
        }
      });

      // Find matching pairs and calculate arbitrage
      const arbOpportunities: ArbitrageOpportunity[] = [];

      driftContracts.forEach(driftContract => {
        // Extract coin symbol from Drift ticker (e.g., "BTC-PERP" -> "BTC")
        const coinSymbol = driftContract.ticker_id.replace('-PERP', '');
        const hlData = hlDataMap.get(coinSymbol);

        if (hlData) {
          const driftRate = parseFloat(driftContract.next_funding_rate) * 100;
          const hlRate = parseFloat(hlData.context.funding) * 100;
          const spread = Math.abs(driftRate - hlRate);
          const driftMarkPrice = parseFloat(driftContract.last_price);
          const hlMarkPrice = parseFloat(hlData.context.markPx);
          const priceDeviation = Math.abs((driftMarkPrice - hlMarkPrice) / driftMarkPrice) * 100;

          // Check for spot market
          const spotMarket = spotMarketMap.get(coinSymbol);
          const hasSpotMarket = !!spotMarket;
          const spotPrice = spotMarket ? parseFloat(spotMarket.context.markPx) : undefined;

          // Calculate profits for both strategies
          const fundingPerDay = 3; // Funding paid 3 times per day (every 8 hours)
          
          // Cross-exchange arbitrage
          const crossExchangeDailyProfit = (spread / 100) * positionSize * fundingPerDay;
          const crossExchangeAnnualProfit = crossExchangeDailyProfit * 365;

          // Spot + Perp strategy
          // We can always do spot+perp on Drift (using Solana DEX for spot)
          // We can do spot+perp on HL only if HL has spot market
          let spotPerpDailyProfit = 0;
          let spotPerpAnnualProfit = 0;
          let spotPerpExchange: 'drift' | 'hyperliquid' | undefined;
          let spotPerpDirection: 'long' | 'short' | undefined;
          
          // Always consider Drift spot+perp (spot via Solana DEX)
          if (Math.abs(driftRate) >= minAbsoluteRate) {
            spotPerpDailyProfit = Math.abs(driftRate) / 100 * positionSize * fundingPerDay;
            spotPerpAnnualProfit = spotPerpDailyProfit * 365;
            spotPerpExchange = 'drift';
            // If rate is positive, shorts receive funding. If negative, longs receive.
            spotPerpDirection = driftRate > 0 ? 'short' : 'long';
          }
          
          // Consider HL spot+perp only if HL has spot market
          if (hasSpotMarket && Math.abs(hlRate) >= minAbsoluteRate) {
            const hlProfit = Math.abs(hlRate) / 100 * positionSize * fundingPerDay;
            if (hlProfit > spotPerpDailyProfit) {
              spotPerpDailyProfit = hlProfit;
              spotPerpAnnualProfit = hlProfit * 365;
              spotPerpExchange = 'hyperliquid';
              spotPerpDirection = hlRate > 0 ? 'short' : 'long';
            }
          }

          // Determine best strategy
          let bestStrategy: 'cross-exchange' | 'spot-perp' | 'none' = 'none';
          let bestStrategyDailyProfit = 0;
          
          if (spread >= minSpread && crossExchangeDailyProfit > spotPerpDailyProfit) {
            bestStrategy = 'cross-exchange';
            bestStrategyDailyProfit = crossExchangeDailyProfit;
          } else if (spotPerpDailyProfit > 0 && spotPerpDailyProfit > crossExchangeDailyProfit) {
            bestStrategy = 'spot-perp';
            bestStrategyDailyProfit = spotPerpDailyProfit;
          } else if (spread >= minSpread) {
            bestStrategy = 'cross-exchange';
            bestStrategyDailyProfit = crossExchangeDailyProfit;
          }

          // Only include if there's a profitable strategy
          if (bestStrategy !== 'none') {
            // Determine cross-exchange direction
            let crossExchangeDirection: 'long-drift' | 'long-hyperliquid' | 'neutral' = 'neutral';
            if (spread > 0.001) {
              crossExchangeDirection = driftRate > hlRate ? 'long-hyperliquid' : 'long-drift';
            }

            const bestStrategyAPR = bestStrategy === 'cross-exchange' 
              ? (crossExchangeAnnualProfit / positionSize) * 100
              : (spotPerpAnnualProfit / positionSize) * 100;

            arbOpportunities.push({
              coin: coinSymbol,
              driftOI: parseFloat(driftContract.open_interest),
              hyperliquidOI: parseFloat(hlData.context.openInterest),
              driftRate,
              hyperliquidRate: hlRate,
              driftRateAPR: driftRate * fundingPerDay * 365,
              hyperliquidRateAPR: hlRate * fundingPerDay * 365,
              arbitrageSpread: spread,
              crossExchangeDirection,
              crossExchangeDailyProfit,
              crossExchangeAnnualProfit,
              hasSpotMarket,
              spotPrice,
              spotPerpDailyProfit,
              spotPerpAnnualProfit,
              spotPerpExchange,
              spotPerpDirection,
              bestStrategy,
              bestStrategyDailyProfit,
              bestStrategyAPR,
              driftMarkPrice,
              hyperliquidMarkPrice: hlMarkPrice,
              priceDeviation
            });
          }
        }
      });

      // Sort by best strategy profit potential
      arbOpportunities.sort((a, b) => b.bestStrategyDailyProfit - a.bestStrategyDailyProfit);

      setOpportunities(arbOpportunities);
      setLastUpdate(new Date().toLocaleString());
    } catch (error) {
      console.error('Error calculating arbitrage:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateArbitrage();
  }, []);

  const formatRate = (rate: number) => `${rate.toFixed(4)}%`;
  const formatAPR = (rate: number) => `${rate.toFixed(1)}%`;
  const formatMoney = (amount: number) => `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatOI = (oi: number) => `$${(oi / 1000000).toFixed(2)}M`;

  const getSpreadColor = (spread: number) => {
    if (spread > 0.1) return 'text-green-600 font-bold';
    if (spread > 0.05) return 'text-green-500';
    if (spread > 0.02) return 'text-yellow-600';
    return 'text-gray-500';
  };

  const getStrategyDisplay = (opp: ArbitrageOpportunity) => {
    if (opp.bestStrategy === 'cross-exchange') {
      if (opp.crossExchangeDirection === 'long-drift') {
        return (
          <Tooltip>
            <TooltipTrigger>
              <div className="flex items-center gap-1 text-xs">
                <TrendingUp className="h-3 w-3 text-green-500" />
                <span>Long Drift</span>
                <span className="text-gray-400">/</span>
                <TrendingDown className="h-3 w-3 text-red-500" />
                <span>Short HL</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Cross-exchange arbitrage: Long on Drift (lower funding) and Short on Hyperliquid (higher funding) to earn the spread</p>
            </TooltipContent>
          </Tooltip>
        );
      }
      return (
        <Tooltip>
          <TooltipTrigger>
            <div className="flex items-center gap-1 text-xs">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span>Long HL</span>
              <span className="text-gray-400">/</span>
              <TrendingDown className="h-3 w-3 text-red-500" />
              <span>Short Drift</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Cross-exchange arbitrage: Long on Hyperliquid (lower funding) and Short on Drift (higher funding) to earn the spread</p>
          </TooltipContent>
        </Tooltip>
      );
    } else if (opp.bestStrategy === 'spot-perp') {
      const exchange = opp.spotPerpExchange === 'hyperliquid' ? 'HL' : 'Drift';
      const rate = opp.spotPerpExchange === 'hyperliquid' ? opp.hyperliquidRate : opp.driftRate;
      const isLong = opp.spotPerpDirection === 'long';
      const spotLocation = opp.spotPerpExchange === 'hyperliquid' ? 'HL' : 'Solana DEX';
      
      return (
        <Tooltip>
          <TooltipTrigger>
            <div className="flex items-center gap-1 text-xs">
              <Coins className="h-3 w-3 text-blue-500" />
              <span>Spot + {isLong ? 'Long' : 'Short'} {exchange}</span>
              <Badge variant="outline" className="ml-1 text-xs h-4 px-1">
                {isLong ? 'Longs receive' : 'Shorts receive'}
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p>Buy spot on {spotLocation} and {isLong ? 'long' : 'short'} perp on {opp.spotPerpExchange === 'hyperliquid' ? 'Hyperliquid' : 'Drift'}. 
            {rate > 0 ? ' Shorts receive funding payments.' : ' Longs receive funding payments (negative funding).'}
            This captures the full {Math.abs(rate).toFixed(3)}% funding rate.</p>
          </TooltipContent>
        </Tooltip>
      );
    }
    return <span className="text-xs text-gray-400">No Arb</span>;
  };

  return (
    <TooltipProvider>
      <div className="w-full mx-auto p-6 space-y-6">
        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Funding Rate Arbitrage Scanner
              </span>
              <Button 
                onClick={calculateArbitrage} 
                disabled={loading}
                size="sm"
                variant="outline"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </CardTitle>
            <CardDescription>
              Compares cross-exchange arbitrage vs spot+short strategies to find the best opportunities
              {lastUpdate && <span className="ml-2 text-xs">• Last updated: {lastUpdate}</span>}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="position-size">Position Size (USD)</Label>
                <Input
                  id="position-size"
                  type="number"
                  value={positionSize}
                  onChange={(e) => setPositionSize(Number(e.target.value))}
                  placeholder="10000"
                />
              </div>
              <div>
                <Label htmlFor="min-spread">
                  Min Spread (%)
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="inline h-3 w-3 ml-1 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Minimum funding rate difference for cross-exchange arbitrage</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  id="min-spread"
                  type="number"
                  step="0.01"
                  value={minSpread}
                  onChange={(e) => setMinSpread(Number(e.target.value))}
                  placeholder="0.01"
                />
              </div>
              <div>
                <Label htmlFor="min-absolute">
                  Min Absolute Rate (%)
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="inline h-3 w-3 ml-1 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Minimum absolute funding rate for spot+perp strategy (works for both positive and negative rates)</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  id="min-absolute"
                  type="number"
                  step="0.01"
                  value={minAbsoluteRate}
                  onChange={(e) => setMinAbsoluteRate(Number(e.target.value))}
                  placeholder="0.05"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={calculateArbitrage} className="w-full">
                  Recalculate
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Scanning for arbitrage opportunities...</span>
              </div>
            ) : opportunities.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <AlertCircle className="h-8 w-8 text-gray-400" />
                <span className="ml-2 text-gray-500">No profitable opportunities found with current filters</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium">Asset</th>
                      <th className="text-left py-3 px-4 font-medium">Drift Rate</th>
                      <th className="text-left py-3 px-4 font-medium">HL Rate</th>
                      <th className="text-left py-3 px-4 font-medium">Spread</th>
                      <th className="text-left py-3 px-4 font-medium">
                        Best Strategy
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="inline h-3 w-3 ml-1 text-gray-400" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Automatically selects the most profitable strategy: cross-exchange arbitrage or spot+perp (long/short based on funding direction)</p>
                          </TooltipContent>
                        </Tooltip>
                      </th>
                      <th className="text-left py-3 px-4 font-medium">Daily Profit</th>
                      <th className="text-left py-3 px-4 font-medium">APR</th>
                      <th className="text-left py-3 px-4 font-medium">
                        Spot
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="inline h-3 w-3 ml-1 text-gray-400" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Shows if spot market exists on Hyperliquid. For Drift strategies, we assume spot is available via Solana DEXs.</p>
                          </TooltipContent>
                        </Tooltip>
                      </th>
                      <th className="text-left py-3 px-4 font-medium">Open Interest</th>
                      <th className="text-left py-3 px-4 font-medium">Price Dev</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opportunities.map((opp) => (
                      <tr key={opp.coin} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 font-medium">{opp.coin}</td>
                        <td className={`py-3 px-4 ${opp.driftRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatRate(opp.driftRate)}
                          {opp.driftRate < 0 && (
                            <span className="ml-1 text-xs text-gray-500">(longs receive)</span>
                          )}
                        </td>
                        <td className={`py-3 px-4 ${opp.hyperliquidRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatRate(opp.hyperliquidRate)}
                          {opp.hyperliquidRate < 0 && (
                            <span className="ml-1 text-xs text-gray-500">(longs receive)</span>
                          )}
                        </td>
                        <td className={`py-3 px-4 ${getSpreadColor(opp.arbitrageSpread)}`}>
                          {formatRate(opp.arbitrageSpread)}
                        </td>
                        <td className="py-3 px-4">{getStrategyDisplay(opp)}</td>
                        <td className="py-3 px-4 font-medium text-green-600">
                          <Tooltip>
                            <TooltipTrigger>
                              <span>{formatMoney(opp.bestStrategyDailyProfit)}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {opp.bestStrategy === 'cross-exchange' 
                                ? `Earning ${opp.arbitrageSpread.toFixed(3)}% spread × 3 times daily`
                                : `Earning ${Math.abs(opp.spotPerpExchange === 'drift' ? opp.driftRate : opp.hyperliquidRate).toFixed(3)}% × 3 times daily`
                              }
                            </TooltipContent>
                          </Tooltip>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {formatAPR(opp.bestStrategyAPR)}
                        </td>
                        <td className="py-3 px-4">
                          {opp.hasSpotMarket ? (
                            <Badge variant="secondary" className="text-xs">
                              <Coins className="h-3 w-3 mr-1" />
                              HL
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-gray-400">
                              DEX only
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-xs">
                            <div>D: {formatOI(opp.driftOI)}</div>
                            <div>H: {formatOI(opp.hyperliquidOI)}</div>
                          </div>
                        </td>
                        <td className={`py-3 px-4 text-xs ${opp.priceDeviation > 0.5 ? 'text-red-500' : 'text-gray-500'}`}>
                          {opp.priceDeviation.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Stats */}
        {opportunities.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Top Opportunity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{opportunities[0].coin}</div>
                <p className="text-xs text-gray-500">
                  {formatMoney(opportunities[0].bestStrategyDailyProfit)} daily
                </p>
                <Badge variant="secondary" className="mt-1 text-xs">
                  {opportunities[0].bestStrategy === 'cross-exchange' ? 'Cross-Exchange' : 'Spot+Perp'}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total Daily Profit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatMoney(opportunities.reduce((sum, opp) => sum + opp.bestStrategyDailyProfit, 0))}
                </div>
                <p className="text-xs text-gray-500">
                  Across {opportunities.length} opportunities
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Average APR</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatAPR(
                    opportunities.reduce((sum, opp) => sum + opp.bestStrategyAPR, 0) / opportunities.length
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Market neutral returns
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Strategy Mix</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <div className="text-xs">
                    Cross-Exchange: {opportunities.filter(o => o.bestStrategy === 'cross-exchange').length}
                  </div>
                  <div className="text-xs">
                    Spot+Perp: {opportunities.filter(o => o.bestStrategy === 'spot-perp').length}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Strategy Guide */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Alert>
            <TrendingUp className="h-4 w-4" />
            <AlertDescription>
              <strong>Cross-Exchange Arbitrage:</strong> Long the exchange with lower funding rate and short the one with higher funding rate. 
              You earn the spread between the two rates every 8 hours while remaining market neutral. 
              Best when there&apos;s a significant rate difference between exchanges.
            </AlertDescription>
          </Alert>
          
          <Alert>
            <Coins className="h-4 w-4" />
            <AlertDescription>
              <strong>Spot + Perp Strategy:</strong> Buy spot and either long or short the perpetual based on funding direction. 
              When funding is positive, shorts receive payments. When negative, longs receive payments. 
              This captures the full funding rate. For Drift positions, spot is purchased on Solana DEXs like Jupiter.
            </AlertDescription>
          </Alert>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Important Notes:</strong>
            <ul className="list-disc list-inside mt-1 text-xs space-y-1">
              <li>Drift doesn&apos;t have spot markets - you&apos;d need to use a Solana DEX like Jupiter for spot purchases</li>
              <li>For negative funding rates, longs receive payments - buy spot and long the perp</li>
              <li>For positive funding rates, shorts receive payments - buy spot and short the perp</li>
              <li>Consider transaction costs (~0.05% per trade), slippage, and gas fees</li>
              <li>Monitor positions closely - funding rates can change every 8 hours</li>
              <li>Maintain sufficient margin to avoid liquidation during price movements</li>
            </ul>
          </AlertDescription>
        </Alert>
      </div>
    </TooltipProvider>
  );
}

export default FundingArbitrageComparison;