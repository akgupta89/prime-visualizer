import PostponedSieve from 'fast-prime-gen';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import PrimeControls from './PrimeControls';
import PrimeVisualization, { PredictionAccuracy } from './PrimeVisualization';

interface ThreeGridProps {
  width: number;
  height: number;
}

const ThreeGrid: React.FC<ThreeGridProps> = ({ width, height }) => {
  const [primeCount, setPrimeCount] = useState(300);
  const [isLoading, setIsLoading] = useState(true);
  const [position, setPosition] = useState<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 20 });
  const [, setZoom] = useState(1);
  const [angleDelta, setAngleDelta] = useState(36);
  const [showConnector, setShowConnector] = useState(false);
  const [showPredictions, setShowPredictions] = useState(false);
  const [predictionCount, setPredictionCount] = useState(3);
  const [primes, setPrimes] = useState<number[]>([]);
  const controlsRef = useRef<OrbitControls | null>(null);
  const accuracyRef = useRef<PredictionAccuracy | null>(null);
  
  useEffect(() => {
    const sieve = PostponedSieve();
    
    const newPrimes: number[] = [];
    for (let i = 0; i < primeCount; i++) {
      const next = sieve.next();
      if (next.done) break;
      newPrimes.push(next.value);
    }
    setPrimes(newPrimes);
    setIsLoading(false);
  }, [primeCount]);

  // Handle prime count change
  const handlePrimeCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0 && value <= 100000) {
      setPrimeCount(value);
    }
  };

  const handleAngleDeltaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value > 0 && value < 180) {
      setAngleDelta(value);
    }
  };

  const handleResetCamera = () => {
    setPosition({ x: 0, y: 0, z: 20 });
    setZoom(1);
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  };

  // Handle connector toggle
  const handleToggleConnector = (e: React.ChangeEvent<HTMLInputElement>) => {
    setShowConnector(e.target.checked);
  };

  // Handle predictions toggle
  const handleTogglePredictions = (e: React.ChangeEvent<HTMLInputElement>) => {
    setShowPredictions(e.target.checked);
  };

  // Handle prediction count change
  const handlePredictionCountChange = (e: React.ChangeEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    const value = parseInt(target.value);
    if (!isNaN(value) && value >= 1 && value <= 20) {
      setPredictionCount(value);
    }
  };

  // Handle accuracy updates from visualization
  const handleAccuracyUpdate = useCallback((accuracy: PredictionAccuracy) => {
    accuracyRef.current = accuracy;
  }, []);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex flex-col md:flex-row w-full h-full">
      <PrimeControls
        primeCount={primeCount}
        isLoading={isLoading}
        angleDelta={angleDelta}
        showConnector={showConnector}
        showPredictions={showPredictions}
        predictionCount={predictionCount}
        onPrimeCountChange={handlePrimeCountChange}
        onAngleDeltaChange={handleAngleDeltaChange}
        onPredictionCountChange={handlePredictionCountChange}
        onUpdatePrimes={(count) => setPrimeCount(count)}
        onResetCamera={handleResetCamera}
        onToggleConnector={handleToggleConnector}
        onTogglePredictions={handleTogglePredictions}
      />
      <PrimeVisualization
        width={width}
        height={height}
        primes={primes}
        angleDelta={angleDelta}
        showConnector={showConnector}
        showPredictions={showPredictions}
        predictionCount={predictionCount}
        setPosition={setPosition}
        setZoom={setZoom}
        position={position}
        onAccuracyUpdate={handleAccuracyUpdate}
      />
    </div>
  );
};

export default ThreeGrid; 