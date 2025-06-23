"use client"
import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';

const COLORS: Record<string, string> = {
  'SOL-PERP': '#8b5cf6',
  'ETH-PERP': '#627eea',
  'BTC-PERP': '#f7931a',
  'JTO-PERP': '#06d6a0',
  'WIF-PERP': '#f59e0b',
  'JUP-PERP': '#22c55e',
  'PYTH-PERP': '#ef4444',
  'BONK-PERP': '#ff6b6b',
  'RNDR-PERP': '#4ecdc4',
  'AVAX-PERP': '#45b7d1'
};

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

interface ProcessedDataPoint {
  timestamp: number;
  date: string;
  time: string;
  dateTime: string;
  [market: string]: number | string;
}

async function fetchDriftContracts(): Promise<DriftContract[]> {
  try {
    const response = await fetch('https://data.api.drift.trade/contracts');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Drift contracts data:', data);
    
    // Filter PERP contracts and sort by next_funding_rate (highest first)
    const perpContracts = data.contracts?.filter((contract: DriftContract) => 
      contract.product_type === 'PERP' && 
      contract.ticker_id && 
      contract.next_funding_rate !== null &&
      contract.next_funding_rate !== undefined
    ) || [];
    
    // Sort by next_funding_rate in descending order (highest rates first)
    return perpContracts.sort((a: DriftContract, b: DriftContract) => 
      parseFloat(b.next_funding_rate) - parseFloat(a.next_funding_rate)
    );
  } catch (error) {
    console.error('Error fetching Drift contracts:', error);
    return [];
  }
}

