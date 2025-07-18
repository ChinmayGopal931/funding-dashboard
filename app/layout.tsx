"use client";

import { useState } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { WebSocketProvider } from "@/contexts/WebSocketProvider";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { config } from "@/lib/wagmi";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import {
  WalletModalProvider,
} from '@solana/wallet-adapter-react-ui';

import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { clusterApiUrl } from '@solana/web3.js';

import "./globals.css";
import '@rainbow-me/rainbowkit/styles.css';
import '@solana/wallet-adapter-react-ui/styles.css';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  url: "https://dex-funding-dashboard.vercel.app",
  name: "DEX Funding Rate Dashboard",
  description:
    "Cross-DEX funding rate analytics dashboard for DeFi traders and researchers",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate:
        "https://dex-funding-dashboard.vercel.app/?search={search_term_string}",
    },
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 30,
        gcTime: 1000 * 60 * 5,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: (failureCount, error: Error) => {
          if ('status' in error && typeof error.status === 'number' && error.status >= 400 && error.status < 500) {
            return false;
          }
          return failureCount < 3;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        networkMode: 'online',
      },
      mutations: {
        retry: false,
        networkMode: 'online',
        onError: (error) => {
          console.error('Mutation failed:', error);
        },
      },
    },
  }));

  const endpoint = clusterApiUrl('devnet'); // or use your custom Solana RPC
  const wallets = [new PhantomWalletAdapter()];

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <RainbowKitProvider>
              <ConnectionProvider endpoint={endpoint}>
                {/* <WalletProvider wallets={wallets} autoConnect> */}
                  <WalletModalProvider>
                    {children}
                  </WalletModalProvider>
                {/* </WalletProvider> */}
              </ConnectionProvider>
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </body>
    </html>
  );
}
