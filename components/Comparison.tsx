// /* eslint-disable @typescript-eslint/no-explicit-any */
// "use client"
// // Enhanced Funding Rate Arbitrage Scanner with Historical Analysis
// // Compares two strategies and provides detailed historical profit analysis

// import React, { useState, useEffect } from 'react';
// import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, Tooltip } from 'recharts';
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';
// import { Label } from '@/components/ui/label';
// import { Loader2, RefreshCw, TrendingUp, TrendingDown, AlertCircle, DollarSign, Info, Coins, ArrowLeft, BarChart3 } from 'lucide-react';
// import { Alert, AlertDescription } from '@/components/ui/alert';
// import { Tooltip as TooltipComponent, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
// import { Badge } from '@/components/ui/badge';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
//   lighterOI?: number;
//   driftRate: number;
//   hyperliquidRate: number;
//   lighterRate?: number;
//   driftRateAPR: number;
//   hyperliquidRateAPR: number;
//   lighterRateAPR?: number;
//   arbitrageSpread: number;
//   crossExchangeDirection: 'long-drift' | 'long-hyperliquid' | 'long-lighter' | 'neutral';
//   crossExchangePair?: 'drift-hyperliquid' | 'drift-lighter' | 'hyperliquid-lighter';
//   crossExchangeDailyProfit: number;
//   crossExchangeAnnualProfit: number;
//   hasSpotMarket: boolean;
//   spotPrice?: number;
//   spotPerpDailyProfit?: number;
//   spotPerpAnnualProfit?: number;
//   spotPerpExchange?: 'drift' | 'hyperliquid' | 'lighter';
//   spotPerpDirection?: 'long' | 'short';
//   altSpotPerpProfit?: number;
//   altSpotPerpExchange?: 'drift' | 'hyperliquid' | 'lighter';
//   bestStrategy: 'cross-exchange' | 'spot-perp' | 'none';
//   bestStrategyDailyProfit: number;
//   bestStrategyAPR: number;
//   driftMarkPrice: number;
//   hyperliquidMarkPrice: number;
//   lighterMarkPrice?: number;
//   priceDeviation: number;
// }

// interface DriftFundingRate {
//   txSig: string;
//   slot: number;
//   ts: string;
//   recordId: string;
//   marketIndex: number;
//   fundingRate: string;
//   cumulativeFundingRateLong: string;
//   cumulativeFundingRateShort: string;
//   oraclePriceTwap: string;
//   markPriceTwap: string;
//   fundingRateLong: string;
//   fundingRateShort: string;
//   periodRevenue: string;
//   baseAssetAmountWithAmm: string;
//   baseAssetAmountWithUnsettledLp: string;
// }

// interface HyperliquidFundingEntry {
//   time: number;
//   fundingRate: string;
// }

// interface LighterFundingEntry {
//   timestamp: number;
//   value: string;
//   rate: string;
//   direction: 'long' | 'short';
// }

// interface LighterMarketMapping {
//   market_id: number;
//   symbol: string;
// }

// // Lighter market mappings from utils.ts
// const LIGHTER_MARKET_MAPPINGS: LighterMarketMapping[] = [
//   {market_id: 14, symbol: "POL"},
//   {market_id: 15, symbol: "TRUMP"},
//   {market_id: 38, symbol: "ONDO"},
//   {market_id: 20, symbol: "BERA"},
//   {market_id: 32, symbol: "SEI"},
//   {market_id: 34, symbol: "IP"},
//   {market_id: 5, symbol: "WIF"},
//   {market_id: 2, symbol: "SOL"},
//   {market_id: 1, symbol: "BTC"},
//   {market_id: 3, symbol: "ETH"},
//   {market_id: 4, symbol: "ARB"},
//   {market_id: 6, symbol: "OP"},
//   {market_id: 7, symbol: "AVAX"},
//   {market_id: 8, symbol: "LINK"},
//   {market_id: 9, symbol: "MATIC"},
//   {market_id: 10, symbol: "CRV"},
//   {market_id: 11, symbol: "LDO"},
//   {market_id: 12, symbol: "ADA"},
//   {market_id: 13, symbol: "DOGE"}
// ];

// interface HistoricalDataPoint {
//   timestamp: number;
//   date: string;
//   driftRate?: number;
//   hyperliquidRate?: number;
//   lighterRate?: number;
//   crossExchangeProfit?: number;
//   spotPerpProfit?: number;
//   cumulativeCrossExchange?: number;
//   cumulativeSpotPerp?: number;
// }

// interface HistoricalAnalysis {
//   totalCrossExchangeProfit: number;
//   totalSpotPerpProfit: number;
//   bestPerformingStrategy: 'cross-exchange' | 'spot-perp';
//   avgDailyProfit: number;
//   maxDailyProfit: number;
//   winRate: number;
//   sharpeRatio: number;
// }

// function FundingArbitrageWithDetails() {
//   const [currentView, setCurrentView] = useState<'scanner' | 'details'>('scanner');
//   const [selectedOpportunity, setSelectedOpportunity] = useState<ArbitrageOpportunity | null>(null);
//   const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
//   const [loading, setLoading] = useState(false);
//   const [lastUpdate, setLastUpdate] = useState<string | null>(null);
//   const [positionSize, setPositionSize] = useState(10000);
//   const [minSpread, setMinSpread] = useState(0.01);
//   const [minAbsoluteRate, setMinAbsoluteRate] = useState(0.05);

//   // Historical analysis state
//   const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
//   const [historicalAnalysis, setHistoricalAnalysis] = useState<HistoricalAnalysis | null>(null);
//   const [timeRange, setTimeRange] = useState<number>(7); // days
//   const [historicalLoading, setHistoricalLoading] = useState(false);

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

//   const fetchHyperliquidSpotData = async (): Promise<{ 
//     tokens: any[], 
//     pairs: any[], 
//     contexts: any[] 
//   }> => {
//     try {
//       const response = await fetch('https://api.hyperliquid.xyz/info', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ type: 'spotMetaAndAssetCtxs' })
//       });
      
//       if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
//       const data = await response.json();
      
//       return {
//         tokens: data[0]?.tokens || [],
//         pairs: data[0]?.universe || [],
//         contexts: data[1] || []
//       };
//     } catch (error) {
//       console.error('Error fetching Hyperliquid spot data:', error);
//       return { tokens: [], pairs: [], contexts: [] };
//     }
//   };

//   const fetchLighterCurrentFunding = async (): Promise<Map<string, LighterFundingEntry>> => {
//     const currentFundingMap = new Map<string, LighterFundingEntry>();
//     const currentTime = Date.now();
    
//     try {
//       // Fetch last 2 hours of funding data for each market
//       const promises = LIGHTER_MARKET_MAPPINGS.map(async (market) => {
//         const endTime = currentTime;
//         const startTime = currentTime - (2 * 60 * 60 * 1000); // 2 hours back
        
//         const response = await fetch(
//           `https://mainnet.zklighter.elliot.ai/api/v1/fundings?market_id=${market.market_id}&resolution=1h&start_timestamp=${startTime}&end_timestamp=${endTime}&count_back=2`,
//           { headers: { 'accept': 'application/json' } }
//         );
        
//         if (!response.ok) return;
        
//         const data = await response.json();
//         if (data.fundings && data.fundings.length > 0) {
//           // Get the most recent funding entry
//           const latestFunding = data.fundings[data.fundings.length - 1];
//           currentFundingMap.set(market.symbol, latestFunding);
//         }
//       });
      
//       await Promise.all(promises);
//     } catch (error) {
//       console.error('Error fetching Lighter funding data:', error);
//     }
    
//     return currentFundingMap;
//   };

//   const fetchLighterFundingHistory = async (symbol: string, startTime: number, endTime: number): Promise<LighterFundingEntry[]> => {
//     try {
//       console.log("Fetching Lighter funding history for symbol:", symbol);
//       const market = LIGHTER_MARKET_MAPPINGS.find(m => m.symbol === symbol);
//       if (!market) return [];
//       console.log("eee")
//       const response = await fetch(
//         `https://mainnet.zklighter.elliot.ai/api/v1/fundings?market_id=${market.market_id}&resolution=1h&start_timestamp=${startTime}&end_timestamp=${endTime}&count_back=1000`,
//         { headers: { 'accept': 'application/json' } }
//       );
      
//       if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
//       const data = await response.json();

//       console.log(data)
      
//       return data.fundings || [];
//     } catch (error) {
//       console.error(`Error fetching Lighter funding history for ${symbol}:`, error);
//       return [];
//     }
//   };

//   // Historical data fetching functions
//   const fetchDriftFundingHistory = async (marketSymbol: string): Promise<DriftFundingRate[]> => {
//     try {
//       const response = await fetch(`https://data.api.drift.trade/fundingRates?marketName=${marketSymbol}`);
//       if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
//       const data = await response.json();
//       return data.fundingRates || [];
//     } catch (error) {
//       console.error(`Error fetching Drift funding history for ${marketSymbol}:`, error);
//       return [];
//     }
//   };

//   const fetchHyperliquidFundingHistory = async (coin: string, startTime: number, endTime: number): Promise<HyperliquidFundingEntry[]> => {
//     try {
//       const response = await fetch('https://api.hyperliquid.xyz/info', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           type: 'fundingHistory',
//           coin: coin,
//           startTime: startTime,
//           endTime: endTime
//         })
//       });
      
//       if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
//       const data: HyperliquidFundingEntry[] = await response.json();
      
//       // Analysis of time range in the returned data is performed later
      
//       return data;
//     } catch (error) {
//       console.error(`Error fetching Hyperliquid funding history for ${coin}:`, error);
//       return [];
//     }
//   };

//   const calculateArbitrage = async () => {
//     setLoading(true);
//     try {
//       const [driftContracts, hyperliquidData, hyperliquidSpotData, lighterFunding] = await Promise.all([
//         fetchDriftContracts(),
//         fetchHyperliquidData(),
//         fetchHyperliquidSpotData(),
//         fetchLighterCurrentFunding()
//       ]);

//       const { assets: hlAssets, contexts: hlContexts } = hyperliquidData;
//       const { pairs: spotPairs, contexts: spotContexts } = hyperliquidSpotData;

//       const hlDataMap = new Map<string, { asset: HyperliquidAsset, context: HyperliquidAssetContext }>();
//       hlAssets.forEach((asset, index) => {
//         if (hlContexts[index]) {
//           hlDataMap.set(asset.name, { asset, context: hlContexts[index] });
//         }
//       });

//       const spotMarketMap = new Map<string, { pair: any, context: any }>();
//       spotPairs.forEach((pair, index) => {
//         if (spotContexts[index] && pair.name.includes('/')) {
//           const tokenName = pair.name.split('/')[0];
//           spotMarketMap.set(tokenName, { pair, context: spotContexts[index] });
//         }
//       });

//       const arbOpportunities: ArbitrageOpportunity[] = [];

//       driftContracts.forEach(driftContract => {
//         const coinSymbol = driftContract.ticker_id.replace('-PERP', '');
//         const hlData = hlDataMap.get(coinSymbol);
//         const lighterData = lighterFunding.get(coinSymbol);

//         if (hlData || lighterData) {
//           const driftRate = parseFloat(driftContract.next_funding_rate) * 100;
//           const hlRate = hlData ? parseFloat(hlData.context.funding) * 100 : null;
          
