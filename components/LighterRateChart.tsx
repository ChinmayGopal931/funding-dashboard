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
import { COLORS, MARKET_MAPPING } from "@/lib/utils";
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

  // Fetch all markets funding data and combine timestamps into one timeline
  const fetchAllMarketsData = useCallback(async () => {
    if (selectedMarkets.length === 0) {
      setData([]);
      return;
    }

    setLoading(true);
    try {
      const allMarketIds = Object.entries(MARKET_MAPPING)
        .filter(([, ticker]) => selectedMarkets.includes(ticker))
        .map(([id]) => parseInt(id));

      // Fetch all selected markets in parallel
      const results = await Promise.all(
        allMarketIds.map((id) => fetchFundingForMarket(id, timePeriod.hours))
      );

      // Map marketId to array of funding points
      const marketDataMap: Record<string, Record<number, number>> = {};

      results.forEach((fundings, idx) => {
        const marketId = allMarketIds[idx];
        const ticker = MARKET_MAPPING[marketId];
        marketDataMap[ticker] = {};

        fundings.forEach((point) => {
          const tsMs = point.timestamp * 1000;
          marketDataMap[ticker][tsMs] = parseFloat(point.rate);
        });
      });

      // Collect all unique timestamps
      const allTimestampsSet = new Set<number>();
      Object.values(marketDataMap).forEach((marketData) => {
        Object.keys(marketData).forEach((ts) => allTimestampsSet.add(Number(ts)));
      });
      const allTimestamps = Array.from(allTimestampsSet).sort((a, b) => a - b);

      // Forward fill missing values per market
      const processed: ProcessedDataPoint[] = allTimestamps.map((timestamp) => {
        const date = new Date(timestamp);
        const point: ProcessedDataPoint = {
          timestamp,
          date: date.toLocaleDateString(),
          time: date.toLocaleTimeString(),
          dateTime: date.toLocaleString(),
        };

        Object.entries(marketDataMap).forEach(([ticker, rates]) => {
          // Forward fill: look backward if undefined
          let value = rates[timestamp];
          if (value === undefined) {
            // find last known value before timestamp
            let lastKnown = undefined;
            for (const t of allTimestamps) {
              if (t > timestamp) break;
              if (rates[t] !== undefined) lastKnown = rates[t];
            }
            value = lastKnown ?? 0;
          }
          point[ticker] = value;
        });

        return point;
      });

      setData(processed);
      setLastUpdate(new Date().toLocaleString());
    } catch (e) {
      console.error("Error fetching all markets data:", e);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedMarkets, timePeriod, fetchFundingForMarket]);

  // Load available markets on component mount
  useEffect(() => {
    const markets = Object.values(MARKET_MAPPING);
    setAvailableMarkets(markets);
    // Auto-select first 3 markets initially
    if (markets.length > 0 && selectedMarkets.length === 0) {
      setSelectedMarkets(markets.slice(0, 3));
    }
  }, [fetchAllMarketsData, selectedMarkets]);

  // Fetch data when selected markets or time period changes
  useEffect(() => {
    fetchAllMarketsData();
  }, [fetchAllMarketsData]);

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
    const values = data
      .map(d => d[ticker] as number)
      .filter(v => !isNaN(v) && v !== null && v !== undefined);
    
    if (values.length === 0) return { avg: 0, min: 0, max: 0 };
    
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    return { avg, min, max };
  };

  return (
    <div className="w-full mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between font-bold">
            ZkLighter Funding Rates
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
                onClick={fetchAllMarketsData} 
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
            Funding rate history for ZkLighter markets. {lastUpdate && <span className="ml-2 text-xs">Last updated: {lastUpdate}</span>}
            <div className="mt-3 space-y-2">
              <div className="text-xs font-medium text-gray-700 mb-2">
                Markets - click to toggle (max 7 selected):
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
                          ? 'bg-[#F0F2F5] text-[#386CDB]'
                          : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
                      }`}
                      style={isSelected ? { borderColor: color } : {}}
                    >
                      <div className="font-bold">{ticker}</div>
                      <div className="text-xs">Avg: {stats.avg.toFixed(4)}%</div>
                      <div className="text-xs">Range: {stats.min.toFixed(4)}% - {stats.max.toFixed(4)}%</div>
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
    </div>
  );
}
