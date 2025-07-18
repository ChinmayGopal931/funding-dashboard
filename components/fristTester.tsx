'use client';

import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Connection, Transaction, PublicKey } from '@solana/web3.js';
import { DriftClient, PositionDirection, PostOnlyParams, BN, OrderType } from '@drift-labs/sdk';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { ethers } from 'ethers';

// Types from Integration Guide
interface ConfigResponse {
  success: boolean;
  data: {
    environment: 'testnet' | 'mainnet';
    isTestnet: boolean;
    hyperliquid: {
      apiUrl: string;
      webAppUrl: string;
      chain: 'Testnet' | 'Mainnet';
    };
    drift: {
      programId: string;
      rpcUrl: string;
      dataApiUrl: string;
      env: 'devnet' | 'mainnet-beta';
      webAppUrl: string;
    };
  };
}

interface DexAccount {
  id: number;
  userId: number;
  dexType: 'hyperliquid' | 'drift';
  address: string;
  accountType: 'master' | 'agent_wallet' | 'subaccount';
  agentName?: string;
  encryptedPrivateKey?: string;
  subaccountId?: number;
  nonce?: string;
  isActive: boolean;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

interface DexAccountsResponse {
  success: boolean;
  data: DexAccount[];
}

interface CreateAgentWalletRequest {
  action: 'create_and_approve';
  masterAddress: string;
  agentName: string;
  agentAddress?: string;
  agentPrivateKey?: string;
  signature: {
    r: string;
    s: string;
    v: number;
  };
  nonce: string;
  actionData?: any;
  metadata?: any;
}

interface CreateAgentWalletResponse {
  success: boolean;
  data: {
    id: number;
    address: string;
    accountType: 'agent_wallet';
    agentName: string;
    isActive: boolean;
    createdAt: string;
  };
}

interface PlaceOrderRequest {
  orders: Array<{
    asset: string;
    side: 'buy' | 'sell';
    orderType: 'market' | 'limit' | 'trigger_market' | 'trigger_limit' | 'oracle';
    size: string;
    price?: string;
    reduceOnly?: boolean;
    postOnly?: boolean;
    timeInForce?: 'Alo' | 'Ioc' | 'Gtc';
    triggerPrice?: string;
    triggerCondition?: 'tp' | 'sl';
    oraclePriceOffset?: string;
    auctionStartPrice?: string;
    auctionEndPrice?: string;
    auctionDuration?: number;
    clientOrderId?: string;
  }>;
  grouping?: string;
  builderFee?: number;
  signature?: string;
  nonce?: string;
}

interface TestResult {
  action: string;
  status: 'success' | 'error' | 'pending';
  message: string;
  data?: any;
  timestamp: Date;
}

export default function FirstTester() {
  const [authToken, setAuthToken] = useState<string>('');
  const [selectedDex, setSelectedDex] = useState<'hyperliquid' | 'drift'>('hyperliquid');
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dexAccounts, setDexAccounts] = useState<DexAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [config, setConfig] = useState<ConfigResponse['data'] | null>(null);
  
  // Hyperliquid specific state
  const [agentName, setAgentName] = useState('');
  const [hlOrderParams, setHlOrderParams] = useState({
    asset: '0',
    side: 'buy',
    size: '1',
    price: '100',
    orderType: 'limit'
  });
  
  // Asset mapping for Hyperliquid (top 5 coins) - TESTNET VALUES
  const hyperliquidAssets = config?.isTestnet ? [
    { value: '3', label: 'BTC-PERP', symbol: 'BTC', currentPrice: '120527.5' },   // BTC is index 3
    { value: '4', label: 'ETH-PERP', symbol: 'ETH', currentPrice: '3470.0' },     // ETH is index 4
    { value: '0', label: 'SOL-PERP', symbol: 'SOL', currentPrice: '175.73' },     // SOL is index 0
    { value: '7', label: 'AVAX-PERP', symbol: 'AVAX', currentPrice: '22.797' },   // AVAX is index 7
    { value: '6', label: 'BNB-PERP', symbol: 'BNB', currentPrice: '723.87' }      // BNB is index 6
  ] : [
    // Mainnet values (if needed later)
    { value: '0', label: 'BTC-PERP', symbol: 'BTC', currentPrice: '119846.5' },
    { value: '151', label: 'ETH-PERP', symbol: 'ETH', currentPrice: '3433.65' },
    { value: '156', label: 'SOL-PERP', symbol: 'SOL', currentPrice: '174.22' },
    { value: '23', label: 'AVAX-PERP', symbol: 'AVAX', currentPrice: '22.609' },
    { value: '51', label: 'MATIC-PERP', symbol: 'MATIC', currentPrice: '0.37621' }
  ];
  
