/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DriftFundingRate } from '@/lib/types';

interface ArbitrageOpportunity {
  asset: string;
  driftData: { rate: number; available: boolean };
  hyperliquidData: { rate: number; available: boolean };
  lighterData: { rate: number; available: boolean };
  gmxData: { rate: number; available: boolean };
  paradexData?: { rate: number; available: boolean };
  maxSpread: number;
  currentAPR: number;
  bestStrategy: string;
  openInterest: number;
  maxPriceDeviation: number;
}

interface HistoricalAnalysisProps {
  opportunity: ArbitrageOpportunity;
  onBack: () => void;
  lighterMarketIds: Record<string, number>;
}

interface FundingDataPoint {
  timestamp: number;
  date: string;
  drift?: number;
  hyperliquid?: number;
  lighter?: number;
  gmx?: number;
  paradex?: number;
  spot: number;
  spread?: number;
}

interface CumulativeDataPoint {
  timestamp: number;
  date: string;
  cumulativeReturn: number;
  hourlyReturn: number;
}

interface ParadexFundingDataPoint {
  market: string;
  funding_index: string;
  funding_premium: string;
  funding_rate: string;
  created_at: number;
}

interface ParadexFundingResponse {
  next: string | null;
  prev: string | null;
  results: ParadexFundingDataPoint[];
}

// API Functions
async function fetchDriftHistoricalRates(asset: string, days: number): Promise<FundingDataPoint[]> {
  const marketName = `${asset}-PERP`;
  const url = `https://data.api.drift.trade/fundingRates?marketName=${marketName}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return [];

    const { fundingRates } = (await response.json()) as { fundingRates: DriftFundingRate[] };
    const rates: DriftFundingRate[] = fundingRates || [];

    const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000; // milliseconds

    return rates
      .map((rate) => {
        const timestamp = Number(rate.ts) * 1000; // convert seconds to milliseconds
        return { rate, timestamp };
      })
      .filter(({ timestamp }) => timestamp > cutoffTime)
      .map(({ rate, timestamp }) => {
        const fundingRate = parseFloat(rate.fundingRate) / 1e9;
        const oracleTwap = parseFloat(rate.oraclePriceTwap) / 1e6;
        const fundingRatePct = (fundingRate / oracleTwap) * 100;
        const hourlyRate = fundingRatePct / 8; // 8-hour rate -> hourly

        return {
          timestamp,
          date: new Date(timestamp).toLocaleString(),
          drift: hourlyRate * 100, // scale up by 100 to correct units
          spot: 0,
        } as FundingDataPoint;
      });
  } catch (error) {
    console.error('Error fetching Drift rates:', error);
    return [];
  }
}

async function fetchHyperliquidHistoricalRates(asset: string, days: number): Promise<FundingDataPoint[]> {
  const endTime = Date.now();
  const startTime = endTime - (days * 24 * 60 * 60 * 1000);
  
  try {
    const response = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'fundingHistory',
        coin: asset,
        startTime: startTime,
        endTime: endTime
      })
    });
    
    if (!response.ok) return [];
    
    const data = await response.json();
    
    return data.map((item: any) => {
      // Convert 8-hour rate to hourly rate (percentage)
      const hourlyRate = parseFloat(item.fundingRate) * 100 / 8;
      
      return {
        timestamp: item.time,
        date: new Date(item.time).toLocaleString(),
        hyperliquid: hourlyRate,
        spot: 0
      };
    });
  } catch (error) {
    console.error('Error fetching Hyperliquid rates:', error);
    return [];
  }
}

async function fetchLighterHistoricalRates(marketId: number, days: number): Promise<FundingDataPoint[]> {
  const endTime = Date.now();
  const startTime = endTime - (days * 24 * 60 * 60 * 1000);
  const countBack = days * 24; // Hourly data points
  
  const url = `https://mainnet.zklighter.elliot.ai/api/v1/fundings?market_id=${marketId}&resolution=1h&start_timestamp=${startTime}&end_timestamp=${endTime}&count_back=${countBack}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    
    const data = await response.json();
    const fundings = data.fundings || [];
    
    return fundings.map((funding: any) => ({
      timestamp: funding.timestamp * 1000, // Convert to milliseconds
      date: new Date(funding.timestamp * 1000).toLocaleString(),
      // Convert to percentage and adjust by dividing by 10 per new requirement
      lighter: parseFloat(funding.rate) * 10 *
      (funding.direction === 'short' ? -1 : 1),
      spot: 0
    }));
  } catch (error) {
    console.error('Error fetching Lighter rates:', error);
    return [];
  }
}

