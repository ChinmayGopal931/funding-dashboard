"use client"
import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';

const TOKENS = ['PURR', 'SOL', 'ETH', 'BTC', 'HYPE', 'ZORA', 'JTO', 'BONK', 'PYTH', 'WIF'] as const;

const COLORS: Record<string, string> = {
  'PURR': '#8b5cf6',
  'SOL': '#06d6a0',
  'ETH': '#627eea',
  'BTC': '#f7931a',
  'HYPE': '#b1931a',
  'ZORA': '#A6d6a0',
  'JTO': '#06d6a0',
  'BONK': '#ff6b6b',
  'PYTH': '#ef4444',
  'WIF': '#f59e0b'
};

interface FundingHistoryEntry {
  time: number;
  fundingRate: string;
}

interface TokenWithRate {
  token: string;
  rate: number;
  apr: number;
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
    // Updated API endpoint with better error handling
    const response = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        type: 'fundingHistory',
        coin: coin,
        startTime: startTime,
        endTime: endTime
      })
    });
    
    // If response is not ok, log the error but don't throw
    // This allows the chart to continue loading other tokens
    if (!response.ok) {
      console.warn(`API returned ${response.status} for ${coin}. Skipping this token.`);
      return [];
    }
    
    const data: FundingHistoryEntry[] = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching data for ${coin}:`, error);
    return [];
  }
}

// Define time period options
const TIME_PERIODS = [
  { value: '24h', label: '24 Hours', hours: 24 },
  { value: '7d', label: '7 Days', hours: 24 * 7 },
  { value: '14d', label: '14 Days', hours: 24 * 14 },
];

function FundingRatesChart() {
  const [data, setData] = useState<ProcessedDataPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState<typeof TIME_PERIODS[number]>(TIME_PERIODS[1]); // default to 7 days
  const [availableTokens, setAvailableTokens] = useState<string[]>([]);
  const [selectedTokens, setSelectedTokens] = useState<string[]>([]);

  // Toggle token selection on/off
  const toggleToken = (token: string) => {
    setSelectedTokens(prev => 
      prev.includes(token) 
        ? prev.filter(t => t !== token)
        : [...prev, token].slice(0, 7) // Limit to 7 tokens for readability
    );
  };

  // Generate a consistent color for tokens not in the COLORS map
  const generateColor = (token: string) => {
    if (COLORS[token]) return COLORS[token];
    
    // Generate a consistent color based on the token name
    const hash = token.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  };

  const fetchAllData = async (): Promise<void> => {
    setLoading(true);
    const endTime = Date.now();
    const startTime = endTime - (timePeriod.hours * 60 * 60 * 1000); // Based on selected time period

    try {
      // Only fetch data for tokens that are selected or available
      const tokensToFetch = availableTokens.length > 0 ? availableTokens : TOKENS;
      
      // Create a map to track which token corresponds to which result
      const tokenMap: Record<number, string> = {};
      
      // Fetch data for each token individually to handle errors better
      const promises = tokensToFetch.map((token, index) => {
        tokenMap[index] = token; // Store the token for this index
        return fetchFundingHistory(token, startTime, endTime);
      });
      
      const results = await Promise.all(promises);
      console.log("Funding data fetched for tokens:", results);
      
      // Combine all data into a single array with timestamps
      const combinedData: Record<number, ProcessedDataPoint> = {};
      
      results.forEach((tokenData, index) => {
        // Use the token map to get the correct token for this index
        const token = tokenMap[index];
        
        if (!tokenData || tokenData.length === 0) {
          console.log(`No data available for ${token}, skipping`);
          return; // Skip tokens with no data
        }
        
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
      
      if (chartData.length > 0) {
        setData(chartData);
        setLastUpdate(new Date().toLocaleString());
      } else {
        console.warn('No data available for any selected tokens');
      }
    } catch (error) {
      console.error('Error fetching funding data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Sort tokens by funding rate and get top 10
  const sortTokensByFundingRate = () => {
    if (data.length === 0) return;
    
    // Get the latest data point for each token
    const latestData = data[data.length - 1];
    
    // Create array of tokens with their rates
    const tokensWithRates: TokenWithRate[] = TOKENS.map(token => {
      const rate = latestData[token] as number || 0;
      return {
        token,
        rate,
        apr: rate * 24 * 365
      };
    });
    
    // Sort by funding rate (highest first)
    const sortedTokens = tokensWithRates.sort((a, b) => Math.abs(b.rate) - Math.abs(a.rate));
    
    // Take top 10 tokens
    const top10Tokens = sortedTokens.slice(0, 10).map(item => item.token);
    
    // Update available tokens to be the top 10
    setAvailableTokens(top10Tokens);
    
    // If no tokens are selected yet, select top 3
    if (selectedTokens.length === 0) {
      setSelectedTokens(top10Tokens.slice(0, 3));
    }
  };
  
  // Initialize top tokens once with initial data
  const initializeTopTokens = () => {
    // Sort all tokens by their funding rate (using absolute value to get highest magnitude)
    const tokensWithRates = TOKENS.map(token => ({
      token,
      // Use a default rate of 0 if we don't have data yet
      rate: 0
    }));
    
    // For initial state, just use the first 10 tokens
    const initialTop10 = tokensWithRates.slice(0, 10).map(item => item.token);
    setAvailableTokens(initialTop10);
    
    // Select top 3 initially
    setSelectedTokens(initialTop10.slice(0, 3));
  };

  // Initialize available tokens on component mount
  useEffect(() => {
    // Initialize with the first 10 tokens
    initializeTopTokens();
    
    // Fetch data for these tokens
    fetchAllData();
  }, []);
  
  // Sort tokens by funding rate only once after initial data is loaded
  useEffect(() => {
    if (data.length > 0 && availableTokens.length === 10 && selectedTokens.length === 3) {
      // This will run only once after initial data load to properly sort by actual rates
      sortTokensByFundingRate();
    }
  }, [data.length === 0]); // This dependency ensures it only runs once when data first becomes available

  useEffect(() => {
    fetchAllData();
  }, [timePeriod, selectedTokens]);

  // Generate chart config with colors for selected tokens
  const chartConfig: ChartConfig = selectedTokens.reduce((config, token) => {
    config[token] = {
      label: token,
      color: generateColor(token),
    };
    return config;
  }, {} as Record<string, { label: string; color: string }>);



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
            Hyperliquid Protocol Funding Rates Analysis - Top 10 Markets
            <div className="flex items-center gap-2">
              <select 
                value={timePeriod.value} 
                onChange={(e) => setTimePeriod(TIME_PERIODS.find(tp => tp.value === e.target.value) || TIME_PERIODS[1])}
                className="px-3 py-1 border rounded-md text-sm"
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
            Last {timePeriod.label} of funding rates (hourly rates in %). Markets sorted by highest funding rate.
            {lastUpdate && <span className="ml-2 text-xs">Last updated: {lastUpdate}</span>}
            <div className="mt-3 space-y-2">
              <div className="text-xs font-medium text-gray-700 mb-2">
                Top 10 markets by funding rate - click to toggle (max 7 selected):
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                {availableTokens.map(token => {
                  const isSelected = selectedTokens.includes(token);
                  const stats = getTokenStats(token);
                  const color = generateColor(token);
                  
                  return (
                    <button
                      key={token}
                      onClick={() => toggleToken(token)}
                      className={`p-2 text-xs rounded-md border text-left ${
                        isSelected
                          ? 'bg-blue-100 border-blue-300 text-blue-800'
                          : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
                      }`}
                      style={isSelected ? { borderColor: color } : {}}
                    >
                      <div className="font-medium">{token}</div>
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
            <ChartContainer config={chartConfig} className="w-full p-10 min-h-[200px] md:min-h-[300px] lg:min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp"
                    tickFormatter={(timestamp) => {
                      const date = new Date(timestamp);
                      const dateStr = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
                      
                      // Show time for 24h time period
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
                        const formattedDate = date.toLocaleString();
                        
                        return (
                          <div className="bg-white p-3 border rounded-lg shadow-lg">
                            <p className="font-medium">{formattedDate}</p>
                            {payload.map((entry, index) => (
                              <p key={index} style={{ color: entry.color }}>
                                {entry.dataKey}: {(entry.value as number)?.toFixed(6)}%/hour
                              </p>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  {selectedTokens.map(token => (
                    <Line
                      key={token}
                      type="monotone"
                      dataKey={token}
                      stroke={generateColor(token)}
                      strokeWidth={2}
                      dot={false}
                      connectNulls={true}
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
          {selectedTokens.map(token => {
            const stats = getTokenStats(token);
            return (
              <Card key={token}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: generateColor(token) }}
                    />
                    <span className="text-blue-600">{token}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-1 text-sm">
                    <div className="font-medium text-blue-600 mb-2">
                      Historical ({timePeriod.value})
                    </div>
                    <div>Avg: {stats.avg.toFixed(6)}%/hour</div>
                    <div>Min: {stats.min.toFixed(6)}%/hour</div>
                    <div>Max: {stats.max.toFixed(6)}%/hour</div>
                    <div className="text-xs text-gray-500">
                      APR: {(stats.avg * 24 * 365).toFixed(2)}%
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
          <CardTitle>Hyperliquid Protocol Insights</CardTitle>
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