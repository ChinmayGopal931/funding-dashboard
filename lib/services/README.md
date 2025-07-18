# Drift Direct Transactions Guide

This guide explains how to use direct on-chain transactions with Drift Protocol instead of Swift (off-chain) transactions.

## Overview

### Swift Transactions (Off-chain)
- Orders are signed as messages and sent to Swift API
- Keepers/market makers execute orders on-chain
- No gas fees for users
- Orders may have execution delays

### Direct Transactions (On-chain) - What we're using now
- Orders are sent directly to Solana blockchain
- You pay gas fees (~0.00025 SOL per transaction)
- Immediate on-chain execution
- Full control over transaction timing

## Quick Start

### 1. Basic Setup

```typescript
import { Connection } from '@solana/web3.js';
import { DriftOrderService } from '@/lib/services/driftOrderService';
import { DriftWalletAdapter } from '@/lib/driftWalletAdapter';

// Create connection
const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

// Create wallet adapter from your wallet
const driftWallet = new DriftWalletAdapter(wallet);

// Initialize order service
const orderService = new DriftOrderService({
  connection,
  wallet: driftWallet,
  env: 'mainnet-beta',
});

await orderService.initialize();
```

### 2. Place a Market Order

```typescript
import { MarketType, PositionDirection } from '@drift-labs/sdk';

const result = await orderService.placeMarketOrder({
  marketIndex: 0, // SOL-PERP
  marketType: MarketType.PERP,
  direction: PositionDirection.LONG,
  baseAssetAmount: orderService.convertToPerpPrecision(0.1), // 0.1 SOL
  auctionDuration: 60, // 60 slots
});

if (result.success) {
  console.log('Order placed! TX:', result.txSignature);
}
```

### 3. Place a Limit Order

```typescript
const result = await orderService.placeLimitOrder({
  marketIndex: 0,
  marketType: MarketType.PERP,
  direction: PositionDirection.LONG,
  baseAssetAmount: orderService.convertToPerpPrecision(0.1),
  price: orderService.convertToPricePrecision(21.50), // $21.50
  postOnly: PostOnlyParams.TRY_POST_ONLY,
});
```

### 4. Place an Oracle Order

```typescript
const result = await orderService.placeOracleOrder({
  marketIndex: 0,
  marketType: MarketType.PERP,
  direction: PositionDirection.LONG,
  baseAssetAmount: orderService.convertToPerpPrecision(0.1),
  oraclePriceOffset: orderService.convertToPricePrecision(0.05).toNumber(), // $0.05 above oracle
});
```

## Integration with Existing Wallet Context

```typescript
// Your existing code
const provider = walletContext.wallets.find(
  (wallet) => wallet.adapter.name === selectedProviderName
);

// Update drift client
const success = await driftClient.updateWallet(
  wallet.adapter as IWallet,
  undefined,
  subAccountId,
  true,
  undefined
);

// Place order directly (no Swift)
if (success) {
  const orderParams = {
    orderType: OrderType.MARKET,
    marketIndex: 0,
    direction: PositionDirection.LONG,
    baseAssetAmount: driftClient.convertToPerpPrecision(1),
  };

  const txSig = await driftClient.placePerpOrder(orderParams);
  console.log("Order placed successfully:", txSig);
}
```

## Using the React Hook

```typescript
import { useDriftOrders } from '@/hooks/useDriftOrders';

function TradingComponent() {
  const { placeOrder, cancelOrder, loading, error } = useDriftOrders();

  const handleTrade = async () => {
    const result = await placeOrder({
      marketIndex: 0,
      marketType: MarketType.PERP,
      direction: 'long',
      size: 0.1,
      orderType: 'market',
    });

    if (result.success) {
      alert(`Order placed! TX: ${result.txSignature}`);
    }
  };

  return (
    <button onClick={handleTrade} disabled={loading}>
      {loading ? 'Placing Order...' : 'Buy 0.1 SOL'}
    </button>
  );
}
```

## Helper Functions

### Price Conversions
```typescript
// Convert USD price to Drift precision
const driftPrice = orderService.convertToPricePrecision(21.50); // $21.50

// Convert size to perp precision
const perpSize = orderService.convertToPerpPrecision(0.1); // 0.1 SOL

// Convert size to spot precision
const spotSize = orderService.convertToSpotPrecision(0, 100); // 100 USDC
```

### Get Oracle Prices
```typescript
// Get oracle price for perp market
const perpOraclePrice = orderService.getOraclePriceForPerpMarket(0);

// Get oracle price for spot market
const spotOraclePrice = orderService.getOraclePriceForSpotMarket(0);
```

## Error Handling

```typescript
const result = await orderService.placeMarketOrder({...});

if (!result.success) {
  // Handle specific errors
  if (result.error?.includes('insufficient collateral')) {
    alert('Not enough collateral for this order');
  } else if (result.error?.includes('Invalid oracle')) {
    alert('Oracle price unavailable');
  } else {
    alert(`Order failed: ${result.error}`);
  }
}
```

## Key Differences from Swift

1. **Transaction Signing**: Orders are signed as transactions, not messages
2. **Gas Fees**: You pay ~0.00025 SOL per transaction
3. **Execution**: Immediate on-chain execution
4. **No API Calls**: No need to submit to Swift API
5. **Direct Control**: Full control over transaction parameters

## Common Patterns

### Market Order with Auction
```typescript
const oraclePrice = orderService.getOraclePriceForPerpMarket(0);
const spread = oraclePrice.muln(1).divn(100); // 1% spread

await orderService.placeMarketOrder({
  marketIndex: 0,
  marketType: MarketType.PERP,
  direction: PositionDirection.LONG,
  baseAssetAmount: orderService.convertToPerpPrecision(0.1),
  auctionDuration: 60,
  auctionStartPrice: oraclePrice.sub(spread),
  auctionEndPrice: oraclePrice.add(spread),
});
```

### Cancel and Replace
```typescript
// Cancel all orders
await orderService.cancelOrders();

// Place new order
await orderService.placeLimitOrder({...});
```

### Multiple Orders
```typescript
const orders = [
  { /* order 1 params */ },
  { /* order 2 params */ },
];

await orderService.placeMultipleOrders(orders);
```

## Troubleshooting

1. **"Drift client not initialized"**: Ensure you call `initialize()` before placing orders
2. **"Insufficient collateral"**: Deposit more funds to your Drift account
3. **"Invalid oracle"**: Market may be inactive or oracle unavailable
4. **"User not found"**: Initialize your Drift account first

## Migration Checklist

When migrating from Swift to direct transactions:

- [x] Remove Swift API calls
- [x] Remove message signing for orders
- [x] Add direct order placement calls
- [x] Handle transaction signatures instead of Swift responses
- [x] Update error handling for on-chain errors
- [x] Consider gas costs in your UI/UX