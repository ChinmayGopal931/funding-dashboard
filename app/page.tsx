"use client"
import Link from 'next/link';
import React, { useEffect } from 'react';

// Google Fonts are added via style jsx

export default function LandingPage() {
  const videoRef = React.useRef<HTMLVideoElement>(null);

  // State to track video loading/error status
  const [videoStatus, setVideoStatus] = React.useState({
    isLoading: true,
    hasError: false,
    errorMessage: ''
  });

  // Use a state to track whether we're on the client side
  const [isMounted, setIsMounted] = React.useState(false);
  
  // First effect just to mark component as mounted (client-side only)
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Apply overflow hidden to body and html when component mounts and play video
  // Only run this effect after initial client-side hydration is complete
  useEffect(() => {
    if (!isMounted) return;
    
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    
    // Explicitly play the video if it exists
    if (videoRef.current) {
      console.log('Attempting to play video...');
      // Add event listeners for debugging
      const video = videoRef.current;
      
      const onCanPlay = () => {
        console.log('Video can play now!');
        setVideoStatus(prev => ({ ...prev, isLoading: false }));
        video.play()
          .then(() => console.log('Video playback started!'))
          .catch(error => {
            console.error('Error attempting to play video:', error);
            setVideoStatus({
              isLoading: false, 
              hasError: true,
              errorMessage: error.message
            });
          });
      };
      
      const onError = (e: Event) => {
        console.error('Video error:', e);
        setVideoStatus({
          isLoading: false,
          hasError: true,
          errorMessage: 'Failed to load video'
        });
      };
      
      video.addEventListener('canplay', onCanPlay);
      video.addEventListener('error', onError);
      
      // Some browsers need to load the video first
      video.load();
      
      return () => {
        video.removeEventListener('canplay', onCanPlay);
        video.removeEventListener('error', onError);
      };
    }
    
    // Cleanup function to reset overflow when component unmounts
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [isMounted]);

  return (
    <div className="relative min-h-screen h-screen w-screen overflow-hidden bg-black text-white">
      {/* Background with gradient fallback */}
      <div className="relative h-screen w-full" style={{ minHeight: '100vh' }}>
        {/* No gradient background - let video be fully visible */}
        
        {/* Debug info */}
        {videoStatus.hasError && (
          <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-red-400 p-4 z-[100] text-sm rounded">
            Video error: {videoStatus.errorMessage}
          </div>
        )}
        
        {/* Video background */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-contain z-[5] opacity-100"
          style={{ 
            minHeight: '100vh',
            backgroundColor: 'black' 
          }}
          autoPlay
          muted
          loop
          playsInline
          controls={false}
          preload="auto"
          disablePictureInPicture
        >
          <source src="/mosaic-butterfly-web.mp4" type="video/mp4" />
        </video>
        
        {/* No dark overlay to ensure video is fully visible */}
      </div>
      
      {/* Navbar */}
      <nav className="absolute top-0 inset-x-0 px-8 py-6 z-50 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 relative">
            <div className="w-4 h-4 absolute top-1 left-1 bg-white opacity-80 rotate-45"></div>
            <div className="w-2 h-2 absolute bottom-1 right-1 bg-white opacity-60"></div>
          </div>
          <span className="font-manrope text-sm font-normal">mosaic</span>
        </div>
        
        <div className="flex-1 flex justify-center space-x-12 font-manrope text-sm font-normal text-white/80">
          <a href="#" className="hover:text-white transition-colors">Origins</a>
          <a href="#" className="hover:text-white transition-colors">Records</a>
          <a href="#" className="hover:text-white transition-colors">Community</a>
        </div>
        
        <div className="font-manrope text-sm">
          <span className="flex items-center space-x-1 text-slate-300 cursor-pointer">
            <span>EN</span>
            <span className="text-xs">⌄</span>
          </span>
        </div>
      </nav>
      
      {/* Main Content */}
      <div className="absolute inset-0 flex">
        {/* Text Content - Left Side */}
        <div className="z-10 relative max-w-2xl px-8 pt-32 text-white flex-1 flex flex-col justify-center">
          <h1 className="font-libre-caslon text-6xl font-light tracking-tight leading-[1.1]">
            Mosaic: The Art of Balance
          </h1>
          <p className="mt-4 font-manrope text-base font-normal text-white/80">
            Where diverse chains converge and strategies align, creating harmony in motion.
          </p>
          <Link href="/dashboard">
            <button className="mt-6 bg-white text-black px-5 py-2 rounded-lg font-manrope text-sm font-medium hover:bg-gray-100 transition">
              Explore the Mosaic →
            </button>
          </Link>
        </div>
        
        {/* Decorative Right Side */}
        <div className="flex-1 relative">
          {/* Vertical Text */}
          <div className="absolute top-1/2 right-12 -translate-y-1/2 transform rotate-90 origin-right">
            <span className="font-manrope text-xs tracking-widest uppercase text-white/40">
              FIELD ENTRY CHAPTER ONE
            </span>
          </div>
          
          {/* Copyright Label */}
          <div className="absolute bottom-8 right-8">
            <span className="text-xs text-white/60">© Mosaic</span>
          </div>
        </div>
      </div>
      
      {/* Footer Label */}
      <div className="absolute bottom-8 left-8">
        <span className="text-xs text-white/50 font-manrope">✦ Founded in Balance, 2025</span>
      </div>
      
      {/* Font classes */}
      <style jsx global>{`        
        :root {
          --font-libre-caslon: 'Libre Caslon Text', serif;
          --font-manrope: 'Manrope', sans-serif;
        }
        
        .font-libre-caslon {
          font-family: var(--font-libre-caslon);
        }
        
        .font-manrope {
          font-family: var(--font-manrope);
        }
      `}</style>
    </div>
  );
}