import {
  DriftClient,
  OrderParams,
  OrderType,
  MarketType,
  PositionDirection,
  PostOnlyParams,
  BN,
  PRICE_PRECISION,
  BASE_PRECISION,
  QUOTE_PRECISION,
  convertToNumber,
  calculateBidAskPrice,
  getMarketOrderParams,
  getLimitOrderParams,
  getTriggerMarketOrderParams,
  getTriggerLimitOrderParams,
  OracleSource,
  PerpMarketAccount,
  SpotMarketAccount,
  isVariant,
  ZERO,
  calculateReservePrice,
  calculatePrice,
  DriftEnv,
  initialize,
  Wallet,
  IWallet,
  DRIFT_PROGRAM_ID,
  getMarketsAndOraclesForSubscription,
  UserAccount,
  Order,
  OrderStatus,
  OrderTriggerCondition,
  ModifyOrderParams,
} from '@drift-labs/sdk';
import { Connection, PublicKey, Transaction, TransactionSignature } from '@solana/web3.js';
import { DriftWalletAdapter } from '../driftWalletAdapter';

export interface DriftOrderServiceConfig {
  connection: Connection;
  wallet: Wallet | IWallet;
  env?: DriftEnv;
  subAccountId?: number;
  perpMarketIndexes?: number[];
  spotMarketIndexes?: number[];
}

export interface PlaceOrderResult {
  success: boolean;
  txSignature?: string;
  orderId?: number;
  error?: string;
}

export interface OrderInfo {
  orderId: number;
  userOrderId: number;
  marketIndex: number;
  marketType: MarketType;
  direction: PositionDirection;
  baseAssetAmount: BN;
  price: BN;
  orderType: OrderType;
  status: OrderStatus;
  postOnly: boolean;
  reduceOnly: boolean;
}

export class DriftOrderService {
  private driftClient: DriftClient | null = null;
  private connection: Connection;
  private wallet: Wallet | IWallet;
  private env: DriftEnv;
  private isInitialized = false;

  constructor(config: DriftOrderServiceConfig) {
    this.connection = config.connection;
    this.wallet = config.wallet;
    this.env = config.env || 'mainnet-beta';
  }