//           // Convert Lighter rate and adjust for direction
//           let lighterRate: number | null = null;
//           if (lighterData) {
//             const rate = parseFloat(lighterData.rate) * 100;
//             // If direction is "short", it means shorts pay longs (negative funding)
//             lighterRate = lighterData.direction === 'long' ? rate : -rate;
//           }

//           const driftMarkPrice = parseFloat(driftContract.last_price);
//           const hlMarkPrice = hlData ? parseFloat(hlData.context.markPx) : null;
          
//           const spotMarket = spotMarketMap.get(coinSymbol);
//           const hasSpotMarket = !!spotMarket;
//           const spotPrice = spotMarket ? parseFloat(spotMarket.context.markPx) : undefined;

//           // Calculate funding periods per day
//           const driftFundingPerDay = 3;
//           const hlFundingPerDay = 3;
//           const lighterFundingPerDay = 24; // Hourly funding

//           // Calculate best cross-exchange arbitrage
//           let bestCrossExchangeSpread = 0;
//           let bestCrossExchangePair: 'drift-hyperliquid' | 'drift-lighter' | 'hyperliquid-lighter' | null = null;
//           let crossExchangeDirection: 'long-drift' | 'long-hyperliquid' | 'long-lighter' | 'neutral' = 'neutral';
          
//           // Drift vs Hyperliquid
//           if (hlRate !== null) {
//             const driftHlSpread = Math.abs(driftRate - hlRate);
//             if (driftHlSpread > bestCrossExchangeSpread && driftHlSpread >= minSpread) {
//               bestCrossExchangeSpread = driftHlSpread;
//               bestCrossExchangePair = 'drift-hyperliquid';
//               crossExchangeDirection = driftRate > hlRate ? 'long-hyperliquid' : 'long-drift';
//             }
//           }
          
//           // Drift vs Lighter (normalize to same time period)
//           if (lighterRate !== null) {
//             // Convert to comparable daily rates
//             const driftDailyRate = driftRate * driftFundingPerDay;
//             const lighterDailyRate = lighterRate * lighterFundingPerDay;
//             const normalizedLighterRate = lighterDailyRate / driftFundingPerDay; // Back to per-funding rate
            
//             const driftLighterSpread = Math.abs(driftRate - normalizedLighterRate);
//             if (driftLighterSpread > bestCrossExchangeSpread && driftLighterSpread >= minSpread) {
//               bestCrossExchangeSpread = driftLighterSpread;
//               bestCrossExchangePair = 'drift-lighter';
//               crossExchangeDirection = driftRate > normalizedLighterRate ? 'long-lighter' : 'long-drift';
//             }
//           }
          
//           // Hyperliquid vs Lighter
//           if (hlRate !== null && lighterRate !== null) {
//             // Convert to comparable daily rates
//             const hlDailyRate = hlRate * hlFundingPerDay;
//             const lighterDailyRate = lighterRate * lighterFundingPerDay;
//             const normalizedLighterRate = lighterDailyRate / hlFundingPerDay; // Back to per-funding rate
            
//             const hlLighterSpread = Math.abs(hlRate - normalizedLighterRate);
//             if (hlLighterSpread > bestCrossExchangeSpread && hlLighterSpread >= minSpread) {
//               bestCrossExchangeSpread = hlLighterSpread;
//               bestCrossExchangePair = 'hyperliquid-lighter';
//               crossExchangeDirection = hlRate > normalizedLighterRate ? 'long-lighter' : 'long-hyperliquid';
//             }
//           }

//           const crossExchangeDailyProfit = (bestCrossExchangeSpread / 100) * positionSize * driftFundingPerDay;
//           const crossExchangeAnnualProfit = crossExchangeDailyProfit * 365;

//           // Calculate spot+perp profits for all exchanges
//           let spotPerpDailyProfit = 0;
//           let spotPerpAnnualProfit = 0;
//           let spotPerpExchange: 'drift' | 'hyperliquid' | 'lighter' | undefined;
//           let spotPerpDirection: 'long' | 'short' | undefined;
//           let altSpotPerpProfit: number | undefined;
//           let altSpotPerpExchange: 'drift' | 'hyperliquid' | 'lighter' | undefined;
          
//           const driftSpotPerpProfit = Math.abs(driftRate) >= minAbsoluteRate 
//             ? Math.abs(driftRate) / 100 * positionSize * driftFundingPerDay 
//             : 0;
          
//           const hlSpotPerpProfit = hasSpotMarket && hlRate !== null && Math.abs(hlRate) >= minAbsoluteRate
//             ? Math.abs(hlRate) / 100 * positionSize * hlFundingPerDay
//             : 0;
            
//           const lighterSpotPerpProfit = lighterRate !== null && Math.abs(lighterRate) >= minAbsoluteRate
//             ? Math.abs(lighterRate) / 100 * positionSize * lighterFundingPerDay
//             : 0;
          
//           // Find best spot+perp strategy
//           const spotPerpOptions = [
//             { profit: driftSpotPerpProfit, exchange: 'drift' as const, rate: driftRate },
//             { profit: hlSpotPerpProfit, exchange: 'hyperliquid' as const, rate: hlRate || 0 },
//             { profit: lighterSpotPerpProfit, exchange: 'lighter' as const, rate: lighterRate || 0 }
//           ].filter(opt => opt.profit > 0).sort((a, b) => b.profit - a.profit);
          
//           if (spotPerpOptions.length > 0) {
//             const best = spotPerpOptions[0];
//             spotPerpDailyProfit = best.profit;
//             spotPerpAnnualProfit = best.profit * 365;
//             spotPerpExchange = best.exchange;
//             spotPerpDirection = best.rate > 0 ? 'short' : 'long';
            
//             if (spotPerpOptions.length > 1) {
//               altSpotPerpProfit = spotPerpOptions[1].profit;
//               altSpotPerpExchange = spotPerpOptions[1].exchange;
//             }
//           }

//           let bestStrategy: 'cross-exchange' | 'spot-perp' | 'none' = 'none';
//           let bestStrategyDailyProfit = 0;
          
//           if (bestCrossExchangeSpread >= minSpread && crossExchangeDailyProfit > spotPerpDailyProfit) {
//             bestStrategy = 'cross-exchange';
//             bestStrategyDailyProfit = crossExchangeDailyProfit;
//           } else if (spotPerpDailyProfit > 0 && spotPerpDailyProfit > crossExchangeDailyProfit) {
//             bestStrategy = 'spot-perp';
//             bestStrategyDailyProfit = spotPerpDailyProfit;
//           } else if (bestCrossExchangeSpread >= minSpread) {
//             bestStrategy = 'cross-exchange';
//             bestStrategyDailyProfit = crossExchangeDailyProfit;
//           }

//           if (bestStrategy !== 'none') {
//             const bestStrategyAPR = bestStrategy === 'cross-exchange' 
//               ? (crossExchangeAnnualProfit / positionSize) * 100
//               : (spotPerpAnnualProfit / positionSize) * 100;

//             const priceDeviation = hlMarkPrice 
//               ? Math.abs((driftMarkPrice - hlMarkPrice) / driftMarkPrice) * 100
//               : 0;

//             arbOpportunities.push({
//               coin: coinSymbol,
//               driftOI: parseFloat(driftContract.open_interest),
//               hyperliquidOI: hlData ? parseFloat(hlData.context.openInterest) : 0,
//               lighterOI: 0, // Not available
//               driftRate,
//               hyperliquidRate: hlRate || 0,
//               lighterRate: lighterRate || undefined,
//               driftRateAPR: driftRate * driftFundingPerDay * 365,
//               hyperliquidRateAPR: hlRate ? hlRate * hlFundingPerDay * 365 : 0,
//               lighterRateAPR: lighterRate ? lighterRate * lighterFundingPerDay * 365 : undefined,
//               arbitrageSpread: bestCrossExchangeSpread,
//               crossExchangeDirection,
//               crossExchangePair: bestCrossExchangePair || undefined,
//               crossExchangeDailyProfit,
//               crossExchangeAnnualProfit,
//               hasSpotMarket,
//               spotPrice,
//               spotPerpDailyProfit,
//               spotPerpAnnualProfit,
//               spotPerpExchange,
//               spotPerpDirection,
//               altSpotPerpProfit,
//               altSpotPerpExchange,
//               bestStrategy,
//               bestStrategyDailyProfit,
//               bestStrategyAPR,
//               driftMarkPrice,
//               hyperliquidMarkPrice: hlMarkPrice || 0,
//               lighterMarkPrice: undefined, // Not available
//               priceDeviation
//             });
//           }
//         }
//       });

//       arbOpportunities.sort((a, b) => b.bestStrategyDailyProfit - a.bestStrategyDailyProfit);

//       setOpportunities(arbOpportunities);
//       setLastUpdate(new Date().toLocaleString());
//     } catch (error) {
//       console.error('Error calculating arbitrage:', error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const fetchHistoricalAnalysis = async (opportunity: ArbitrageOpportunity) => {
//     if (!opportunity) return;
    
//     setHistoricalLoading(true);
    
//     try {
//       const endTime = Date.now();
//       const startTime = endTime - (timeRange * 24 * 60 * 60 * 1000);
      
//       // Fetch historical data from all exchanges
//       const promises: Promise<any>[] = [
//         fetchDriftFundingHistory(`${opportunity.coin}-PERP`),
//         fetchHyperliquidFundingHistory(opportunity.coin, startTime, endTime)
//       ];
      
//       // Only fetch Lighter data if this coin is available on Lighter
//       if (opportunity.lighterRate !== undefined) {
//         promises.push(fetchLighterFundingHistory(opportunity.coin, startTime, endTime));
//       }
      
//       const results = await Promise.all(promises);
//       const [driftHistory, hyperliquidHistory, lighterHistory] = results;

//       // Process data into time series
//       const timeSeriesData: Record<string, HistoricalDataPoint> = {};
      
//       // Process Drift data
//       driftHistory.forEach(entry => {
//         const timestamp = parseInt(entry.ts) * 1000;
        
//         if (timestamp >= startTime && timestamp <= endTime) {
//           const dateKey = new Date(timestamp).toISOString().split('T')[0];
//           const oracleTwap = parseFloat(entry.oraclePriceTwap) / 1e6;
//           const fundingRateRaw = parseFloat(entry.fundingRate) / 1e9;
//           const fundingRatePercent = (fundingRateRaw / oracleTwap) * 100;
          
//           if (!timeSeriesData[dateKey]) {
//             timeSeriesData[dateKey] = {
//               timestamp,
//               date: new Date(timestamp).toLocaleDateString()
//             };
//           }
//           timeSeriesData[dateKey].driftRate = fundingRatePercent;
//         }
//       });

//       // Process Hyperliquid data
//       hyperliquidHistory.forEach(entry => {
//         const timestamp = entry.time * (entry.time < 10000000000 ? 1000 : 1);
        
//         if (timestamp >= startTime && timestamp <= endTime) {
//           const dateKey = new Date(timestamp).toISOString().split('T')[0];
//           const fundingRatePercent = parseFloat(entry.fundingRate) * 100;
          
//           if (!timeSeriesData[dateKey]) {
//             timeSeriesData[dateKey] = {
//               timestamp,
//               date: new Date(timestamp).toLocaleDateString()
//             };
//           }
//           timeSeriesData[dateKey].hyperliquidRate = fundingRatePercent;
//         }
//       });