async function fetchDriftFundingRates(marketSymbol: string): Promise<DriftFundingRate[]> {
  try {
    const response = await fetch(`https://data.api.drift.trade/fundingRates?marketName=${marketSymbol}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.fundingRates || [];
  } catch (error) {
    console.error(`Error fetching Drift funding data for ${marketSymbol}:`, error);
    return [];
  }
}

function DriftFundingRatesChart() {
  const [data, setData] = useState<ProcessedDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [availableMarkets, setAvailableMarkets] = useState<DriftContract[]>([]);
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);

  const processMultiMarketData = (marketDataMap: Record<string, DriftFundingRate[]>): ProcessedDataPoint[] => {
    // Step 1: Process each market's data into a map
    const marketTimestampData: Record<string, Record<number, number>> = {};
    
    Object.entries(marketDataMap).forEach(([market, rawData]) => {
      marketTimestampData[market] = {};
      
      rawData.forEach(entry => {
        const timestamp = parseInt(entry.ts) * 1000;
        const oracleTwap = parseFloat(entry.oraclePriceTwap) / 1e6;
        const fundingRateRaw = parseFloat(entry.fundingRate) / 1e9;
        const fundingRatePercent = (fundingRateRaw / oracleTwap) * 100;
        
        marketTimestampData[market][timestamp] = fundingRatePercent;
      });
    });
    
    // Step 2: Get all unique timestamps and sort them
    const allTimestamps = new Set<number>();
    Object.values(marketTimestampData).forEach(marketData => {
      Object.keys(marketData).forEach(ts => allTimestamps.add(parseInt(ts)));
    });
    
    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);
    
    // Step 3: Fill in missing values using forward fill (carry last known value)
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
      
      // For each market, use actual value or carry forward last known value
      markets.forEach(market => {
        if (marketTimestampData[market][timestamp] !== undefined) {
          // Use actual value and update last known
          lastKnownValues[market] = marketTimestampData[market][timestamp];
          dataPoint[market] = marketTimestampData[market][timestamp];
        } else if (lastKnownValues[market] !== undefined) {
          // Forward fill with last known value
          dataPoint[market] = lastKnownValues[market];
        }
        // If no last known value exists, leave undefined (line won't start until first data point)
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
      // Fetch data for selected markets in parallel
      const promises = selectedMarkets.map(market => 
        fetchDriftFundingRates(market).then(data => ({ market, data }))
      );
      
      const results = await Promise.all(promises);
      
      // Convert to market data map
      const marketDataMap: Record<string, DriftFundingRate[]> = {};
      results.forEach(({ market, data }) => {
        marketDataMap[market] = data;
      });
      
      const processedData = processMultiMarketData(marketDataMap);
      setData(processedData);
      setLastUpdate(new Date().toLocaleString());
    } catch (error) {
      console.error('Error fetching Drift funding data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableMarkets = async () => {
    try {
      const contracts = await fetchDriftContracts();
      console.log('Sorted contracts:', contracts.slice(0, 10)); // Debug log
      
      // Store the top 10 contracts with highest funding rates
      const topContracts = contracts.slice(0, 10);
      setAvailableMarkets(topContracts);
      
      // Auto-select top 3 markets for initial display
      if (topContracts.length > 0) {
        const topThree = topContracts.slice(0, 3).map(contract => contract.ticker_id);
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
  }, [selectedMarkets]);

  const generateColor = (tickerId: string) => {
    if (COLORS[tickerId]) return COLORS[tickerId];
    
    // Generate a consistent color based on the ticker name
    const hash = tickerId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  };

  const chartConfig = selectedMarkets.reduce((config, tickerId) => {
    config[tickerId] = {
      label: tickerId,
      color: generateColor(tickerId),
    };
    return config;
  }, {} as Record<string, { label: string; color: string }>);

  // Calculate stats for each market
  const getMarketStats = (tickerId: string) => {
    const values = data.map(d => d[tickerId] as number).filter(v => !isNaN(v) && v !== undefined);
    if (values.length === 0) return { avg: 0, min: 0, max: 0 };
    
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    return { avg, min, max };
  };

  // Get contract info for a market
  const getContractInfo = (tickerId: string) => {
    return availableMarkets.find(contract => contract.ticker_id === tickerId);
  };

  const toggleMarket = (market: string) => {
    setSelectedMarkets(prev => 
      prev.includes(market) 
        ? prev.filter(m => m !== market)
        : [...prev, market].slice(0, 7) // Limit to 7 markets for readability
    );
  };


  return (
    <div className="w-full mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Drift Protocol Funding Rates Analysis - Top 10 Markets
            <div className="flex items-center gap-2">
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
            Last 30 days of funding rates (hourly rates in %). Markets sorted by highest next funding rate.
            {lastUpdate && <span className="ml-2 text-xs">Last updated: {lastUpdate}</span>}
            <div className="mt-3 space-y-2">
              <div className="text-xs font-medium text-gray-700 mb-2">
                Top 10 markets by funding rate - click to toggle (max 7 selected):
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                {availableMarkets.map(contract => {
                  const isSelected = selectedMarkets.includes(contract.ticker_id);
                  const nextFundingRate = (parseFloat(contract.next_funding_rate) * 100).toFixed(4);
                  const nextFundingRateApr = (parseFloat(contract.next_funding_rate) * 24 * 365 * 100).toFixed(1);
                  
                  return (
                    <button
                      key={contract.ticker_id}
                      onClick={() => toggleMarket(contract.ticker_id)}
                      className={`p-2 text-xs rounded-md border text-left ${
                        isSelected
                          ? 'bg-blue-100 border-blue-300 text-blue-800'
                          : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <div className="font-medium">{contract.ticker_id}</div>
                      <div className="text-xs opacity-75">Rate: {nextFundingRate}%</div>
                      <div className="text-xs opacity-75">APR: {nextFundingRateApr}%</div>
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
            <ChartContainer config={chartConfig} className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="dateTime"
                    tickFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <YAxis 
                    label={{ value: 'Funding Rate (%/hour)', angle: -90, position: 'insideLeft' }}
                    tickFormatter={(value) => `${value.toFixed(4)}%`}
                  />
                  <ChartTooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white p-3 border rounded-lg shadow-lg">
                            <p className="font-medium">{label}</p>
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
                  {selectedMarkets.map(tickerId => (
                    <Line
                      key={tickerId}
                      type="monotone"
                      dataKey={tickerId}
                      stroke={chartConfig[tickerId]?.color}
                      strokeWidth={2}
                      dot={false}
                      connectNulls={true} // This will connect across gaps - try false if you prefer gaps
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
              <span>No data available. Try refreshing or selecting a different market.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {data.length > 0 && selectedMarkets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {selectedMarkets.map(tickerId => {
            const stats = getMarketStats(tickerId);
            const contractInfo = getContractInfo(tickerId);
            const color = chartConfig[tickerId]?.color;
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
                    <div className="font-medium text-blue-600 mb-2">Historical (30d)</div>
                    <div>Avg: {stats.avg.toFixed(6)}%/hour</div>
                    <div>Min: {stats.min.toFixed(6)}%/hour</div>
                    <div>Max: {stats.max.toFixed(6)}%/hour</div>
                    <div className="text-xs text-gray-500">
                      APR: {(stats.avg * 24 * 365).toFixed(2)}%
                    </div>
                    {contractInfo && (
                      <>
                        <div className="font-medium text-green-600 mt-3 mb-1">Current</div>
                        <div>Next Rate: {(parseFloat(contractInfo.next_funding_rate) * 100).toFixed(6)}%</div>
                        <div className="text-xs text-gray-500">
                          Next APR: {(parseFloat(contractInfo.next_funding_rate) * 24 * 365 * 100).toFixed(2)}%
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          OI: ${parseFloat(contractInfo.open_interest).toLocaleString()}
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
          <CardTitle>Drift Strategy Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>Top 10 Selection:</strong> Markets are automatically sorted by highest next funding rates.</p>
            <p><strong>Auto-Selection:</strong> Top 3 markets are pre-selected for immediate analysis.</p>
            <p><strong>Rate Calculation:</strong> Funding rates are calculated as: (fundingRate / 1e9) / (oraclePriceTwap / 1e6) × 100</p>
            <p><strong>APR Formula:</strong> Hourly rate × 24 × 365 gives the annualized percentage rate.</p>
            <p><strong>Market Comparison:</strong> Compare rates across markets to identify arbitrage opportunities.</p>
            <p><strong>Risk Assessment:</strong> Higher funding rates may indicate higher volatility and risk.</p>
            <p><strong>Data Source:</strong> Real-time data from Drift Protocol&apos;s public API with 30-day history.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default DriftFundingRatesChart;