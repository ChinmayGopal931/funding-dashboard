import { useState, useEffect } from 'react';
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { authService, WalletAuthResponse } from '@/lib/authService';

interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  dexAccountId: string | null;
  loading: boolean;
  error: string | null;
  authData: WalletAuthResponse | null;
}

export const useWalletAuth = (dex: 'hyperliquid' | 'drift' = 'drift') => {
  const solanaWallet = useSolanaWallet();
  
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    userId: null,
    dexAccountId: null,
    loading: false,
    error: null,
    authData: null
  });
  
  const [showEmailInput, setShowEmailInput] = useState(false);
  
  const walletAddress = solanaWallet.publicKey?.toBase58();
  
  useEffect(() => {
    if (walletAddress) {
      authenticateWallet();
    } else {
      setAuthState({
        isAuthenticated: false,
        userId: null,
        dexAccountId: null,
        loading: false,
        error: null,
        authData: null
      });
    }
  }, [walletAddress]);
  
  const authenticateWallet = async (email?: string) => {
    if (!walletAddress) return;
    
    setAuthState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      let authData;
      
      // If email is provided, try to authenticate/create user
      if (email) {
        authData = await authService.authenticateWithWallet(
          walletAddress,
          dex,
          email
        );
      } else {
        // First check if user exists
        authData = await authService.getUserByWallet(walletAddress, dex);
      }
      
      if (authData) {
        setAuthState({
          isAuthenticated: true,
          userId: authData.user.id,
          dexAccountId: authData.dexAccount.id,
          loading: false,
          error: null,
          authData
        });
        
        // Store in session/localStorage
        sessionStorage.setItem('userId', authData.user.id);
        sessionStorage.setItem('dexAccountId', authData.dexAccount.id);
        sessionStorage.setItem('walletAddress', walletAddress);
        
        setShowEmailInput(false);
      } else {
        // User not found, show email input
        setAuthState({
          isAuthenticated: false,
          userId: null,
          dexAccountId: null,
          loading: false,
          error: 'User not found. Please provide email to create account.',
          authData: null
        });
        setShowEmailInput(true);
      }
    } catch (error: any) {
      // Check if it's a 404 (user not found)
      if (error.message.includes('404') || error.message.includes('not found')) {
        setAuthState({
          isAuthenticated: false,
          userId: null,
          dexAccountId: null,
          loading: false,
          error: 'New wallet detected. Please provide email to create account.',
          authData: null
        });
        setShowEmailInput(true);
      } else {
        setAuthState({
          isAuthenticated: false,
          userId: null,
          dexAccountId: null,
          loading: false,
          error: error.message,
          authData: null
        });
      }
    }
  };
  
  const logout = () => {
    sessionStorage.removeItem('userId');
    sessionStorage.removeItem('dexAccountId');
    sessionStorage.removeItem('walletAddress');
    setAuthState({
      isAuthenticated: false,
      userId: null,
      dexAccountId: null,
      loading: false,
      error: null,
      authData: null
    });
  };
  
  return {
    ...authState,
    walletAddress,
    authenticateWallet,
    logout,
    isConnected: !!walletAddress,
    showEmailInput,
    setShowEmailInput
  };
};