//       // Process Lighter data if available
//       if (lighterHistory && lighterHistory.length > 0) {
//         lighterHistory.forEach(entry => {
//           const timestamp = entry.timestamp * 1000; // Convert to milliseconds
          
//           if (timestamp >= startTime && timestamp <= endTime) {
//             const dateKey = new Date(timestamp).toISOString().split('T')[0];
//             const rate = parseFloat(entry.rate) * 100;
//             const fundingRatePercent = entry.direction === 'long' ? rate : -rate;
            
//             if (!timeSeriesData[dateKey]) {
//               timeSeriesData[dateKey] = {
//                 timestamp,
//                 date: new Date(timestamp).toLocaleDateString()
//               };
//             }
            
//             // Average hourly rates for daily view
//             if (timeSeriesData[dateKey].lighterRate !== undefined) {
//               timeSeriesData[dateKey].lighterRate = (timeSeriesData[dateKey].lighterRate! + fundingRatePercent) / 2;
//             } else {
//               timeSeriesData[dateKey].lighterRate = fundingRatePercent;
//             }
//           }
//         });
//       }

//       // Calculate profits for each data point and sort by timestamp
//       const sortedData = Object.values(timeSeriesData)
//         .sort((a, b) => a.timestamp - b.timestamp);

//       let cumulativeCrossExchange = 0;
//       let cumulativeSpotPerp = 0;

//       const processedData = sortedData.map(point => {
//         const driftRate = point.driftRate || 0;
//         const hlRate = point.hyperliquidRate || 0;
//         const lighterRate = point.lighterRate || 0;
        
//         // Calculate best cross-exchange profit for this data point
//         let bestSpread = 0;
//         let bestPair = null;
        
//         if (driftRate && hlRate) {
//           const spread = Math.abs(driftRate - hlRate);
//           if (spread > bestSpread) {
//             bestSpread = spread;
//             bestPair = 'drift-hyperliquid';
//           }
//         }
        
//         if (driftRate && lighterRate) {
//           // Normalize Lighter rate for comparison (24 funding periods vs 3)
//           const normalizedLighterRate = (lighterRate * 24) / 3;
//           const spread = Math.abs(driftRate - normalizedLighterRate);
//           if (spread > bestSpread) {
//             bestSpread = spread;
//             bestPair = 'drift-lighter';
//           }
//         }
        
//         if (hlRate && lighterRate) {
//           // Normalize Lighter rate for comparison
//           const normalizedLighterRate = (lighterRate * 24) / 3;
//           const spread = Math.abs(hlRate - normalizedLighterRate);
//           if (spread > bestSpread) {
//             bestSpread = spread;
//             bestPair = 'hyperliquid-lighter';
//           }
//         }
        
//         const crossExchangeProfit = (bestSpread / 100) * positionSize / 3; // Per funding period
        
//         // Calculate spot+perp profit based on the exchange used in current opportunity
//         let spotPerpRate = 0;
//         let fundingPerDay = 3;
        
//         if (opportunity.spotPerpExchange === 'drift' && driftRate) {
//           spotPerpRate = driftRate;
//         } else if (opportunity.spotPerpExchange === 'hyperliquid' && hlRate) {
//           spotPerpRate = hlRate;
//         } else if (opportunity.spotPerpExchange === 'lighter' && lighterRate) {
//           spotPerpRate = lighterRate;
//           fundingPerDay = 24; // Lighter has hourly funding
//         }
        
//         const spotPerpProfit = (Math.abs(spotPerpRate) / 100) * positionSize / (spotPerpRate === lighterRate ? 1 : 3);
        
//         cumulativeCrossExchange += crossExchangeProfit;
//         cumulativeSpotPerp += spotPerpProfit;
        
//         return {
//           ...point,
//           crossExchangeProfit,
//           spotPerpProfit,
//           cumulativeCrossExchange,
//           cumulativeSpotPerp
//         };
//       });

//       // Calculate analysis metrics for both strategies
//       const crossExchangeProfits = processedData.map(d => d.crossExchangeProfit || 0);
//       const spotPerpProfits = processedData.map(d => d.spotPerpProfit || 0);
      
//       const bestStrategyProfits = opportunity.bestStrategy === 'cross-exchange' ? crossExchangeProfits : spotPerpProfits;
//       const totalProfit = bestStrategyProfits.reduce((sum, profit) => sum + profit, 0);
//       const avgDailyProfit = totalProfit / timeRange;
//       const maxDailyProfit = Math.max(...bestStrategyProfits);
//       const winRate = bestStrategyProfits.filter(p => p > 0).length / bestStrategyProfits.length;
      
//       // Simple Sharpe ratio calculation
//       const avgProfit = bestStrategyProfits.reduce((sum, p) => sum + p, 0) / bestStrategyProfits.length;
//       const variance = bestStrategyProfits.reduce((sum, p) => sum + Math.pow(p - avgProfit, 2), 0) / bestStrategyProfits.length;
//       const stdDev = Math.sqrt(variance);
//       const sharpeRatio = stdDev > 0 ? avgProfit / stdDev : 0;

//       const analysis: HistoricalAnalysis = {
//         totalCrossExchangeProfit: cumulativeCrossExchange,
//         totalSpotPerpProfit: cumulativeSpotPerp,
//         bestPerformingStrategy: cumulativeCrossExchange > cumulativeSpotPerp ? 'cross-exchange' : 'spot-perp',
//         avgDailyProfit,
//         maxDailyProfit,
//         winRate,
//         sharpeRatio
//       };

//       setHistoricalData(processedData);
//       setHistoricalAnalysis(analysis);
      
//     } catch (error) {
//       console.error('Error fetching historical analysis:', error);
//     } finally {
//       setHistoricalLoading(false);
//     }
//   };

//   const handleRowClick = (opportunity: ArbitrageOpportunity) => {
//     console.log('handleRowClick called for:', opportunity.coin);
//     setSelectedOpportunity(opportunity);
//     setCurrentView('details');
//     setTimeRange(21); // Default to past month (21 days)
//     fetchHistoricalAnalysis(opportunity);
//   };

//   const goBackToScanner = () => {
//     setCurrentView('scanner');
//     setSelectedOpportunity(null);
//     setHistoricalData([]);
//     setHistoricalAnalysis(null);
//   };

//   useEffect(() => {
//     calculateArbitrage();
//   }, []);

//   useEffect(() => {
//     if (selectedOpportunity && currentView === 'details') {
//       fetchHistoricalAnalysis(selectedOpportunity);
//     }
//   }, [timeRange]);

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

//   const getStrategyDisplay = (opp: ArbitrageOpportunity) => {
//     if (opp.bestStrategy === 'cross-exchange') {
//       if (opp.crossExchangePair === 'drift-hyperliquid') {
//         if (opp.crossExchangeDirection === 'long-drift') {
//           return (
//             <TooltipComponent>
//               <TooltipTrigger>
//                 <div className="flex items-center gap-1 text-xs">
//                   <TrendingUp className="h-3 w-3 text-green-500" />
//                   <span>Long Drift</span>
//                   <span className="text-gray-400">/</span>
//                   <TrendingDown className="h-3 w-3 text-red-500" />
//                   <span>Short HL</span>
//                 </div>
//               </TooltipTrigger>
//               <TooltipContent>
//                 <p>Cross-exchange arbitrage: Long on Drift (lower funding) and Short on Hyperliquid (higher funding) to earn the spread</p>
//               </TooltipContent>
//             </TooltipComponent>
//           );
//         }
//         return (
//           <TooltipComponent>
//             <TooltipTrigger>
//               <div className="flex items-center gap-1 text-xs">
//                 <TrendingUp className="h-3 w-3 text-green-500" />
//                 <span>Long HL</span>
//                 <span className="text-gray-400">/</span>
//                 <TrendingDown className="h-3 w-3 text-red-500" />
//                 <span>Short Drift</span>
//               </div>
//             </TooltipTrigger>
//             <TooltipContent>
//               <p>Cross-exchange arbitrage: Long on Hyperliquid (lower funding) and Short on Drift (higher funding) to earn the spread</p>
//             </TooltipContent>
//           </TooltipComponent>
//         );
//       } else if (opp.crossExchangePair === 'drift-lighter') {
//         if (opp.crossExchangeDirection === 'long-drift') {
//           return (
//             <TooltipComponent>
//               <TooltipTrigger>
//                 <div className="flex items-center gap-1 text-xs">
//                   <TrendingUp className="h-3 w-3 text-green-500" />
//                   <span>Long Drift</span>
//                   <span className="text-gray-400">/</span>
//                   <TrendingDown className="h-3 w-3 text-red-500" />
//                   <span>Short Lighter</span>
//                 </div>
//               </TooltipTrigger>
//               <TooltipContent>
//                 <p>Cross-exchange arbitrage: Long on Drift (lower funding) and Short on Lighter (higher funding). Note: Lighter charges funding hourly (24x/day)</p>
//               </TooltipContent>
//             </TooltipComponent>
//           );
//         }
//         return (
//           <TooltipComponent>
//             <TooltipTrigger>
//               <div className="flex items-center gap-1 text-xs">
//                 <TrendingUp className="h-3 w-3 text-green-500" />
//                 <span>Long Lighter</span>
//                 <span className="text-gray-400">/</span>
//                 <TrendingDown className="h-3 w-3 text-red-500" />
//                 <span>Short Drift</span>
//               </div>
//             </TooltipTrigger>
//             <TooltipContent>
//               <p>Cross-exchange arbitrage: Long on Lighter (lower funding) and Short on Drift (higher funding). Note: Lighter charges funding hourly (24x/day)</p>
//             </TooltipContent>
//           </TooltipComponent>
//         );
//       } else if (opp.crossExchangePair === 'hyperliquid-lighter') {
//         if (opp.crossExchangeDirection === 'long-hyperliquid') {
//           return (
//             <TooltipComponent>
//               <TooltipTrigger>
//                 <div className="flex items-center gap-1 text-xs">
//                   <TrendingUp className="h-3 w-3 text-green-500" />
//                   <span>Long HL</span>
//                   <span className="text-gray-400">/</span>
//                   <TrendingDown className="h-3 w-3 text-red-500" />
//                   <span>Short Lighter</span>
//                 </div>
//               </TooltipTrigger>
//               <TooltipContent>
//                 <p>Cross-exchange arbitrage: Long on Hyperliquid (lower funding) and Short on Lighter (higher funding). Note: Lighter charges funding hourly (24x/day)</p>
//               </TooltipContent>
//             </TooltipComponent>
//           );
//         }
//         return (
//           <TooltipComponent>
//             <TooltipTrigger>
//               <div className="flex items-center gap-1 text-xs">
//                 <TrendingUp className="h-3 w-3 text-green-500" />
//                 <span>Long Lighter</span>
//                 <span className="text-gray-400">/</span>
//                 <TrendingDown className="h-3 w-3 text-red-500" />
//                 <span>Short HL</span>
//               </div>
//             </TooltipTrigger>
//             <TooltipContent>
//               <p>Cross-exchange arbitrage: Long on Lighter (lower funding) and Short on Hyperliquid (higher funding). Note: Lighter charges funding hourly (24x/day)</p>
//             </TooltipContent>
//           </TooltipComponent>
//         );
//       }
//     } else if (opp.bestStrategy === 'spot-perp') {
//       const exchange = opp.spotPerpExchange === 'hyperliquid' ? 'HL' : opp.spotPerpExchange === 'drift' ? 'Drift' : 'Lighter';
//       const rate = opp.spotPerpExchange === 'hyperliquid' ? opp.hyperliquidRate : 
//                    opp.spotPerpExchange === 'drift' ? opp.driftRate : opp.lighterRate || 0;
//       const isLong = opp.spotPerpDirection === 'long';
//       const spotLocation = opp.spotPerpExchange === 'hyperliquid' ? 'HL' : 'Solana DEX';
      
