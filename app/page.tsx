"use client"
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Menu, 
  Coins,
  ChevronLeft,
  ArrowLeftRight
} from 'lucide-react';
import FundingRatesChart from '@/components/HyperliquidFundingChart';
import DriftFundingRatesChart from '@/components/DriftFundingChart';
import ZkLighterMultiFundingChart from '@/components/LighterRateChart';
import FundingArbitrageDashboard from '@/components/Arbitrage/ComparisonTable';
import ParadexFundingChart from '@/components/ParadexFundingChart';

// Rest of your code remains the same

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  component: React.ReactNode;
  description: string;
}

const navigationItems: NavItem[] = [
  // {
  //   id: 'arbitrage',
  //   label: 'Arbitrage Scanner',
  //   icon: <ArrowLeftRight className="h-5 w-5" />,
  //   component: <FundingArbitrageWithDetails />,
  //   description: 'Find cross-exchange and spot+perp arbitrage opportunities'
  // },
  {
    id: 'arbitrage',
    label: 'Arbitrage Scanner',
    icon: <ArrowLeftRight className="h-5 w-5" />,
    component: <FundingArbitrageDashboard/>,
    description: 'Find cross-exchange arbitrage opportunities'
  },
  {
    id: 'hyperliquid',
    label: 'Hyperliquid Charts',
    icon: <img src="/assets/hyperliquid.svg" alt="Hyperliquid" className="h-5 w-5" />,
    component: <FundingRatesChart />,
    description: 'Hyperliquid historical funding rates'
  },
  {
    id: 'drift',
    label: 'Drift Charts',
    icon: <img src="/assets/drift.svg" alt="Drift" className="h-5 w-5" />,
    component: <DriftFundingRatesChart/>,
    description: 'Drift historical funding rates'
  },
  {
    id: 'lighter',
    label: 'Lighter Charts',
    icon: <img src="/assets/lighter-color.svg" alt="Lighter" className="h-5 w-5" />,
    component: <ZkLighterMultiFundingChart/>,
    description: 'Lighter historical funding rates'
  },
  {
    id: 'paradex',
    label: 'Paradex Charts',
    icon: <img src="/assets/paradex.svg" alt="Paradex" className="h-5 w-5" />,
    component: <ParadexFundingChart/>,
    description: 'Paradex historical funding rates'
  },

];

export default function FundingDashboard() {
  const [activeView, setActiveView] = useState('arbitrage');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const activeItem = navigationItems.find(item => item.id === activeView);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className={`bg-white shadow-lg transition-all duration-300 ${
        sidebarOpen ? 'w-64' : 'w-16'
      } flex flex-col border-r border-gray-200`}>
        
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg text-gray-900">Funding Scan</h1>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5"
            >
              {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-2">
          <div className="space-y-1">
            {navigationItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  activeView === item.id
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <div className={`flex-shrink-0 ${
                  activeView === item.id ? 'text-blue-600' : 'text-gray-400'
                }`}>
                  {item.icon}
                </div>
                {sidebarOpen && (
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {item.label}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {item.description}
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </nav>

        {/* Sidebar Footer */}
        {sidebarOpen && (
          <div className="p-4 border-t border-gray-200">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Coins className="h-4 w-4 text-gray-500" />
                <span className="text-xs font-medium text-gray-700">Live Data</span>
              </div>
              <p className="text-xs text-gray-500">
                Real-time funding rates from Drift & Hyperliquid
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Bar */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                {activeItem?.icon}
                {activeItem?.label}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {activeItem?.description}
              </p>
            </div>
            

          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-full">
            {activeItem?.component}
          </div>
        </main>
      </div>
    </div>
  );
}