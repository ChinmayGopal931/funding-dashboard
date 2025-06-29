"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { COLORS, MARKET_MAPPING, fetchAllLighterMarkets, LighterMarket } from "@/lib/utils";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";

interface FundingDataPoint {
  timestamp: number; // UNIX seconds
  value: string;
  rate: string;
  direction: "long" | "short";
}

interface ApiResponse {
  code: number;
  resolution: string;
  fundings: FundingDataPoint[];
}

interface ProcessedDataPoint {
  timestamp: number;
  date: string;
  time: string;
  dateTime: string;
  [market: string]: number | string | null;  // Allow null values
}

const RESOLUTION = "1h";
const TIME_PERIODS = [
  { value: '24h', label: '24 Hours', hours: 24 },
  { value: '7d', label: '7 Days', hours: 24 * 7 },
  { value: '14d', label: '14 Days', hours: 24 * 14 },
];

export default function ZkLighterMultiFundingChart() {
  const [data, setData] = useState<ProcessedDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  const [timePeriod, setTimePeriod] = useState<typeof TIME_PERIODS[number]>(TIME_PERIODS[1]); // default to 7 days
  const [availableMarkets, setAvailableMarkets] = useState<string[]>([]);
  const [topMarkets, setTopMarkets] = useState<LighterMarket[]>([]);

  // Helper: fetch historical funding data for one market ID
  const fetchFundingForMarket = useCallback(async (
    marketId: number,
    hoursBack: number
  ): Promise<FundingDataPoint[]> => {
    const now = Date.now();
    const endTimestampMs = now;
    const startTimestampMs = endTimestampMs - hoursBack * 60 * 60 * 1000;
    const countBack = Math.ceil(hoursBack);

    const url = `https://mainnet.zklighter.elliot.ai/api/v1/fundings?market_id=${marketId}&resolution=${RESOLUTION}&start_timestamp=${startTimestampMs}&end_timestamp=${endTimestampMs}&count_back=${countBack}`;

    try {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json: ApiResponse = await res.json();
      if (json.code !== 200) throw new Error(`API error code ${json.code}`);

      return json.fundings;
    } catch (error) {
      console.error(`Error fetching market ${marketId}:`, error);
      return [];
    }
  }, []);

  // Cache for funding data to reduce API calls
  const fundingDataCache = React.useRef<Record<string, {timestamp: number, data: FundingDataPoint[]}>>({});

  // Fetch all markets funding data and combine timestamps into one timeline
  const fetchAllMarketsData = useCallback(async () => {
    if (selectedMarkets.length === 0) {
      setData([]);
      return;
    }

    setLoading(true);
    try {
      // Map selected market tickers back to their IDs
      const allMarketIds = topMarkets
        .filter(market => selectedMarkets.includes(`${market.symbol}-PERP`))
        .map(market => market.market_id);

      // Use cached data when possible to reduce API calls
      const now = Date.now();
      const cacheExpiration = 5 * 60 * 1000; // 5 minutes cache
      const fetchPromises = allMarketIds.map(id => {
        const cacheKey = `${id}-${timePeriod.hours}`;
        const cachedData = fundingDataCache.current[cacheKey];
        
        // Use cached data if available and not expired
        if (cachedData && (now - cachedData.timestamp) < cacheExpiration) {
          // console.log(`Using cached data for market ID ${id}`);
          return Promise.resolve(cachedData.data);
        }
        
        // Otherwise fetch new data
        return fetchFundingForMarket(id, timePeriod.hours).then(data => {
          // Cache the result
          fundingDataCache.current[cacheKey] = {
            timestamp: now,
            data: data
          };
          return data;
        });
      });

      // Fetch data with reduced API calls
      const results = await Promise.all(fetchPromises);

      // Map marketId to array of funding points
      const marketDataMap: Record<string, Record<number, number>> = {};

      results.forEach((fundings, idx) => {
        const marketId = allMarketIds[idx];
        // Find the corresponding market in topMarkets
        const market = topMarkets.find(m => m.market_id === marketId);
        if (!market) return;
        
        const ticker = `${market.symbol}-PERP`;
        marketDataMap[ticker] = {};

        fundings.forEach((point) => {
          const tsMs = point.timestamp * 1000;
          marketDataMap[ticker][tsMs] = parseFloat(point.rate);
        });
      });

      // Get all unique timestamps
      const allTimestamps = new Set<number>();
      Object.values(marketDataMap).forEach((marketData) => {
        Object.keys(marketData).forEach((ts) => {
          allTimestamps.add(parseInt(ts));
        });
      });

      // Sort timestamps
      const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

      // Create combined data points
      const combinedData = sortedTimestamps.map((ts) => {
        const date = new Date(ts);
        const formattedDate = date.toLocaleDateString();
        const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const dataPoint: ProcessedDataPoint = {
          timestamp: ts,
          date: formattedDate,
          time: formattedTime,
          dateTime: `${formattedDate} ${formattedTime}`,
        };

        // Add data for each market
        selectedMarkets.forEach((ticker) => {
          dataPoint[ticker] = marketDataMap[ticker]?.[ts] ?? null;
        });

        return dataPoint;
      });

      setData(combinedData);
      setLastUpdate(new Date().toLocaleString());
    } catch (e) {
      console.error("Error fetching all markets data:", e);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedMarkets, timePeriod, fetchFundingForMarket, topMarkets]);

  // Load top 10 markets on component mount - only once
  useEffect(() => {
    const loadTopMarkets = async () => {
      setLoading(true);
      try {
        // Fetch all markets with their funding rates (uses caching internally)
        const allMarkets = await fetchAllLighterMarkets();
        
        // Get top 10 markets by funding rate
        const top10Markets = allMarkets.slice(0, 10);
        setTopMarkets(top10Markets); // This should contain funding_rate and latestRate
        
        // Convert to ticker format and set as available markets
        const marketTickers = top10Markets.map(market => `${market.symbol}-PERP`);
        setAvailableMarkets(marketTickers);
        
        // Auto-select top 3 markets initially
        const initialSelections = marketTickers.slice(0, 3);
        setSelectedMarkets(initialSelections);
        
        // Force a re-render to ensure stats are displayed
        setLastUpdate(new Date().toLocaleString());
        
        // No need to pre-fetch data here - the next useEffect will handle it
        // This prevents duplicate API calls
      } catch (error) {
        console.error('Error loading top markets:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadTopMarkets();
    // Only run this once on mount - no dependencies
  }, []);

  // Function to refresh top markets
  const refreshTopMarkets = async () => {
    setLoading(true);
    try {
      const allMarkets = await fetchAllLighterMarkets();
      // Get top 10 markets by funding rate
      const top10Markets = allMarkets.slice(0, 10);
      setTopMarkets(top10Markets);
      
      // Convert to ticker format and set as available markets
      const marketTickers = top10Markets.map(market => `${market.symbol}-PERP`);
      setAvailableMarkets(marketTickers);
      
      // Update selected markets to maintain selections where possible
      setSelectedMarkets(prev => {
        const stillAvailable = prev.filter(ticker => marketTickers.includes(ticker));
        // If we lost some selections, add new ones from top markets to maintain up to 3
        if (stillAvailable.length < Math.min(3, prev.length)) {
          const newSelections = marketTickers
            .filter(ticker => !stillAvailable.includes(ticker))
            .slice(0, 3 - stillAvailable.length);
          return [...stillAvailable, ...newSelections];
        }
        return stillAvailable;
      });
      
      // Fetch data for the updated selections
      await fetchAllMarketsData();
    } catch (error) {
      console.error('Error refreshing top markets:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when selected markets or time period changes
  useEffect(() => {
    // Only fetch data when we have selected markets and top markets
    if (selectedMarkets.length > 0 && topMarkets.length > 0) {
      // Use a debounced fetch to prevent excessive API calls
      const timer = setTimeout(() => {
        fetchAllMarketsData();
      }, 300); // 300ms debounce
      
      return () => clearTimeout(timer); // Clean up timer on dependency changes
    }
  }, [fetchAllMarketsData, selectedMarkets, topMarkets.length, timePeriod.hours]);

  // Toggle market on/off
  const toggleMarket = (ticker: string) => {
    setSelectedMarkets((prev) =>
      prev.includes(ticker)
        ? prev.filter((m) => m !== ticker)
        : [...prev, ticker].slice(0, 7) // max 7 markets selected to keep chart readable
    );
  };

  const generateColor = (ticker: string) => {
    if (COLORS[ticker]) return COLORS[ticker];
    const hash = ticker.split("").reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0);
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  };

  // Generate chart config with colors
  const chartConfig = selectedMarkets.reduce((config, ticker) => {
    config[ticker] = {
      label: ticker,
      color: generateColor(ticker),
    };
    return config;
  }, {} as Record<string, { label: string; color: string }>);

  // Calculate stats for each market
  const getMarketStats = (ticker: string) => {
    // First check if we have historical data
    const values = data
      .map(d => d[ticker] as number)
      .filter(v => !isNaN(v) && v !== null && v !== undefined);
    
    if (values.length > 0) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      return { avg, min, max };
    }
    
    // If no historical data, try to get the current rate from topMarkets
    const marketSymbol = ticker.replace('-PERP', '');
    const marketInfo = topMarkets.find(m => m.symbol === marketSymbol);
    
    // For debugging
    // console.log('Market info for', marketSymbol, marketInfo);
    
    if (marketInfo) {
      // Try latestRate first (which is set during market fetching)
      if (marketInfo.latestRate !== undefined) {
        return { 
          avg: marketInfo.latestRate, 
          min: marketInfo.latestRate, 
          max: marketInfo.latestRate 
        };
      }
      
      // Then try funding_rate
      if (marketInfo.funding_rate !== undefined) {
        const rate = parseFloat(marketInfo.funding_rate);
        return { avg: rate, min: rate, max: rate };
      }
    }
    
    // Default to zero if no data available
    return { avg: 0, min: 0, max: 0 };
  };

  return (
    <div className="w-full mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            ZkLighter Protocol Funding Rates Analysis - Top 10 Markets
            <div className="flex items-center gap-2">
              <select
                value={timePeriod.value}
                onChange={(e) => {
                  const period = TIME_PERIODS.find(p => p.value === e.target.value) || TIME_PERIODS[0];
                  setTimePeriod(period);
                }}
                className="text-sm border rounded-md p-1"
              >
                {TIME_PERIODS.map((period) => (
                  <option key={period.value} value={period.value}>
                    {period.label}
                  </option>
                ))}
              </select>
              <Button 
                onClick={refreshTopMarkets} 
                disabled={loading}
                size="sm"
                variant="outline"
                title="Refresh top markets and data"
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
            Last {timePeriod.label} of funding rates (hourly rates in %). Markets sorted by highest funding rate.
            {lastUpdate && <span className="ml-2 text-xs">Last updated: {lastUpdate}</span>}
            <div className="mt-3 space-y-2">
              <div className="text-xs font-medium text-gray-700 mb-2">
                Top 10 markets by funding rate - click to toggle (max 7 selected):
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                {availableMarkets.map((ticker) => {
                  const isSelected = selectedMarkets.includes(ticker);
                  const stats = getMarketStats(ticker);
                  const color = generateColor(ticker);
                  
                  return (
                    <button
                      key={ticker}
                      onClick={() => toggleMarket(ticker)}
                      className={`p-2 text-xs rounded-md border text-left ${
                        isSelected
                          ? 'bg-blue-100 border-blue-300 text-blue-800'
                          : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
                      }`}
                      style={isSelected ? { borderColor: color } : {}}
                    >
                      <div className="font-medium">{ticker}</div>
                      <div className="text-xs opacity-75">Rate: {stats.avg.toFixed(4)}%</div>
                      <div className="text-xs opacity-75">APR: {(stats.avg * 24 * 365).toFixed(2)}%</div>
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
            <ChartContainer 
              config={chartConfig} 
              className="w-full p-10 min-h-[200px] md:min-h-[300px] lg:min-h-[300px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp"
                    tickFormatter={(timestamp) => {
                      const date = new Date(timestamp);
                      const dateStr = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
                      
                      // Show time only for 24h chart
                      if (timePeriod.value === '24h') {
                        const hours = String(date.getHours()).padStart(2, '0');
                        const minutes = String(date.getMinutes()).padStart(2, '0');
                        return `${dateStr} ${hours}:${minutes}`;
                      }
                      
                      return dateStr;
                    }}
                  />
                  <YAxis 
                    label={{ value: 'Funding Rate (%)', angle: -90, position: 'insideLeft' }}
                    tickFormatter={(value) => `${value.toFixed(4)}%`}
                  />
                  <ChartTooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const date = new Date(label);
                        const formattedDate = date.toLocaleString();
                        
                        return (
                          <div className="bg-white p-3 border rounded-lg shadow-lg">
                            <p className="font-medium">{formattedDate}</p>
                            {payload.map((entry, index) => (
                              <p key={index} style={{ color: entry.color }}>
                                {entry.dataKey}: {(entry.value as number)?.toFixed(6)}%
                              </p>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  {selectedMarkets.map((ticker) => (
                    <Line
                      key={ticker}
                      type="monotone"
                      dataKey={ticker}
                      stroke={chartConfig[ticker]?.color}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
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
              <span>No funding data available for the selected markets.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {data.length > 0 && selectedMarkets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
          {selectedMarkets.map(tickerId => {
            const stats = getMarketStats(tickerId);
            const color = generateColor(tickerId);
            const market = topMarkets.find(m => `${m.symbol}-PERP` === tickerId);
            
            return (
              <Card key={tickerId}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: color }}
                    />
                    {tickerId}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-1 text-sm">
                    <div className="font-medium text-blue-600 mb-2">Historical</div>
                    <div>Avg: {stats.avg.toFixed(6)}%</div>
                    <div>Min: {stats.min.toFixed(6)}%</div>
                    <div>Max: {stats.max.toFixed(6)}%</div>
                    <div className="text-xs text-gray-500">
                      APR: {(stats.avg * 24 * 365).toFixed(2)}%
                    </div>
                    {market && market.latestRate !== undefined && (
                      <>
                        <div className="font-medium text-green-600 mt-3 mb-1">Current</div>
                        <div>Latest Rate: {(market.latestRate * 100).toFixed(6)}%</div>
                        <div className="text-xs text-gray-500">
                          Latest APR: {(market.latestRate * 24 * 365 * 100).toFixed(2)}%
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
          <CardTitle>ZkLighter Strategy Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>Top 10 Selection:</strong> Markets are automatically sorted by highest absolute funding rates.</p>
            <p><strong>Auto-Selection:</strong> Top 3 markets are pre-selected for immediate analysis.</p>
            <p><strong>Rate Calculation:</strong> Funding rates are calculated hourly and displayed as percentages.</p>
            <p><strong>APR Formula:</strong> Hourly rate × 24 × 365 gives the annualized percentage rate.</p>
            <p><strong>Market Comparison:</strong> Compare rates across markets to identify arbitrage opportunities.</p>
            <p><strong>Risk Assessment:</strong> Higher funding rates may indicate higher volatility and risk.</p>
            <p><strong>Data Source:</strong> Real-time data from ZkLighter Protocol's public API.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