//       return (
//         <TooltipComponent>
//           <TooltipTrigger>
//             <div className="flex items-center gap-1 text-xs">
//               <Coins className="h-3 w-3 text-blue-500" />
//               <span>Spot + {isLong ? 'Long' : 'Short'} {exchange}</span>
//               <Badge variant="outline" className="ml-1 text-xs h-4 px-1">
//                 {isLong ? 'Longs receive' : 'Shorts receive'}
//               </Badge>
//             </div>
//           </TooltipTrigger>
//           <TooltipContent className="max-w-xs">
//             <p>Buy spot on {spotLocation} and {isLong ? 'long' : 'short'} perp on {opp.spotPerpExchange}. 
//             {rate > 0 ? ' Shorts receive funding payments.' : ' Longs receive funding payments (negative funding).'}
//             This captures the full {Math.abs(rate).toFixed(3)}% funding rate.
//             {opp.spotPerpExchange === 'lighter' && ' Note: Lighter charges funding hourly (24x/day).'}</p>
//             {opp.altSpotPerpExchange && (
//               <p className="mt-1 text-xs text-gray-400 border-t pt-1">
//                 Alternative: {opp.altSpotPerpExchange === 'drift' ? 'Drift' : opp.altSpotPerpExchange === 'hyperliquid' ? 'HL' : 'Lighter'} at {Math.abs(opp.altSpotPerpExchange === 'drift' ? opp.driftRate : opp.altSpotPerpExchange === 'hyperliquid' ? opp.hyperliquidRate : opp.lighterRate || 0).toFixed(3)}% 
//                 (${(opp.altSpotPerpProfit || 0).toFixed(2)}/day)
//               </p>
//             )}
//           </TooltipContent>
//         </TooltipComponent>
//       );
//     }
//     return <span className="text-xs text-gray-400">No Arb</span>;
//   };

//   // Scanner View
//   if (currentView === 'scanner') {
//     return (
//       <TooltipProvider>
//         <div className="w-full mx-auto p-6 space-y-6">
//           {/* Controls */}
//           <Card>
//             <CardHeader>
//               <CardTitle className="flex items-center justify-between">
//                 <span className="flex items-center gap-2">
//                   <DollarSign className="h-5 w-5" />
//                   Funding Rate Arbitrage Scanner
//                 </span>
//                 <Button 
//                   onClick={calculateArbitrage} 
//                   disabled={loading}
//                   size="sm"
//                   variant="outline"
//                 >
//                   {loading ? (
//                     <Loader2 className="h-4 w-4 animate-spin" />
//                   ) : (
//                     <RefreshCw className="h-4 w-4" />
//                   )}
//                 </Button>
//               </CardTitle>
//               <CardDescription>
//                 Compares cross-exchange arbitrage vs spot+perp strategies. Click any row to view historical analysis.
//                 {lastUpdate && <span className="ml-2 text-xs">• Last updated: {lastUpdate}</span>}
//               </CardDescription>
//             </CardHeader>
//             <CardContent>
//               <div className="grid grid-cols-1 md:grid-cols-4 gap-4 ">
//                 <div >
//                   <Label className='mb-1' htmlFor="position-size">Position Size (USD)</Label>
//                   <Input
//                     id="position-size"
//                     type="number"
//                     value={positionSize}
//                     onChange={(e) => setPositionSize(Number(e.target.value))}
//                     placeholder="10000"
//                   />
//                 </div>
//                 <div>
//                   <Label htmlFor="min-spread" className='mb-1'>
//                     Min Spread (%)
//                     <TooltipComponent>
//                       <TooltipTrigger asChild>
//                         <Info className="inline h-3 w-3 ml-1 text-gray-400" />
//                       </TooltipTrigger>
//                       <TooltipContent>
//                         <p>Minimum funding rate difference for cross-exchange arbitrage</p>
//                       </TooltipContent>
//                     </TooltipComponent>
//                   </Label>
//                   <Input
//                     id="min-spread"
//                     type="number"
//                     step="0.01"
//                     value={minSpread}
//                     onChange={(e) => setMinSpread(Number(e.target.value))}
//                     placeholder="0.01"
//                   />
//                 </div>
//                 <div>
//                   <Label htmlFor="min-absolute" className='mb-1'>
//                     Min Absolute Rate (%)
//                     <TooltipComponent>
//                       <TooltipTrigger asChild>
//                         <Info className="inline h-3 w-3 ml-1 text-gray-400" />
//                       </TooltipTrigger>
//                       <TooltipContent>
//                         <p>Minimum absolute funding rate for spot+perp strategy</p>
//                       </TooltipContent>
//                     </TooltipComponent>
//                   </Label>
//                   <Input
//                     id="min-absolute"
//                     type="number"
//                     step="0.01"
//                     value={minAbsoluteRate}
//                     onChange={(e) => setMinAbsoluteRate(Number(e.target.value))}
//                     placeholder="0.05"
//                   />
//                 </div>
//                 <div className="flex items-end">
//                   <Button onClick={calculateArbitrage} className="w-full">
//                     Recalculate
//                   </Button>
//                 </div>
//               </div>
//             </CardContent>
//           </Card>

//           {/* Results Table */}
//           <Card>
//             <CardContent className="p-0">
//               {loading ? (
//                 <div className="flex items-center justify-center h-64">
//                   <Loader2 className="h-8 w-8 animate-spin" />
//                   <span className="ml-2">Scanning for arbitrage opportunities...</span>
//                 </div>
//               ) : opportunities.length === 0 ? (
//                 <div className="flex items-center justify-center h-64">
//                   <AlertCircle className="h-8 w-8 text-gray-400" />
//                   <span className="ml-2 text-gray-500">No profitable opportunities found with current filters</span>
//                 </div>
//               ) : (
//                 <div className="overflow-x-auto">
//                   <table className="w-full text-sm">
//                     <thead className="bg-gray-50">
//                       <tr>
//                         <th className="text-left py-3 px-4 font-medium">
//                           Asset 
//                           <TooltipComponent>
//                             <TooltipTrigger asChild>
//                               <Info className="inline h-3 w-3 ml-1 text-gray-400" />
//                             </TooltipTrigger>
//                             <TooltipContent>
//                               <p>Click any row to view historical analysis</p>
//                             </TooltipContent>
//                           </TooltipComponent>
//                         </th>
//                         <th className="text-left py-3 px-4 font-medium">Drift Rate</th>
//                         <th className="text-left py-3 px-4 font-medium">HL Rate</th>
//                         <th className="text-left py-3 px-4 font-medium">Lighter Rate</th>
//                         <th className="text-left py-3 px-4 font-medium">Spread</th>
//                         <th className="text-left py-3 px-4 font-medium">Best Strategy</th>
//                         <th className="text-left py-3 px-4 font-medium">Daily Profit</th>
//                         <th className="text-left py-3 px-4 font-medium">APR</th>
//                         <th className="text-left py-3 px-4 font-medium">Spot</th>
//                         <th className="text-left py-3 px-4 font-medium">Open Interest</th>
//                         <th className="text-left py-3 px-4 font-medium">Price Dev</th>
//                       </tr>
//                     </thead>
//                     <tbody>
//                       {opportunities.map((opp) => (
//                         <tr 
//                           key={opp.coin} 
//                           className="border-b hover:bg-blue-50 transition-colors cursor-pointer group"
//                           onClick={(e) => {
//                             e.preventDefault();
//                             console.log('Row clicked for:', opp.coin);
//                             handleRowClick(opp);
//                           }}
//                         >
//                           <td className="py-3 px-4 font-medium text-blue-600 group-hover:text-blue-800">
//                             <div className="flex items-center gap-1">
//                               {opp.coin}
//                               <BarChart3 className="h-3 w-3" />
//                             </div>
//                           </td>
//                           <td className={`py-3 px-4 ${opp.driftRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
//                             {formatRate(opp.driftRate)}
//                             {opp.driftRate < 0 && (
//                               <span className="ml-1 text-xs text-gray-500">(longs receive)</span>
//                             )}
//                           </td>
//                           <td className={`py-3 px-4 ${opp.hyperliquidRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
//                             {formatRate(opp.hyperliquidRate)}
//                             {opp.hyperliquidRate < 0 && (
//                               <span className="ml-1 text-xs text-gray-500">(longs receive)</span>
//                             )}
//                           </td>
//                           <td className={`py-3 px-4 ${opp.lighterRate !== undefined ? (opp.lighterRate >= 0 ? 'text-green-600' : 'text-red-600') : 'text-gray-400'}`}>
//                             {opp.lighterRate !== undefined ? (
//                               <>
//                                 {formatRate(opp.lighterRate)}
//                                 {opp.lighterRate < 0 && (
//                                   <span className="ml-1 text-xs text-gray-500">(longs receive)</span>
//                                 )}
//                                 <span className="ml-1 text-xs text-gray-400">(hourly)</span>
//                               </>
//                             ) : '-'}
//                           </td>
//                           <td className={`py-3 px-4 ${getSpreadColor(opp.arbitrageSpread)}`}>
//                             {formatRate(opp.arbitrageSpread)}
//                             {opp.crossExchangePair && (
//                               <div className="text-xs text-gray-500">
//                                 {opp.crossExchangePair === 'drift-hyperliquid' ? 'D-H' : 
//                                  opp.crossExchangePair === 'drift-lighter' ? 'D-L' : 'H-L'}
//                               </div>
//                             )}
//                           </td>
//                           <td className="py-3 px-4">{getStrategyDisplay(opp)}</td>
//                           <td className="py-3 px-4 font-medium text-green-600">
//                             {formatMoney(opp.bestStrategyDailyProfit)}
//                           </td>
//                           <td className="py-3 px-4 text-sm">
//                             {formatAPR(opp.bestStrategyAPR)}
//                           </td>
//                           <td className="py-3 px-4">
//                             <div className="space-y-1">
//                               {opp.hasSpotMarket ? (
//                                 <Badge variant="secondary" className="text-xs">
//                                   <Coins className="h-3 w-3 mr-1" />
//                                   HL Spot
//                                 </Badge>
//                               ) : (
//                                 <Badge variant="outline" className="text-xs text-gray-400">
//                                   DEX only
//                                 </Badge>
//                               )}
//                               {opp.bestStrategy === 'spot-perp' && (
//                                 <div className="text-xs text-gray-500">
//                                   Using: {opp.spotPerpExchange === 'hyperliquid' ? 'HL' : opp.spotPerpExchange === 'drift' ? 'Solana DEX' : 'Solana DEX'}
//                                   {opp.altSpotPerpExchange && (
//                                     <span className="text-yellow-600"> ({opp.spotPerpExchange === 'lighter' ? '3' : '2'} options)</span>
//                                   )}
//                                 </div>
//                               )}
//                             </div>
//                           </td>
//                           <td className="py-3 px-4">
//                             <div className="text-xs">
//                               <div>D: {formatOI(opp.driftOI)}</div>
//                               <div>H: {formatOI(opp.hyperliquidOI)}</div>
//                               {opp.lighterOI !== undefined && (
//                                 <div>L: -</div>
//                               )}
//                             </div>
//                           </td>
//                           <td className={`py-3 px-4 text-xs ${opp.priceDeviation > 0.5 ? 'text-red-500' : 'text-gray-500'}`}>
//                             {opp.priceDeviation.toFixed(2)}%
//                           </td>
//                         </tr>
//                       ))}
//                     </tbody>
//                   </table>
//                 </div>
//               )}
//             </CardContent>
//           </Card>