async function fetchGMXHistoricalRates(asset: string, days: number): Promise<FundingDataPoint[]> {
  // GMX doesn't provide historical funding rate data via API
  // Return empty array to handle gracefully in the UI
  // console.log(`GMX historical data not available for ${asset} (${days} days)`);
  return [];
}

async function fetchParadexHistoricalRates(
  asset: string,
  days: number,
  onProgress?: (pct: number) => void,
): Promise<FundingDataPoint[]> {
  const market = `${asset}-USD-PERP`;
  const endTime = Date.now();
  const startTime = endTime - (days * 24 * 60 * 60 * 1000);
  
  try {
    const allData: ParadexFundingDataPoint[] = [];
    let cursor: string | null = null;
    const pageSize = 5000; // Max allowed per docs
    let page = 0;
    
    do {
      page += 1;
      const params = new URLSearchParams({
        market,
        page_size: pageSize.toString(),
        start_at: startTime.toString(),
        end_at: endTime.toString(),
      });
      if (cursor) params.append('cursor', cursor);

      const requestUrl = `https://api.prod.paradex.trade/v1/funding/data?${params}`;
      // console.log(`[Paradex] Fetching page ${page}: ${requestUrl}`);
      
      const response = await fetch(requestUrl, { headers: { 'Accept': 'application/json' } });
      if (!response.ok) {
        console.error(`[Paradex] API error on page ${page}: ${response.status} ${response.statusText}`);
        break;
      }
      const data: ParadexFundingResponse = await response.json();
      // console.log(`[Paradex] Page ${page} results: ${data.results?.length ?? 0}, next: ${data.next ? 'yes' : 'no'}`);

      const pageResults = data.results || [];
      allData.push(...pageResults);

      // progress: based on oldest timestamp fetched so far versus requested window
      if (onProgress && pageResults.length) {
        const oldestTs = Math.min(...allData.map(r => r.created_at));
        const pct = Math.min(1, (endTime - oldestTs) / (endTime - startTime));
        onProgress(pct);
      }
      
      cursor = data.next;
      
      // Safety: if API keeps paginating forever, bail after 20 pages (100k rows)
      if (page >= 20) {
        console.warn('[Paradex] Reached pagination limit (20 pages), stopping.');
        break;
      }
    } while (cursor);

    // Filter strictly to requested window and sort ascending
    const filteredData = allData
      .filter(entry => entry.created_at >= startTime && entry.created_at <= endTime)
      .sort((a, b) => a.created_at - b.created_at);

    // console.log(`[Paradex] Total entries fetched: ${allData.length}. In-range entries: ${filteredData.length}`);
    
    // Convert to the expected format
    return filteredData.map(entry => {
      // Convert funding rate to hourly percentage (Paradex rates are per 8 h)
      const hourlyRate = (parseFloat(entry.funding_rate) * 100) / 8;
      return {
        timestamp: entry.created_at,
        date: new Date(entry.created_at).toLocaleString(),
        paradex: hourlyRate,
        spot: 0,
      };
    });
  } catch (error) {
    console.error('Error fetching Paradex rates:', error);
    onProgress?.(1);
    return [];
  } finally {
    onProgress?.(1);
  }
}

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border rounded-lg p-3 shadow-lg">
        <p className="text-sm font-medium">{new Date(label).toLocaleString()}</p>
        {payload.map((entry: any) => (
          <p key={entry.name} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.value?.toFixed(4)}%
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function HistoricalAnalysis({ opportunity, onBack, lighterMarketIds }: HistoricalAnalysisProps) {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '14d'>('7d');
  const [loading, setLoading] = useState(true);
  const [fundingData, setFundingData] = useState<FundingDataPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [paradexProgress, setParadexProgress] = useState(0);

  // Parse strategy to determine which platforms to show
  const strategyPlatforms = useMemo(() => {
    const strategy = opportunity.bestStrategy;
    const platforms: string[] = [];
    
    if (strategy.includes('Drift')) platforms.push('drift');
    if (strategy.includes('Hyperliquid')) platforms.push('hyperliquid');
    if (strategy.includes('Lighter')) platforms.push('lighter');
    if (strategy.includes('GMX')) platforms.push('gmx');
    if (strategy.includes('Paradex')) platforms.push('paradex');
    if (strategy.includes('Spot')) platforms.push('spot');
    
    return platforms;
  }, [opportunity.bestStrategy]);

  // Determine if platform is long or short based on strategy
  const platformPositions = useMemo(() => {
    const strategy = opportunity.bestStrategy;
    const positions: Record<string, 'long' | 'short'> = {};
    
    // Parse strategy like "Long Drift / Short Hyperliquid" or "Buy Spot / Short Lighter"
    const parts = strategy.split('/');
    
    parts.forEach(part => {
      const trimmed = part.trim();
      if (trimmed.includes('Long') || trimmed.includes('Buy')) {
        const platform = trimmed.replace('Long ', '').replace('Buy ', '').toLowerCase();
        positions[platform] = 'long';
      } else if (trimmed.includes('Short')) {
        const platform = trimmed.replace('Short ', '').toLowerCase();
        positions[platform] = 'short';
      } else if (trimmed === 'Spot') {
        positions['spot'] = 'short'; // In "Long X / Spot", spot is effectively the short side
      }
    });
    
    return positions;
  }, [opportunity.bestStrategy]);

  // Fetch historical data
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const days = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : 14;
        const promises = [];
        
        if (strategyPlatforms.includes('drift')) {
          promises.push(fetchDriftHistoricalRates(opportunity.asset, days));
        }
        
        if (strategyPlatforms.includes('hyperliquid')) {
          promises.push(fetchHyperliquidHistoricalRates(opportunity.asset, days));
        }
        
        if (strategyPlatforms.includes('lighter')) {
          const marketId = lighterMarketIds[opportunity.asset];
          if (marketId) {
            promises.push(fetchLighterHistoricalRates(marketId, days));
          }
        }
        
        if (strategyPlatforms.includes('gmx')) {
          promises.push(fetchGMXHistoricalRates(opportunity.asset, days));
        }
        
        if (strategyPlatforms.includes('paradex')) {
          promises.push(
            fetchParadexHistoricalRates(opportunity.asset, days, pct => setParadexProgress(pct)),
          );
        }
        
        const results = await Promise.all(promises);

        // console.log(results)

        // Merge all data points by timestamp
        const dataMap = new Map<number, FundingDataPoint>();
        
        results.forEach((platformData, ) => {
          // Skip empty results (like GMX)
          if (!platformData || platformData.length === 0) return;
          
          platformData.forEach(point => {
            const existing = dataMap.get(point.timestamp) || {
              timestamp: point.timestamp,
              date: point.date,
              spot: 0
            };
            
            Object.assign(existing, point);
            dataMap.set(point.timestamp, existing);
          });
        });
        
        // Convert to array and sort by timestamp
        const mergedData = Array.from(dataMap.values())
          .sort((a, b) => a.timestamp - b.timestamp);
        
        // Calculate spread for each data point
        mergedData.forEach(point => {
          let longRate = 0;
          let shortRate = 0;
          let hasRequiredData = true;
          
          Object.entries(platformPositions).forEach(([platform, position]) => {
            if (platform === 'spot') {
              // Spot always has a rate of 0
              if (position === 'long') longRate = 0;
              else shortRate = 0;
            } else {
              const rate = point[platform as keyof FundingDataPoint] as number;
              // If a required platform (GMX) has no data, mark as incomplete
              if ((platform === 'gmx' || platform === 'paradex') && rate === undefined) {
                // Only mark as incomplete if this platform is critical to the strategy
                const platformCount = Object.keys(platformPositions).length;
                if (platformCount <= 2) {
                  hasRequiredData = false;
                  return;
                }
              }
              if (rate !== undefined) {
                if (position === 'long') {
                  longRate = rate;
                } else {
                  shortRate = rate;
                }
              }
            }
          });
          
          // Only calculate spread if we have all required data
          if (hasRequiredData) {
            // Spread = Short funding rate - Long funding rate
            // When positive, we earn from the spread
            point.spread = shortRate - longRate;
          } else {
            // Don't calculate spread if critical data is missing
            point.spread = undefined;
          }
        });
        
        setFundingData(mergedData);
      } catch (err) {
        setError('Failed to fetch historical data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAllData();
  }, [timeRange, opportunity.asset, strategyPlatforms, platformPositions, lighterMarketIds]);

  // Calculate cumulative performance
  const cumulativeData = useMemo(() => {
    if (fundingData.length === 0) return [];
    
    let cumulativeReturn = 0;
    const performanceData: CumulativeDataPoint[] = [];
    
    fundingData.forEach(point => {
      // Skip points where spread couldn't be calculated (e.g., missing critical data)
      if (point.spread === undefined) return;
      
      const hourlyReturn = point.spread || 0;
      cumulativeReturn += hourlyReturn;
      
      performanceData.push({
        timestamp: point.timestamp,
        date: point.date,
        hourlyReturn: hourlyReturn,
        cumulativeReturn: cumulativeReturn
      });
    });
    
    return performanceData;
  }, [fundingData]);

  // Chart colors
  const chartColors = {
    drift: '#ec4899', // Pink
    hyperliquid: '#8b5cf6', // Purple
    lighter: '#10b981', // Green
    gmx: '#3b82f6', // Blue
    paradex: '#f59e0b', // Amber
    spot: '#6b7280', // Gray
    spread: '#f59e0b',
    cumulative: '#ef4444'
  };

  const unavailablePlatforms = strategyPlatforms.filter(platform => 
    (platform === 'gmx') || 
    (platform === 'paradex' && !opportunity.paradexData?.available)
  );

  const canCalculatePerformance = !(
    unavailablePlatforms.length > 0 && 
    Object.keys(platformPositions).length <= 2
  );

  return (
    <div className="w-full max-w-7xl mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="p-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <CardTitle className="text-2xl">
                Historical Analysis - {opportunity.asset}
              </CardTitle>
              <CardDescription>
                Strategy: {opportunity.bestStrategy}
              </CardDescription>
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
          
          {unavailablePlatforms.length > 0 && (
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Note: {unavailablePlatforms.map(p => p.toUpperCase()).join(', ')} historical funding rate data is not available via API. 
                {!canCalculatePerformance 
                  ? " Performance metrics cannot be calculated for this strategy."
                  : ` ${unavailablePlatforms.map(p => p.toUpperCase()).join(', ')} data is excluded from historical calculations.`}
              </AlertDescription>
            </Alert>
          )}
          
          <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as any)}>
            <TabsList className="mb-4">
              <TabsTrigger value="24h">24 Hours</TabsTrigger>
              <TabsTrigger value="7d">7 Days</TabsTrigger>
              <TabsTrigger value="14d">14 Days</TabsTrigger>
            </TabsList>
            
            <TabsContent value={timeRange} className="space-y-6">
              {loading ? (
                <div className="flex flex-col items-center py-12 space-y-4">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  {strategyPlatforms.includes('paradex') && paradexProgress > 0 && paradexProgress < 1 && (
                    <div className="w-full max-w-sm h-2 rounded bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${(paradexProgress * 100).toFixed(0)}%` }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Historical Funding Rates Chart */}
                  {fundingData.length === 0 ? (
                    <div className="text-center py-12 border rounded-lg bg-muted/10">
                      <AlertCircle className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        No historical funding rate data available for this asset.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Historical Funding Rates (Hourly %)</h3>
                      <div className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={fundingData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="timestamp"
                            tick={{ fontSize: 12 }}
                            angle={-45}
                            textAnchor="end"
                            height={60}
                            type="number"
                            domain={['dataMin', 'dataMax']}
                            tickFormatter={(value: number) => {
                              const d = new Date(value);
                              return timeRange === '24h'
                                ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : `${d.getMonth() + 1}/${d.getDate()}`;
                            }}
                          />
                          <YAxis 
                            label={{ value: 'Funding Rate (%)', angle: -90, position: 'insideLeft' }}
                          />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend />
                          
                          {strategyPlatforms.includes('drift') && (
                            <Line 
                              type="monotone" 
                              dataKey="drift" 
                              stroke={chartColors.drift}
                              name={`Drift (${platformPositions.drift})`}
                              strokeWidth={1}
                              dot={false}
                              connectNulls
                            />
                          )}
                          
                          {strategyPlatforms.includes('hyperliquid') && (
                            <Line 
                              type="monotone" 
                              dataKey="hyperliquid" 
                              stroke={chartColors.hyperliquid}
                              name={`Hyperliquid (${platformPositions.hyperliquid})`}
                              strokeWidth={1}
                              dot={false}
                              connectNulls
                            />
                          )}
                          
                          {strategyPlatforms.includes('lighter') && (
                            <Line 
                              type="monotone" 
                              dataKey="lighter" 
                              stroke={chartColors.lighter}
                              name={`Lighter (${platformPositions.lighter})`}
                              strokeWidth={1}
                              dot={false}
                              connectNulls
                            />
                          )}
                          
                          {strategyPlatforms.includes('gmx') && (
                            <Line 
                              type="monotone" 
                              dataKey="gmx" 
                              stroke={chartColors.gmx}
                              name={`GMX (${platformPositions.gmx})`}
                              strokeWidth={1}
                              dot={false}
                              connectNulls
                            />
                          )}
                          
                          {strategyPlatforms.includes('paradex') && (
                            <Line 
                              type="monotone" 
                              dataKey="paradex" 
                              stroke={chartColors.paradex}
                              name={`Paradex (${platformPositions.paradex})`}
                              strokeWidth={1}
                              dot={false}
                              connectNulls
                            />
                          )}
                          
                          {strategyPlatforms.includes('spot') && (
                            <Line 
                              type="monotone" 
                              dataKey="spot" 
                              stroke={chartColors.spot}
                              name="Spot"
                              strokeWidth={3}
                              strokeDasharray="5 5"
                              dot={false}
                              connectNulls
                            />
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
                  
                  {/* Cumulative Strategy Performance Chart */}
                  {!canCalculatePerformance ? (
                    <div className="text-center py-12 border rounded-lg bg-muted/10">
                      <AlertCircle className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        Historical performance cannot be calculated because {unavailablePlatforms.map(p => p.toUpperCase()).join(', ')} {unavailablePlatforms.length > 1 ? 'do' : 'does'} not provide historical funding rate data.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Cumulative Strategy Performance</h3>
                      <div className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={cumulativeData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="timestamp"
                              tick={{ fontSize: 12 }}
                              angle={-45}
                              textAnchor="end"
                              height={60}
                              type="number"
                              domain={['dataMin', 'dataMax']}
                              tickFormatter={(value: number) => {
                                const d = new Date(value);
                                return timeRange === '24h'
                                  ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                  : `${d.getMonth() + 1}/${d.getDate()}`;
                              }}
                            />
                            <YAxis 
                              label={{ value: 'Cumulative Return (%)', angle: -90, position: 'insideLeft' }}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            
                            <Line 
                              type="monotone" 
                              dataKey="cumulativeReturn" 
                              stroke={chartColors.cumulative}
                              name="Cumulative Return"
                              strokeWidth={1}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                  
                  {/* Summary Statistics */}
                  {canCalculatePerformance && (
                    <div className="mt-6 p-4 bg-muted rounded-lg">
                      <h3 className="font-semibold mb-2">Performance Summary</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Total Return</p>
                          <p className="font-semibold">
                            {cumulativeData.length > 0 
                              ? `${cumulativeData[cumulativeData.length - 1].cumulativeReturn.toFixed(2)}%`
                              : '0.00%'
                            }
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Avg Hourly Return</p>
                          <p className="font-semibold">
                            {cumulativeData.length > 0 
                              ? `${(cumulativeData.reduce((acc, d) => acc + d.hourlyReturn, 0) / cumulativeData.length).toFixed(4)}%`
                              : '0.0000%'
                            }
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Data Points</p>
                          <p className="font-semibold">{fundingData.length}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Annualized Return</p>
                          <p className="font-semibold">
                            {cumulativeData.length > 0 
                              ? `${((cumulativeData.reduce((acc, d) => acc + d.hourlyReturn, 0) / cumulativeData.length) * 24 * 365).toFixed(2)}%`
                              : '0.00%'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}