  // Drift specific state
  const solanaWallet = useWallet();
  const [driftClient, setDriftClient] = useState<DriftClient | null>(null);
  const [driftOrderParams, setDriftOrderParams] = useState({
    marketIndex: 0,
    direction: 'long',
    size: '0.1',
    price: '100',
    orderType: 'limit'
  });
  
  // Drift perpetual markets mapping
  const driftPerpMarkets = [
    { index: 0, symbol: 'SOL-PERP', name: 'Solana', baseAsset: 'SOL' },
    { index: 1, symbol: 'BTC-PERP', name: 'Bitcoin', baseAsset: 'BTC' },
    { index: 2, symbol: 'ETH-PERP', name: 'Ethereum', baseAsset: 'ETH' },
    { index: 3, symbol: 'APT-PERP', name: 'Aptos', baseAsset: 'APT' },
    { index: 4, symbol: 'MATIC-PERP', name: 'Polygon', baseAsset: 'MATIC' },
    { index: 5, symbol: 'ARB-PERP', name: 'Arbitrum', baseAsset: 'ARB' },
    { index: 6, symbol: 'DOGE-PERP', name: 'Dogecoin', baseAsset: 'DOGE' },
    { index: 7, symbol: 'BNB-PERP', name: 'BNB', baseAsset: 'BNB' },
    { index: 8, symbol: 'SUI-PERP', name: 'Sui', baseAsset: 'SUI' },
    { index: 9, symbol: 'PEPE-PERP', name: 'Pepe', baseAsset: 'PEPE' }
  ];
  
  // Common state
  const [depositAmount, setDepositAmount] = useState('100');
  const [positionName, setPositionName] = useState('Test Position');

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

  const addTestResult = (action: string, status: TestResult['status'], message: string, data?: unknown) => {
    setTestResults(prev => [{
      action,
      status,
      message,
      data,
      timestamp: new Date()
    }, ...prev]);
  };