//           {/* Summary Stats */}
//           {opportunities.length > 0 && (
//             <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
//               <Card>
//                 <CardHeader className="pb-3">
//                   <CardTitle className="text-sm font-medium">Top Opportunity</CardTitle>
//                 </CardHeader>
//                 <CardContent>
//                   <div className="text-2xl font-bold">{opportunities[0].coin}</div>
//                   <p className="text-xs text-gray-500">
//                     {formatMoney(opportunities[0].bestStrategyDailyProfit)} daily
//                   </p>
//                   <Badge variant="secondary" className="mt-1 text-xs">
//                     {opportunities[0].bestStrategy === 'cross-exchange' ? 'Cross-Exchange' : 'Spot+Perp'}
//                   </Badge>
//                 </CardContent>
//               </Card>

//               <Card>
//                 <CardHeader className="pb-3">
//                   <CardTitle className="text-sm font-medium">Total Daily Profit</CardTitle>
//                 </CardHeader>
//                 <CardContent>
//                   <div className="text-2xl font-bold">
//                     {formatMoney(opportunities.reduce((sum, opp) => sum + opp.bestStrategyDailyProfit, 0))}
//                   </div>
//                   <p className="text-xs text-gray-500">
//                     Across {opportunities.length} opportunities
//                   </p>
//                 </CardContent>
//               </Card>

//               <Card>
//                 <CardHeader className="pb-3">
//                   <CardTitle className="text-sm font-medium">Average APR</CardTitle>
//                 </CardHeader>
//                 <CardContent>
//                   <div className="text-2xl font-bold">
//                     {formatAPR(
//                       opportunities.reduce((sum, opp) => sum + opp.bestStrategyAPR, 0) / opportunities.length
//                     )}
//                   </div>
//                   <p className="text-xs text-gray-500">
//                     Market neutral returns
//                   </p>
//                 </CardContent>
//               </Card>

//               <Card>
//                 <CardHeader className="pb-3">
//                   <CardTitle className="text-sm font-medium">Strategy Mix</CardTitle>
//                 </CardHeader>
//                 <CardContent>
//                   <div className="space-y-1">
//                     <div className="text-xs">
//                       Cross-Exchange: {opportunities.filter(o => o.bestStrategy === 'cross-exchange').length}
//                     </div>
//                     <div className="text-xs">
//                       Spot+Perp: {opportunities.filter(o => o.bestStrategy === 'spot-perp').length}
//                     </div>
//                     <div className="text-xs text-gray-400 mt-1 pt-1 border-t">
//                       Both viable: {opportunities.filter(o => o.altSpotPerpExchange).length}
//                     </div>
//                   </div>
//                 </CardContent>
//               </Card>
//             </div>
//           )}
//         </div>
//       </TooltipProvider>
//     );
//   }

//   // Historical Analysis View
//   return (
//     <TooltipProvider>
//       <div className="w-full mx-auto p-6 space-y-6">
//         {/* Header */}
//         <Card>
//           <CardHeader>
//             <div className="flex items-center justify-between">
//               <div className="flex items-center gap-3">
//                 <Button 
//                   variant="outline" 
//                   size="sm" 
//                   onClick={goBackToScanner}
//                   className="flex items-center gap-2"
//                 >
//                   <ArrowLeft className="h-4 w-4" />
//                   Back to Scanner
//                 </Button>
//                 <div>
//                   <CardTitle className="flex items-center gap-2">
//                     <BarChart3 className="h-5 w-5" />
//                     {selectedOpportunity?.coin} Historical Analysis
//                   </CardTitle>
//                   <CardDescription>
//                     Historical funding rates and strategy performance analysis
//                   </CardDescription>
//                 </div>
//               </div>
//               <div className="flex items-center gap-2">
//                 <Select value={timeRange.toString()} onValueChange={(value) => setTimeRange(parseInt(value))}>
//                   <SelectTrigger className="w-32">
//                     <SelectValue />
//                   </SelectTrigger>
//                   <SelectContent>
//                     <SelectItem value="7">7 days</SelectItem>
//                     <SelectItem value="14">2 weeks</SelectItem>
//                     <SelectItem value="30">1 month</SelectItem>
//                     <SelectItem value="90">3 months</SelectItem>
//                   </SelectContent>
//                 </Select>
//                 <Button 
//                   variant="outline" 
//                   size="sm" 
//                   onClick={() => fetchHistoricalAnalysis(selectedOpportunity!)}
//                   disabled={historicalLoading}
//                 >
//                   {historicalLoading ? (
//                     <Loader2 className="h-4 w-4 animate-spin" />
//                   ) : (
//                     <RefreshCw className="h-4 w-4" />
//                   )}
//                 </Button>
//               </div>
//             </div>
//           </CardHeader>
//         </Card>

//         {/* Current Strategy Info */}
//         {selectedOpportunity && (
//           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//             <Card>
//               <CardHeader className="pb-3">
//                 <CardTitle className="text-sm font-medium">Current Best Strategy</CardTitle>
//               </CardHeader>
//               <CardContent>
//                 <div className="space-y-2">
//                   <div className="text-lg font-bold">
//                     {selectedOpportunity.bestStrategy === 'cross-exchange' ? 'Cross-Exchange' : 'Spot+Perp'}
//                   </div>
//                   <div className="text-sm text-gray-600">
//                     {formatMoney(selectedOpportunity.bestStrategyDailyProfit)} daily
//                   </div>
//                   <div className="text-xs text-gray-500">
//                     {formatAPR(selectedOpportunity.bestStrategyAPR)} APR
//                   </div>
//                 </div>
//               </CardContent>
//             </Card>

//             <Card>
//               <CardHeader className="pb-3">
//                 <CardTitle className="text-sm font-medium">Current Rates</CardTitle>
//               </CardHeader>
//               <CardContent>
//                 <div className="space-y-2">
//                   <div className="flex justify-between text-sm">
//                     <span>Drift:</span>
//                     <span className={selectedOpportunity.driftRate >= 0 ? 'text-green-600' : 'text-red-600'}>
//                       {formatRate(selectedOpportunity.driftRate)}
//                     </span>
//                   </div>
//                   <div className="flex justify-between text-sm">
//                     <span>Hyperliquid:</span>
//                     <span className={selectedOpportunity.hyperliquidRate >= 0 ? 'text-green-600' : 'text-red-600'}>
//                       {formatRate(selectedOpportunity.hyperliquidRate)}
//                     </span>
//                   </div>
//                   {selectedOpportunity.lighterRate !== undefined && (
//                     <div className="flex justify-between text-sm">
//                       <span>Lighter (hourly):</span>
//                       <span className={selectedOpportunity.lighterRate >= 0 ? 'text-green-600' : 'text-red-600'}>
//                         {formatRate(selectedOpportunity.lighterRate)}
//                       </span>
//                     </div>
//                   )}
//                   <div className="flex justify-between text-sm font-medium pt-1 border-t">
//                     <span>Spread:</span>
//                     <span>{formatRate(selectedOpportunity.arbitrageSpread)}</span>
//                   </div>
//                   {selectedOpportunity.crossExchangePair && (
//                     <div className="text-xs text-gray-500">
//                       Pair: {selectedOpportunity.crossExchangePair}
//                     </div>
//                   )}
//                 </div>
//               </CardContent>
//             </Card>

//             <Card>
//               <CardHeader className="pb-3">
//                 <CardTitle className="text-sm font-medium">Position Size</CardTitle>
//               </CardHeader>
//               <CardContent>
//                 <div className="space-y-2">
//                   <div className="text-lg font-bold">
//                     {formatMoney(positionSize)}
//                   </div>
//                   <div className="text-xs text-gray-500">
//                     Analysis based on this position size
//                   </div>
//                 </div>
//               </CardContent>
//             </Card>
//           </div>
//         )}

//         {/* Historical Analysis */}
//         {historicalLoading ? (
//           <Card>
//             <CardContent className="flex items-center justify-center h-64">
//               <Loader2 className="h-8 w-8 animate-spin" />
//               <span className="ml-2">Loading historical data...</span>
//             </CardContent>
//           </Card>
//         ) : historicalData.length === 0 ? (
//           <Card>
//             <CardContent className="flex items-center justify-center h-64">
//               <AlertCircle className="h-8 w-8 text-gray-400" />
//               <span className="ml-2 text-gray-500">No historical data available for the selected time range</span>
//             </CardContent>
//           </Card>
//         ) : (
//           <>
//             {/* Performance Summary */}
//             {historicalAnalysis && (
//               <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
//                 <Card>
//                   <CardHeader className="pb-3">
//                     <CardTitle className="text-sm font-medium">Total Profit ({timeRange}d)</CardTitle>
//                   </CardHeader>
//                   <CardContent>
//                     <div className="text-2xl font-bold text-green-600">
//                       {selectedOpportunity?.bestStrategy === 'cross-exchange' 
//                         ? formatMoney(historicalAnalysis.totalCrossExchangeProfit)
//                         : formatMoney(historicalAnalysis.totalSpotPerpProfit)
//                       }
//                     </div>
//                     <p className="text-xs text-gray-500">
//                       {formatMoney(historicalAnalysis.avgDailyProfit)} avg daily
//                     </p>
//                   </CardContent>
//                 </Card>

//                 <Card>
//                   <CardHeader className="pb-3">
//                     <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
//                   </CardHeader>
//                   <CardContent>
//                     <div className="text-2xl font-bold">
//                       {(historicalAnalysis.winRate * 100).toFixed(1)}%
//                     </div>
//                     <p className="text-xs text-gray-500">
//                       Profitable funding periods
//                     </p>
//                   </CardContent>
//                 </Card>

//                 <Card>
//                   <CardHeader className="pb-3">
//                     <CardTitle className="text-sm font-medium">Max Daily Profit</CardTitle>
//                   </CardHeader>
//                   <CardContent>
//                     <div className="text-2xl font-bold">
//                       {formatMoney(historicalAnalysis.maxDailyProfit)}
//                     </div>
//                     <p className="text-xs text-gray-500">
//                       Best single day
//                     </p>
//                   </CardContent>
//                 </Card>

//                 <Card>
//                   <CardHeader className="pb-3">
//                     <CardTitle className="text-sm font-medium">Sharpe Ratio</CardTitle>
//                   </CardHeader>
//                   <CardContent>
//                     <div className="text-2xl font-bold">
//                       {historicalAnalysis.sharpeRatio.toFixed(2)}
//                     </div>
//                     <p className="text-xs text-gray-500">
//                       Risk-adjusted returns
//                     </p>
//                   </CardContent>
//                 </Card>
//               </div>
//             )}

