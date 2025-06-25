"use client"
import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';

const TOKENS = ['PURR', 'SOL', 'ETH', 'BTC', 'HYPE', 'ZORA'] as const;

type TokenType = typeof TOKENS[number];

const COLORS: Record<TokenType, string> = {
  'PURR': '#8b5cf6',
  'SOL': '#06d6a0',
  'ETH': '#627eea',
  'BTC': '#f7931a',
  'HYPE': '#b1931a',
  'ZORA': '#A6d6a0'
};

interface FundingHistoryEntry {
  time: number;
  fundingRate: string;
}

interface ProcessedDataPoint {
  timestamp: number;
  date: string;
  time: string;
  dateTime: string;
  [key: string]: number | string; // Allow token names as keys with number values
}

interface TokenStats {
  avg: number;
  min: number;
  max: number;
}

interface ChartConfig {
  [key: string]: {
    label: string;
    color: string;
  };
}

async function fetchFundingHistory(coin: string, startTime: number, endTime: number): Promise<FundingHistoryEntry[]> {
  try {
    const response = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'fundingHistory',
        coin: coin,
        startTime: startTime,
        endTime: endTime
      })
    });
    
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: FundingHistoryEntry[] = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching data for ${coin}:`, error);
    return [];
  }
}

function FundingRatesChart() {
  const [data, setData] = useState<ProcessedDataPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<number>(7); // days

  const fetchAllData = async (): Promise<void> => {
    setLoading(true);
    const endTime = Date.now();
    const startTime = endTime - (timeRange * 24 * 60 * 60 * 1000); // X days ago

    try {
      // Fetch data for all tokens
      const promises = TOKENS.map(token => 
        fetchFundingHistory(token, startTime, endTime)
      );
      
      const results = await Promise.all(promises);
      console.log("Funding data fetched for tokens:", results);
      
      // Combine all data into a single array with timestamps
      const combinedData: Record<number, ProcessedDataPoint> = {};
      
      results.forEach((tokenData, index) => {
        const token = TOKENS[index];
        tokenData.forEach((entry: FundingHistoryEntry) => {
          const timestamp = entry.time;
          const date = new Date(timestamp).toLocaleDateString();
          const time = new Date(timestamp).toLocaleTimeString();
          
          if (!combinedData[timestamp]) {
            combinedData[timestamp] = {
              timestamp,
              date,
              time,
              dateTime: new Date(timestamp).toLocaleString()
            };
          }
          
          combinedData[timestamp][token] = parseFloat(entry.fundingRate) * 100; // Convert to percentage
        });
      });
      
      // Convert to array and sort by timestamp
      const chartData: ProcessedDataPoint[] = Object.values(combinedData)
        .sort((a, b) => a.timestamp - b.timestamp);
      
      setData(chartData);
      setLastUpdate(new Date().toLocaleString());
    } catch (error) {
      console.error('Error fetching funding data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [timeRange]);

  const chartConfig: ChartConfig = {
    PURR: {
      label: "PURR",
      color: COLORS.PURR,
    },
    SOL: {
      label: "SOL",
      color: COLORS.SOL,
    },
    ETH: {
      label: "ETH",
      color: COLORS.ETH,
    },
    BTC: {
      label: "BTC",
      color: COLORS.BTC,
    },
    HYPE: {
      label: "HYPE",
      color: COLORS.HYPE,
    },
    ZORA: {
      label: "ZORA",
      color: COLORS.ZORA,
    },
  };

  console.log("TOKEN", TOKENS);

  // Calculate some stats
  const getTokenStats = (token: string): TokenStats => {
    const values = data.map(d => d[token] as number).filter(v => v !== undefined && !isNaN(v));
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
          <CardTitle className="flex items-center justify-between">
            Hyperliquid Funding Rates Analysis
            <div className="flex items-center gap-2">
              <select 
                value={timeRange} 
                onChange={(e) => setTimeRange(Number(e.target.value))}
                className="px-3 py-1 border rounded-md text-sm"
              >
                <option value={1}>1 day</option>
                <option value={3}>3 days</option>
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={180}>180 days</option>
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
            Historical funding rates for delta neutral strategy analysis
            {lastUpdate && <span className="ml-2 text-xs">Last updated: {lastUpdate}</span>}
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
                    tickFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <YAxis 
                    label={{ value: 'Funding Rate (%)', angle: -90, position: 'insideLeft' }}
                    tickFormatter={(value) => `${value.toFixed(3)}%`}
                  />
                  <ChartTooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white p-3 border rounded-lg shadow-lg">
                            <p className="font-medium">{label}</p>
                            {payload.map((entry, index) => (
                              <p key={index} style={{ color: entry.color }}>
                                {entry.dataKey}: {(entry.value as number)?.toFixed(4)}%
                              </p>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  {TOKENS.map(token => (
                    <Line
                      key={token}
                      type="monotone"
                      dataKey={token}
                      stroke={COLORS[token]}
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <div className="flex items-center justify-center h-96">
              <span>No data available. Try refreshing or selecting a different time range.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {TOKENS.map(token => {
            const stats = getTokenStats(token);
            return (
              <Card key={token}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[token] }}
                    />
                    {token}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-1 text-sm">
                    <div>Avg: {stats.avg.toFixed(4)}%</div>
                    <div>Min: {stats.min.toFixed(4)}%</div>
                    <div>Max: {stats.max.toFixed(4)}%</div>
                    <div className="text-xs text-gray-500 mt-1">
                      APR: {(stats.avg * 24 * 365).toFixed(1)}%
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Strategy Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>Funding Rate Variability:</strong> Compare the spreads between tokens to identify switching opportunities.</p>
            <p><strong>Consistency:</strong> Look for tokens with consistently higher rates vs those with high volatility.</p>
            <p><strong>Gas Costs:</strong> Factor in transaction costs when deciding whether rate differences justify switching.</p>
            <p><strong>Optimal Strategy:</strong> Consider the trade-off between higher average returns and switching frequency.</p>
            <p><strong>APR Calculation:</strong> Hourly rate × 24 × 365 shows annualized returns for comparison.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default FundingRatesChart;