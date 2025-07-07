import { ethers } from 'ethers';

const ARB_RPC = 'https://arb-mainnet.g.alchemy.com/v2/T9-FpentOi6lMOXtyb397haz3s1r7-Uh';
const provider = new ethers.JsonRpcProvider(ARB_RPC);

// ✅ Use getAddress to sanitize all raw input addresses
const READER = '0x22199A49a999c351eF7927602CfB187ec3b8A37b';     // Reader
const DATASTORE = '0xFD70de6B91282D8017aA4E741e9Ae325CAb992d8';  // ✅ Corrected
const MARKET_KEY = '0x70d95587d40A2CAf56bd97485AB3eec10bEe6336'; // Market

// ETH/USD [ETH-USDC] Market

const readerAbi = [
  'function getMarkets(address dataStore, address[] marketKeys) external view returns ((address marketToken, address indexToken, address longToken, address shortToken, bool isSameCollaterals, uint256 borrowingFactorPerSecondForLongs, uint256 borrowingFactorPerSecondForShorts, uint256 fundingFactorPerSecond, uint256 fundingExponentFactor, uint256 longInterestUsd, uint256 shortInterestUsd, uint256 longInterestTokens, uint256 shortInterestTokens)[])'
];

export async function fetchMarketFundingData() {
  const reader = new ethers.Contract(READER, readerAbi, provider);

  const markets = await reader.getMarkets(DATASTORE, [MARKET_KEY]);

  if (!markets || markets.length === 0) {
    throw new Error('No market data found');
  }

  console.log(markets)
  const market = markets[0];

  return {
    marketToken: market.marketToken,
    fundingFactorPerSecond: ethers.formatUnits(market.fundingFactorPerSecond, 30),
    fundingExponentFactor: ethers.formatUnits(market.fundingExponentFactor, 30),
    longOpenInterestUsd: ethers.formatUnits(market.longInterestUsd, 30),
    shortOpenInterestUsd: ethers.formatUnits(market.shortInterestUsd, 30),
  };
}
