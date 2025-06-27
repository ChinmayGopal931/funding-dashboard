// components/PerformanceMonitor.tsx
"use client"

import { useEffect, useRef } from 'react';

interface PerformanceMonitorProps {
  componentName: string;
  showInProduction?: boolean;
}

export function PerformanceMonitor({ 
  componentName, 
  showInProduction = false 
}: PerformanceMonitorProps) {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(Date.now());
  
  useEffect(() => {
    renderCount.current += 1;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTime.current;
    lastRenderTime.current = now;
    
    if (process.env.NODE_ENV === 'development' || showInProduction) {
      console.log(
        `[${componentName}] Render #${renderCount.current} | ` +
        `Time since last: ${timeSinceLastRender}ms`
      );
    }
  });
  
  return null;
}

// Hook version for easier integration
export function useRenderMonitor(componentName: string) {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(Date.now());
  
  useEffect(() => {
    renderCount.current += 1;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTime.current;
    lastRenderTime.current = now;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[${componentName}] Render #${renderCount.current} | ` +
        `Time since last: ${timeSinceLastRender}ms | ` +
        `Total renders: ${renderCount.current}`
      );
    }
  });
  
  return {
    renderCount: renderCount.current,
    lastRenderTime: lastRenderTime.current
  };
}