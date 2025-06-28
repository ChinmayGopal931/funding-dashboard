/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback, useMemo } from 'react';

interface MarketStats {
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

interface WebSocketContextType {
  isConnected: boolean;
  marketData: Map<number, MarketStats>;
  error: Error | null;
  lastUpdateTime: number;
  subscribedMarkets: Set<number>;
  subscribeToMarket: (marketId: number) => void;
  unsubscribeFromMarket: (marketId: number) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [marketDataState, setMarketDataState] = useState<{
    data: Map<number, MarketStats>;
    lastUpdate: number;
  }>({
    data: new Map(),
    lastUpdate: Date.now()
  });
  const [error, setError] = useState<Error | null>(null);
  const [subscribedMarkets, setSubscribedMarkets] = useState<Set<number>>(new Set());
  
  const ws = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeout = useRef<NodeJS.Timeout | undefined>(undefined);
  const updateBuffer = useRef<Map<number, MarketStats>>(new Map());
  const updateTimeout = useRef<NodeJS.Timeout | undefined>(undefined);

  // Batch updates to reduce re-renders
  const flushUpdates = useCallback(() => {
    if (updateBuffer.current.size === 0) return;
    setMarketDataState(prev => {
      // 💡  mutate the existing Map so the reference stays stable
      const data = prev.data;
      updateBuffer.current.forEach((stats, marketId) => {
        data.set(marketId, stats);
      });
      // clear buffer for next round
      updateBuffer.current.clear();
      // only lastUpdate changes – Map reference remains the same
      return {
        data,
        lastUpdate: Date.now()
      };
    });
  }, []);

  const scheduleUpdate = useCallback((marketStatsData: any) => {

    // Check if this is a single MarketStats object or an object containing multiple markets
    if (marketStatsData && typeof marketStatsData === 'object') {
      if ('market_id' in marketStatsData) {
        // Single market stats object
        updateBuffer.current.set(marketStatsData.market_id, marketStatsData as MarketStats);
      } else {
        // Object containing multiple market stats
        Object.entries(marketStatsData).forEach(([, value]: [string, any]) => {
          if (value && typeof value === 'object' && 'market_id' in value) {
            updateBuffer.current.set(value.market_id, value as MarketStats);
          } else {
          }
        });
      }
    } 
    
    
    // Clear existing timeout
    if (updateTimeout.current) {
      clearTimeout(updateTimeout.current);
    }
    
    // Schedule batch update (debounce)
    updateTimeout.current = setTimeout(flushUpdates, 500); // ⏱️ debounce widened from 100 ms → 500 ms
  }, [flushUpdates]);

  const connect = useCallback((): void => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      return;
    }

    if (ws.current) {
      ws.current.close();
    }

    try {
      ws.current = new WebSocket('wss://mainnet.zklighter.elliot.ai/stream');

      ws.current.onopen = () => {
        setIsConnected(true);
        reconnectAttempts.current = 0;
        
        // Subscribe to all market stats
        const subscribeMessage = {
          type: "subscribe",
          channel: "market_stats/all"
        };
        ws.current?.send(JSON.stringify(subscribeMessage));
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'update/market_stats') {
            if (data.market_stats) {
              scheduleUpdate(data.market_stats);
            }
          }
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
          console.error('❌ Raw message:', event.data);
        }
      };

      ws.current.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setError(new Error('WebSocket connection error'));
        setIsConnected(false);
      };

      ws.current.onclose = () => {
        setIsConnected(false);
        
        // Exponential backoff for reconnection
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current += 1;
          
          reconnectTimeout.current = setTimeout(connect, delay);
        } else {
          setError(new Error('Max reconnection attempts reached'));
        }
      };
    } catch (error) {
      setError(error as Error);
      setIsConnected(false);
    }
  }, [scheduleUpdate]);

  const subscribeToMarket = useCallback((marketId: number) => {
    setSubscribedMarkets(prev => new Set(prev).add(marketId));
  }, []);

  const unsubscribeFromMarket = useCallback((marketId: number) => {
    setSubscribedMarkets(prev => {
      const newSet = new Set(prev);
      newSet.delete(marketId);
      return newSet;
    });
  }, []);

  useEffect(() => {
    connect();
    
    return () => {
      if (ws.current) {
        ws.current.close();
      }
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (updateTimeout.current) {
        clearTimeout(updateTimeout.current);
      }
    };
  }, [connect]);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    isConnected,
    marketData: marketDataState.data,
    error,
    lastUpdateTime: marketDataState.lastUpdate,
    subscribedMarkets,
    subscribeToMarket,
    unsubscribeFromMarket
  }), [isConnected, marketDataState, error, subscribedMarkets, subscribeToMarket, unsubscribeFromMarket]);

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

// Custom hook for specific market data with memoization
export const useMarketData = (marketId: number): MarketStats | undefined => {
  const { marketData, subscribeToMarket, unsubscribeFromMarket } = useWebSocket();
  
  useEffect(() => {
    subscribeToMarket(marketId);
    return () => unsubscribeFromMarket(marketId);
  }, [marketId, subscribeToMarket, unsubscribeFromMarket]);
  
  return marketData.get(marketId);
};
