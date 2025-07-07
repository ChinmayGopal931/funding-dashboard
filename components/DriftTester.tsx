/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Connection } from '@solana/web3.js';
import { 
  DriftClient, 
  initialize,
  DriftEnv,
  BN,
  PRICE_PRECISION,
  BASE_PRECISION,
  PositionDirection,
  OrderType,
  PostOnlyParams,
  MarketType,
  OrderParams,
  getMarketOrderParams,
  isVariant,
  generateSignedMsgUuid,
} from '@drift-labs/sdk';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWalletAuth } from '@/hooks/useWalletAuth';
import { DriftWalletAdapter } from '@/lib/driftWalletAdapter';
import axios from 'axios';

// Types
interface DriftAccount {
  id: string;
  userId: string;
  dex: string;
  accountType: string;
  address: string;
  subAccountId: number;
  status: string;
  createdAt: string;
}

interface Position {
  marketIndex: number;
  marketName: string;
  baseAssetAmount: string;
  notionalValue: string;
  entryPrice: string;
  markPrice: string;
  pnl: string;
  leverage?: string;
}

interface Market {
  marketIndex: number;
  symbol: string;
  baseAssetSymbol: string;
  markPrice: string;
  funding: string;
  volume24h: string;
}

// Market configuration for mainnet
const MARKETS = [
  { index: 0, name: 'SOL-PERP', symbol: 'SOL' },
  { index: 1, name: 'BTC-PERP', symbol: 'BTC' },
  { index: 2, name: 'ETH-PERP', symbol: 'ETH' },
  { index: 3, name: 'MATIC-PERP', symbol: 'MATIC' },
  { index: 4, name: 'APT-PERP', symbol: 'APT' },
  { index: 5, name: 'ARB-PERP', symbol: 'ARB' },
  { index: 6, name: 'DOGE-PERP', symbol: 'DOGE' },
  { index: 7, name: 'BNB-PERP', symbol: 'BNB' },
  { index: 8, name: 'SUI-PERP', symbol: 'SUI' },
  { index: 9, name: '1MPEPE-PERP', symbol: '1MPEPE' },
  { index: 10, name: 'RNDR-PERP', symbol: 'RNDR' },
  { index: 11, name: 'XRP-PERP', symbol: 'XRP' },
  { index: 12, name: 'HNT-PERP', symbol: 'HNT' },
  { index: 13, name: 'INJ-PERP', symbol: 'INJ' },
  { index: 14, name: 'PYTH-PERP', symbol: 'PYTH' },
  { index: 15, name: 'TIA-PERP', symbol: 'TIA' },
  { index: 16, name: 'JUP-PERP', symbol: 'JUP' },
  { index: 17, name: 'AVAX-PERP', symbol: 'AVAX' },
  { index: 18, name: 'LINK-PERP', symbol: 'LINK' },
  { index: 19, name: 'WIF-PERP', symbol: 'WIF' },
  { index: 20, name: 'JTO-PERP', symbol: 'JTO' },
];