  /**
   * Initialize the Drift SDK and client
   */
  async initialize(subAccountId: number = 0): Promise<void> {
    if (this.isInitialized && this.driftClient) {
      console.log('DriftOrderService already initialized');
      return;
    }

    try {
      // Initialize the SDK (only needs to be done once)
      await initialize({ env: this.env });

      // Create Drift client
      this.driftClient = new DriftClient({
        connection: this.connection,
        wallet: this.wallet,
        env: this.env,
        activeSubAccountId: subAccountId,
      });

      // Subscribe to markets and oracles
      await this.driftClient.subscribe();
      console.log('DriftClient subscribed to markets and oracles');

      // Try to subscribe to user account if it exists
      try {
        await this.driftClient.addUser(subAccountId);
        console.log(`Subscribed to user account ${subAccountId}`);
      } catch (e: any) {
        if (e.message.includes('Account does not exist')) {
          console.log('User account does not exist yet');
        } else {
          console.error('Error subscribing to user:', e);
        }
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize DriftOrderService:', error);
      throw error;
    }
  }

  /**
   * Update the wallet used by the drift client
   */
  async updateWallet(wallet: Wallet | IWallet, subAccountId?: number): Promise<boolean> {
    if (!this.driftClient) {
      throw new Error('DriftClient not initialized');
    }

    try {
      // Update wallet
      await this.driftClient.updateWallet(wallet);
      
      // Switch sub account if specified
      if (subAccountId !== undefined) {
        await this.switchSubAccount(subAccountId);
      }

      this.wallet = wallet;
      return true;
    } catch (error) {
      console.error('Failed to update wallet:', error);
      return false;
    }
  }

  /**
   * Switch to a different sub account
   */
  async switchSubAccount(subAccountId: number): Promise<void> {
    if (!this.driftClient) {
      throw new Error('DriftClient not initialized');
    }

    try {
      // Try to add user if not already subscribed
      const user = this.driftClient.getUser(subAccountId);
      if (!user) {
        await this.driftClient.addUser(subAccountId);
      }

      // Switch active user
      this.driftClient.switchActiveUser(subAccountId);
      console.log(`Switched to sub account ${subAccountId}`);
    } catch (error) {
      console.error('Failed to switch sub account:', error);
      throw error;
    }
  }

  /**
   * Place a market order
   */
  async placeMarketOrder(params: {
    marketIndex: number;
    marketType: MarketType;
    direction: PositionDirection;
    baseAssetAmount: BN;
    reduceOnly?: boolean;
    auctionDuration?: number;
    auctionStartPrice?: BN;
    auctionEndPrice?: BN;
    maxTs?: BN;
  }): Promise<PlaceOrderResult> {
    if (!this.driftClient) {
      return { success: false, error: 'DriftClient not initialized' };
    }

    try {
      const orderParams = getMarketOrderParams({
        marketIndex: params.marketIndex,
        marketType: params.marketType,
        direction: params.direction,
        baseAssetAmount: params.baseAssetAmount,
        reduceOnly: params.reduceOnly,
        auctionDuration: params.auctionDuration,
        auctionStartPrice: params.auctionStartPrice,
        auctionEndPrice: params.auctionEndPrice,
        maxTs: params.maxTs,
      });

      const txSig = await this.driftClient.placeOrder(orderParams);
      
      return {
        success: true,
        txSignature: txSig,
      };
    } catch (error: any) {
      console.error('Failed to place market order:', error);
      return {
        success: false,
        error: error.message || 'Failed to place market order',
      };
    }
  }

  /**
   * Place a limit order
   */
  async placeLimitOrder(params: {
    marketIndex: number;
    marketType: MarketType;
    direction: PositionDirection;
    baseAssetAmount: BN;
    price: BN;
    postOnly?: PostOnlyParams;
    reduceOnly?: boolean;
    immediateOrCancel?: boolean;
    maxTs?: BN;
    userOrderId?: number;
  }): Promise<PlaceOrderResult> {
    if (!this.driftClient) {
      return { success: false, error: 'DriftClient not initialized' };
    }

    try {
      const orderParams = getLimitOrderParams({
        marketIndex: params.marketIndex,
        marketType: params.marketType,
        direction: params.direction,
        baseAssetAmount: params.baseAssetAmount,
        price: params.price,
        postOnly: params.postOnly,
        reduceOnly: params.reduceOnly,
        immediateOrCancel: params.immediateOrCancel,
        maxTs: params.maxTs,
        userOrderId: params.userOrderId,
      });

      const txSig = await this.driftClient.placeOrder(orderParams);
      
      return {
        success: true,
        txSignature: txSig,
      };
    } catch (error: any) {
      console.error('Failed to place limit order:', error);
      return {
        success: false,
        error: error.message || 'Failed to place limit order',
      };
    }
  }

  /**
   * Place an oracle-based order
   */
  async placeOracleOrder(params: {
    marketIndex: number;
    marketType: MarketType;
    direction: PositionDirection;
    baseAssetAmount: BN;
    oraclePriceOffset: number;
    postOnly?: PostOnlyParams;
    reduceOnly?: boolean;
    auctionDuration?: number;
    auctionStartPrice?: BN;
    auctionEndPrice?: BN;
    maxTs?: BN;
  }): Promise<PlaceOrderResult> {
    if (!this.driftClient) {
      return { success: false, error: 'DriftClient not initialized' };
    }

    try {
      const orderParams: OrderParams = {
        orderType: OrderType.ORACLE,
        marketIndex: params.marketIndex,
        marketType: params.marketType,
        direction: params.direction,
        baseAssetAmount: params.baseAssetAmount,
        oraclePriceOffset: params.oraclePriceOffset,
        postOnly: params.postOnly,
        reduceOnly: params.reduceOnly,
        auctionDuration: params.auctionDuration,
        auctionStartPrice: params.auctionStartPrice,
        auctionEndPrice: params.auctionEndPrice,
        maxTs: params.maxTs,
      };

      const txSig = await this.driftClient.placeOrder(orderParams);
      
      return {
        success: true,
        txSignature: txSig,
      };
    } catch (error: any) {
      console.error('Failed to place oracle order:', error);
      return {
        success: false,
        error: error.message || 'Failed to place oracle order',
      };
    }
  }

  /**
   * Place multiple orders in a single transaction
   */
  async placeMultipleOrders(orderParamsList: OrderParams[]): Promise<PlaceOrderResult> {
    if (!this.driftClient) {
      return { success: false, error: 'DriftClient not initialized' };
    }

    try {
      const txSig = await this.driftClient.placeOrders(orderParamsList);
      
      return {
        success: true,
        txSignature: txSig,
      };
    } catch (error: any) {
      console.error('Failed to place multiple orders:', error);
      return {
        success: false,
        error: error.message || 'Failed to place multiple orders',
      };
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: number): Promise<PlaceOrderResult> {
    if (!this.driftClient) {
      return { success: false, error: 'DriftClient not initialized' };
    }

    try {
      const txSig = await this.driftClient.cancelOrder(orderId);
      
      return {
        success: true,
        txSignature: txSig,
      };
    } catch (error: any) {
      console.error('Failed to cancel order:', error);
      return {
        success: false,
        error: error.message || 'Failed to cancel order',
      };
    }
  }

  /**
   * Cancel multiple orders
   */
  async cancelOrders(params?: {
    marketType?: MarketType;
    marketIndex?: number;
    direction?: PositionDirection;
  }): Promise<PlaceOrderResult> {
    if (!this.driftClient) {
      return { success: false, error: 'DriftClient not initialized' };
    }

    try {
      const txSig = await this.driftClient.cancelOrders(
        params?.marketType,
        params?.marketIndex,
        params?.direction
      );
      
      return {
        success: true,
        txSignature: txSig,
      };
    } catch (error: any) {
      console.error('Failed to cancel orders:', error);
      return {
        success: false,
        error: error.message || 'Failed to cancel orders',
      };
    }
  }

  /**
   * Modify an existing order
   */
  async modifyOrder(orderId: number, params: ModifyOrderParams): Promise<PlaceOrderResult> {
    if (!this.driftClient) {
      return { success: false, error: 'DriftClient not initialized' };
    }

    try {
      const txSig = await this.driftClient.modifyOrder(orderId, params);
      
      return {
        success: true,
        txSignature: txSig,
      };
    } catch (error: any) {
      console.error('Failed to modify order:', error);
      return {
        success: false,
        error: error.message || 'Failed to modify order',
      };
    }
  }

  /**
   * Get all open orders for the current user
   */
  async getOpenOrders(): Promise<OrderInfo[]> {
    if (!this.driftClient) {
      throw new Error('DriftClient not initialized');
    }

    try {
      const user = this.driftClient.getUser();
      const orders = user.getOpenOrders();

      return orders.map(order => ({
        orderId: order.orderId,
        userOrderId: order.userOrderId,
        marketIndex: order.marketIndex,
        marketType: order.marketType,
        direction: order.direction,
        baseAssetAmount: order.baseAssetAmount,
        price: order.price,
        orderType: order.orderType,
        status: order.status,
        postOnly: order.postOnly,
        reduceOnly: order.reduceOnly,
      }));
    } catch (error) {
      console.error('Failed to get open orders:', error);
      return [];
    }
  }

  /**
   * Get oracle price for a perp market
   */
  getOraclePriceForPerpMarket(marketIndex: number): BN | undefined {
    if (!this.driftClient) {
      throw new Error('DriftClient not initialized');
    }

    const oracleData = this.driftClient.getOracleDataForPerpMarket(marketIndex);
    return oracleData?.price;
  }

  /**
   * Get oracle price for a spot market
   */
  getOraclePriceForSpotMarket(marketIndex: number): BN | undefined {
    if (!this.driftClient) {
      throw new Error('DriftClient not initialized');
    }

    const oracleData = this.driftClient.getOracleDataForSpotMarket(marketIndex);
    return oracleData?.price;
  }

  /**
   * Helper to convert price to PRICE_PRECISION
   */
  convertToPricePrecision(price: number): BN {
    return new BN(price * PRICE_PRECISION.toNumber());
  }

  /**
   * Helper to convert size to BASE_PRECISION for perp markets
   */
  convertToPerpPrecision(size: number): BN {
    return new BN(size * BASE_PRECISION.toNumber());
  }

  /**
   * Helper to convert size to spot market precision
   */
  convertToSpotPrecision(marketIndex: number, size: number): BN {
    if (!this.driftClient) {
      throw new Error('DriftClient not initialized');
    }

    const spotMarket = this.driftClient.getSpotMarketAccount(marketIndex);
    if (!spotMarket) {
      throw new Error(`Spot market ${marketIndex} not found`);
    }

    const precision = new BN(10).pow(new BN(spotMarket.decimals));
    return new BN(size * precision.toNumber());
  }

  /**
   * Check if the service is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.driftClient !== null;
  }

  /**
   * Cleanup and unsubscribe
   */
  async destroy(): Promise<void> {
    if (this.driftClient) {
      await this.driftClient.unsubscribe();
      this.driftClient = null;
      this.isInitialized = false;
    }
  }
}

// Export singleton instance for convenience
let driftOrderServiceInstance: DriftOrderService | null = null;

export function getDriftOrderService(config?: DriftOrderServiceConfig): DriftOrderService {
  if (!driftOrderServiceInstance && config) {
    driftOrderServiceInstance = new DriftOrderService(config);
  } else if (!driftOrderServiceInstance) {
    throw new Error('DriftOrderService not initialized. Please provide config on first call.');
  }
  
  return driftOrderServiceInstance;
}

export function destroyDriftOrderService(): void {
  if (driftOrderServiceInstance) {
    driftOrderServiceInstance.destroy();
    driftOrderServiceInstance = null;
  }
}