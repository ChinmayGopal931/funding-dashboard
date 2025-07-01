"use client"
import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';

type TimeRange = '24h' | '7d' | '30d';

interface ParadexMarket {
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

interface ProcessedDataPoint {
  timestamp: number;
  date: string;
  time: string;
  dateTime: string;
  [market: string]: number | string;
}

async function fetchParadexMarkets(): Promise<ParadexMarket[]> {
  try {
    const response = await fetch('https://api.prod.paradex.trade/v1/markets/summary?market=ALL', {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Filter only perpetual markets and sort by funding rate
    const perpMarkets = (data.results || [])
      .filter((market: ParadexMarket) => market.symbol.endsWith('-USD-PERP'))
      .sort((a: ParadexMarket, b: ParadexMarket) => 
        parseFloat(b.funding_rate) - parseFloat(a.funding_rate)
      );
    
    return perpMarkets;
  } catch (error) {
    console.error('Error fetching Paradex markets:', error);
    return [];
  }
}

async function fetchParadexFundingHistory(
  market: string, 
  startTime?: number, 
  endTime?: number,
  timeRange?: TimeRange
): Promise<ParadexFundingDataPoint[]> {
  const allData: ParadexFundingDataPoint[] = [];
  let cursor: string | null = null;
  const pageSize = 5000; // Max allowed
  
  try {
    do {
      const params = new URLSearchParams({
        market,
        page_size: pageSize.toString(),
      });
      
      if (startTime) params.append('start_at', startTime.toString());
      if (endTime) params.append('end_at', endTime.toString());
      if (cursor) params.append('cursor', cursor);
      
      const response = await fetch(
        `https://api.prod.paradex.trade/v1/funding/data?${params}`,
        { headers: { 'Accept': 'application/json' } }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: ParadexFundingResponse = await response.json();
      allData.push(...(data.results || []));
      
      // Continue if there's more data and we haven't reached our limit
      cursor = data.next;
      
      // Stop if we have enough data for the time range
      // Assuming ~288 data points per day with 5-minute intervals
      const maxDataPoints = timeRange === '24h' ? 288 : timeRange === '7d' ? 2016 : 8640;
      if (allData.length > maxDataPoints) break;
      
    } while (cursor);
    
    return allData;
  } catch (error) {
    console.error(`Error fetching Paradex funding data for ${market}:`, error);
    return [];
  }
}

function ParadexFundingRatesChart() {
  const [data, setData] = useState<ProcessedDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [availableMarkets, setAvailableMarkets] = useState<ParadexMarket[]>([]);
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');

  const processMultiMarketData = (marketDataMap: Record<string, ParadexFundingDataPoint[]>): ProcessedDataPoint[] => {
    // Step 1: Process each market's data into a map
    const marketTimestampData: Record<string, Record<number, number>> = {};
    
    Object.entries(marketDataMap).forEach(([market, rawData]) => {
      marketTimestampData[market] = {};
      
      rawData.forEach(entry => {
        const timestamp = entry.created_at;
        // Convert funding rate to percentage (already in decimal format)
        const fundingRatePercent = parseFloat(entry.funding_rate) * 100;
        
        marketTimestampData[market][timestamp] = fundingRatePercent;
      });
    });
    
    // Step 2: Get all unique timestamps and sort them
    const allTimestamps = new Set<number>();
    Object.values(marketTimestampData).forEach(marketData => {
      Object.keys(marketData).forEach(ts => allTimestamps.add(parseInt(ts)));
    });
    
    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);
    
    // Step 3: Fill in missing values using forward fill
    const markets = Object.keys(marketTimestampData);
    const lastKnownValues: Record<string, number> = {};
    
    // Initialize with first available value for each market
    markets.forEach(market => {
      const firstTimestamp = sortedTimestamps.find(ts => marketTimestampData[market][ts] !== undefined);
      if (firstTimestamp) {
        lastKnownValues[market] = marketTimestampData[market][firstTimestamp];
      }
    });
    
    // Step 4: Create complete dataset with forward-filled values
    const combinedData: ProcessedDataPoint[] = sortedTimestamps.map(timestamp => {
      const dataPoint: ProcessedDataPoint = {
        timestamp,
        date: new Date(timestamp).toLocaleDateString(),
        time: new Date(timestamp).toLocaleTimeString(),
        dateTime: new Date(timestamp).toLocaleString()
      };
      
      markets.forEach(market => {
        if (marketTimestampData[market][timestamp] !== undefined) {
          lastKnownValues[market] = marketTimestampData[market][timestamp];
          dataPoint[market] = marketTimestampData[market][timestamp];
        } else if (lastKnownValues[market] !== undefined) {
          dataPoint[market] = lastKnownValues[market];
        }
      });
      
      return dataPoint;
    });
    
    return combinedData;
  };

  const fetchAllData = async () => {
    if (selectedMarkets.length === 0) {
      setData([]);
      return;
    }

    setLoading(true);
    try {
      // Calculate time range based on selection
      const endTime = Date.now();
      let startTime: number;
      
      switch (timeRange) {
        case '24h':
          startTime = endTime - (24 * 60 * 60 * 1000); // 24 hours
          break;
        case '7d':
          startTime = endTime - (7 * 24 * 60 * 60 * 1000); // 7 days
          break;
        case '30d':
        default:
          startTime = endTime - (30 * 24 * 60 * 60 * 1000); // 30 days
          break;
      }
      
      // Fetch data for selected markets in parallel
      const promises = selectedMarkets.map(symbol => 
        fetchParadexFundingHistory(symbol, startTime, endTime, timeRange).then(data => ({ 
          market: symbol, 
          data 
        }))
      );
      
      const results = await Promise.all(promises);
      
      // Convert to market data map
      const marketDataMap: Record<string, ParadexFundingDataPoint[]> = {};
      results.forEach(({ market, data }) => {
        marketDataMap[market] = data;
      });
      
      const processedData = processMultiMarketData(marketDataMap);
      setData(processedData);
      setLastUpdate(new Date().toLocaleString());
    } catch (error) {
      console.error('Error fetching Paradex funding data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableMarkets = async () => {
    try {
      const markets = await fetchParadexMarkets();
      
      // Store the top 10 markets with highest funding rates
      const topMarkets = markets.slice(0, 10);
      setAvailableMarkets(topMarkets);
      
      // Auto-select top 3 markets for initial display
      if (topMarkets.length > 0) {
        const topThree = topMarkets.slice(0, 3).map(market => market.symbol);
        setSelectedMarkets(topThree);
      }
    } catch (error) {
      console.error('Error loading available markets:', error);
    }
  };

  useEffect(() => {
    loadAvailableMarkets();
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [selectedMarkets, timeRange]);

  const generateColor = (symbol: string) => {
    // Generate a consistent color based on the symbol
    const hash = symbol.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  };

  const chartConfig = selectedMarkets.reduce((config, symbol) => {
    config[symbol] = {
      label: symbol,
      color: generateColor(symbol),
    };
    return config;
  }, {} as Record<string, { label: string; color: string }>);

  // Calculate stats for each market
  const getMarketStats = (symbol: string) => {
    const values = data.map(d => d[symbol] as number).filter(v => !isNaN(v) && v !== undefined);
    if (values.length === 0) return { avg: 0, min: 0, max: 0 };
    
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    return { avg, min, max };
  };

  // Get market info
  const getMarketInfo = (symbol: string) => {
    return availableMarkets.find(market => market.symbol === symbol);
  };

  const toggleMarket = (market: string) => {
    setSelectedMarkets(prev => 
      prev.includes(market) 
        ? prev.filter(m => m !== market)
        : [...prev, market].slice(0, 7) // Limit to 7 markets for readability
    );
  };

  // Calculate 8-hour rate from current funding rate for display
  const format8HourRate = (rate: string) => {
    // Paradex funding rate is already per 8 hours
    return (parseFloat(rate) * 100).toFixed(4);
  };

  // Calculate APR from 8-hour rate
  const calculateAPR = (rate: number) => {
    // rate is per 8 hours, so multiply by 3 for daily, then by 365 for annual
    return rate * 3 * 365;
  };

  return (
    <div className="w-full mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Paradex Funding Rates Analysis - Top 10 Markets
            <div className="flex items-center gap-2">
              <div className="flex gap-1 bg-gray-100 p-1 rounded-md">
                <Button
                  onClick={() => setTimeRange('24h')}
                  size="sm"
                  variant={timeRange === '24h' ? 'default' : 'ghost'}
                  className={`px-3 ${timeRange === '24h' ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}`}
                >
                  24H
                </Button>
                <Button
                  onClick={() => setTimeRange('7d')}
                  size="sm"
                  variant={timeRange === '7d' ? 'default' : 'ghost'}
                  className={`px-3 ${timeRange === '7d' ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}`}
                >
                  7D
                </Button>
                <Button
                  onClick={() => setTimeRange('30d')}
                  size="sm"
                  variant={timeRange === '30d' ? 'default' : 'ghost'}
                  className={`px-3 ${timeRange === '30d' ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}`}
                >
                  30D
                </Button>
              </div>
              <Button 
                onClick={fetchAllData} 
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
            </div>
          </CardTitle>
          <CardDescription>
            Last {timeRange === '24h' ? '24 hours' : timeRange === '7d' ? '7 days' : '30 days'} of funding rates (8-hour rates in %). Markets sorted by highest current funding rate.
            {lastUpdate && <span className="ml-2 text-xs">Last updated: {lastUpdate}</span>}
            <div className="mt-3 space-y-2">
              <div className="text-xs font-medium text-gray-700 mb-2">
                Top 10 markets by funding rate - click to toggle (max 7 selected):
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                {availableMarkets.map(market => {
                  const isSelected = selectedMarkets.includes(market.symbol);
                  const fundingRate8h = format8HourRate(market.funding_rate);
                  const fundingRateAPR = calculateAPR(parseFloat(market.funding_rate) * 100).toFixed(1);
                  
                  return (
                    <button
                      key={market.symbol}
                      onClick={() => toggleMarket(market.symbol)}
                      className={`p-2 text-xs rounded-md border text-left ${
                        isSelected
                          ? 'bg-purple-100 border-purple-300 text-purple-800'
                          : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <div className="font-medium">{market.symbol.replace('-USD-PERP', '')}</div>
                      <div className="text-xs opacity-75">8h: {fundingRate8h}%</div>
                      <div className="text-xs opacity-75">APR: {fundingRateAPR}%</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading funding data...</span>
            </div>
          ) : data.length > 0 ? (
            <ChartContainer config={chartConfig} className="w-full p-10 min-h-[200px] md:min-h-[300px] lg:min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="dateTime"
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      if (timeRange === '24h') {
                        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      } else if (timeRange === '7d') {
                        return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
                      } else {
                        return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
                      }
                    }}
                    interval={timeRange === '24h' ? 'preserveStartEnd' : timeRange === '7d' ? 48 : 144}
                  />
                  <YAxis 
                    label={{ value: 'Funding Rate (%/8 hours)', angle: -90, position: 'insideLeft' }}
                    tickFormatter={(value) => `${value.toFixed(4)}%`}
                  />
                  <ChartTooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const date = new Date(label);
                        const formattedDate = timeRange === '24h' 
                          ? date.toLocaleString([], { 
                              month: 'short', 
                              day: 'numeric', 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })
                          : date.toLocaleString([], { 
                              month: 'short', 
                              day: 'numeric', 
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            });
                        
                        return (
                          <div className="bg-white p-3 border rounded-lg shadow-lg">
                            <p className="font-medium">{formattedDate}</p>
                            {payload.map((entry, index) => (
                              <p key={index} style={{ color: entry.color }}>
                                {entry.dataKey}: {(entry.value as number)?.toFixed(6)}%/8h
                              </p>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  {selectedMarkets.map(symbol => (
                    <Line
                      key={symbol}
                      type="monotone"
                      dataKey={symbol}
                      stroke={chartConfig[symbol]?.color}
                      strokeWidth={2}
                      dot={false}
                      connectNulls={true}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : selectedMarkets.length === 0 ? (
            <div className="flex items-center justify-center h-96">
              <span>Select markets above to view their funding rate history.</span>
            </div>
          ) : (
            <div className="flex items-center justify-center h-96">
              <span>No data available. Try refreshing or selecting different markets.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {data.length > 0 && selectedMarkets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {selectedMarkets.map(symbol => {
            const stats = getMarketStats(symbol);
            const marketInfo = getMarketInfo(symbol);
            const color = chartConfig[symbol]?.color;
            const assetName = symbol.replace('-USD-PERP', '');
            
            return (
              <Card key={symbol}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: color }}
                    />
                    {assetName}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-1 text-sm">
                    <div className="font-medium text-purple-600 mb-2">
                      Historical ({timeRange === '24h' ? '24h' : timeRange === '7d' ? '7d' : '30d'})
                    </div>
                    <div>Avg: {stats.avg.toFixed(6)}%/8h</div>
                    <div>Min: {stats.min.toFixed(6)}%/8h</div>
                    <div>Max: {stats.max.toFixed(6)}%/8h</div>
                    <div className="text-xs text-gray-500">
                      APR: {calculateAPR(stats.avg).toFixed(2)}%
                    </div>
                    {marketInfo && (
                      <>
                        <div className="font-medium text-green-600 mt-3 mb-1">Current</div>
                        <div>Rate: {format8HourRate(marketInfo.funding_rate)}%/8h</div>
                        <div className="text-xs text-gray-500">
                          APR: {calculateAPR(parseFloat(marketInfo.funding_rate) * 100).toFixed(2)}%
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          OI: ${(parseFloat(marketInfo.open_interest) * parseFloat(marketInfo.underlying_price)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                        <div className="text-xs text-gray-500">
                          24h Vol: ${parseFloat(marketInfo.volume_24h).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Paradex Strategy Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>Time Range:</strong> Toggle between 24 hours, 7 days, and 30 days of historical data.</p>
            <p><strong>Top 10 Selection:</strong> Markets are automatically sorted by highest current funding rates.</p>
            <p><strong>Auto-Selection:</strong> Top 3 markets are pre-selected for immediate analysis.</p>
            <p><strong>Funding Period:</strong> Paradex uses 8-hour funding periods, paid continuously.</p>
            <p><strong>APR Formula:</strong> 8-hour rate × 3 × 365 gives the annualized percentage rate.</p>
            <p><strong>Market Comparison:</strong> Compare rates across markets to identify arbitrage opportunities.</p>
            <p><strong>Risk Assessment:</strong> Higher funding rates may indicate higher volatility and risk.</p>
            <p><strong>Data Source:</strong> Real-time data from Paradex&apos;s public API with historical data.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ParadexFundingRatesChart;