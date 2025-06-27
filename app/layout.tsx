// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { WebSocketProvider } from "@/contexts/WebSocketProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DEX Funding Rate Dashboard",
  description:
    "Compare and analyze funding rates across top decentralized exchanges like Drift, Hyperliquid, and more. Cross-chain, cross-DEX analytics built for traders and DeFi researchers.",
  keywords: [
    "DEX funding rates",
    "Crypto funding rate dashboard",
    "Cross-chain analytics",
    "Cross-DEX funding rates",
    "Drift funding rate",
    "Hyperliquid funding",
    "DeFi analytics",
    "Funding rate arbitrage",
    "Funding rate comparison",
    "Delta-neutral strategy",
  ],
  metadataBase: new URL("https://dex-funding-dashboard.vercel.app"),
  openGraph: {
    title: "DEX Funding Rate Dashboard",
    description:
      "Cross-DEX, cross-chain funding rate analytics for advanced DeFi strategies. Analyze, compare, and uncover funding rate arbitrage opportunities.",
    url: "https://dex-funding-dashboard.vercel.app",
    siteName: "DEX Funding Dashboard",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "DEX Funding Rate Dashboard",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DEX Funding Rate Dashboard",
    description:
      "Visualize funding rate trends across DeFi exchanges. Support for Drift, Hyperliquid, and more coming soon.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <WebSocketProvider>
          {children}
        </WebSocketProvider>
      </body>
    </html>
  );
}