//             {/* Charts */}
//             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
//               {/* Funding Rates Chart */}
//               <Card>
//                 <CardHeader>
//                   <CardTitle className="text-lg">Historical Funding Rates</CardTitle>
//                   <CardDescription>
//                     Funding rates over the last {timeRange} days
//                   </CardDescription>
//                 </CardHeader>
//                 <CardContent>
//                   <div className="h-80">
//                     <ResponsiveContainer width="100%" height="100%">
//                       <LineChart data={historicalData}>
//                         <CartesianGrid strokeDasharray="3 3" />
//                         <XAxis 
//                           dataKey="date" 
//                           tick={{ fontSize: 12 }}
//                           angle={-45}
//                           textAnchor="end"
//                           height={60}
//                         />
//                         <YAxis 
//                           tick={{ fontSize: 12 }}
//                           label={{ value: 'Funding Rate (%)', angle: -90, position: 'insideLeft' }}
//                         />
//                         <Tooltip 
//                           labelFormatter={(value) => `Date: ${value}`}
//                           formatter={(value: number, name: string) => {
//                             // Correctly identify the source based on the exact dataKey name
//                             let source = '';
//                             if (name === 'driftRate') {
//                               source = 'Drift';
//                             } else if (name === 'hyperliquidRate') {
//                               source = 'Hyperliquid';
//                             } else {
//                               source = name; // Fallback to the raw name if it's neither
//                             }
//                             return [`${value?.toFixed(4)}%`, source];
//                           }}
//                         />
//                         <Legend />
//                         <Line 
//                           type="monotone" 
//                           dataKey="driftRate" 
//                           stroke="#8b5cf6" 
//                           strokeWidth={2}
//                           name="Drift"
//                           connectNulls={false}
//                         />
//                         <Line 
//                           type="monotone" 
//                           dataKey="hyperliquidRate" 
//                           stroke="#06b6d4" 
//                           strokeWidth={2}
//                           name="Hyperliquid"
//                           connectNulls={false}
//                         />
//                         {selectedOpportunity?.lighterRate !== undefined && (
//                           <Line 
//                             type="monotone" 
//                             dataKey="lighterRate" 
//                             stroke="#f59e0b" 
//                             strokeWidth={2}
//                             name="Lighter (hourly)"
//                             connectNulls={false}
//                           />
//                         )}
//                       </LineChart>
//                     </ResponsiveContainer>
//                   </div>
//                 </CardContent>
//               </Card>

//               {/* Cumulative Profit Chart */}
//               <Card>
//                 <CardHeader>
//                   <CardTitle className="text-lg">Cumulative Strategy Performance</CardTitle>
//                   <CardDescription>
//                     Strategy profits over time (${positionSize.toLocaleString()} position)
//                   </CardDescription>
//                 </CardHeader>
//                 <CardContent>
//                   <div className="h-80">
//                     <ResponsiveContainer width="100%" height="100%">
//                       <LineChart data={historicalData}>
//                         <CartesianGrid strokeDasharray="3 3" />
//                         <XAxis 
//                           dataKey="date" 
//                           tick={{ fontSize: 12 }}
//                           angle={-45}
//                           textAnchor="end"
//                           height={60}
//                         />
//                         <YAxis 
//                           tick={{ fontSize: 12 }}
//                           label={{ value: 'Cumulative Profit ($)', angle: -90, position: 'insideLeft' }}
//                         />
//                         <Tooltip 
//                           labelFormatter={(value) => `Date: ${value}`}
//                           formatter={(value: number, name: string) => [
//                             `$${value?.toFixed(2)}`, 
//                             name === 'cumulativeCrossExchange' ? 'Cross-Exchange' : 'Spot+Perp'
//                           ]}
//                         />
//                         <Legend />
//                         <Line 
//                           type="monotone" 
//                           dataKey="cumulativeCrossExchange" 
//                           stroke="#10b981" 
//                           strokeWidth={2}
//                           name="Cross-Exchange"
//                         />
//                         <Line 
//                           type="monotone" 
//                           dataKey="cumulativeSpotPerp" 
//                           stroke="#f59e0b" 
//                           strokeWidth={2}
//                           name="Spot+Perp"
//                         />
//                       </LineChart>
//                     </ResponsiveContainer>
//                   </div>
//                 </CardContent>
//               </Card>
//             </div>

//             {/* Strategy Comparison */}
//             <Card>
//               <CardHeader>
//                 <CardTitle className="text-lg">Strategy Comparison Summary</CardTitle>
//                 <CardDescription>
//                   Performance comparison over the last {timeRange} days
//                 </CardDescription>
//               </CardHeader>
//               <CardContent>
//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                   <div className="space-y-4">
//                     <div className="flex items-center gap-2">
//                       <TrendingUp className="h-5 w-5 text-green-500" />
//                       <h3 className="font-semibold">Cross-Exchange Arbitrage</h3>
//                     </div>
//                     <div className="space-y-2 text-sm">
//                       <div className="flex justify-between">
//                         <span>Total Profit:</span>
//                         <span className="font-medium">{formatMoney(historicalAnalysis?.totalCrossExchangeProfit || 0)}</span>
//                       </div>
//                       <div className="flex justify-between">
//                         <span>Strategy:</span>
//                         <span>Long {selectedOpportunity?.crossExchangeDirection === 'long-drift' ? 'Drift' : 'Hyperliquid'}, Short {selectedOpportunity?.crossExchangeDirection === 'long-drift' ? 'Hyperliquid' : 'Drift'}</span>
//                       </div>
//                       <div className="text-xs text-gray-500 mt-2">
//                         Earns the spread between funding rates on both exchanges. Market neutral position.
//                       </div>
//                     </div>
//                   </div>

//                   <div className="space-y-4">
//                     <div className="flex items-center gap-2">
//                       <Coins className="h-5 w-5 text-blue-500" />
//                       <h3 className="font-semibold">Spot + Perp Strategy</h3>
//                     </div>
//                     <div className="space-y-2 text-sm">
//                       <div className="flex justify-between">
//                         <span>Total Profit:</span>
//                         <span className="font-medium">{formatMoney(historicalAnalysis?.totalSpotPerpProfit || 0)}</span>
//                       </div>
//                       <div className="flex justify-between">
//                         <span>Strategy:</span>
//                         <span>Spot + {selectedOpportunity?.spotPerpDirection} on {selectedOpportunity?.spotPerpExchange}</span>
//                       </div>
//                       <div className="text-xs text-gray-500 mt-2">
//                         Buy spot and {selectedOpportunity?.spotPerpDirection} perpetual to capture full funding rate. 
//                         {selectedOpportunity?.spotPerpExchange === 'drift' ? ' Uses Solana DEX for spot.' : ' Uses Hyperliquid spot market.'}
//                       </div>
//                     </div>
//                   </div>
//                 </div>
//               </CardContent>
//             </Card>
//           </>
//         )}

//         {/* Important Notes */}
//         <Alert>
//           <AlertCircle className="h-4 w-4" />
//           <AlertDescription>
//             <strong>Historical Analysis Notes:</strong>
//             <ul className="list-disc list-inside mt-1 text-xs space-y-1">
//               <li>Profits are calculated per funding period (every 8 hours for Drift/Hyperliquid, hourly for Lighter)</li>
//               <li>Lighter funding rates are normalized for comparison (24 funding periods/day vs 3/day)</li>
//               <li>Does not include transaction costs, slippage, or gas fees</li>
//               <li>Assumes immediate execution at historical rates</li>
//               <li>Past performance does not guarantee future results</li>
//               <li>Consider market volatility and liquidation risks when implementing strategies</li>
//             </ul>
//           </AlertDescription>
//         </Alert>
//       </div>
//     </TooltipProvider>
//   );
// }

// export default FundingArbitrageWithDetails;

/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"
// Enhanced Funding Rate Arbitrage Scanner with Historical Analysis
// Compares two strategies and provides detailed historical profit analysis

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, RefreshCw, TrendingUp, TrendingDown, AlertCircle, DollarSign, Info, Coins, ArrowLeft, BarChart3 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip as TooltipComponent, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  coin: string;
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
  hasSpotMarket: boolean;
  spotPrice?: number;
  spotPerpDailyProfit?: number;
  spotPerpAnnualProfit?: number;
  spotPerpExchange?: 'drift' | 'hyperliquid';
  spotPerpDirection?: 'long' | 'short';
  altSpotPerpProfit?: number;
  altSpotPerpExchange?: 'drift' | 'hyperliquid';
  bestStrategy: 'cross-exchange' | 'spot-perp' | 'none';
  bestStrategyDailyProfit: number;
  bestStrategyAPR: number;
  driftMarkPrice: number;
  hyperliquidMarkPrice: number;
  priceDeviation: number;
}

