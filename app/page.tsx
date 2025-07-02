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
  const [isContentVisible, setIsContentVisible] = React.useState(false);
  
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

  useEffect(() => {
    if (isMounted) {
        const timer = setTimeout(() => setIsContentVisible(true), 500); // Delay for entry animation
        return () => clearTimeout(timer);
    }
  }, [isMounted]);

  return (
    <div className="relative min-h-screen h-screen w-screen overflow-hidden bg-black text-white transition-all duration-300">
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
          className="absolute inset-0 w-full h-full object-cover z-[5] opacity-100"
          style={{ 
            minHeight: '100vh',
            minWidth: '100vw',
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

      </div>
      
      {/* Navbar */}
      <nav className="absolute top-0 inset-x-0 px-8 py-6 z-50 flex justify-between items-center backdrop-blur-md bg-black/10">
        <div className="flex items-center space-x-2 transition-opacity hover:opacity-80">
          <div className="h-8 relative">
            <img src="/butterfly-logo.png" alt="Mosaic Butterfly Logo" className="h-full" />
          </div>
          <span className="font-libre-caslon text-lg tracking-wide">mosaic</span>
        </div>
        
        <div className="flex-1 flex justify-center space-x-12 font-manrope text-sm font-normal text-white/80">
          <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-all duration-300 transform hover:-translate-y-px">
            Twitter
          </a>
          <a href="/docs" className="hover:text-white transition-all duration-300 transform hover:-translate-y-px">
            Docs
          </a>
        </div>
        
        {/* EN dropdown removed */}
      </nav>
      
      {/* Main Content */}
      <div className="absolute inset-0 flex">
        {/* Text Content - Left Side */}
        <div className="z-10 relative max-w-2xl px-8 pt-32 text-white flex-1 flex flex-col justify-center backdrop-blur-md bg-black/20 rounded-lg p-10 ml-4 md:ml-10 border border-white/10">
          <h1 className={`font-libre-caslon text-6xl font-light tracking-tight leading-tight transition-all duration-700 ease-out ${isContentVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            mosaic: Precision in Every Piece
          </h1>
          <p className={`mt-4 font-manrope text-base font-normal text-white/90 transition-all duration-700 ease-out delay-150 ${isContentVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            Delta-neutral strategies, seamlessly interlocked—like a mosaic—across chain and market.
          </p>
          <Link href="/dashboard" className={`transition-all duration-700 ease-out delay-300 ${isContentVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <button className="group mt-8 gradient-button px-7 py-4 rounded-lg font-manrope text-base font-semibold tracking-wide transition duration-300 transform hover:scale-105 relative overflow-hidden">
              <span className="relative z-10 flex items-center justify-center">
                Build Your Balance
                <svg className="ml-2 w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
              </span>
            </button>
          </Link>
        </div>
        
        {/* Decorative Right Side */}
        <div className="flex-1 relative">
          {/* Vertical Text */}
          <div className="absolute top-1/2 right-12 -translate-y-1/2 transform rotate-90 origin-right z-20">
            <span className="font-manrope text-xs tracking-widest uppercase font-bold text-white/80">
            SEAMLESS. BALANCED. PRECISE.
            </span>
          </div>
          
          {/* Copyright Label */}
          <div className="absolute bottom-8 right-8 backdrop-blur-sm bg-black/10 px-3 py-1 rounded-full">
            <span className="text-lg font-libre-caslon tracking-wide">mosaic</span>
          </div>
        </div>
      </div>
      
      {/* Footer Label */}
      <div className="absolute bottom-8 left-14 md:left-20 backdrop-blur-sm bg-black/10 px-3 py-1 rounded-full flex items-center space-x-4 z-20">
        <span className="text-xs text-white/60"> Mosaic</span>
        <span className="text-xs text-white/60">© Mosaic</span>
        <span className="text-xs text-white/50 font-manrope">✦ Founded in Balance, 2025</span>
      </div>
      
      {/* Font classes and mosaic button styles */}
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

        /* Gradient Button Styling */
        .gradient-button {
          background: linear-gradient(135deg, #a5c9fd, #c4a1ff, #ffacdc);
          background-size: 200% 200%;
          color: #333;
          position: relative;
          border: none;
          box-shadow: 0 4px 15px rgba(0,0,0,0.25), 0 0 20px rgba(196, 161, 255, 0.2);
          letter-spacing: 0.5px;
          font-weight: 600;
          transform: translateY(0);
          min-width: 200px;
          text-align: center;
          animation: gradient-shift 5s ease infinite;
        }

        .gradient-button:hover {
          background-size: 150% 150%;
          box-shadow: 0 6px 20px rgba(0,0,0,0.3), 0 0 30px rgba(196, 161, 255, 0.3);
          transform: translateY(-2px);
          animation: gradient-shift 3s ease infinite;
        }
        
        .gradient-button:active {
          transform: translateY(1px);
          box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        }

        @keyframes gradient-shift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
      `}</style>
    </div>
  );
}