export const DriftTester: React.FC = () => {
  const wallet = useWallet();
  const {
    isAuthenticated,
    userId: authUserId,
    loading: authLoading,
    error: authError,
    authenticateWallet,
    walletAddress,
    showEmailInput,
    setShowEmailInput
  } = useWalletAuth('drift');
  
  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [output, setOutput] = useState<any>(null);
  const [driftClient, setDriftClient] = useState<DriftClient | null>(null);
  
  // User & Account
  const [email, setEmail] = useState('');
  const [account, setAccount] = useState<DriftAccount | null>(null);
  const [accounts, setAccounts] = useState<DriftAccount[]>([]);
  
  // Order Form
  const [marketIndex, setMarketIndex] = useState(0);
  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [size, setSize] = useState('1');
  const [price, setPrice] = useState('');
  const [reduceOnly, setReduceOnly] = useState(false);
  const [postOnly, setPostOnly] = useState(false);
  const [useSwift, setUseSwift] = useState(false);
  
  // Data
  const [positions, setPositions] = useState<Position[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [userStats, setUserStats] = useState<any>(null);

  // API Client
  const driftAPI = {
    baseURL: 'http://localhost:3000/api/dex/drift',
    
    async request(method: string, endpoint: string, body?: any) {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`${this.baseURL}${endpoint}`, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
        });
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text();
          console.error('Non-JSON response:', text);
          throw new Error(`Server error: Expected JSON response but got ${contentType || 'no content-type'}`);
        }
        
        const data = await response.json();
        
        if (!response.ok) {
          console.error('API Error Response:', data);
          // Extract more detailed error information
          let errorMessage = data.error || `Request failed: ${response.status}`;
          if (data.details) {
            errorMessage += ` - ${JSON.stringify(data.details)}`;
          }
          throw new Error(errorMessage);
        }
        
        setOutput(data);
        return data;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('Request error:', errorMessage);
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    
    // Account endpoints
    initAccount: (userId: string, authority: string, subAccountId = 0) =>
      driftAPI.request('POST', '/account/init', { userId, authority, subAccountId }),
    
    getUserAccounts: (userId: string) =>
      driftAPI.request('GET', `/account/${userId}`),
    
    markAccountInitialized: (accountId: string) =>
      driftAPI.request('POST', `/account/${accountId}/initialized`),
    
    // Order endpoints
    prepareOrder: (accountId: string, orderParams: any) =>
      driftAPI.request('POST', '/order/prepare', { accountId, orderParams }),
    
    submitOrder: (accountId: string, signedOrder: any, orderParams: any, clientOrderId?: string) =>
      driftAPI.request('POST', '/order', { accountId, signedOrder, orderParams, clientOrderId }),
    
    prepareCancelOrder: (orderId: string) =>
      driftAPI.request('POST', '/order/cancel/prepare', { orderId }),
    
    cancelOrder: (orderId: string, signature: string, message: any, authority: string) =>
      driftAPI.request('POST', '/order/cancel', { orderId, signature, message, authority }),
    
    // Position endpoints - Note: uses authority and subAccountId, not accountId
    getPositions: (authority: string, subAccountId: number) =>
      driftAPI.request('GET', `/positions/${authority}/${subAccountId}`),
    
    getUserStats: (authority: string, subAccountId: number) =>
      driftAPI.request('GET', `/stats/${authority}/${subAccountId}`),
    
    // Market endpoints
    getMarket: (marketType: 'perp' | 'spot', symbol: string) =>
      driftAPI.request('GET', `/market/${marketType}/${symbol}`),
  };

  // Load user accounts on wallet connect and authentication
  useEffect(() => {
    const loadAccounts = async () => {
      if (isAuthenticated && authUserId) {
        await loadUserAccounts();
      }
    };
    loadAccounts();
  }, [isAuthenticated, authUserId]);

  // Initialize Drift SDK and client when wallet connects
  useEffect(() => {
    const initDriftClient = async () => {
      if (wallet.publicKey && wallet.signTransaction && wallet.connected && isAuthenticated) {
        try {
          console.log('Initializing Drift SDK and client...');
          
          // Initialize SDK (do this once)
          const sdkConfig = {
            env: 'mainnet-beta' as DriftEnv,
            userStats: true,
            perpMarkets: [
              {
                baseAssetSymbol: 'SOL',
                marketIndex: 0,
              },
            ],
          };
          
          await initialize(sdkConfig);
          
          // Use mainnet RPC
          const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=d1233421-deb1-4669-a2eb-5d5df2dd18df', 'confirmed');
          
          // Create wallet adapter from the connected wallet
          if (!wallet.connected) {
            throw new Error('Wallet is not connected');
          }
          
          const driftWallet = new DriftWalletAdapter(wallet);
                    
          const client = new DriftClient({
            connection,
            wallet: driftWallet,
            env: 'mainnet-beta' as DriftEnv,
          });
          
          // Subscribe to the client first - this subscribes to markets and oracles
          await client.subscribe();
          console.log('Subscribed to markets and oracles');
          
          // Check if user exists and subscribe to user account
          // Try multiple subaccount IDs since users might have accounts on different subaccounts
          let userSubscribed = false;
          const subAccountsToCheck = [0, 1, 2, 3, 4]; // Check first 5 subaccounts
          
          for (const subAccountId of subAccountsToCheck) {
            try {
              const userAccountPublicKey = await client.getUserAccountPublicKey(subAccountId);
              if (userAccountPublicKey) {
                // Subscribe to user account if it exists
                await client.addUser(subAccountId);
                console.log(`User account subscribed on subaccount ${subAccountId}`);
                userSubscribed = true;
                
                // Set the active subaccount
                client.switchActiveUser(subAccountId);
                console.log(`Switched to subaccount ${subAccountId}`);
                break; // Stop after finding the first valid subaccount
              }
            } catch (e: any) {
              // This subaccount doesn't exist, try the next one
              if (!e.message.includes('no user for user id')) {
                console.log(`Error checking subaccount ${subAccountId}:`, e.message);
              }
            }
          }
          
          if (!userSubscribed) {
            console.log('User account not found on any subaccount (0-4)');
          }
          
          setDriftClient(client);
          
          // Set up event listeners for account updates
          try {
            const user = client.getUser();
            
            // Listen for user account updates
            user.eventEmitter.on('update', () => {
              console.log('User account updated');
              // Refresh positions when account updates
              if (account) {
                loadPositions();
              }
            });
          } catch (e: any) {
            console.log('Could not set up user event listeners yet:', e.message);
          }
          
          // The SDK will automatically keep user data in sync
          
          console.log('Drift client initialized successfully');
        } catch (err) {
          console.error('Failed to initialize Drift client:', err);
          setError('Failed to initialize Drift client: ' + (err as Error).message);
        }
      } else {
        // Clean up drift client if wallet disconnected
        if (driftClient) {
          driftClient.unsubscribe();
          setDriftClient(null);
        }
      }
    };
    
    initDriftClient();
    
    // Cleanup function will be handled by the next effect run
  }, [wallet.publicKey, wallet.signTransaction, isAuthenticated, account]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (driftClient) {
        driftClient.unsubscribe();
      }
    };
  }, [driftClient]);
  
  // Re-subscribe to user when account changes
  useEffect(() => {
    const subscribeToUser = async () => {
      if (driftClient && account && account.status === 'active') {
        try {
          // Check if already subscribed
          const user = driftClient.getUser();
          if (!user.getUserAccount()) {
            // Try multiple subaccounts
            const subAccountsToCheck = [0, 1, 2, 3, 4];
            for (const subAccountId of subAccountsToCheck) {
              try {
                await driftClient.addUser(subAccountId);
                driftClient.switchActiveUser(subAccountId);
                console.log(`Subscribed to user account on subaccount ${subAccountId} after account change`);
                break;
              } catch (e: any) {
                if (!e.message.includes('no user for user id')) {
                  console.log(`Could not subscribe to subaccount ${subAccountId}:`, e.message);
                }
              }
            }
          }
        } catch (e: any) {
          console.log('Could not subscribe to user:', e.message);
        }
      }
    };
    
    subscribeToUser();
  }, [driftClient, account]);

  // Account Management Functions
  const createAccount = async () => {
    if (!wallet.publicKey) {
      setError('Please connect your wallet first');
      return;
    }
    
    if (!isAuthenticated || !authUserId) {
      setError('Please authenticate first');
      return;
    }
    
    try {
      const result = await driftAPI.initAccount(authUserId, wallet.publicKey.toBase58());
      setAccount(result.account);
      await loadUserAccounts();
    } catch (err) {
      console.error('Failed to create account:', err);
    }
  };

  const loadUserAccounts = async () => {
    if (!authUserId) return;
    
    try {
      const accounts = await driftAPI.getUserAccounts(authUserId);
      setAccounts(accounts || []);
      
      // Auto-select first active account if available
      if (accounts?.length > 0 && !account) {
        const activeAccount = accounts.find((acc: DriftAccount) => acc.status === 'active') || accounts[0];
        setAccount(activeAccount);
      }
    } catch (err) {
      console.error('Failed to load accounts:', err);
    }
  };

  const initializeAccount = async () => {
    if (!driftClient || !wallet.publicKey || !account) {
      setError('Drift client not initialized, wallet not connected, or no account selected');
      return;
    }
    
    // Verify wallet is truly connected
    console.log('Wallet connection state:', {
      publicKey: wallet.publicKey?.toBase58(),
      connected: wallet.connected,
      connecting: wallet.connecting,
      signTransaction: !!wallet.signTransaction,
      signAllTransactions: !!wallet.signAllTransactions,
      wallet: wallet.wallet?.adapter?.name
    });
    
    if (!wallet.connected) {
      setError('Wallet is not connected. Please connect your wallet first.');
      return;
    }
    
    if (!wallet.signTransaction) {
      setError('Wallet does not support transaction signing. Please use a different wallet.');
      return;
    }
    
    try {
      setLoading(true);
      
      // Check if user account already exists on-chain
      let userAccountExists = false;
      try {
        const userAccountPublicKey = await driftClient.getUserAccountPublicKey();
        userAccountExists = !!userAccountPublicKey;
      } catch (e: any) {
        userAccountExists = false;
        console.log('Error checking user account:', e.message);
      }
      
      if (!userAccountExists) {
        console.log('Initializing Drift user account on-chain...');
        
        // Initialize user account on-chain
        // Use subAccountId from the account if available, otherwise default to 0
        const subAccountId = account.subAccountId || 0;
        console.log(`Using subAccountId: ${subAccountId}`);
        
        // Add more logging before initialization
        console.log('DriftClient state before initialization:', {
          wallet: driftClient.wallet.publicKey.toBase58(),
          connection: driftClient.connection.rpcEndpoint,
          env: (driftClient as any).config?.env || 'unknown'
        });
        
        let txSig, userPublicKey;
        try {
          [txSig, userPublicKey] = await driftClient.initializeUserAccount(subAccountId);
        } catch (initError: any) {
          console.error('Error during initializeUserAccount:', initError);
          console.error('Error stack:', initError.stack);
          
          // Check if it's a transaction signature verification error
          if (initError.message?.includes('signature verification') || initError.message?.includes('Transaction signature verification')) {
            console.error('Transaction signature verification failed. This may be due to wallet adapter issues.');
            
            // Log the wallet adapter state
            const walletAdapter = (driftClient.wallet as any).walletAdapter;
            console.error('Wallet adapter state:', {
              hasWalletAdapter: !!walletAdapter,
              publicKey: walletAdapter?.publicKey?.toBase58(),
              connected: walletAdapter?.connected,
              signTransaction: !!walletAdapter?.signTransaction
            });
          }
          
          throw initError;
        }
        
        console.log('User account initialization TX:', txSig);
        console.log('User public key:', userPublicKey.toString());
        console.log('SubAccount ID:', subAccountId);
        
        // Wait for confirmation
        await driftClient.connection.confirmTransaction(txSig);
        
        // Subscribe to the newly created user account
        await driftClient.addUser(subAccountId);
        driftClient.switchActiveUser(subAccountId);
        console.log(`Subscribed to new user account on subaccount ${subAccountId}`);
        
        // Mark account as initialized on the server
        await driftAPI.markAccountInitialized(account.id);
        
        setSuccess('Drift account initialized successfully!');
        setTimeout(() => setSuccess(null), 5000);
      } else {
        // Account already exists, ensure we're subscribed
        // Try to subscribe with the account's subAccountId or search for it
        let subscribed = false;
        const subAccountId = account.subAccountId || 0;
        
        try {
          await driftClient.addUser(subAccountId);
          driftClient.switchActiveUser(subAccountId);
          console.log(`Subscribed to existing user account on subaccount ${subAccountId}`);
          subscribed = true;
        } catch (e: any) {
          console.log(`Could not subscribe to subaccount ${subAccountId}:`, e.message);
          
          // Try other subaccounts
          const subAccountsToCheck = [0, 1, 2, 3, 4].filter(id => id !== subAccountId);
          for (const id of subAccountsToCheck) {
            try {
              await driftClient.addUser(id);
              driftClient.switchActiveUser(id);
              console.log(`Subscribed to existing user account on subaccount ${id}`);
              subscribed = true;
              break;
            } catch (err: any) {
              // Continue to next subaccount
            }
          }
        }
        
        if (!subscribed) {
          console.log('Could not subscribe to any subaccount');
        }
        
        // Mark as initialized on the server
        await driftAPI.markAccountInitialized(account.id);
        setSuccess('Drift account already initialized on-chain');
        setTimeout(() => setSuccess(null), 5000);
      }
      
      // Refresh account data
      await loadUserAccounts();
    } catch (err) {
      console.error('Failed to initialize account:', err);
      setError('Failed to initialize Drift account: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Helper Functions
  const recordOrder = async (txId: string, orderParams: any) => {
    if (!account) return;
    
    try {
      const response = await fetch(`${driftAPI.baseURL}/order/record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: authUserId,
          accountId: account.id,
          transactionId: txId,
          orderParams,
          clientOrderId: Date.now().toString()
        })
      });
      
      if (!response.ok) {
        console.error('Failed to record order:', await response.text());
      }
    } catch (error) {
      console.error('Error recording order:', error);
    }
  };

  const signAndSubmitOrder = async () => {
    if (!driftClient || !wallet.publicKey || !account) {
      setError('Drift client not initialized, wallet not connected, or no account selected');
      return;
    }
    console.log(driftClient)
    
    // Clear any previous errors/success messages
    setError(null);
    setSuccess(null);
    
    try {
      // Ensure user is subscribed
      let user;
      try {
        user = driftClient.getUser();
      } catch (e: any) {
        console.error('No user found:', e.message);
        setError('No Drift account found. Please create and initialize a Drift account first.');
        return;
      }
      
      if (!user.getUserAccount()) {
        console.log('User not subscribed, attempting to subscribe...');
        // Try to find and subscribe to user account across multiple subaccounts
        let subscribed = false;
        const subAccountsToCheck = [0, 1, 2, 3, 4];
        
        for (const subAccountId of subAccountsToCheck) {
          try {
            await driftClient.addUser(subAccountId);
            console.log(`Successfully subscribed to user account on subaccount ${subAccountId}`);
            
            // Switch to this subaccount
            driftClient.switchActiveUser(subAccountId);
            
            // Wait a moment for subscription to complete
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Verify subscription
            if (user.getUserAccount()) {
              subscribed = true;
              console.log(`Using subaccount ${subAccountId}`);
              break;
            }
          } catch (e: any) {
            // This subaccount doesn't exist, try the next one
            if (!e.message.includes('no user for user id')) {
              console.error(`Failed to subscribe to subaccount ${subAccountId}:`, e);
            }
          }
        }
        
        if (!subscribed) {
          console.error('Failed to subscribe to any user account');
          setError('No Drift account found on mainnet. Please ensure you have an account at app.drift.trade');
          return;
        }
      }
      
      // Log user account state
      const currentUserAccount = user.getUserAccount();
      console.log('User account state:', currentUserAccount);
      
      // Verify wallet authority matches user account
      if (currentUserAccount && !currentUserAccount.authority.equals(wallet.publicKey)) {
        console.error('Authority mismatch:', {
          userAuthority: currentUserAccount.authority.toString(),
          walletPubkey: wallet.publicKey.toString()
        });
        setError('Wallet authority does not match user account');
        return;
      }
      
      // Check if user has any collateral
      if (currentUserAccount) {
        const totalCollateral = user.getTotalCollateral();
        console.log('Total collateral:', totalCollateral.toString());
        
        if (totalCollateral.lte(new BN(0))) {
          setError('You need to deposit collateral before placing orders. Please deposit USDC first.');
          return;
        }
      }
      let txId: string = '';
      
      // Convert string inputs to BN
      const baseAssetAmount = new BN(parseFloat(size) * BASE_PRECISION.toNumber());
      const limitPrice = orderType === 'limit' ? new BN(parseFloat(price) * PRICE_PRECISION.toNumber()) : undefined;
      
      // Map direction to SDK enum
      const orderDirection = direction === 'long' ? PositionDirection.LONG : PositionDirection.SHORT;
      
      // Map order type to SDK enum
      const sdkOrderType = orderType === 'market' ? OrderType.MARKET : OrderType.LIMIT;
      
      console.log('Placing order:', {
        marketIndex,
        direction: orderDirection,
        baseAssetAmount: baseAssetAmount.toString(),
        price: limitPrice?.toString(),
        orderType: sdkOrderType,
        reduceOnly
      });
      
      // Double-check user state before placing order
      const userAccountBefore = user.getUserAccount();
      if (!userAccountBefore) {
        throw new Error('User account not available');
      }
      
      // Log market info
      const perpMarket = driftClient.getPerpMarketAccount(marketIndex);
      console.log('Perp market info:', {
        marketIndex,
        status: perpMarket?.status,
        amm: perpMarket?.amm,
        oracleSource: perpMarket?.amm?.oracleSource,
        oracle: perpMarket?.amm?.oracle?.toString(),
      });
      
      // Place order based on type
      let txResponse;
      try {
        if (orderType === 'market') {
          // Place market order
          console.log('Calling placePerpOrder with market order params...');
          txResponse = await driftClient.placePerpOrder({
            marketIndex,
            direction: orderDirection,
            baseAssetAmount,
            orderType: OrderType.MARKET,
            reduceOnly,
          });
          console.log("txResponse:", txResponse);
        } else {
          // Place limit order
          console.log('Calling placePerpOrder with limit order params...');
          console.log("params", {
            marketIndex,
            direction: orderDirection,
            baseAssetAmount: baseAssetAmount.toString(),
            price: limitPrice?.toString(),
            orderType: OrderType.LIMIT,
            postOnly: postOnly ? PostOnlyParams.TRY_POST_ONLY : PostOnlyParams.NONE,
            reduceOnly,
          }
          )
          txResponse = await driftClient.placePerpOrder({
            marketIndex,
            direction: orderDirection,
            baseAssetAmount,
            price: limitPrice!,
            orderType: OrderType.LIMIT,
            postOnly: postOnly ? PostOnlyParams.TRY_POST_ONLY : PostOnlyParams.NONE,
            reduceOnly,
          });
          console.log("txResponse:", txResponse);

        }
      } catch (orderErr: any) {
        console.error('Error during placePerpOrder call:', orderErr);
        throw orderErr;
      }
      
      console.log('Order response:', txResponse);
      console.log('Order response type:', typeof txResponse);
      
      // The SDK should return a transaction signature string
      if (!txResponse) {
        throw new Error('No response from placePerpOrder - check if you have sufficient collateral');
      }
      
      // Extract transaction ID - the response should be a string (transaction signature)
      if (typeof txResponse === 'string') {
        txId = txResponse;
      } else if (Array.isArray(txResponse) && txResponse.length > 0) {
        // Sometimes it might return an array of signatures
        txId = txResponse[0];
      } else if (txResponse && typeof txResponse === 'object') {
        // Check various possible property names
        const possibleKeys = ['txSig', 'transactionSignature', 'signature', 'txId', 'txid'];
        for (const key of possibleKeys) {
          if (txResponse[key]) {
            txId = txResponse[key];
            break;
          }
        }
        
        // If still no txId, log the entire response to understand its structure
        if (!txId) {
          console.error('Unexpected transaction response structure:', JSON.stringify(txResponse, null, 2));
          console.error('Response type:', typeof txResponse);
          console.error('Response keys:', txResponse ? Object.keys(txResponse) : 'null');
        }
      }
      
      if (!txId || typeof txId !== 'string') {
        console.error('Invalid transaction response:', txResponse);
        throw new Error(`Failed to get transaction ID from order response. Response was: ${JSON.stringify(txResponse)}`);
      }
      
      console.log('Order transaction ID:', txId);
      
      // Wait for transaction confirmation
      const connection = driftClient.connection;
      await connection.confirmTransaction(txId);
      
      // Record order in backend
      await recordOrder(txId, {
        marketIndex,
        marketType: 'perp',
        orderType,
        direction,
        baseAssetAmount: size,
        price: orderType === 'limit' ? price : undefined,
        reduceOnly,
        postOnly: orderType === 'limit' ? postOnly : undefined,
      });
      
      // Show success message
      setError(null);
      const shortTxId = txId && typeof txId === 'string' ? txId.slice(0, 8) : 'Unknown';
      setSuccess(`Order placed successfully! TX: ${shortTxId}...`);
      setTimeout(() => setSuccess(null), 5000);
      
      // Positions will auto-update via event listeners
      
    } catch (err: any) {
      console.error('Failed to place order:', err);
      console.error('Error stack:', err.stack);
      
      // Try to get detailed logs from SendTransactionError
      if (err.name === 'SendTransactionError' && typeof err.getLogs === 'function') {
        try {
          const logs = await err.getLogs();
          console.error('Transaction logs:', logs);
          
          // Parse logs for specific error messages
          const logString = logs.join(' ');
          if (logString.includes('insufficient collateral')) {
            setError('Insufficient collateral for this order');
            return;
          } else if (logString.includes('Invalid oracle')) {
            setError('Oracle price unavailable for this market');
            return;
          } else if (logString.includes('0x1770')) { // INVALID_ORACLE error code
            setError('Invalid oracle price - market may be inactive');
            return;
          }
        } catch (logErr) {
          console.error('Failed to get transaction logs:', logErr);
        }
      }
      
      // Handle specific error cases
      if (err.message?.includes('insufficient collateral')) {
        setError('Insufficient collateral for this order');
      } else if (err.message?.includes('User not found')) {
        setError('Please initialize your Drift account first');
      } else if (err.message?.includes('Market not found')) {
        setError('Invalid market selected');
      } else if (err.message?.includes('signature verification failure')) {
        setError('Transaction signature verification failed - please try again');
      } else {
        setError(`Order failed: ${err.message || 'Unknown error'}`);
      }
    }
  };

  // Swift Order Function
  const placeSwiftOrder = async () => {
    if (!driftClient || !wallet.publicKey || !account) {
      setError('Drift client not initialized, wallet not connected, or no account selected');
      return;
    }

    // Clear any previous errors/success messages
    setError(null);
    setSuccess(null);

    try {
      // Ensure user is subscribed
      let user;
      try {
        user = driftClient.getUser();
      } catch (e: any) {
        console.error('No user found:', e.message);
        setError('No Drift account found. Please create and initialize a Drift account first.');
        return;
      }

      if (!user.getUserAccount()) {
        console.log('User not subscribed, attempting to subscribe...');
        // Try to find and subscribe to user account across multiple subaccounts
        let subscribed = false;
        const subAccountsToCheck = [0, 1, 2, 3, 4];
        
        for (const subAccountId of subAccountsToCheck) {
          try {
            await driftClient.addUser(subAccountId);
            console.log(`Successfully subscribed to user account on subaccount ${subAccountId}`);
            
            // Switch to this subaccount
            driftClient.switchActiveUser(subAccountId);
            
            // Wait a moment for subscription to complete
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Verify subscription
            if (user.getUserAccount()) {
              subscribed = true;
              console.log(`Using subaccount ${subAccountId}`);
              break;
            }
          } catch (e: any) {
            // This subaccount doesn't exist, try the next one
            if (!e.message.includes('no user for user id')) {
              console.error(`Failed to subscribe to subaccount ${subAccountId}:`, e);
            }
          }
        }
        
        if (!subscribed) {
          console.error('Failed to subscribe to any user account');
          setError('No Drift account found. Please ensure you have an account');
          return;
        }
      }

      // Get oracle info for the market
      const oracleInfo = driftClient.getOracleDataForPerpMarket(marketIndex);
      if (!oracleInfo || !oracleInfo.price) {
        setError('Oracle price not available for this market');
        return;
      }

      // Calculate auction prices (1% spread for market orders)
      const highPrice = oracleInfo.price.muln(101).divn(100);
      const lowPrice = oracleInfo.price;

      // Convert size to base asset amount
      const baseAssetAmount = new BN(parseFloat(size) * BASE_PRECISION.toNumber());

      // Get slot
      const slot = await driftClient.connection.getSlot();

      // Create order parameters
      let orderParams: OrderParams;
      if (orderType === 'market') {
        orderParams = getMarketOrderParams({
          marketIndex: marketIndex,
          marketType: MarketType.PERP,
          direction: direction === 'long' ? PositionDirection.LONG : PositionDirection.SHORT,
          baseAssetAmount,
          auctionStartPrice: isVariant(direction === 'long' ? PositionDirection.LONG : PositionDirection.SHORT, 'long') ? lowPrice : highPrice,
          auctionEndPrice: isVariant(direction === 'long' ? PositionDirection.LONG : PositionDirection.SHORT, 'long') ? highPrice : lowPrice,
          auctionDuration: 50,
        }) as OrderParams;
      } else {
        // For limit orders
        if (!price || parseFloat(price) <= 0) {
          setError('Please enter a valid limit price');
          return;
        }
        
        const limitPrice = new BN(parseFloat(price) * PRICE_PRECISION.toNumber());
        
        // Create limit order params
        const limitOrderParams = {
          orderType: OrderType.LIMIT,
          marketType: MarketType.PERP,
          direction: direction === 'long' ? PositionDirection.LONG : PositionDirection.SHORT,
          marketIndex,
          baseAssetAmount,
          price: limitPrice,
          postOnly: postOnly ? PostOnlyParams.TRY_POST_ONLY : PostOnlyParams.NONE,
          reduceOnly,
          userOrderId: 0,
          immediateOrCancel: false,
          maxTs: null,
        };
        
        // Cast to OrderParams - SDK will handle optional fields
        orderParams = limitOrderParams as unknown as OrderParams;
      }

      // Create order message
      const orderMessage = {
        signedMsgOrderParams: orderParams,
        subAccountId: driftClient.activeSubAccountId || 0,
        slot: new BN(slot),
        uuid: generateSignedMsgUuid(),
        stopLossOrderParams: null,
        takeProfitOrderParams: null,
      };

      console.log('Swift order message:', orderMessage);

      // Sign the message
      let signedResult;
      try {
        signedResult = await driftClient.signSignedMsgOrderParamsMessage(orderMessage);
      } catch (signErr: any) {
        console.error('Failed to sign message:', signErr);
        setError('Failed to sign order message. Please check your wallet connection.');
        return;
      }

      const { orderParams: message, signature } = signedResult;
      
      console.log('Signed message:', message);
      console.log('Signature:', signature);

      // Submit to Swift API
      const swiftUrl = 'https://swift.drift.trade/orders';

      const response = await axios.post(swiftUrl, {
        market_index: marketIndex,
        market_type: 'perp',
        message: message,
        signature: signature,
        taker_authority: driftClient.wallet.publicKey.toBase58(),
      }, {
        headers: { 'Content-Type': 'application/json' },
        validateStatus: (status) => status < 500, // Don't throw on 4xx errors
      });

      console.log("Swift order response:", response.data);

      // Check for successful response
      if (response.status === 200 || response.status === 201) {
        setError(null);
        setSuccess(`Swift order submitted successfully! Order ID: ${response.data.orderId || response.data.id || 'Pending'}`);
        setTimeout(() => setSuccess(null), 5000);
        
        // Refresh order history
        await loadOrderHistory();
      } else {
        // Handle API errors
        const errorMessage = response.data?.error || response.data?.message || 'Unknown error';
        throw new Error(errorMessage);
      }

    } catch (err: any) {
      console.error('Failed to place Swift order:', err);
      console.error('Error response:', err.response?.data);
      
      // Handle specific error cases
      if (err.response?.status === 400) {
        const errorData = err.response.data;
        const errorMessage = errorData.error || errorData.message || 'Bad request';
        
        // Parse common Swift API errors
        if (errorMessage.includes('insufficient collateral')) {
          setError('Insufficient collateral for this order. Please deposit more USDC.');
        } else if (errorMessage.includes('invalid signature')) {
          setError('Invalid signature. Please reconnect your wallet and try again.');
        } else if (errorMessage.includes('market closed')) {
          setError('Market is currently closed. Please try again later.');
        } else if (errorMessage.includes('order size too small')) {
          setError('Order size is too small. Please increase the size.');
        } else {
          setError(`Swift order failed: ${errorMessage}`);
        }
      } else if (err.response?.status === 429) {
        setError('Rate limit exceeded. Please wait a moment and try again.');
      } else if (err.response?.status === 503) {
        setError('Swift service is temporarily unavailable. Please try again later.');
      } else if (err.message?.includes('Network Error')) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError(`Swift order failed: ${err.message || 'Unknown error'}`);
      }
    }
  };

  // Data Loading Functions
  const loadPositions = async () => {
    if (!account || !driftClient) return;
    
    try {
      // Get positions directly from SDK for real-time accuracy
      const user = driftClient.getUser();
      const perpPositions = user.getActivePerpPositions();
      
      // Convert SDK positions to our format
      const formattedPositions = perpPositions.map(pos => ({
        marketIndex: pos.marketIndex,
        marketName: MARKETS.find(m => m.index === pos.marketIndex)?.name || `Market ${pos.marketIndex}`,
        baseAssetAmount: pos.baseAssetAmount.toString(),
        notionalValue: pos.quoteAssetAmount.toString(),
        entryPrice: pos.quoteEntryAmount.div(pos.baseAssetAmount.abs()).toString(),
        markPrice: '0', // Will be filled from market data
        pnl: '0', // Will be calculated from market data
      }));
      
      setPositions(formattedPositions);
      
      // Also fetch from backend for consistency
      try {
        await driftAPI.getPositions(account.address, account.subAccountId || 0);
        // Backend positions can be used for additional data if needed
      } catch (backendErr) {
        console.warn('Backend position fetch failed, using SDK data only:', backendErr);
      }
    } catch (err) {
      console.error('Failed to load positions:', err);
    }
  };

  const loadUserStats = async () => {
    if (!account) return;
    
    try {
      const result = await driftAPI.getUserStats(account.address, account.subAccountId || 0);
      setUserStats(result);
    } catch (err) {
      console.error('Failed to load user stats:', err);
    }
  };

  const loadMarkets = async () => {
    try {
      // Fetch data for each market
      const marketPromises = MARKETS.map(async (market) => {
        try {
          const data = await driftAPI.getMarket('perp', market.symbol);
          return {
            marketIndex: market.index,
            symbol: market.name,
            baseAssetSymbol: market.symbol,
            ...data
          };
        } catch (err) {
          console.error(`Failed to load market ${market.symbol}:`, err);
          return null;
        }
      });
      
      const marketData = await Promise.all(marketPromises);
      setMarkets(marketData.filter(m => m !== null) as Market[]);
    } catch (err) {
      console.error('Failed to load markets:', err);
    }
  };

  // Load order history from Drift SDK
  const loadOrderHistory = async () => {
    if (!driftClient) {
      setOrderHistory([]);
      return;
    }
    
    try {
      const user = driftClient.getUser();
      const orders = await user.getOpenOrders();
      
      // Format orders for display
      const formattedOrders = orders.map(order => ({
        market: MARKETS.find(m => m.index === order.marketIndex)?.name || `Market ${order.marketIndex}`,
        direction: order.direction === PositionDirection.LONG ? 'long' : 'short',
        size: order.baseAssetAmount.div(BASE_PRECISION).toString(),
        price: order.price ? order.price.div(PRICE_PRECISION).toString() : 'Market',
        status: order.status,
        orderId: order.orderId.toString(),
      }));
      
      setOrderHistory(formattedOrders);
    } catch (err) {
      console.error('Failed to load order history:', err);
      setOrderHistory([]);
    }
  };

  const closePosition = async (marketIndex: number) => {
    if (!driftClient || !wallet.publicKey || !account) {
      setError('Drift client not initialized, wallet not connected, or no account selected');
      return;
    }
    
    try {
      setLoading(true);
      
      // Get current positions from Drift client
      const user = driftClient.getUser();
      const positions = user.getActivePerpPositions();
      
      // Find the position to close
      const position = positions.find(p => p.marketIndex === marketIndex);
      if (!position) {
        setError('Position not found');
        return;
      }
      
      const baseAssetAmount = position.baseAssetAmount;
      const isLong = baseAssetAmount.gt(new BN(0));
      
      console.log('Closing position:', {
        marketIndex,
        currentAmount: baseAssetAmount.toString(),
        isLong
      });
      
      // Place a reduce-only order in the opposite direction
      const txId = await driftClient.placePerpOrder({
        marketIndex,
        direction: isLong ? PositionDirection.SHORT : PositionDirection.LONG,
        baseAssetAmount: baseAssetAmount.abs(),
        orderType: OrderType.MARKET,
        reduceOnly: true,
      });
      
      console.log('Close position TX:', txId);
      
      // Wait for confirmation
      await driftClient.connection.confirmTransaction(txId);
      
      // Record the close order
      await recordOrder(txId, {
        marketIndex,
        marketType: 'perp',
        orderType: 'market',
        direction: isLong ? 'short' : 'long',
        baseAssetAmount: baseAssetAmount.abs().div(BASE_PRECISION).toString(),
        reduceOnly: true,
      });
      
      setSuccess('Position closed successfully!');
      setTimeout(() => setSuccess(null), 5000);
      
      // Positions will auto-update via event listeners
      
    } catch (err) {
      console.error('Failed to close position:', err);
      setError('Failed to close position: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Utility Functions
  const formatBaseAmount = (amount: string, decimals = 9) => {
    const value = parseFloat(amount) / Math.pow(10, decimals);
    return value.toFixed(4);
  };

  const formatUSDC = (amount: string) => {
    const value = parseFloat(amount) / 1e6;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };


  // Cancel all orders
  const cancelAllOrders = async () => {
    if (!driftClient || !account) {
      setError('Drift client not initialized or no account selected');
      return;
    }
    
    try {
      setLoading(true);
      const txId = await driftClient.cancelOrders();
      await driftClient.connection.confirmTransaction(txId);
      
      setSuccess('All orders cancelled successfully!');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error('Failed to cancel orders:', err);
      setError('Failed to cancel orders: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>🌊 Drift Protocol Tester</span>
            <WalletMultiButton />
          </CardTitle>
        </CardHeader>
      </Card>

      <Tabs defaultValue="account" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="trading">Trading</TabsTrigger>
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="markets">Markets</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
        </TabsList>

        {/* Account Tab */}
        <TabsContent value="account" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Account Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Authentication Status */}
              {!wallet.connected ? (
                <Alert>
                  <AlertDescription>
                    Please connect your Solana wallet to continue.
                  </AlertDescription>
                </Alert>
              ) : !isAuthenticated ? (
                <div className="space-y-4">
                  {authLoading ? (
                    <Alert>
                      <AlertDescription>
                        Authenticating with wallet...
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      {authError && (
                        <Alert variant={authError.includes('not found') ? 'default' : 'destructive'}>
                          <AlertDescription>
                            {authError}
                          </AlertDescription>
                        </Alert>
                      )}
                      
                      {(showEmailInput || authError?.includes('email')) && (
                        <div className="space-y-2">
                          <p className="text-sm text-gray-600">
                            Create a new account with your wallet address
                          </p>
                          <div className="flex gap-2">
                            <Input
                              type="email"
                              placeholder="Enter your email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                            />
                            <Button
                              onClick={() => authenticateWallet(email)}
                              disabled={!email || authLoading}
                            >
                              Create Account
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      {!showEmailInput && !authError && (
                        <Button 
                          variant="outline" 
                          onClick={() => setShowEmailInput(true)}
                        >
                          Create New Account
                        </Button>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-green-50 border border-green-200 rounded">
                    <p className="text-sm font-medium text-green-800">✓ Authenticated</p>
                    <p className="text-xs text-green-600">User ID: {authUserId}</p>
                    <p className="text-xs text-green-600">Wallet: {walletAddress}</p>
                    <p className="text-xs text-green-600">
                      Drift Client: {driftClient ? '✓ Connected' : '⏳ Connecting...'}
                    </p>
                    {driftClient && (
                      <p className="text-xs text-green-600">
                        Active Subaccount: {driftClient.activeSubAccountId ?? 'None'}
                      </p>
                    )}
                  </div>

                  {wallet.publicKey && (
                    <Button onClick={createAccount} disabled={loading}>
                      Create New Drift Account
                    </Button>
                  )}
                </div>
              )}

              {accounts.length === 0 && isAuthenticated && (
                <Alert className="mb-4">
                  <AlertDescription>
                    You don't have any Drift accounts yet. Click "Create New Drift Account" to get started.
                  </AlertDescription>
                </Alert>
              )}

              {accounts.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium">Your Accounts</h3>
                  {accounts.map((acc) => (
                    <div
                      key={acc.id}
                      className={`p-3 border rounded cursor-pointer ${
                        account?.id === acc.id ? 'border-blue-500 bg-blue-50' : ''
                      }`}
                      onClick={() => setAccount(acc)}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-mono">{acc.address}</span>
                        <Badge variant={acc.status === 'active' ? 'default' : 'secondary'}>
                          {acc.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500">
                        Sub-account: {acc.subAccountId} | Created: {new Date(acc.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {account && account.status === 'pending' && (
  
                  <Button onClick={initializeAccount} className="mt-2" disabled={loading}>
                    {loading ? 'Initializing...' : 'Initialize Account'}
                  </Button>
            )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trading Tab */}
        <TabsContent value="trading" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Place Order</span>
                {useSwift && (
                  <Badge variant="default" className="bg-blue-600">
                    🚀 Swift Mode
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isAuthenticated ? (
                <Alert>
                  <AlertDescription>
                    Please authenticate with your wallet in the Account tab first.
                  </AlertDescription>
                </Alert>
              ) : !account ? (
                <Alert>
                  <AlertDescription>
                    Please create or select an account in the Account tab first.
                  </AlertDescription>
                </Alert>
              ) : !driftClient ? (
                <Alert>
                  <AlertDescription>
                    Drift client is initializing... Please wait for the connection to be established.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  {/* Collateral Warning */}
                  <Alert className="mb-4">
                    <AlertDescription>
                      <strong>Important:</strong> Before placing orders:
                      <br />1. Create a Drift account (if you haven't already)
                      <br />2. Initialize your account on-chain
                      <br />3. Deposit USDC collateral via <a href="https://app.drift.trade" target="_blank" rel="noopener noreferrer" className="underline">app.drift.trade</a>
                      <br />4. Ensure you have SOL for transaction fees
                    </AlertDescription>
                  </Alert>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Market</label>
                      <select
                        className="w-full p-2 border rounded"
                        value={marketIndex}
                        onChange={(e) => setMarketIndex(Number(e.target.value))}
                      >
                        {MARKETS.map((market) => (
                          <option key={market.index} value={market.index}>
                            {market.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Direction</label>
                      <select
                        className="w-full p-2 border rounded"
                        value={direction}
                        onChange={(e) => setDirection(e.target.value as 'long' | 'short')}
                      >
                        <option value="long">Long</option>
                        <option value="short">Short</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Order Type</label>
                      <select
                        className="w-full p-2 border rounded"
                        value={orderType}
                        onChange={(e) => setOrderType(e.target.value as 'market' | 'limit')}
                      >
                        <option value="market">Market</option>
                        <option value="limit">Limit</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Size</label>
                      <Input
                        type="number"
                        placeholder="1.0"
                        value={size}
                        onChange={(e) => setSize(e.target.value)}
                      />
                    </div>
                  </div>

                  {orderType === 'limit' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Price</label>
                        <Input
                          type="number"
                          placeholder="150.5"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={postOnly}
                            onChange={(e) => setPostOnly(e.target.checked)}
                          />
                          <span className="text-sm">Post Only</span>
                        </label>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={reduceOnly}
                        onChange={(e) => setReduceOnly(e.target.checked)}
                      />
                      <span className="text-sm">Reduce Only</span>
                    </label>
                    
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={useSwift}
                        onChange={(e) => setUseSwift(e.target.checked)}
                      />
                      <span className="text-sm font-medium">Use Swift (Off-chain)</span>
                      <span className="text-xs text-gray-500">
                        {useSwift && '✓ Fast execution • No gas fees upfront'}
                      </span>
                    </label>
                  </div>

                  {useSwift && (
                    <Alert className="mb-4 border-blue-200 bg-blue-50">
                      <AlertDescription className="text-blue-800">
                        <strong>🚀 Swift Mode Active</strong>
                        <ul className="mt-2 ml-4 list-disc text-sm">
                          <li>Orders are submitted off-chain to keepers</li>
                          <li>Faster execution with no upfront gas fees</li>
                          <li>Keepers execute on your behalf when conditions are met</li>
                          <li>Small keeper fee charged on execution (typically ~0.01%)</li>
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button 
                    onClick={useSwift ? placeSwiftOrder : signAndSubmitOrder} 
                    disabled={loading || !wallet.connected}
                    className="w-full"
                  >
                    {loading ? 'Processing...' : useSwift ? '🚀 Place Swift Order' : 'Place Order'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Order History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between">
                <span>Order History</span>
                <div className="flex gap-2">
                  <Button size="sm" onClick={cancelAllOrders} variant="destructive" disabled={loading}>
                    Cancel All
                  </Button>
                  <Button size="sm" onClick={loadOrderHistory}>
                    Refresh
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {orderHistory.length === 0 ? (
                <p className="text-gray-500">No orders yet</p>
              ) : (
                <div className="space-y-2">
                  {orderHistory.map((order, idx) => (
                    <div key={idx} className="p-2 border rounded text-sm">
                      <div className="flex justify-between">
                        <span>{order.market} - {order.direction}</span>
                        <Badge>{order.status}</Badge>
                      </div>
                      <p className="text-xs text-gray-500">
                        Size: {order.size} | Price: {order.price || 'Market'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Positions Tab */}
        <TabsContent value="positions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between">
                <span>Open Positions</span>
                <Button size="sm" onClick={loadPositions}>
                  Refresh
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {positions.length === 0 ? (
                <p className="text-gray-500">No open positions</p>
              ) : (
                <div className="space-y-3">
                  {positions.map((position) => (
                    <div key={position.marketIndex} className="p-4 border rounded">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium">{position.marketName}</h4>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => closePosition(position.marketIndex)}
                        >
                          Close Position
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-600">Size:</span>{' '}
                          {formatBaseAmount(position.baseAssetAmount)}
                        </div>
                        <div>
                          <span className="text-gray-600">Entry:</span> ${position.entryPrice}
                        </div>
                        <div>
                          <span className="text-gray-600">Mark:</span> ${position.markPrice}
                        </div>
                        <div>
                          <span className="text-gray-600">PnL:</span>{' '}
                          <span className={parseFloat(position.pnl) >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatUSDC(position.pnl)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Markets Tab */}
        <TabsContent value="markets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between">
                <span>Markets</span>
                <Button size="sm" onClick={loadMarkets}>
                  Refresh
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {markets.length === 0 ? (
                <p className="text-gray-500">Loading markets...</p>
              ) : (
                <div className="grid gap-3">
                  {markets.map((market) => (
                    <div key={market.marketIndex} className="p-3 border rounded">
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium">{market.symbol}</h4>
                        <span className="text-lg font-mono">${market.markPrice}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mt-2">
                        <div>Funding: {(parseFloat(market.funding) * 100).toFixed(4)}%</div>
                        <div>24h Vol: {formatUSDC(market.volume24h)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stats Tab */}
        <TabsContent value="stats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between">
                <span>User Statistics</span>
                <Button size="sm" onClick={loadUserStats}>
                  Refresh
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!account ? (
                <p className="text-gray-500">Please select an account first</p>
              ) : !userStats ? (
                <p className="text-gray-500">Click refresh to load stats</p>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 border rounded">
                      <p className="text-sm text-gray-600">Total Value</p>
                      <p className="text-lg font-medium">
                        {formatUSDC(userStats.totalValue || '0')}
                      </p>
                    </div>
                    <div className="p-3 border rounded">
                      <p className="text-sm text-gray-600">Free Collateral</p>
                      <p className="text-lg font-medium">
                        {formatUSDC(userStats.freeCollateral || '0')}
                      </p>
                    </div>
                    <div className="p-3 border rounded">
                      <p className="text-sm text-gray-600">Unrealized PnL</p>
                      <p className={`text-lg font-medium ${
                        parseFloat(userStats.unrealizedPnl || '0') >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatUSDC(userStats.unrealizedPnl || '0')}
                      </p>
                    </div>
                    <div className="p-3 border rounded">
                      <p className="text-sm text-gray-600">Margin Ratio</p>
                      <p className="text-lg font-medium">
                        {userStats.marginRatio ? `${(parseFloat(userStats.marginRatio) * 100).toFixed(2)}%` : 'N/A'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Raw stats data */}
                  <details>
                    <summary className="cursor-pointer text-sm text-gray-600">Raw Data</summary>
                    <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                      {JSON.stringify(userStats, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Success Display */}
      {success && (
        <Alert className="border-green-500 bg-green-50">
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Error Display */}
      {(error || authError) && (
        <Alert variant="destructive">
          <AlertDescription>{error || authError}</AlertDescription>
        </Alert>
      )}

      {/* Debug Output */}
      {output && (
        <Card>
          <CardHeader>
            <CardTitle>API Response</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 p-4 rounded text-sm max-h-96 overflow-auto">
              {JSON.stringify(output, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
};