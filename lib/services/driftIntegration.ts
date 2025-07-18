import { Connection } from '@solana/web3.js';
import { 
  DriftClient,
  DriftEnv,
  MarketType,
  PositionDirection,
  OrderType,
  PostOnlyParams,
  BN,
  IWallet,
} from '@drift-labs/sdk';
import { DriftOrderService } from './driftOrderService';

/**
 * Example integration showing how to use DriftOrderService with your wallet context
 */
export class DriftIntegration {
  private orderService: DriftOrderService;

  constructor(
    private connection: Connection,
    private wallet: IWallet,
    private env: DriftEnv = 'mainnet-beta'
  ) {
    this.orderService = new DriftOrderService({
      connection,
      wallet,
      env,
    });
  }

  /**
   * Initialize the integration
   */
  async initialize(subAccountId: number = 0): Promise<void> {
    await this.orderService.initialize(subAccountId);
  }

  /**
   * Example: Place a market order with your wallet
   */
  async placeMarketOrderExample() {
    // Example from your code snippet
    const marketIndex = 0; // SOL-PERP
    const size = 0.1; // 0.1 SOL
    const direction = PositionDirection.LONG;

    // Get oracle price for auction parameters
    const oraclePrice = this.orderService.getOraclePriceForPerpMarket(marketIndex);
    
    if (!oraclePrice) {
      throw new Error('Oracle price not available');
    }

    // Set auction parameters (1% spread)
    const spread = oraclePrice.muln(1).divn(100);
    const auctionStartPrice = direction === PositionDirection.LONG 
      ? oraclePrice.sub(spread)
      : oraclePrice.add(spread);
    const auctionEndPrice = direction === PositionDirection.LONG
      ? oraclePrice.add(spread)
      : oraclePrice.sub(spread);

    // Place the order
    const result = await this.orderService.placeMarketOrder({
      marketIndex,
      marketType: MarketType.PERP,
      direction,
      baseAssetAmount: this.orderService.convertToPerpPrecision(size),
      auctionDuration: 60, // 60 slots (~30 seconds)
      auctionStartPrice,
      auctionEndPrice,
    });

    if (result.success) {
      console.log('Market order placed successfully:', result.txSignature);
    } else {
      console.error('Failed to place market order:', result.error);
    }

    return result;
  }

  /**
   * Example: Place a limit order
   */
  async placeLimitOrderExample() {
    const marketIndex = 0; // SOL-PERP
    const size = 0.1; // 0.1 SOL
    const price = 21.50; // $21.50
    const direction = PositionDirection.LONG;

    const result = await this.orderService.placeLimitOrder({
      marketIndex,
      marketType: MarketType.PERP,
      direction,
      baseAssetAmount: this.orderService.convertToPerpPrecision(size),
      price: this.orderService.convertToPricePrecision(price),
      postOnly: PostOnlyParams.TRY_POST_ONLY, // Only place if it would be a maker order
    });

    if (result.success) {
      console.log('Limit order placed successfully:', result.txSignature);
    } else {
      console.error('Failed to place limit order:', result.error);
    }

    return result;
  }

  /**
   * Example: Place an oracle-based order
   */
  async placeOracleOrderExample() {
    const marketIndex = 0; // SOL-PERP
    const size = 0.1; // 0.1 SOL
    const oraclePriceOffset = 0.05; // $0.05 above oracle price
    const direction = PositionDirection.LONG;

    const result = await this.orderService.placeOracleOrder({
      marketIndex,
      marketType: MarketType.PERP,
      direction,
      baseAssetAmount: this.orderService.convertToPerpPrecision(size),
      oraclePriceOffset: this.orderService.convertToPricePrecision(oraclePriceOffset).toNumber(),
      auctionDuration: 60,
    });

    if (result.success) {
      console.log('Oracle order placed successfully:', result.txSignature);
    } else {
      console.error('Failed to place oracle order:', result.error);
    }

    return result;
  }

  /**
   * Update wallet (when user switches wallets)
   */
  async updateWallet(newWallet: IWallet, subAccountId?: number): Promise<boolean> {
    return await this.orderService.updateWallet(newWallet, subAccountId);
  }

  /**
   * Get the order service instance for direct access
   */
  getOrderService(): DriftOrderService {
    return this.orderService;
  }

  /**
   * Cleanup
   */
  async destroy(): Promise<void> {
    await this.orderService.destroy();
  }
}

/**
 * Integration with your existing wallet context code
 */
export async function integrateWithWalletContext(
  walletContext: any,
  selectedProviderName: string,
  subAccountId: number = 0
) {
  // Your existing code
  const provider = walletContext.wallets.find(
    (wallet: any) => wallet.adapter.name === selectedProviderName
  );

  if (!provider) {
    throw new Error('Provider not found');
  }

  // Create connection
  const connection = new Connection(
    'https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY',
    'confirmed'
  );

  // Create drift integration
  const driftIntegration = new DriftIntegration(
    connection,
    provider.adapter as IWallet,
    'mainnet-beta'
  );

  // Initialize
  await driftIntegration.initialize(subAccountId);

  // Now you can place orders directly
  return driftIntegration;
}

/**
 * Complete example showing the conversion from Swift to direct transactions
 */
export async function convertSwiftToDirectExample(
  wallet: IWallet,
  connection: Connection
) {
  // Instead of Swift order placement:
  // const orderMessage = { ... };
  // const { orderParams: message, signature } = driftClient.signSignedMsgOrderParamsMessage(orderMessage);
  // await axios.post('https://swift.drift.trade/orders', { ... });

  // Use direct transactions:
  const orderService = new DriftOrderService({
    connection,
    wallet,
    env: 'mainnet-beta',
  });

  await orderService.initialize();

  // Place order directly on-chain
  const result = await orderService.placeMarketOrder({
    marketIndex: 0,
    marketType: MarketType.PERP,
    direction: PositionDirection.LONG,
    baseAssetAmount: orderService.convertToPerpPrecision(0.1),
    auctionDuration: 60,
  });

  return result;
}