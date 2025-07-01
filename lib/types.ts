// types.ts - Centralized type definitions

import { GMXMarket, ParadexMarket } from "./utils";


interface PlatformData {
  rate: number;
  available: boolean;
}


export interface LighterStats {
  market_id: number;
  index_price: string;
  mark_price: string;
  last_trade_price: string;
  current_funding_rate: string;
  funding_rate: string;
  funding_timestamp: number;
  daily_base_token_volume: number;
  daily_quote_token_volume: number;
  daily_price_low: number;
  daily_price_high: number;
  daily_price_change: number;
}


// Interfaces
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

interface PlatformData {
  rate: number;
  available: boolean;
}



export interface ArbitrageOpportunity {
  asset: string;
  driftData: PlatformData;
  hyperliquidData: PlatformData;
  lighterData: PlatformData;
  gmxData: PlatformData;
  paradexData: PlatformData; // Add this
  maxSpread: number;
  currentAPR: number;
  bestStrategy: string;
  openInterest: number;
  openInterestDrift: number;
  openInterestHyperliquid: number;
  openInterestLighter: number;
  openInterestParadex: number; // Add this
  gmxMarket?: GMXMarket;
  paradexMarket?: ParadexMarket; // Add this
  maxPriceDeviation: number;
  driftContract?: DriftContract;
  hyperliquidContext?: HyperliquidAssetContext;
  lighterStats?: LighterStats;
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

export const TIME_PERIODS = [
  { value: '24h', label: '24 Hours', hours: 24 },
  { value: '7d', label: '7 Days', hours: 24 * 7 },
  { value: '14d', label: '14 Days', hours: 24 * 14 },
];