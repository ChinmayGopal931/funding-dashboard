// types.ts - Centralized type definitions

export interface DriftContract {
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

export interface HyperliquidAsset {
  name: string;
  szDecimals: number;
  maxLeverage: number;
  onlyIsolated?: boolean;
}

export interface HyperliquidAssetContext {
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

export interface ArbitrageOpportunity {
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

export interface DriftFundingRate {
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

export interface HyperliquidFundingEntry {
  time: number;
  fundingRate: string;
}

export interface HistoricalDataPoint {
  timestamp: number;
  date: string;
  driftRate?: number;
  hyperliquidRate?: number;
  crossExchangeProfit?: number;
  spotPerpProfit?: number;
  cumulativeCrossExchange?: number;
  cumulativeSpotPerp?: number;
}

export interface HistoricalAnalysis {
  totalCrossExchangeProfit: number;
  totalSpotPerpProfit: number;
  bestPerformingStrategy: 'cross-exchange' | 'spot-perp';
  avgDailyProfit: number;
  maxDailyProfit: number;
  winRate: number;
  sharpeRatio: number;
}

export interface ArbitrageFilters {
  positionSize: number;
  minSpread: number;
  minAbsoluteRate: number;
}

export interface ViewState {
  currentView: 'scanner' | 'details';
  selectedOpportunity: ArbitrageOpportunity | null;
  timeRange: number;
}