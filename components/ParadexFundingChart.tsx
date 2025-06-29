"use client"
import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';

const COLORS: Record<string, string> = {
  'SOL-USD-PERP': '#8b5cf6',
  'ETH-USD-PERP': '#627eea',
  'BTC-USD-PERP': '#f7931a',
  'JTO-USD-PERP': '#06d6a0',
  'WIF-USD-PERP': '#f59e0b',
  'JUP-USD-PERP': '#22c55e',
  'PYTH-USD-PERP': '#ef4444',
  'BONK-USD-PERP': '#ff6b6b',
  'RNDR-USD-PERP': '#4ecdc4',
  'AVAX-USD-PERP': '#45b7d1'
};

// Define time period options
const TIME_PERIODS = [
  { value: '24h', label: '24 Hours', hours: 24 },
  { value: '7d', label: '7 Days', hours: 24 * 7 },
  { value: '14d', label: '14 Days', hours: 24 * 14 },
];

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
  days: number,
): Promise<ParadexFundingDataPoint[]> {
  const endTime = Date.now();
  const startTime = endTime - days * 24 * 60 * 60 * 1000;

  try {
    const allData: ParadexFundingDataPoint[] = [];
    let cursor: string | null = null;
    const pageSize = 5000; // max allowed by API

    do {
      const params = new URLSearchParams({
        market,
        page_size: pageSize.toString(),
        start_at: startTime.toString(),
        end_at: endTime.toString(),
      });

      if (cursor) params.append('cursor', cursor);

      const resp = await fetch(`https://api.prod.paradex.trade/v1/funding/data?${params}`, {
        headers: { Accept: 'application/json' },
      });

      if (!resp.ok) {
        console.error(`Paradex API error ${resp.status}`);
        break;
      }

      const data: ParadexFundingResponse = await resp.json();
      allData.push(...(data.results || []));

      cursor = data.next;

      // Safety: stop if we already gathered more points than we could possibly
      // need (Paradex emits one funding event per 8 h → 3 per day).
      const maxPoints = days * 3 + 10;
      if (allData.length > maxPoints) break;
    } while (cursor);

    return allData;
  } catch (err) {
    console.error(`Error fetching funding history for ${market}:`, err);
    return [];
  }
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="w-full bg-gray-200 rounded h-2">
      <div
        className="bg-blue-500 h-2 rounded"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

function ParadexFundingRatesChart() {
  const [data, setData] = useState<ProcessedDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [availableMarkets, setAvailableMarkets] = useState<ParadexMarket[]>([]);
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  const [timePeriod, setTimePeriod] = useState<typeof TIME_PERIODS[number]>(TIME_PERIODS[1]); // default to 7 days

  const processMultiMarketData = (marketDataMap: Record<string, ParadexFundingDataPoint[]>): ProcessedDataPoint[] => {
    const marketTimestampData: Record<string, Record<number, number>> = {};

    Object.entries(marketDataMap).forEach(([market, rawData]) => {
      marketTimestampData[market] = {};
      rawData.forEach((entry) => {
        const timestamp = entry.created_at;
        // Convert Paradex 8-hour rate to hourly percentage
        const hourlyRatePercent = (parseFloat(entry.funding_rate) * 100) / 8;
        marketTimestampData[market][timestamp] = hourlyRatePercent;
      });
    });

    // Step 2: Get all unique timestamps and sort them
    const allTimestamps = new Set<number>();
    Object.values(marketTimestampData).forEach((marketData) => {
      Object.keys(marketData).forEach((ts) => allTimestamps.add(parseInt(ts)));
    });

    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

    // Step 3: Fill in missing values using forward fill
    const markets = Object.keys(marketTimestampData);
    const lastKnownValues: Record<string, number> = {};

    // Initialize with first available value for each market
    markets.forEach((market) => {
      const firstTimestamp = sortedTimestamps.find((ts) => marketTimestampData[market][ts] !== undefined);
      if (firstTimestamp) {
        lastKnownValues[market] = marketTimestampData[market][firstTimestamp];
      }
    });

    // Step 4: Create complete dataset with forward-filled values
    const combinedData: ProcessedDataPoint[] = sortedTimestamps.map((timestamp) => {
      const dataPoint: ProcessedDataPoint = {
        timestamp,
        date: new Date(timestamp).toLocaleDateString(),
        time: new Date(timestamp).toLocaleTimeString(),
        dateTime: new Date(timestamp).toLocaleString(),
      };

      markets.forEach((market) => {
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
    setProgress(0);

    try {
      const marketDataMap: Record<string, ParadexFundingDataPoint[]> = {};

      for (let i = 0; i < selectedMarkets.length; i++) {
        const symbol = selectedMarkets[i];
        // Convert timePeriod to days
        const days = Math.ceil(timePeriod.hours / 24);
        const marketHistory = await fetchParadexFundingHistory(symbol, days);

        const cutoff = Date.now() - timePeriod.hours * 60 * 60 * 1000;
        marketDataMap[symbol] = marketHistory.filter((d) => d.created_at >= cutoff);

        setProgress(Math.round(((i + 1) / selectedMarkets.length) * 100));
      }

      const processed = processMultiMarketData(marketDataMap);
      setData(processed);
      setLastUpdate(new Date().toLocaleString());
    } catch (err) {
      console.error("Error fetching Paradex funding data:", err);
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
        const topThree = topMarkets.slice(0, 3).map((market) => market.symbol);
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
  }, [fetchAllData]);

  const generateColor = (symbol: string) => {
    if (COLORS[symbol]) return COLORS[symbol];

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
    const values = data.map((d) => d[symbol] as number).filter((v) => !isNaN(v) && v !== undefined);
    if (values.length === 0) return { avg: 0, min: 0, max: 0 };

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    return { avg, min, max };
  };

  // Get market info
  const getMarketInfo = (symbol: string) => {
    return availableMarkets.find((market) => market.symbol === symbol);
  };

  const toggleMarket = (market: string) => {
    setSelectedMarkets((prev) =>
      prev.includes(market)
        ? prev.filter((m) => m !== market)
        : [...prev, market].slice(0, 7) // Limit to 7 markets for readability
    );
  };

  // Format funding rate for display
  const formatFundingRate = (rate: string) => {
    // Paradex funding rate is already per 8 hours
    return (parseFloat(rate) * 100).toFixed(4);
  };

  // Calculate APR from funding rate
  const calculateAPR = (rate: number) => {
    // Convert 8-hour rate to hourly rate (divide by 8), then multiply by 24 for daily, then by 365 for annual
    // This matches Drift's calculation: hourly_rate * 24 * 365 * 100
    return (rate / 8) * 24 * 365;
  };

  return (
    <div className="w-full mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Paradex Funding Rates Analysis - Top 10 Markets
            <div className="flex items-center gap-2">
              <select
                value={timePeriod.value}
                onChange={(e) => {
                  const period = TIME_PERIODS.find((p) => p.value === e.target.value) || TIME_PERIODS[0];
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
            Last {timePeriod.label} of funding rates (hourly rates in %). Markets sorted by highest current funding rate.
            {lastUpdate && (
              <span className="ml-2 text-xs">Last updated: {lastUpdate}</span>
            )}
            <div className="mt-3 space-y-2">
              <div className="text-xs font-medium text-gray-700 mb-2">
                Top 10 markets by funding rate - click to toggle (max 7 selected):
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                {availableMarkets.map((market) => {
                  const isSelected = selectedMarkets.includes(market.symbol);
                  const fundingRate8h = formatFundingRate(market.funding_rate);
                  const fundingRateAPR = calculateAPR(parseFloat(market.funding_rate) * 100).toFixed(1);

                  return (
                    <button
                      key={market.symbol}
                      onClick={() => toggleMarket(market.symbol)}
                      className={`p-2 text-xs rounded-md border text-left ${
                        isSelected
                          ? 'bg-blue-100 border-blue-300 text-blue-800'
                          : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <div className="font-medium">{market.symbol}</div>
                      <div className="text-xs opacity-75">Rate: {fundingRate8h}%</div>
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
            <div className="flex flex-col items-center justify-center h-96 w-full space-y-4">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-sm">Loading funding data...</span>
              <ProgressBar progress={progress} />
              <span className="text-xs text-gray-500">{progress}%</span>
            </div>
          ) : data.length > 0 ? (
            <ChartContainer config={chartConfig} className="w-full p-10 min-h-[200px] md:min-h-[300px] lg:min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(timestamp) => {
                      const date = new Date(timestamp);
                      const dateStr = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;

                      // Show time only for 24h time period
                      if (timePeriod.value === '24h') {
                        const hours = String(date.getHours()).padStart(2, '0');
                        const minutes = String(date.getMinutes()).padStart(2, '0');
                        return `${dateStr} ${hours}:${minutes}`;
                      }

                      return dateStr;
                    }}
                  />
                  <YAxis
                    label={{ value: 'Funding Rate (%/hour)', angle: -90, position: 'insideLeft' }}
                    tickFormatter={(value) => `${value.toFixed(4)}%`}
                  />
                  <ChartTooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const date = new Date(label);
                        const formattedDate = new Date(date).toLocaleString();

                        return (
                          <div className="bg-white p-3 border rounded-lg shadow-lg">
                            <p className="font-medium">{formattedDate}</p>
                            {payload.map((entry, index) => (
                              <p key={index} style={{ color: entry.color }}>
                                {entry.dataKey}: {typeof entry.value === 'number' ? entry.value.toFixed(6) : 'N/A'}%/h
                              </p>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  {selectedMarkets.map((symbol) => (
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
          {selectedMarkets.map((symbol) => {
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
                    <div className="font-medium text-blue-600 mb-2">
                      Historical ({timePeriod.value})
                    </div>
                    <div>Avg: {stats.avg.toFixed(6)}%/h</div>
                    <div>Min: {stats.min.toFixed(6)}%/h</div>
                    <div>Max: {stats.max.toFixed(6)}%/h</div>
                    <div className="text-xs text-gray-500">
                      APR: {calculateAPR(stats.avg).toFixed(2)}%
                    </div>
                    {marketInfo && (
                      <>
                        <div className="font-medium text-blue-600 mt-3 mb-1">Current</div>
                        <div>Rate: {(parseFloat(formatFundingRate(marketInfo.funding_rate))).toFixed(6)}%/h</div>
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
          <CardTitle>Paradex Protocol Funding Rates Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p>
              <strong>Time Period:</strong> Toggle between 24 hours, 7 days, and 30 days of historical data.
            </p>
            <p>
              <strong>Top 10 Selection:</strong> Markets are automatically sorted by highest current funding rates.
            </p>
            <p>
              <strong>Auto-Selection:</strong> Top 3 markets are pre-selected for immediate analysis.
            </p>
            <p>
              <strong>Funding Rate:</strong> Displayed as hourly rates for consistency with other protocols.
            </p>
            <p>
              <strong>APR Formula:</strong> Hourly rate × 24 × 365 gives the annualized percentage rate.
            </p>
            <p>
              <strong>Market Comparison:</strong> Compare rates across markets to identify arbitrage opportunities.
            </p>
            <p>
              <strong>Risk Assessment:</strong> Higher funding rates may indicate higher volatility and risk.
            </p>
            <p>
              <strong>Data Source:</strong> Real-time data from Paradex&apos;s public API with historical data.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ParadexFundingRatesChart;