"use client"

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

// Import ThreeGrid dynamically to avoid SSR issues
const ThreeGrid = dynamic(() => import('../components/ThreeGrid'), {
  ssr: false,
});

export default function Home() {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Update dimensions on window resize
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    // Set initial dimensions
    updateDimensions();

    // Add event listener
    window.addEventListener('resize', updateDimensions);

    // Clean up
    return () => {
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  return (
    <main className="w-screen h-screen overflow-hidden">
      <h1 className="sr-only">Prime Visualizer — interactive 3D prime number spiral</h1>
      {dimensions.width > 0 && dimensions.height > 0 && (
        <ThreeGrid width={dimensions.width} height={dimensions.height} />
      )}
    </main>
  );
}