  // Fetch configuration on mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch(`${API_BASE}/config`);
        if (response.ok) {
          const data: ConfigResponse = await response.json();
          setConfig(data.data);
          addTestResult('Config', 'success', `Running on ${data.data.environment}`, data.data);
        }
      } catch (error) {
        addTestResult('Config', 'error', 'Failed to fetch configuration');
      }
    };
    
    fetchConfig();
  }, [API_BASE]);

  // Check if auth is expired (5 minute window)
  const isAuthExpired = (authHeader: string): boolean => {
    if (!authHeader.startsWith('Bearer ')) return true;
    
    const parts = authHeader.substring(7).split(':');
    if (parts.length !== 3) return true;
    
    const timestamp = parseInt(parts[2]);
    const now = Math.floor(Date.now() / 1000);
    
    // 5 minute window
    return (now - timestamp) > 300;
  };

  // Refresh authentication
  const refreshAuth = async () => {
    if (!authToken || !isAuthExpired(authToken)) return authToken;
    
    await authenticateWallet();
    return authToken;
  };

  // Authentication
  const authenticateWallet = async () => {
    setIsLoading(true);
    try {
      let walletAddress = '';
      let signature = '';
      const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
      
      if (selectedDex === 'drift' && solanaWallet.publicKey) {
        walletAddress = solanaWallet.publicKey.toString();
        
        // Create the exact message format expected by backend
        const message = `Authenticate to Magnolia\nAddress: ${walletAddress}\nTimestamp: ${timestamp}`;
        const encodedMessage = new TextEncoder().encode(message);
        const signatureUint8Array = await solanaWallet.signMessage!(encodedMessage);
        signature = Buffer.from(signatureUint8Array).toString('hex');
        
        addTestResult('Auth Message', 'success', 'Message signed', { message, walletType: 'Solana' });
        
      } else if (selectedDex === 'hyperliquid' && window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        walletAddress = accounts[0];
        
        // Create the exact message format expected by backend
        const message = `Authenticate to Magnolia\nAddress: ${walletAddress}\nTimestamp: ${timestamp}`;
        signature = await window.ethereum.request({
          method: 'personal_sign',
          params: [message, walletAddress]
        });
        
        addTestResult('Auth Message', 'success', 'Message signed', { message, walletType: 'EVM' });
      }
      
      // Backend expects auth in header format, not a login endpoint
      const authHeader = `Bearer ${walletAddress}:${signature}:${timestamp}`;
      setAuthToken(authHeader);
      
      // Test authentication by making a protected request
      const response = await fetch(`${API_BASE}/${selectedDex}/dex-accounts`, {
        headers: { 'Authorization': authHeader }
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Authentication failed: ${error}`);
      }
      
      addTestResult('Authentication', 'success', 'Successfully authenticated', {
        address: walletAddress,
        timestamp,
        expiresAt: timestamp + 300 // 5 minutes
      });
      
      // Initialize Drift client if using Drift
      if (selectedDex === 'drift') {
        await initializeDriftClient();
      }
    } catch (error) {
      addTestResult('Authentication', 'error', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize Drift Client
  const initializeDriftClient = async () => {
    if (!solanaWallet.publicKey) return;
    
    try {
      // Fetch SDK configuration
      const configResponse = await fetch(`${API_BASE}/config/drift-sdk`);
      if (!configResponse.ok) throw new Error('Failed to fetch Drift SDK config');
      
      const sdkConfig = await configResponse.json();
      
      const connection = new Connection(
        sdkConfig.data.provider?.connection?.rpcEndpoint || 
        config?.drift.rpcUrl || 
        'https://api.mainnet-beta.solana.com'
      );
      
      const walletAdapter = {
        publicKey: solanaWallet.publicKey!,
        signTransaction: async (tx: Transaction) => {
          return await solanaWallet.signTransaction!(tx);
        },
        signAllTransactions: async (txs: Transaction[]) => {
          return await solanaWallet.signAllTransactions!(txs);
        }
      };
      
      const client = new DriftClient({
        connection,
        wallet: walletAdapter,
        env: sdkConfig.data.env || config?.drift.env || 'mainnet-beta',
        programID: sdkConfig.data.programID ? new PublicKey(sdkConfig.data.programID) : undefined
      });
      
      await client.subscribe();
      setDriftClient(client);
      addTestResult('Drift Client', 'success', `Drift client initialized (${sdkConfig.data.env || config?.drift.env})`);
    } catch (error) {
      addTestResult('Drift Client', 'error', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  // Fetch DEX accounts
  const fetchDexAccounts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/${selectedDex}/dex-accounts`, {
        headers: { 'Authorization': authToken }
      });
      
      if (!response.ok) throw new Error('Failed to fetch accounts');
      
      const data: DexAccountsResponse = await response.json();
      setDexAccounts(data.data || []);
      addTestResult('Fetch Accounts', 'success', `Found ${data.data?.length || 0} accounts`);
    } catch (error) {
      addTestResult('Fetch Accounts', 'error', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };


  // Create Hyperliquid agent wallet
  const createHyperliquidAgent = async () => {
    setIsLoading(true);
    try {
      // Check auth expiration
      if (isAuthExpired(authToken)) {
        await authenticateWallet();
      }
      
      const nonce = Date.now();
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });
      const walletAddress = accounts[0];
      
      // Generate agent wallet on frontend
      const agentWallet = ethers.Wallet.createRandom();
      const agentAddress = agentWallet.address;
      const agentPrivateKey = agentWallet.privateKey;
      
      addTestResult('Agent Wallet', 'success', 'Generated agent wallet', { 
        agentAddress,
        agentName 
      });
      
      // Import the signing function from the SDK
      const { signUserSignedAction } = await import('@nktkas/hyperliquid/signing');
      
      // Create action exactly like the SDK expects
      const action = {
        type: 'approveAgent' as const,
        hyperliquidChain: config?.isTestnet ? 'Testnet' : 'Mainnet',
        agentAddress: agentAddress,
        agentName: agentName || "", // SDK uses empty string as default
        nonce: Number(nonce) // Use Number, not BigInt
      };
      
      addTestResult('Action', 'success', 'Prepared action', action);
      
      // Create a wallet adapter for the SDK
      const walletAdapter = {
        signTypedData: async (params: {
          domain: any;
          types: any;
          primaryType: string;
          message: any;
        }) => {
          return await window.ethereum.request({
            method: 'eth_signTypedData_v4',
            params: [walletAddress, JSON.stringify({
              domain: params.domain,
              types: params.types,
              primaryType: params.primaryType,
              message: params.message
            })]
          });
        }
      };
      
      // Use the SDK's signing function
      const signature = await signUserSignedAction({
        wallet: walletAdapter,
        action,
        types: {
          'HyperliquidTransaction:ApproveAgent': [
            { name: 'hyperliquidChain', type: 'string' },
            { name: 'agentAddress', type: 'address' },
            { name: 'agentName', type: 'string' },
            { name: 'nonce', type: 'uint64' }
          ]
        },
        signatureChainId: config?.isTestnet ? '0x66eee' : '0xa4b1',
        chainId: config?.isTestnet ? 421614 : 42161 // Use number chainId
      });
      
      addTestResult('Signature', 'success', 'Signed with SDK', { signature });
      
      // Convert hex signature to {r, s, v} format
      const sig = ethers.utils.splitSignature(signature);
      
      // Send to backend with the correct signature format
      const requestBody: CreateAgentWalletRequest = {
        action: 'create_and_approve',
        masterAddress: walletAddress,
        agentName,
        agentAddress,
        agentPrivateKey,
        signature: {
          r: sig.r,
          s: sig.s,
          v: sig.v
        },
        nonce: nonce.toString()
      };
      
      const response = await fetch(`${API_BASE}/hyperliquid/dex-accounts`, {
        method: 'POST',
        headers: {
          'Authorization': authToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create agent: ${error}`);
      }
      
      const data: CreateAgentWalletResponse = await response.json();
      addTestResult('Create Agent', 'success', 'Agent wallet created', data);
      
      fetchDexAccounts();
    } catch (error) {
      addTestResult('Create Agent', 'error', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  // Create Drift account
  const createDriftAccount = async () => {
    setIsLoading(true);
    try {
      if (!solanaWallet.publicKey) throw new Error('Wallet not connected');
      
      const response = await fetch(`${API_BASE}/drift/dex-accounts`, {
        method: 'POST',
        headers: {
          'Authorization': authToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          address: solanaWallet.publicKey.toString(),
          accountType: 'master',
          subaccountId: 0
        })
      });
      
      if (!response.ok) throw new Error('Failed to create account');
      
      const data = await response.json();
      addTestResult('Create Account', 'success', 'Drift account created', data);
      fetchDexAccounts();
    } catch (error) {
      addTestResult('Create Account', 'error', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  // Record deposit
  const recordDeposit = async () => {
    setIsLoading(true);
    try {
      const endpoint = selectedDex === 'hyperliquid' 
        ? `/hyperliquid/dex-accounts/${selectedAccount}/deposits`
        : `/drift/dex-accounts/${selectedAccount}/deposits`;
      
      const body = selectedDex === 'hyperliquid' ? {
        amount: depositAmount,
        tokenSymbol: 'USDC',
        txHash: '0x' + Math.random().toString(36).substring(2, 15),
        fromAddress: dexAccounts.find(a => a.id.toString() === selectedAccount)?.address
      } : {
        marketIndex: 0,
        amount: depositAmount,
        tokenSymbol: 'USDC',
        txSignature: Math.random().toString(36).substring(2, 15),
        tokenMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
      };
      
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': authToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) throw new Error('Failed to record deposit');
      
      const data = await response.json();
      addTestResult('Record Deposit', 'success', `Recorded ${depositAmount} USDC deposit`, data);
    } catch (error) {
      addTestResult('Record Deposit', 'error', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  // Place Hyperliquid order (with server-side signing)
  const placeHyperliquidOrder = async () => {
    setIsLoading(true);
    try {
      // Check auth expiration
      if (isAuthExpired(authToken)) {
        await authenticateWallet();
      }

      // Get the selected DEX account
      const selectedDexAccount = dexAccounts.find(acc => acc.id.toString() === selectedAccount);
      if (!selectedDexAccount) {
        throw new Error('No DEX account selected');
      }

      // Prepare order parameters - NO signature needed!
      const orderParams: PlaceOrderRequest = {
        orders: [{
          asset: hlOrderParams.asset,        // '0' for BTC, '1' for ETH, etc.
          side: hlOrderParams.side as 'buy' | 'sell',
          orderType: hlOrderParams.orderType as 'limit',
          size: hlOrderParams.size,          // Amount to trade
          price: hlOrderParams.price,        // Price (required for limit orders)
          reduceOnly: false,                 // Set to true for closing positions only
          postOnly: hlOrderParams.orderType === 'limit', // Post-only for limit orders
          clientOrderId: '0x' + Buffer.from(ethers.randomBytes(16)).toString('hex') // Unique identifier
        }],
        grouping: 'na',     // Order grouping (usually 'na')
        builderFee: 0       // Builder fee if applicable
        // NO signature or nonce needed - backend handles it!
      };

      console.log(orderParams)

      addTestResult('Order Params', 'success', 'Prepared order parameters', orderParams);

      // Submit order - backend will sign it automatically
      const response = await fetch(`${API_BASE}/hyperliquid/dex-accounts/${selectedAccount}/orders/test-sdk`, {
        method: 'POST',
        headers: {
          'Authorization': authToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderParams)
      });

      if (!response.ok) {
        const error = await response.text();
        
        // Handle specific error cases
        if (error.includes('Cannot sign orders for accounts without stored private keys')) {
          throw new Error('This account does not support automated trading. Only agent wallets can place orders automatically.');
        } else if (error.includes('Access denied')) {
          throw new Error('You do not have permission to trade on this account');
        }
        
        throw new Error(`Failed to place order: ${error}`);
      }

      const data = await response.json();
      addTestResult('Place Order', 'success', 'Order placed successfully', data);

      // Refresh orders to show the new order
      await fetchOrders();
    } catch (error) {
      addTestResult('Place Order', 'error', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  // Place Drift order
  const placeDriftOrder = async () => {
    setIsLoading(true);
    try {
      if (!driftClient) throw new Error('Drift client not initialized');
      
      const direction = driftOrderParams.direction === 'long' 
        ? PositionDirection.LONG 
        : PositionDirection.SHORT;
      
      // Place order using Drift SDK
      let orderTx;
      if (driftOrderParams.orderType === 'market') {
        orderTx = await driftClient.placePerpOrder({
          marketIndex: driftOrderParams.marketIndex,
          orderType: OrderType.MARKET,
          direction,
          baseAssetAmount: new BN(parseFloat(driftOrderParams.size) * 1e9),
        });
      } else {
        orderTx = await driftClient.placePerpOrder({
          marketIndex: driftOrderParams.marketIndex,
          orderType: OrderType.LIMIT,
          direction,
          baseAssetAmount: new BN(parseFloat(driftOrderParams.size) * 1e9),
          price: new BN(parseFloat(driftOrderParams.price) * 1e6),
          postOnly: PostOnlyParams.TRY_POST_ONLY
        });
      }
      
      // Sync with backend
      const response = await fetch(`${API_BASE}/drift/dex-accounts/${selectedAccount}/orders`, {
        method: 'POST',
        headers: {
          'Authorization': authToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          orders: [{
            driftOrderId: orderTx.toString(),
            marketIndex: driftOrderParams.marketIndex,
            marketType: 'PERP',
            direction: driftOrderParams.direction,
            baseAssetAmount: driftOrderParams.size,
            price: driftOrderParams.price,
            status: 'open',
            orderType: driftOrderParams.orderType
          }]
        })
      });
      
      if (!response.ok) throw new Error('Failed to sync order');
      
      const data = await response.json();
      addTestResult('Place Order', 'success', 'Drift order placed', data);
    } catch (error) {
      addTestResult('Place Order', 'error', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch orders
  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const endpoint = selectedDex === 'hyperliquid'
        ? `/hyperliquid/dex-accounts/${selectedAccount}/orders?status=open`
        : `/drift/dex-accounts/${selectedAccount}/orders?status=open`;
      
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: { 'Authorization': authToken }
      });
      
      if (!response.ok) throw new Error('Failed to fetch orders');
      
      const data = await response.json();
      addTestResult('Fetch Orders', 'success', `Found ${data.data?.length || 0} open orders`, data.data);
    } catch (error) {
      addTestResult('Fetch Orders', 'error', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  // Create position
  const createPosition = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/hyperliquid/positions`, {
        method: 'POST',
        headers: {
          'Authorization': authToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: positionName,
          positionType: 'single',
          snapshots: [{
            orderId: Date.now(),
            symbol: 'SOL-PERP',
            side: 'long',
            entryPrice: '100.50',
            size: '1.5'
          }]
        })
      });
      
      if (!response.ok) throw new Error('Failed to create position');
      
      const data = await response.json();
      addTestResult('Create Position', 'success', 'Position created', data);
    } catch (error) {
      addTestResult('Create Position', 'error', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  // Create delta neutral position
  const createDeltaNeutralPosition = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/drift/positions/delta-neutral`, {
        method: 'POST',
        headers: {
          'Authorization': authToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `${positionName} - Delta Neutral`,
          driftOrderId: Date.now(),
          hyperliquidOrderId: Date.now() + 1,
          metadata: {
            strategy: 'funding_arbitrage',
            targetSize: '10'
          }
        })
      });
      
      if (!response.ok) throw new Error('Failed to create delta neutral position');
      
      const data = await response.json();
      addTestResult('Delta Neutral', 'success', 'Delta neutral position created', data);
    } catch (error) {
      addTestResult('Delta Neutral', 'error', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch transaction history
  const fetchTransactionHistory = async () => {
    setIsLoading(true);
    try {
      const endpoint = selectedDex === 'hyperliquid'
        ? `/hyperliquid/dex-accounts/${selectedAccount}/transactions?limit=10`
        : `/drift/dex-accounts/${selectedAccount}/transactions?limit=10`;
      
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: { 'Authorization': authToken }
      });
      
      if (!response.ok) throw new Error('Failed to fetch transactions');
      
      const data = await response.json();
      addTestResult('Transaction History', 'success', `Found ${data.data?.length || 0} transactions`, data.data);
    } catch (error) {
      addTestResult('Transaction History', 'error', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Magnolia V2 Integration Tester</CardTitle>
              <CardDescription>
                Test all integration endpoints for Hyperliquid and Drift
              </CardDescription>
            </div>
            {config && (
              <Badge variant={config.isTestnet ? "secondary" : "default"} className="text-lg px-4 py-2">
                {config.environment.toUpperCase()}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedDex} onValueChange={(v) => setSelectedDex(v as 'hyperliquid' | 'drift')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="hyperliquid">Hyperliquid</TabsTrigger>
              <TabsTrigger value="drift">Drift</TabsTrigger>
            </TabsList>
            
            <TabsContent value="hyperliquid" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">1. Authentication</h3>
                  <Button onClick={authenticateWallet} disabled={isLoading}>
                    Connect EVM Wallet & Authenticate
                  </Button>
                  {authToken && (
                    <>
                      <Badge 
                        className="ml-2" 
                        variant={isAuthExpired(authToken) ? "destructive" : "default"}
                      >
                        {isAuthExpired(authToken) ? 'Auth Expired' : 'Authenticated'}
                      </Badge>
                      {isAuthExpired(authToken) && (
                        <Button 
                          onClick={refreshAuth} 
                          disabled={isLoading} 
                          size="sm" 
                          className="ml-2"
                        >
                          Refresh Auth
                        </Button>
                      )}
                    </>
                  )}
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-2">2. Account Management</h3>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Button onClick={fetchDexAccounts} disabled={!authToken || isLoading}>
                        Fetch Accounts
                      </Button>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Agent name"
                          value={agentName}
                          onChange={(e) => setAgentName(e.target.value)}
                        />
                        <Button onClick={createHyperliquidAgent} disabled={!authToken || !agentName || isLoading}>
                          Create Agent
                        </Button>
                      </div>
                    </div>
                    <Alert>
                      <AlertDescription className="text-xs">
                        ℹ️ Agent wallets are now generated on the frontend to ensure proper signature verification. 
                        The private key is sent securely to the backend for storage.
                      </AlertDescription>
                    </Alert>
                  </div>
                  
                  {dexAccounts.length > 0 && (
                    <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {dexAccounts.map(account => (
                          <SelectItem key={account.id} value={account.id.toString()}>
                            {account.agentName || account.address} ({account.accountType})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-2">3. Deposits</h3>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Amount"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                    />
                    <Button onClick={recordDeposit} disabled={!selectedAccount || isLoading}>
                      Record Deposit
                    </Button>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-2">4. Trading</h3>
                  
                  {/* Order Preview Card */}
                  <Card className="mb-4 bg-muted/50">
                    <CardContent className="pt-4">
                      <div className="text-sm space-y-1">
                        <p><strong>Order Type:</strong> {hlOrderParams.orderType.toUpperCase()}</p>
                        <p><strong>Asset:</strong> {hyperliquidAssets.find(a => a.value === hlOrderParams.asset)?.label || 'Unknown'}</p>
                        <p><strong>Side:</strong> <span className={hlOrderParams.side === 'buy' ? 'text-green-600' : 'text-red-600'}>{hlOrderParams.side.toUpperCase()}</span></p>
                        <p><strong>Size:</strong> {hlOrderParams.size} contracts</p>
                        <p><strong>Price:</strong> ${hlOrderParams.price}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Current Market Price: ${hyperliquidAssets.find(a => a.value === hlOrderParams.asset)?.currentPrice || 'N/A'}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <div className="space-y-4">
                    {/* Asset Selection */}
                    <div>
                      <label className="text-sm font-medium mb-1 block">Select Asset</label>
                      <Select 
                        value={hlOrderParams.asset} 
                        onValueChange={(v) => setHlOrderParams({...hlOrderParams, asset: v})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {hyperliquidAssets.map(asset => (
                            <SelectItem key={asset.value} value={asset.value}>
                              <div className="flex justify-between items-center w-full">
                                <span>{asset.label}</span>
                                <span className="text-xs text-muted-foreground ml-2">${asset.currentPrice}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Buy/Sell Selection */}
                    <div>
                      <label className="text-sm font-medium mb-1 block">Side</label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant={hlOrderParams.side === 'buy' ? 'default' : 'outline'}
                          className={hlOrderParams.side === 'buy' ? 'bg-green-600 hover:bg-green-700' : ''}
                          onClick={() => setHlOrderParams({...hlOrderParams, side: 'buy'})}
                        >
                          Buy / Long
                        </Button>
                        <Button
                          variant={hlOrderParams.side === 'sell' ? 'default' : 'outline'}
                          className={hlOrderParams.side === 'sell' ? 'bg-red-600 hover:bg-red-700' : ''}
                          onClick={() => setHlOrderParams({...hlOrderParams, side: 'sell'})}
                        >
                          Sell / Short
                        </Button>
                      </div>
                    </div>
                    
                    {/* Size and Price */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-1 block">
                          Size (contracts)
                          <span className="text-xs text-muted-foreground ml-1">Amount to trade</span>
                        </label>
                        <Input
                          type="number"
                          step="0.1"
                          value={hlOrderParams.size}
                          onChange={(e) => setHlOrderParams({...hlOrderParams, size: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1 block">
                          Limit Price ($)
                          <span className="text-xs text-muted-foreground ml-1">Execution price</span>
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          value={hlOrderParams.price}
                          onChange={(e) => setHlOrderParams({...hlOrderParams, price: e.target.value})}
                        />
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button 
                        onClick={placeHyperliquidOrder} 
                        disabled={!selectedAccount || isLoading}
                        className="flex-1"
                      >
                        Place {hlOrderParams.side === 'buy' ? 'Buy' : 'Sell'} Order
                      </Button>
                      <Button 
                        onClick={fetchOrders} 
                        disabled={!selectedAccount || isLoading}
                        variant="outline"
                      >
                        View Orders
                      </Button>
                    </div>
                    
                    {/* Help Text */}
                    <Alert>
                      <AlertDescription className="text-xs">
                        <strong>Notes:</strong>
                        <ul className="mt-1 ml-4 list-disc">
                          <li>Orders are placed as limit orders with post-only flag</li>
                          <li>{config?.isTestnet ? 'Testnet' : 'Mainnet'} asset indices: BTC={config?.isTestnet ? '3' : '0'}, ETH={config?.isTestnet ? '4' : '151'}, SOL={config?.isTestnet ? '0' : '156'}, AVAX={config?.isTestnet ? '7' : '23'}, BNB={config?.isTestnet ? '6' : 'N/A'}</li>
                          <li>Backend automatically signs orders for agent wallets</li>
                          <li>Master wallets cannot place automated orders</li>
                        </ul>
                      </AlertDescription>
                    </Alert>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="drift" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">1. Authentication</h3>
                  <div className="flex gap-2">
                    <WalletMultiButton />
                    {solanaWallet.publicKey && (
                      <Button onClick={authenticateWallet} disabled={isLoading}>
                        Authenticate
                      </Button>
                    )}
                  </div>
                  {authToken && (
                    <Badge 
                      className="mt-2" 
                      variant={isAuthExpired(authToken) ? "destructive" : "default"}
                    >
                      {isAuthExpired(authToken) ? 'Auth Expired' : 'Authenticated'}
                    </Badge>
                  )}
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-2">2. Account Management</h3>
                  <div className="flex gap-2">
                    <Button onClick={fetchDexAccounts} disabled={!authToken || isLoading}>
                      Fetch Accounts
                    </Button>
                    <Button onClick={createDriftAccount} disabled={!authToken || isLoading}>
                      Create Account
                    </Button>
                  </div>
                  
                  {dexAccounts.length > 0 && (
                    <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {dexAccounts.map(account => (
                          <SelectItem key={account.id} value={account.id.toString()}>
                            {account.address} ({account.accountType})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-2">3. Deposits</h3>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Amount (USDC)"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                    />
                    <Button onClick={recordDeposit} disabled={!selectedAccount || isLoading}>
                      Record Deposit
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Record USDC deposits to your Drift account
                  </p>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-2">4. Trading</h3>
                  
                  {/* Order Preview Card */}
                  <Card className="mb-4 bg-muted/50">
                    <CardContent className="pt-4">
                      <div className="text-sm space-y-1">
                        <p><strong>Order Type:</strong> {driftOrderParams.orderType.toUpperCase()}</p>
                        <p><strong>Market:</strong> {driftPerpMarkets.find(m => m.index === driftOrderParams.marketIndex)?.symbol || 'Unknown'}</p>
                        <p><strong>Direction:</strong> <span className={driftOrderParams.direction === 'long' ? 'text-green-600' : 'text-red-600'}>{driftOrderParams.direction.toUpperCase()}</span></p>
                        <p><strong>Size:</strong> {driftOrderParams.size} {driftPerpMarkets.find(m => m.index === driftOrderParams.marketIndex)?.baseAsset || ''}</p>
                        <p><strong>Limit Price:</strong> ${driftOrderParams.price}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Position Value: ${(parseFloat(driftOrderParams.size) * parseFloat(driftOrderParams.price)).toFixed(2)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <div className="space-y-4">
                    {/* Market Selection */}
                    <div>
                      <label className="text-sm font-medium mb-1 block">Select Market</label>
                      <Select 
                        value={driftOrderParams.marketIndex.toString()} 
                        onValueChange={(v) => setDriftOrderParams({...driftOrderParams, marketIndex: parseInt(v)})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {driftPerpMarkets.map(market => (
                            <SelectItem key={market.index} value={market.index.toString()}>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{market.symbol}</span>
                                <span className="text-xs text-muted-foreground">({market.name})</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Long/Short Selection */}
                    <div>
                      <label className="text-sm font-medium mb-1 block">Direction</label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant={driftOrderParams.direction === 'long' ? 'default' : 'outline'}
                          className={driftOrderParams.direction === 'long' ? 'bg-green-600 hover:bg-green-700' : ''}
                          onClick={() => setDriftOrderParams({...driftOrderParams, direction: 'long'})}
                        >
                          Long
                        </Button>
                        <Button
                          variant={driftOrderParams.direction === 'short' ? 'default' : 'outline'}
                          className={driftOrderParams.direction === 'short' ? 'bg-red-600 hover:bg-red-700' : ''}
                          onClick={() => setDriftOrderParams({...driftOrderParams, direction: 'short'})}
                        >
                          Short
                        </Button>
                      </div>
                    </div>
                    
                    {/* Order Type Selection */}
                    <div>
                      <label className="text-sm font-medium mb-1 block">Order Type</label>
                      <Select 
                        value={driftOrderParams.orderType} 
                        onValueChange={(v) => setDriftOrderParams({...driftOrderParams, orderType: v})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="limit">Limit Order</SelectItem>
                          <SelectItem value="market">Market Order</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Size and Price */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-1 block">
                          Size ({driftPerpMarkets.find(m => m.index === driftOrderParams.marketIndex)?.baseAsset || 'tokens'})
                          <span className="text-xs text-muted-foreground ml-1">Amount to trade</span>
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          value={driftOrderParams.size}
                          onChange={(e) => setDriftOrderParams({...driftOrderParams, size: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1 block">
                          {driftOrderParams.orderType === 'limit' ? 'Limit Price ($)' : 'Est. Price ($)'}
                          <span className="text-xs text-muted-foreground ml-1">
                            {driftOrderParams.orderType === 'limit' ? 'Execution price' : 'Market price'}
                          </span>
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          value={driftOrderParams.price}
                          onChange={(e) => setDriftOrderParams({...driftOrderParams, price: e.target.value})}
                          disabled={driftOrderParams.orderType === 'market'}
                        />
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button 
                        onClick={placeDriftOrder} 
                        disabled={!selectedAccount || !driftClient || isLoading}
                        className="flex-1"
                      >
                        Place {driftOrderParams.direction === 'long' ? 'Long' : 'Short'} Order
                      </Button>
                      <Button 
                        onClick={fetchOrders} 
                        disabled={!selectedAccount || isLoading}
                        variant="outline"
                      >
                        View Orders
                      </Button>
                    </div>
                    
                    {/* Help Text */}
                    <Alert>
                      <AlertDescription className="text-xs">
                        <strong>Notes:</strong>
                        <ul className="mt-1 ml-4 list-disc">
                          <li>Orders are placed on Drift Protocol (Solana)</li>
                          <li>Market indices: SOL=0, BTC=1, ETH=2, etc.</li>
                          <li>Limit orders use post-only flag by default</li>
                          <li>Size is in base asset units (e.g., 1 SOL, 0.01 BTC)</li>
                          <li>Requires Solana wallet connection and SOL for gas</li>
                        </ul>
                      </AlertDescription>
                    </Alert>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="mt-6 space-y-4">
            <h3 className="text-lg font-semibold">Common Operations</h3>
            
            <div className="flex gap-2">
              <Input
                placeholder="Position name"
                value={positionName}
                onChange={(e) => setPositionName(e.target.value)}
              />
              <Button onClick={createPosition} disabled={!authToken || isLoading}>
                Create Position
              </Button>
              <Button onClick={createDeltaNeutralPosition} disabled={!authToken || isLoading}>
                Create Delta Neutral
              </Button>
            </div>
            
            <Button onClick={fetchTransactionHistory} disabled={!selectedAccount || isLoading}>
              Fetch Transaction History
            </Button>
          </div>
          
          {config && (
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Environment Configuration</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Hyperliquid:</strong>
                  <ul className="ml-4 text-xs text-muted-foreground">
                    <li>Chain: {config.hyperliquid.chain}</li>
                    <li>API: {config.hyperliquid.apiUrl}</li>
                    <li>Web: {config.hyperliquid.webAppUrl}</li>
                  </ul>
                </div>
                <div>
                  <strong>Drift:</strong>
                  <ul className="ml-4 text-xs text-muted-foreground">
                    <li>Env: {config.drift.env}</li>
                    <li>RPC: {config.drift.rpcUrl}</li>
                    <li>Web: {config.drift.webAppUrl}</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
          
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2">Test Results</h3>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {testResults.map((result, index) => (
                <Alert key={index} className={result.status === 'error' ? 'border-red-500' : ''}>
                  <AlertDescription>
                    <div className="flex items-center justify-between">
                      <div>
                        <Badge variant={result.status === 'success' ? 'default' : 'destructive'}>
                          {result.action}
                        </Badge>
                        <span className="ml-2">{result.message}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {result.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    {result.data && (
                      <pre className="mt-2 text-xs overflow-x-auto">
                        {typeof result.data === 'string' 
                          ? result.data 
                          : JSON.stringify(result.data, (_, value) => 
                              typeof value === 'bigint' ? value.toString() : value
                            , 2)}
                      </pre>
                    )}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}