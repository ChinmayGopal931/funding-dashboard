"use client"
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';

// Market mappings between exchanges
const MARKET_MAPPINGS: Record<string, { drift: string; hyperliquid: string }> = {
  'SOL': { drift: 'SOL-PERP', hyperliquid: 'SOL' },
  'ETH': { drift: 'ETH-PERP', hyperliquid: 'ETH' },
  'BTC': { drift: 'BTC-PERP', hyperliquid: 'BTC' },
  'JTO': { drift: 'JTO-PERP', hyperliquid: 'JTO' },
  'WIF': { drift: 'WIF-PERP', hyperliquid: 'WIF' },
  'JUP': { drift: 'JUP-PERP', hyperliquid: 'JUP' },
  'PYTH': { drift: 'PYTH-PERP', hyperliquid: 'PYTH' },
  'BONK': { drift: 'BONK-PERP', hyperliquid: 'BONK' },
  'RNDR': { drift: 'RNDR-PERP', hyperliquid: 'RNDR' },
  'AVAX': { drift: 'AVAX-PERP', hyperliquid: 'AVAX' }
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

interface HyperliquidFundingEntry {
  time: number;
  fundingRate: string;
}

interface ComparisonData {
  coin: string;
  driftOI: string;
  driftRate: number;
  hyperliquidRate: number;
  arbitrageOpportunity: number;
  direction: 'long-drift' | 'long-hyperliquid' | 'neutral';
  driftRateAPR: number;
  hyperliquidRateAPR: number;
}

async function fetchDriftContracts(): Promise<DriftContract[]> {
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
}

async function fetchHyperliquidFunding(coin: string): Promise<number> {
  try {
    const endTime = Date.now();
    const startTime = endTime - (24 * 60 * 60 * 1000); // 24 hours ago
    
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
    
    // Get the latest funding rate
    if (data && data.length > 0) {
      const latest = data[data.length - 1];
      return parseFloat(latest.fundingRate);
    }
    return 0;
  } catch (error) {
    console.error(`Error fetching Hyperliquid funding for ${coin}:`, error);
    return 0;
  }
}

function FundingComparison() {
  const [data, setData] = useState<ComparisonData[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  const fetchComparisonData = async () => {
    setLoading(true);
    try {
      // Fetch Drift contracts
      const driftContracts = await fetchDriftContracts();
      
      // Filter for markets that exist on both exchanges
      const availableMarkets = Object.keys(MARKET_MAPPINGS).filter(coin => 
        driftContracts.some(contract => contract.ticker_id === MARKET_MAPPINGS[coin].drift)
      );

      // Fetch Hyperliquid funding rates in parallel
      const hyperliquidPromises = availableMarkets.map(coin => 
        fetchHyperliquidFunding(MARKET_MAPPINGS[coin].hyperliquid)
          .then(rate => ({ coin, rate }))
      );
      
      const hyperliquidResults = await Promise.all(hyperliquidPromises);
      
      // Combine the data
      const comparisonData: ComparisonData[] = availableMarkets.map(coin => {
        const driftContract = driftContracts.find(
          contract => contract.ticker_id === MARKET_MAPPINGS[coin].drift
        );
        const hyperliquidResult = hyperliquidResults.find(result => result.coin === coin);
        
        if (!driftContract || !hyperliquidResult) return null;
        
        const driftRate = parseFloat(driftContract.next_funding_rate) * 100; // Convert to percentage
        const hyperliquidRate = hyperliquidResult.rate * 100; // Convert to percentage
        const arbitrageOpportunity = Math.abs(driftRate - hyperliquidRate);
        
        let direction: 'long-drift' | 'long-hyperliquid' | 'neutral' = 'neutral';
        if (Math.abs(driftRate - hyperliquidRate) > 0.001) { // Threshold of 0.001%
          direction = driftRate > hyperliquidRate ? 'long-hyperliquid' : 'long-drift';
        }
        
        return {
          coin,
          driftOI: driftContract.open_interest,
          driftRate,
          hyperliquidRate,
          arbitrageOpportunity,
          direction,
          driftRateAPR: driftRate * 24 * 365,
          hyperliquidRateAPR: hyperliquidRate * 24 * 365
        };
      }).filter(Boolean) as ComparisonData[];
      
      // Sort by arbitrage opportunity (highest first)
      comparisonData.sort((a, b) => b.arbitrageOpportunity - a.arbitrageOpportunity);
      
      setData(comparisonData);
      setLastUpdate(new Date().toLocaleString());
    } catch (error) {
      console.error('Error fetching comparison data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComparisonData();
  }, []);

  const formatRate = (rate: number) => `${rate.toFixed(4)}%`;
  const formatAPR = (rate: number) => `${rate.toFixed(1)}%`;
  const formatOI = (oi: string) => `$${parseFloat(oi).toLocaleString()}`;

  const getArbitrageColor = (opportunity: number) => {
    if (opportunity > 1) return 'text-green-600 font-bold';
    if (opportunity > 0.1) return 'text-green-500';
    if (opportunity > 0.01) return 'text-yellow-600';
    return 'text-gray-500';
  };

  const getDirectionIcon = (direction: string) => {
    if (direction === 'long-drift') return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (direction === 'long-hyperliquid') return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <div className="h-4 w-4" />;
  };

  return (
    <div className="w-full mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Funding Comparison
            <Button 
              onClick={fetchComparisonData} 
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
            Funding rate differences across exchanges - identifying basis trading opportunities
            {lastUpdate && <span className="ml-2 text-xs">Last updated: {lastUpdate}</span>}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading comparison data...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Coin</th>
                    <th className="text-left py-3 px-4">Drift OI</th>
                    <th className="text-left py-3 px-4">Drift Rate</th>
                    <th className="text-left py-3 px-4">Hyperliquid Rate</th>
                    <th className="text-left py-3 px-4">Arb Opportunity</th>
                    <th className="text-left py-3 px-4">Strategy</th>
                    <th className="text-left py-3 px-4">Drift APR</th>
                    <th className="text-left py-3 px-4">HL APR</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <tr key={row.coin} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{row.coin}</td>
                      <td className="py-3 px-4">{formatOI(row.driftOI)}</td>
                      <td className={`py-3 px-4 ${row.driftRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatRate(row.driftRate)}
                      </td>
                      <td className={`py-3 px-4 ${row.hyperliquidRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatRate(row.hyperliquidRate)}
                      </td>
                      <td className={`py-3 px-4 ${getArbitrageColor(row.arbitrageOpportunity)}`}>
                        {formatRate(row.arbitrageOpportunity)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {getDirectionIcon(row.direction)}
                          <span className="text-xs">
                            {row.direction === 'long-drift' ? 'Long Drift / Short HL' : 
                             row.direction === 'long-hyperliquid' ? 'Long HL / Short Drift' : 
                             'No Arb'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs">{formatAPR(row.driftRateAPR)}</td>
                      <td className="py-3 px-4 text-xs">{formatAPR(row.hyperliquidRateAPR)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Basis Trading Strategy</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">How to Read This Table:</h4>
                <ul className="space-y-1 text-xs">
                  <li>• <strong>Arb Opportunity:</strong> Absolute difference between funding rates</li>
                  <li>• <strong>Strategy:</strong> Shows which position to take on each exchange</li>
                  <li>• <strong>Green rates:</strong> Positive funding (longs pay shorts)</li>
                  <li>• <strong>Red rates:</strong> Negative funding (shorts pay longs)</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Execution Strategy:</h4>
                <ul className="space-y-1 text-xs">
                  <li>• <strong>Long Drift / Short HL:</strong> When Drift rate {'>'} HL rate</li>
                  <li>• <strong>Long HL / Short Drift:</strong> When HL rate {'>'} Drift rate</li>
                  <li>• Consider transaction costs and slippage</li>
                  <li>• Monitor for funding rate changes every 8 hours</li>
                </ul>
              </div>
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded-md">
              <p className="text-xs"><strong>Risk Warning:</strong> Basis trading carries risks including funding rate changes, price divergence, and liquidation risk. Always maintain proper risk management and position sizing.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default FundingComparison;