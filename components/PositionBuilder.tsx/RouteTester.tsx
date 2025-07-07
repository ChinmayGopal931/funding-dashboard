/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { useAccount, useSignTypedData } from "wagmi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
// import PlaceSolanaOrder from "@/hooks/useDriftOrder";

const BASE_URL = "http://localhost:3000";

export default function UserAgentManager() {
  const { address } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();


  const [email, setEmail] = useState("alice@example.com");
  const [telegramId, setTelegramId] = useState("alice_tg");

  const [userId, setUserId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [agentAddress, setAgentAddress] = useState("");
  const [output, setOutput] = useState<any>(null);

  const request = async (
    method: "GET" | "POST",
    endpoint: string,
    body?: Record<string, any>
  ) => {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json();
    setOutput(data);
    return data;
  };

  const createUserAndAgent = async () => {
    try {
      const user = await request("POST", "/api/users", {
        email,
        telegramId,
      });
      setUserId(user.id);

      const agent = await request("POST", "/api/agents", {
        userId: user.id,
        dex: "hyperliquid",
      });

      setAgentId(agent.id);
      setAgentAddress(agent.address);
    } catch (err) {
      console.error(err);
    }
  };

const approveAgent = async () => {
  if (!agentAddress || !agentId || !address) return alert("Missing data");

  try {
    const agentName = "MyTradingAgent";
    const nonce = Date.now();

    // ✅ Import the signing function from the SDK
    const { signUserSignedAction } = await import('@nktkas/hyperliquid/signing');

    // ✅ Create action exactly like the SDK does
    const action = {
      agentAddress: agentAddress,
      agentName: agentName || "", // SDK uses empty string as default
      type: 'approveAgent',
      hyperliquidChain: 'Testnet', // Use 'Mainnet' for production
      signatureChainId: '0x66eee', // Arbitrum Sepolia for testnet, '0xa4b1' for mainnet
      nonce
    };

    console.log('🔐 Creating approval action:', action);

    // ✅ Try using the SDK's signing in a different way
    // The SDK might expect the wallet to be passed differently
    const signature = await signUserSignedAction({
      wallet: {
        signTypedData: signTypedDataAsync // Pass the function directly
      },
      action,
      types: {
        'HyperliquidTransaction:ApproveAgent': [
          { name: 'hyperliquidChain', type: 'string' },
          { name: 'agentAddress', type: 'address' },
          { name: 'agentName', type: 'string' },
          { name: 'nonce', type: 'uint64' }
        ]
      },
      chainId: parseInt(action.signatureChainId, 16)
    });

    console.log('✅ Generated signature with SDK:', signature);
    console.log('Signature type:', typeof signature);
    
    // The signature should already be a hex string from the SDK
    // If it's still an object, there might be an issue with the SDK usage
    if (typeof signature === 'object' && signature.r) {
      console.error('❌ SDK returned RSV object instead of hex string. This suggests incorrect SDK usage.');
      // You might need to use a different signing method or check the SDK documentation
    }

    const res = await request("POST", `/api/agents/${agentId}/approve`, {
      signature: signature, // Should be a hex string from SDK
      agentName,
      action  // Send the action object as well
    });

    return res;
  } catch (error) {
    console.error('Error signing or submitting:', error);
    throw error;
  }
};



// --- Place Order Functions ---

const placeLimitBuyOrder = () => {
  if (!agentId) return alert("Missing agent ID");
  return request("POST", "/api/positions/order", {
    agentId,
    asset: 0,
    isBuy: true,
    price: "100.50",
    size: "1.0",
    reduceOnly: false,
    orderType: "limit",
    timeInForce: "Gtc"
  });
};

const placeMarketSellOrder = () => {
  if (!agentId) return alert("Missing agent ID");
  return request("POST", "/api/positions/order", {
    agentId,
    asset: 0,
    isBuy: false,
    price: "0",
    size: "1.0",
    orderType: "market"
  });
};

const placeOrderWithCloid = () => {
  if (!agentId) return alert("Missing agent ID");
  return request("POST", "/api/positions/order", {
    agentId,
    asset: 0,
    isBuy: true,
    price: "100.50",
    size: "1.0",
    cloid: "0x1234567890abcdef1234567890abcdef"
  });
};

const openLongSOL = () => {
  return request("POST", "/api/positions/order", {
    agentId,
    asset: 3, // SOL
    isBuy: true,
    price: "152.15",
    size: "1.0",
    orderType: "limit"
  });
};

const placeLimitBuyBTC = () => {
  return request("POST", "/api/positions/order", {
    agentId,
    asset: 0,
    isBuy: true,
    price: "109296",
    size: "0.01000",
    orderType: "limit",
    timeInForce: "Gtc"
  });
};

const placeMarketSellETH = () => {
  return request("POST", "/api/positions/order", {
    agentId,
    asset: 1,
    isBuy: false,
    price: "0",
    size: "0.1000",
    orderType: "market"
  });
};

// --- Cancel Order Functions ---

const cancelOrderById = () => {
  if (!agentId) return alert("Missing agent ID");
  return request("POST", "/api/positions/order/cancel", {
    agentId,
    asset: 0,
    orderId: 123456789
  });
};

const cancelOrderByCloid = () => {
  if (!agentId) return alert("Missing agent ID");
  return request("POST", "/api/positions/order/cancel-by-cloid", {
    agentId,
    asset: 0,
    cloid: "0x1234567890abcdef1234567890abcdef"
  });
};

// --- Position Management ---

const openPosition = () => {
  if (!agentId) return alert("Missing agent ID");
  return request("POST", "/api/positions", {
    agentId,
    coin: "BTC",
    side: "buy",
    size: "1.0",
    isMarket: true
  });
};

const closePosition = () => {
  return request("POST", "/api/positions/position_id/close"); // you may need to replace `position_id`
};




// --- DRIFT API ---

// Replace with actual IDs or allow dynamic entry via input fields
const driftUserId = userId; // reusing userId from earlier
const driftWalletAddress = address;

const getAllDriftMarkets = () => request("GET", "/api/drift/markets");

const getDriftMarket = (index: number) =>
  request("GET", `/api/drift/markets/${index}`);

const placeDriftOrder = () => {
  return request("POST", "/api/drift/orders", {
    userId: driftUserId,
    userWalletAddress: driftWalletAddress,
    orderParams: {
      marketIndex: 0,
      marketType: "perp",
      orderType: "market",
      direction: "long",
      size: 1.5,
      price: null,
      triggerPrice: null,
    },
    signature: "your-signature-here", // TODO: Generate using real signing flow
    timestamp: Date.now(),
  });
};

const cancelDriftOrder = () =>
  request("POST", `/api/drift/orders/${driftUserId}/cancel`, {
    userWalletAddress: driftWalletAddress,
    signature: "your-signature-here", // TODO: Generate this properly
    timestamp: Date.now(),
  });

const getDriftUserOrders = () =>
  request("GET", `/api/drift/orders/user/${driftUserId}?limit=10&offset=0`);

const getDriftWalletOrders = () =>
  request(
    "GET",
    `/api/drift/orders/wallet/${driftWalletAddress}?limit=10&offset=0`
  );

const getDriftUserOpenOrders = () =>
  request("GET", `/api/drift/orders/user/${driftUserId}/open`);

const getDriftUserPositions = () =>
  request("GET", `/api/drift/positions/user/${driftUserId}`);

const getDriftWalletPositions = () =>
  request(
    "GET",
    `/api/drift/positions/wallet/${driftWalletAddress}?subAccountId=0`
  );

const getDriftUserPnl = () =>
  request("GET", `/api/drift/pnl/user/${driftUserId}`);

const getDriftPnlForMarket = () =>
  request(
    "GET",
    `/api/drift/pnl/user/${driftUserId}?marketIndex=0`
  );

const getDriftWalletPnl = () =>
  request(
    "GET",
    `/api/drift/pnl/wallet/${driftWalletAddress}?subAccountId=0&marketIndex=0`
  );

const initializeDriftAccount = () =>
  request("POST", "/api/drift/accounts/initialize", {
    userId: driftUserId,
    userWalletAddress: driftWalletAddress,
    subAccountId: 0,
    accountName: "Main Account",
    signature: "your-signature-here", // TODO: sign message correctly
    timestamp: Date.now(),
  });

const getDriftUserAccounts = () =>
  request("GET", `/api/drift/accounts/user/${driftUserId}`);

const getDriftWalletAccounts = () =>
  request("GET", `/api/drift/accounts/wallet/${driftWalletAddress}`);

const broadcastDriftTransaction = () =>
  request("POST", "/api/drift/transactions/broadcast", {
    signedTransaction: "base64-encoded-signed-transaction", // TODO: replace
  });

const getDriftUserOrderStats = () =>
  request("GET", `/api/drift/stats/orders/user/${driftUserId}`);

const getDriftUserAccountStats = () =>
  request("GET", `/api/drift/stats/accounts/user/${driftUserId}`);




  // --- Additional GET endpoints ---

  const getUserById = () => {
    if (!userId) return alert("User ID is missing");
    return request("GET", `/api/users/${userId}`);
  };

  const getUserByEmail = () => {
    if (!email) return alert("Email is missing");
    return request("GET", `/api/users/email/${email}`);
  };

  const getUserAgents = () => {
    if (!userId) return alert("User ID is missing");
    return request("GET", `/api/agents/${userId}`);
  };

  const getAgentById = () => {
    if (!agentId) return alert("Agent ID is missing");
    return request("GET", `/api/agents/agent/${agentId}`);
  };

  return (
    <div className="max-w-xl mx-auto p-6 bg-white shadow rounded-xl space-y-6 border">
      <ConnectButton/>

      <WalletMultiButton />
      <h1 className="text-2xl font-semibold mt-10">🧪 User & Agent Setup</h1>

      <div className="grid grid-cols-1 gap-4">
        <Input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          placeholder="Telegram ID"
          value={telegramId}
          onChange={(e) => setTelegramId(e.target.value)}
        />
        <Button onClick={createUserAndAgent}>1️⃣ Create User & Agent</Button>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-gray-600">User ID: {userId}</p>
        <p className="text-sm text-gray-600">Agent ID: {agentId}</p>
        <p className="text-sm text-gray-600">Agent Address: {agentAddress}</p>
        <Button onClick={approveAgent} disabled={!agentId}>
          2️⃣ Approve Agent (Sign)
        </Button>
      </div>

      <div className="space-y-2">
        <h2 className="font-medium mt-4">🔍 View Data</h2>
        <Button onClick={getUserById}>🔎 Get User by ID</Button>
        <Button onClick={getUserByEmail}>🔎 Get User by Email</Button>
        <Button onClick={getUserAgents}>🔎 Get User&apos;s Agents</Button>
        <Button onClick={getAgentById}>🔎 Get Agent by ID</Button>
      </div>

      <Button onClick={openLongSOL} > Long Sol</Button>
      <Button onClick={placeLimitBuyBTC}>💰 Buy 0.01 BTC @ $109,000 (Limit)</Button>
      <Button onClick={placeMarketSellETH}>📤 Sell 0.1 ETH (Market)</Button>

      <h2 className="font-medium mt-4">🛒 Order Management</h2>
      <Button onClick={placeLimitBuyOrder}>📈 Place Limit Buy</Button>
      <Button onClick={placeMarketSellOrder}>📉 Place Market Sell</Button>
      <Button onClick={placeOrderWithCloid}>🧾 Place Order with CLoID</Button>

      <h2 className="font-medium mt-4">❌ Cancel Orders</h2>
      <Button onClick={cancelOrderById}>🗑️ Cancel by Order ID</Button>
      <Button onClick={cancelOrderByCloid}>🗑️ Cancel by CLoID</Button>

      <h2 className="font-medium mt-4">📊 Position Management</h2>
      <Button onClick={openPosition}>📤 Open Position</Button>
      <Button onClick={closePosition}>📥 Close Position</Button>



      <h2 className="font-medium mt-6">🌊 Drift API</h2>
      <div className="space-y-2">
        <Button onClick={getAllDriftMarkets}>📈 Get All Markets</Button>
        <Button onClick={() => getDriftMarket(0)}>📉 Get Market 0</Button>

        {/* <PlaceSolanaOrder /> */}
        <Button onClick={placeDriftOrder}>🛒 Place Market Long Order</Button>
        <Button onClick={cancelDriftOrder}>❌ Cancel Order</Button>
        <Button onClick={getDriftUserOrders}>📜 Get User Orders</Button>
        <Button onClick={getDriftWalletOrders}>💳 Get Wallet Orders</Button>
        <Button onClick={getDriftUserOpenOrders}>🧾 Get Open Orders</Button>
        <Button onClick={getDriftUserPositions}>📊 Get User Positions</Button>
        <Button onClick={getDriftWalletPositions}>📊 Get Wallet Positions</Button>
        <Button onClick={getDriftUserPnl}>💰 Get User PnL</Button>
        <Button onClick={getDriftPnlForMarket}>📈 Get Market PnL</Button>
        <Button onClick={getDriftWalletPnl}>💳 Get Wallet PnL</Button>
        <Button onClick={initializeDriftAccount}>🧾 Init Drift Account</Button>
        <Button onClick={getDriftUserAccounts}>👤 Get User Accounts</Button>
        <Button onClick={getDriftWalletAccounts}>💳 Get Wallet Accounts</Button>
        <Button onClick={broadcastDriftTransaction}>📤 Broadcast Tx</Button>
        <Button onClick={getDriftUserOrderStats}>📈 User Order Stats</Button>
        <Button onClick={getDriftUserAccountStats}>📊 User Account Stats</Button>
      </div>



      {output && (
        <pre className="bg-gray-100 p-4 rounded text-sm max-h-[400px] overflow-auto">
          {JSON.stringify(output, null, 2)}
        </pre>
      )}
    </div>
  );
}
