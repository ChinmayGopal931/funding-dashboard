interface WalletAuthResponse {
  user: {
    id: string;
    email: string;
    telegramId?: string;
  };
  dexAccount: {
    id: string;
    userId: string;
    dex: string;
    accountType: string;
    address: string;
    status: string;
  };
  isNewUser?: boolean;
}

class AuthService {
  private baseURL = 'http://localhost:3000/api/auth';
  
  async authenticateWithWallet(
    walletAddress: string,
    dex: 'hyperliquid' | 'drift',
    email?: string
  ): Promise<WalletAuthResponse> {
    try {
      const response = await fetch(`${this.baseURL}/wallet-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, dex, email })
      });
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Server error: Expected JSON response but got ${contentType}`);
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `Authentication failed: ${response.status}`);
      }
      
      return data;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error('Cannot connect to server. Is it running on port 3000?');
      }
      throw error;
    }
  }
  
  async getUserByWallet(
    walletAddress: string,
    dex?: string
  ): Promise<WalletAuthResponse | null> {
    try {
      const params = new URLSearchParams();
      if (dex) params.append('dex', dex);
      
      const response = await fetch(
        `${this.baseURL}/wallet/${walletAddress}?${params}`
      );
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        if (response.status === 404) {
          return null; // User not found is expected
        }
        throw new Error(`Server error: Expected JSON response but got ${contentType}`);
      }
      
      if (response.status === 404) {
        return null;
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `Failed to fetch user: ${response.status}`);
      }
      
      return data;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error('Cannot connect to server. Is it running on port 3000?');
      }
      throw error;
    }
  }
  
  async linkWallet(
    userId: string,
    walletAddress: string,
    dex: 'hyperliquid' | 'drift'
  ): Promise<WalletAuthResponse> {
    const response = await fetch(`${this.baseURL}/link-wallet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, walletAddress, dex })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to link wallet');
    }
    
    return response.json();
  }
}

export const authService = new AuthService();
export type { WalletAuthResponse };