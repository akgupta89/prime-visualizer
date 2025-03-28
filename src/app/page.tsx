"use client"

import dynamic from 'next/dynamic';
import Head from 'next/head';
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
    <>
      <Head>
        <title>Prime Number Spiral Visualizer</title>
        <meta name="description" content="Interactive 3D visualization of prime numbers in a spiral pattern" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </Head>
      
      <main className="w-screen h-screen overflow-hidden">
        {dimensions.width > 0 && dimensions.height > 0 && (
          <ThreeGrid width={dimensions.width} height={dimensions.height} />
        )}
      </main>
    </>
  );
}