interface DriftFundingRate {
  txSig: string;
  slot: number;
  ts: string;
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

interface HyperliquidFundingEntry {
  time: number;
  fundingRate: string;
}

interface HistoricalDataPoint {
  timestamp: number;
  date: string;
  driftRate?: number;
  hyperliquidRate?: number;
  crossExchangeProfit?: number;
  spotPerpProfit?: number;
  cumulativeCrossExchange?: number;
  cumulativeSpotPerp?: number;
}

interface HistoricalAnalysis {
  totalCrossExchangeProfit: number;
  totalSpotPerpProfit: number;
  bestPerformingStrategy: 'cross-exchange' | 'spot-perp';
  avgDailyProfit: number;
  maxDailyProfit: number;
  winRate: number;
  sharpeRatio: number;
}

function FundingArbitrageWithDetails() {
  const [currentView, setCurrentView] = useState<'scanner' | 'details'>('scanner');
  const [selectedOpportunity, setSelectedOpportunity] = useState<ArbitrageOpportunity | null>(null);
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [positionSize, setPositionSize] = useState(10000);
  const [minSpread, setMinSpread] = useState(0.01);
  const [minAbsoluteRate, setMinAbsoluteRate] = useState(0.05);

  // Historical analysis state
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [historicalAnalysis, setHistoricalAnalysis] = useState<HistoricalAnalysis | null>(null);
  const [timeRange, setTimeRange] = useState<number>(7); // days
  const [historicalLoading, setHistoricalLoading] = useState(false);

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

  // Historical data fetching functions
  const fetchDriftFundingHistory = async (marketSymbol: string): Promise<DriftFundingRate[]> => {
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

  const fetchHyperliquidFundingHistory = async (coin: string, startTime: number, endTime: number): Promise<HyperliquidFundingEntry[]> => {
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
      
      // Analysis of time range in the returned data is performed later
      
      return data;
    } catch (error) {
      console.error(`Error fetching Hyperliquid funding history for ${coin}:`, error);
      return [];
    }
  };

  const calculateArbitrage = async () => {
    setLoading(true);
    try {
      const [driftContracts, hyperliquidData, hyperliquidSpotData] = await Promise.all([
        fetchDriftContracts(),
        fetchHyperliquidData(),
        fetchHyperliquidSpotData()
      ]);

      const { assets: hlAssets, contexts: hlContexts } = hyperliquidData;
      const { pairs: spotPairs, contexts: spotContexts } = hyperliquidSpotData;

      const hlDataMap = new Map<string, { asset: HyperliquidAsset, context: HyperliquidAssetContext }>();
      hlAssets.forEach((asset, index) => {
        if (hlContexts[index]) {
          hlDataMap.set(asset.name, { asset, context: hlContexts[index] });
        }
      });

      const spotMarketMap = new Map<string, { pair: any, context: any }>();
      spotPairs.forEach((pair, index) => {
        if (spotContexts[index] && pair.name.includes('/')) {
          const tokenName = pair.name.split('/')[0];
          spotMarketMap.set(tokenName, { pair, context: spotContexts[index] });
        }
      });

      const arbOpportunities: ArbitrageOpportunity[] = [];

      driftContracts.forEach(driftContract => {
        const coinSymbol = driftContract.ticker_id.replace('-PERP', '');
        const hlData = hlDataMap.get(coinSymbol);

        if (hlData) {
          const driftRate = parseFloat(driftContract.next_funding_rate) * 100;
          const hlRate = parseFloat(hlData.context.funding) * 100;
          const spread = Math.abs(driftRate - hlRate);
          const driftMarkPrice = parseFloat(driftContract.last_price);
          const hlMarkPrice = parseFloat(hlData.context.markPx);
          const priceDeviation = Math.abs((driftMarkPrice - hlMarkPrice) / driftMarkPrice) * 100;

          const spotMarket = spotMarketMap.get(coinSymbol);
          const hasSpotMarket = !!spotMarket;
          const spotPrice = spotMarket ? parseFloat(spotMarket.context.markPx) : undefined;

          const fundingPerDay = 3;
          const crossExchangeDailyProfit = (spread / 100) * positionSize * fundingPerDay;
          const crossExchangeAnnualProfit = crossExchangeDailyProfit * 365;

          let spotPerpDailyProfit = 0;
          let spotPerpAnnualProfit = 0;
          let spotPerpExchange: 'drift' | 'hyperliquid' | undefined;
          let spotPerpDirection: 'long' | 'short' | undefined;
          let altSpotPerpProfit: number | undefined;
          let altSpotPerpExchange: 'drift' | 'hyperliquid' | undefined;
          
          const driftSpotPerpProfit = Math.abs(driftRate) >= minAbsoluteRate 
            ? Math.abs(driftRate) / 100 * positionSize * fundingPerDay 
            : 0;
          
          const hlSpotPerpProfit = hasSpotMarket && Math.abs(hlRate) >= minAbsoluteRate
            ? Math.abs(hlRate) / 100 * positionSize * fundingPerDay
            : 0;
          
          if (driftSpotPerpProfit > 0 || hlSpotPerpProfit > 0) {
            if (driftSpotPerpProfit >= hlSpotPerpProfit) {
              spotPerpDailyProfit = driftSpotPerpProfit;
              spotPerpAnnualProfit = driftSpotPerpProfit * 365;
              spotPerpExchange = 'drift';
              spotPerpDirection = driftRate > 0 ? 'short' : 'long';
              
              if (hlSpotPerpProfit > 0) {
                altSpotPerpProfit = hlSpotPerpProfit;
                altSpotPerpExchange = 'hyperliquid';
              }
            } else {
              spotPerpDailyProfit = hlSpotPerpProfit;
              spotPerpAnnualProfit = hlSpotPerpProfit * 365;
              spotPerpExchange = 'hyperliquid';
              spotPerpDirection = hlRate > 0 ? 'short' : 'long';
              
              if (driftSpotPerpProfit > 0) {
                altSpotPerpProfit = driftSpotPerpProfit;
                altSpotPerpExchange = 'drift';
              }
            }
          }

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

          if (bestStrategy !== 'none') {
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
              altSpotPerpProfit,
              altSpotPerpExchange,
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

      arbOpportunities.sort((a, b) => b.bestStrategyDailyProfit - a.bestStrategyDailyProfit);

      setOpportunities(arbOpportunities);
      setLastUpdate(new Date().toLocaleString());
    } catch (error) {
      console.error('Error calculating arbitrage:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistoricalAnalysis = async (opportunity: ArbitrageOpportunity) => {
    if (!opportunity) return;
    
    setHistoricalLoading(true);
    
    try {
      const endTime = Date.now();
      const startTime = endTime - (timeRange * 24 * 60 * 60 * 1000);
      
      // Fetch historical data from both exchanges
      const [driftHistory, hyperliquidHistory] = await Promise.all([
        fetchDriftFundingHistory(`${opportunity.coin}-PERP`),
        fetchHyperliquidFundingHistory(opportunity.coin, startTime, endTime)
      ]);

      // Process data into time series
      const timeSeriesData: Record<string, HistoricalDataPoint> = {};
      
      // Process Drift data
      driftHistory.forEach(entry => {
        // Convert timestamp to milliseconds uniformly
        const timestamp = parseInt(entry.ts) * 1000; // Ensure it's in milliseconds
        
        if (timestamp >= startTime && timestamp <= endTime) {
          const dateKey = new Date(timestamp).toISOString().split('T')[0]; // Use ISO date as key
          const oracleTwap = parseFloat(entry.oraclePriceTwap) / 1e6;
          const fundingRateRaw = parseFloat(entry.fundingRate) / 1e9;
          const fundingRatePercent = (fundingRateRaw / oracleTwap) * 100;
          
          if (!timeSeriesData[dateKey]) {
            timeSeriesData[dateKey] = {
              timestamp,
              date: new Date(timestamp).toLocaleDateString()
            };
          }
          timeSeriesData[dateKey].driftRate = fundingRatePercent;
          
          // Debug log for first few entries
          if (Object.keys(timeSeriesData).length <= 3) {
            console.log('Drift entry processed:', {
              timestamp,
              dateKey,
              oracleTwap,
              fundingRateRaw,
              fundingRatePercent,
              date: new Date(timestamp).toLocaleDateString()
            });
          }
        }
      });

      // Process Hyperliquid data
      hyperliquidHistory.forEach(entry => {
        // Ensure timestamp is in milliseconds
        const timestamp = entry.time * (entry.time < 10000000000 ? 1000 : 1); // Convert to ms if in seconds
        
        // Add the same time range check that's used for Drift data
        if (timestamp >= startTime && timestamp <= endTime) {
          const dateKey = new Date(timestamp).toISOString().split('T')[0]; // Use same ISO date key format
          const fundingRatePercent = parseFloat(entry.fundingRate) * 100;
          
          if (!timeSeriesData[dateKey]) {
            timeSeriesData[dateKey] = {
              timestamp,
              date: new Date(timestamp).toLocaleDateString()
            };
          }
          timeSeriesData[dateKey].hyperliquidRate = fundingRatePercent;
        }
      });

      // Calculate profits for each data point and sort by timestamp
      const sortedData = Object.values(timeSeriesData)
        .sort((a, b) => a.timestamp - b.timestamp);

      let cumulativeCrossExchange = 0;
      let cumulativeSpotPerp = 0;

      const processedData = sortedData.map(point => {
        const driftRate = point.driftRate || 0;
        const hlRate = point.hyperliquidRate || 0;
        
        // Debug logs
        console.log(`Processing data point:`, {
          date: point.date,
          driftRate,
          hlRate,
          spotPerpExchange: opportunity.spotPerpExchange,
          spotPerpDirection: opportunity.spotPerpDirection
        });
        
        // Always calculate both strategies for comparison
        const spread = Math.abs(driftRate - hlRate);
        const crossExchangeProfit = (spread / 100) * positionSize / 3; // Per funding period
        
        // Calculate spot+perp profit - always calculate regardless of best strategy
        const spotPerpRate = opportunity.spotPerpExchange === 'drift' ? driftRate : hlRate;
        const spotPerpProfit = (Math.abs(spotPerpRate) / 100) * positionSize / 3; // Per funding period
        
        console.log(`Calculated profits:`, {
          spread,
          crossExchangeProfit,
          spotPerpRate,
          spotPerpProfit,
          positionSize
        });
        
        cumulativeCrossExchange += crossExchangeProfit;
        cumulativeSpotPerp += spotPerpProfit;
        
        return {
          ...point,
          crossExchangeProfit,
          spotPerpProfit,
          cumulativeCrossExchange,
          cumulativeSpotPerp
        };
      });

      // Calculate analysis metrics for both strategies
      const crossExchangeProfits = processedData.map(d => d.crossExchangeProfit || 0);
      const spotPerpProfits = processedData.map(d => d.spotPerpProfit || 0);
      
      console.log('Cross-exchange profits sample:', crossExchangeProfits.slice(0, 5));
      console.log('Spot+perp profits sample:', spotPerpProfits.slice(0, 5));
      console.log('Total cross-exchange:', cumulativeCrossExchange);
      console.log('Total spot+perp:', cumulativeSpotPerp);
      
      // Use the best strategy for main metrics
      const bestStrategyProfits = opportunity.bestStrategy === 'cross-exchange' ? crossExchangeProfits : spotPerpProfits;
      const totalProfit = bestStrategyProfits.reduce((sum, profit) => sum + profit, 0);
      const avgDailyProfit = totalProfit / timeRange;
      const maxDailyProfit = Math.max(...bestStrategyProfits);
      const winRate = bestStrategyProfits.filter(p => p > 0).length / bestStrategyProfits.length;
      
      // Simple Sharpe ratio calculation (assuming risk-free rate = 0)
      const avgProfit = bestStrategyProfits.reduce((sum, p) => sum + p, 0) / bestStrategyProfits.length;
      const variance = bestStrategyProfits.reduce((sum, p) => sum + Math.pow(p - avgProfit, 2), 0) / bestStrategyProfits.length;
      const stdDev = Math.sqrt(variance);
      const sharpeRatio = stdDev > 0 ? avgProfit / stdDev : 0;

      const analysis: HistoricalAnalysis = {
        totalCrossExchangeProfit: cumulativeCrossExchange,
        totalSpotPerpProfit: cumulativeSpotPerp,
        bestPerformingStrategy: cumulativeCrossExchange > cumulativeSpotPerp ? 'cross-exchange' : 'spot-perp',
        avgDailyProfit,
        maxDailyProfit,
        winRate,
        sharpeRatio
      };

      console.log('Final analysis:', analysis);

      setHistoricalData(processedData);
      setHistoricalAnalysis(analysis);
      
    } catch (error) {
      console.error('Error fetching historical analysis:', error);
    } finally {
      setHistoricalLoading(false);
    }
  };

  const handleRowClick = (opportunity: ArbitrageOpportunity) => {
    console.log('handleRowClick called for:', opportunity.coin);
    setSelectedOpportunity(opportunity);
    setCurrentView('details');
    setTimeRange(21); // Default to past month (21 days)
    fetchHistoricalAnalysis(opportunity);
  };

  const goBackToScanner = () => {
    setCurrentView('scanner');
    setSelectedOpportunity(null);
    setHistoricalData([]);
    setHistoricalAnalysis(null);
  };

  useEffect(() => {
    calculateArbitrage();
  }, []);

  useEffect(() => {
    if (selectedOpportunity && currentView === 'details') {
      fetchHistoricalAnalysis(selectedOpportunity);
    }
  }, [timeRange]);

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
          <TooltipComponent>
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
          </TooltipComponent>
        );
      }
      return (
        <TooltipComponent>
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
        </TooltipComponent>
      );
    } else if (opp.bestStrategy === 'spot-perp') {
      const exchange = opp.spotPerpExchange === 'hyperliquid' ? 'HL' : 'Drift';
      const rate = opp.spotPerpExchange === 'hyperliquid' ? opp.hyperliquidRate : opp.driftRate;
      const isLong = opp.spotPerpDirection === 'long';
      const spotLocation = opp.spotPerpExchange === 'hyperliquid' ? 'HL' : 'Solana DEX';
      
      return (
        <TooltipComponent>
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
            {opp.altSpotPerpExchange && (
              <p className="mt-1 text-xs text-gray-400 border-t pt-1">
                Alternative: {opp.altSpotPerpExchange === 'drift' ? 'Drift' : 'HL'} at {Math.abs(opp.altSpotPerpExchange === 'drift' ? opp.driftRate : opp.hyperliquidRate).toFixed(3)}% 
                (${(opp.altSpotPerpProfit || 0).toFixed(2)}/day)
              </p>
            )}
          </TooltipContent>
        </TooltipComponent>
      );
    }
    return <span className="text-xs text-gray-400">No Arb</span>;
  };

  // Scanner View
  if (currentView === 'scanner') {
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
                Compares cross-exchange arbitrage vs spot+perp strategies. Click any row to view historical analysis.
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
                    <TooltipComponent>
                      <TooltipTrigger asChild>
                        <Info className="inline h-3 w-3 ml-1 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Minimum funding rate difference for cross-exchange arbitrage</p>
                      </TooltipContent>
                    </TooltipComponent>
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
                    <TooltipComponent>
                      <TooltipTrigger asChild>
                        <Info className="inline h-3 w-3 ml-1 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Minimum absolute funding rate for spot+perp strategy</p>
                      </TooltipContent>
                    </TooltipComponent>
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
                        <th className="text-left py-3 px-4 font-medium">
                          Asset 
                          <TooltipComponent>
                            <TooltipTrigger asChild>
                              <Info className="inline h-3 w-3 ml-1 text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Click any row to view historical analysis</p>
                            </TooltipContent>
                          </TooltipComponent>
                        </th>
                        <th className="text-left py-3 px-4 font-medium">Drift Rate</th>
                        <th className="text-left py-3 px-4 font-medium">HL Rate</th>
                        <th className="text-left py-3 px-4 font-medium">Spread</th>
                        <th className="text-left py-3 px-4 font-medium">Best Strategy</th>
                        <th className="text-left py-3 px-4 font-medium">Daily Profit</th>
                        <th className="text-left py-3 px-4 font-medium">APR</th>
                        <th className="text-left py-3 px-4 font-medium">Spot</th>
                        <th className="text-left py-3 px-4 font-medium">Open Interest</th>
                        <th className="text-left py-3 px-4 font-medium">Price Dev</th>
                      </tr>
                    </thead>
                    <tbody>
                      {opportunities.map((opp) => (
                        <tr 
                          key={opp.coin} 
                          className="border-b hover:bg-blue-50 transition-colors cursor-pointer group"
                          onClick={(e) => {
                            e.preventDefault();
                            console.log('Row clicked for:', opp.coin);
                            handleRowClick(opp);
                          }}
                        >
                          <td className="py-3 px-4 font-medium text-blue-600 group-hover:text-blue-800">
                            <div className="flex items-center gap-1">
                              {opp.coin}
                              <BarChart3 className="h-3 w-3" />
                            </div>
                          </td>
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
                            {formatMoney(opp.bestStrategyDailyProfit)}
                          </td>
                          <td className="py-3 px-4 text-sm">
                            {formatAPR(opp.bestStrategyAPR)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              {opp.hasSpotMarket ? (
                                <Badge variant="secondary" className="text-xs">
                                  <Coins className="h-3 w-3 mr-1" />
                                  HL Spot
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs text-gray-400">
                                  DEX only
                                </Badge>
                              )}
                              {opp.bestStrategy === 'spot-perp' && (
                                <div className="text-xs text-gray-500">
                                  Using: {opp.spotPerpExchange === 'hyperliquid' ? 'HL' : 'Solana DEX'}
                                  {opp.altSpotPerpExchange && (
                                    <span className="text-yellow-600"> (2 options)</span>
                                  )}
                                </div>
                              )}
                            </div>
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
                    <div className="text-xs text-gray-400 mt-1 pt-1 border-t">
                      Both viable: {opportunities.filter(o => o.altSpotPerpExchange).length}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </TooltipProvider>
    );
  }

  // Historical Analysis View
  return (
    <TooltipProvider>
      <div className="w-full mx-auto p-6 space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={goBackToScanner}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Scanner
                </Button>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    {selectedOpportunity?.coin} Historical Analysis
                  </CardTitle>
                  <CardDescription>
                    Historical funding rates and strategy performance analysis
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select value={timeRange.toString()} onValueChange={(value) => setTimeRange(parseInt(value))}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">2 weeks</SelectItem>
                    <SelectItem value="30">1 month</SelectItem>
                    <SelectItem value="90">3 months</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => fetchHistoricalAnalysis(selectedOpportunity!)}
                  disabled={historicalLoading}
                >
                  {historicalLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Current Strategy Info */}
        {selectedOpportunity && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Current Best Strategy</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-lg font-bold">
                    {selectedOpportunity.bestStrategy === 'cross-exchange' ? 'Cross-Exchange' : 'Spot+Perp'}
                  </div>
                  <div className="text-sm text-gray-600">
                    {formatMoney(selectedOpportunity.bestStrategyDailyProfit)} daily
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatAPR(selectedOpportunity.bestStrategyAPR)} APR
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Current Rates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Drift:</span>
                    <span className={selectedOpportunity.driftRate >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {formatRate(selectedOpportunity.driftRate)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Hyperliquid:</span>
                    <span className={selectedOpportunity.hyperliquidRate >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {formatRate(selectedOpportunity.hyperliquidRate)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-medium pt-1 border-t">
                    <span>Spread:</span>
                    <span>{formatRate(selectedOpportunity.arbitrageSpread)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Position Size</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-lg font-bold">
                    {formatMoney(positionSize)}
                  </div>
                  <div className="text-xs text-gray-500">
                    Analysis based on this position size
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Historical Analysis */}
        {historicalLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading historical data...</span>
            </CardContent>
          </Card>
        ) : historicalData.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center h-64">
              <AlertCircle className="h-8 w-8 text-gray-400" />
              <span className="ml-2 text-gray-500">No historical data available for the selected time range</span>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Performance Summary */}
            {historicalAnalysis && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total Profit ({timeRange}d)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {selectedOpportunity?.bestStrategy === 'cross-exchange' 
                        ? formatMoney(historicalAnalysis.totalCrossExchangeProfit)
                        : formatMoney(historicalAnalysis.totalSpotPerpProfit)
                      }
                    </div>
                    <p className="text-xs text-gray-500">
                      {formatMoney(historicalAnalysis.avgDailyProfit)} avg daily
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {(historicalAnalysis.winRate * 100).toFixed(1)}%
                    </div>
                    <p className="text-xs text-gray-500">
                      Profitable funding periods
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Max Daily Profit</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatMoney(historicalAnalysis.maxDailyProfit)}
                    </div>
                    <p className="text-xs text-gray-500">
                      Best single day
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Sharpe Ratio</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {historicalAnalysis.sharpeRatio.toFixed(2)}
                    </div>
                    <p className="text-xs text-gray-500">
                      Risk-adjusted returns
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Funding Rates Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Historical Funding Rates</CardTitle>
                  <CardDescription>
                    Funding rates over the last {timeRange} days
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={historicalData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 12 }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis 
                          tick={{ fontSize: 12 }}
                          label={{ value: 'Funding Rate (%)', angle: -90, position: 'insideLeft' }}
                        />
                        <Tooltip 
                          labelFormatter={(value) => `Date: ${value}`}
                          formatter={(value: number, name: string) => {
                            // Correctly identify the source based on the exact dataKey name
                            let source = '';
                            if (name === 'driftRate') {
                              source = 'Drift';
                            } else if (name === 'hyperliquidRate') {
                              source = 'Hyperliquid';
                            } else {
                              source = name; // Fallback to the raw name if it's neither
                            }
                            return [`${value?.toFixed(4)}%`, source];
                          }}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="driftRate" 
                          stroke="#8b5cf6" 
                          strokeWidth={2}
                          name="Drift"
                          connectNulls={false}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="hyperliquidRate" 
                          stroke="#06b6d4" 
                          strokeWidth={2}
                          name="Hyperliquid"
                          connectNulls={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Cumulative Profit Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Cumulative Strategy Performance</CardTitle>
                  <CardDescription>
                    Strategy profits over time (${positionSize.toLocaleString()} position)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={historicalData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 12 }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis 
                          tick={{ fontSize: 12 }}
                          label={{ value: 'Cumulative Profit ($)', angle: -90, position: 'insideLeft' }}
                        />
                        <Tooltip 
                          labelFormatter={(value) => `Date: ${value}`}
                          formatter={(value: number, name: string) => [
                            `$${value?.toFixed(2)}`, 
                            name === 'cumulativeCrossExchange' ? 'Cross-Exchange' : 'Spot+Perp'
                          ]}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="cumulativeCrossExchange" 
                          stroke="#10b981" 
                          strokeWidth={2}
                          name="Cross-Exchange"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="cumulativeSpotPerp" 
                          stroke="#f59e0b" 
                          strokeWidth={2}
                          name="Spot+Perp"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Strategy Comparison */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Strategy Comparison Summary</CardTitle>
                <CardDescription>
                  Performance comparison over the last {timeRange} days
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-green-500" />
                      <h3 className="font-semibold">Cross-Exchange Arbitrage</h3>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Total Profit:</span>
                        <span className="font-medium">{formatMoney(historicalAnalysis?.totalCrossExchangeProfit || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Strategy:</span>
                        <span>Long {selectedOpportunity?.crossExchangeDirection === 'long-drift' ? 'Drift' : 'Hyperliquid'}, Short {selectedOpportunity?.crossExchangeDirection === 'long-drift' ? 'Hyperliquid' : 'Drift'}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        Earns the spread between funding rates on both exchanges. Market neutral position.
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Coins className="h-5 w-5 text-blue-500" />
                      <h3 className="font-semibold">Spot + Perp Strategy</h3>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Total Profit:</span>
                        <span className="font-medium">{formatMoney(historicalAnalysis?.totalSpotPerpProfit || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Strategy:</span>
                        <span>Spot + {selectedOpportunity?.spotPerpDirection} on {selectedOpportunity?.spotPerpExchange}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        Buy spot and {selectedOpportunity?.spotPerpDirection} perpetual to capture full funding rate. 
                        {selectedOpportunity?.spotPerpExchange === 'drift' ? ' Uses Solana DEX for spot.' : ' Uses Hyperliquid spot market.'}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Important Notes */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Historical Analysis Notes:</strong>
            <ul className="list-disc list-inside mt-1 text-xs space-y-1">
              <li>Profits are calculated per funding period (every 8 hours)</li>
              <li>Does not include transaction costs, slippage, or gas fees</li>
              <li>Assumes immediate execution at historical rates</li>
              <li>Past performance does not guarantee future results</li>
              <li>Consider market volatility and liquidation risks when implementing strategies</li>
            </ul>
          </AlertDescription>
        </Alert>
      </div>
    </TooltipProvider>
  );
}

export default FundingArbitrageWithDetails;