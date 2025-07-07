import { Wallet } from '@drift-labs/sdk';
import { WalletContextState } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';

/**
 * Creates a Drift SDK compatible wallet from a Solana wallet adapter
 */
export class DriftWalletAdapter implements Wallet {
  private walletAdapter: WalletContextState;

  constructor(walletAdapter: WalletContextState) {
    this.walletAdapter = walletAdapter;
  }

  get publicKey(): PublicKey {
    if (!this.walletAdapter.publicKey) {
      throw new Error('Wallet not connected');
    }
    return this.walletAdapter.publicKey;
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    if (!this.walletAdapter.signTransaction) {
      throw new Error('Wallet does not support transaction signing');
    }
    return await this.walletAdapter.signTransaction(tx);
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
    if (!this.walletAdapter.signAllTransactions) {
      throw new Error('Wallet does not support signing multiple transactions');
    }
    return await this.walletAdapter.signAllTransactions(txs);
  }

  get connected(): boolean {
    return this.walletAdapter.connected;
  }
}