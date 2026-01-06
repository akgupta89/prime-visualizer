import React, { useEffect, useState } from 'react';

interface PrimeControlsProps {
  primeCount: number;
  isLoading: boolean;
  angleDelta: number;
  showConnector: boolean;
  showPredictions: boolean;
  onPrimeCountChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAngleDeltaChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUpdatePrimes: (count: number) => void;
  onResetCamera: () => void;
  onToggleConnector: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTogglePredictions: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const PrimeControls: React.FC<PrimeControlsProps> = ({
  primeCount,
  isLoading,
  angleDelta,
  showConnector,
  showPredictions,
  onPrimeCountChange,
  onAngleDeltaChange,
  onUpdatePrimes,
  onResetCamera,
  onToggleConnector,
  onTogglePredictions
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Handle key press in the input field
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading) {
      onUpdatePrimes(primeCount);
    }
  };

  // Handle touch events for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    // Only handle touch events if the drawer is open
    if (isOpen) {
      e.stopPropagation();
      setTouchStart(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Only handle touch events if the drawer is open
    if (isOpen) {
      e.stopPropagation();
      setTouchEnd(e.touches[0].clientY);
    }
  };

  const handleTouchEnd = () => {
    if (isOpen && touchStart && touchEnd) {
      const diff = touchStart - touchEnd;
      if (Math.abs(diff) > 50) { // Minimum swipe distance
        if (diff > 0 && !isOpen) {
          setIsOpen(true);
        } else if (diff < 0 && isOpen) {
          setIsOpen(false);
        }
      }
      setTouchStart(null);
      setTouchEnd(null);
    }
  };

  // Close drawer when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const drawer = document.getElementById('prime-controls-drawer');
      if (drawer && !drawer.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDrawer = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
      {/* Controls Drawer */}
      <div 
        id="prime-controls-drawer"
        className={`fixed md:absolute bottom-0 left-0 right-0 md:left-4 md:bottom-4 md:w-80 bg-white rounded-t-2xl md:rounded-lg shadow-lg transition-transform duration-300 ease-in-out pointer-events-auto
          ${isOpen ? 'translate-y-0' : 'translate-y-[calc(100%-2rem)] md:translate-y-0'}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drawer Handle */}
        <div 
          className="md:hidden h-8 flex items-center justify-center border-b border-gray-200 cursor-pointer"
          onClick={toggleDrawer}
        >
          <svg 
            className={`w-6 h-6 text-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M5 15l7-7 7 7" 
            />
          </svg>
        </div>

        <div className="p-4">
          <div className="flex flex-col space-y-4">
            <div className="relative">
              <label htmlFor="primeCount" className="absolute -top-2 left-2 bg-white px-1 text-xs text-gray-600">
                Number of Primes
              </label>
              <input
                id="primeCount"
                type="number"
                min="10"
                max="100000"
                value={primeCount}
                onChange={onPrimeCountChange}
                onBlur={() => onUpdatePrimes(primeCount)}
                onKeyDown={handleKeyDown}
                className="w-full px-3 py-2 border text-black border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 pt-3"
                disabled={isLoading}
              />
            </div>
            
            <div className="relative">
              <label htmlFor="angleDelta" className="absolute -top-2 left-2 bg-white px-1 text-xs text-gray-600">
                Angle Delta (degrees)
              </label>
              <input
                id="angleDelta"
                type="number"
                min="0.1"
                max="179.9"
                step="0.1"
                value={angleDelta}
                onChange={onAngleDeltaChange}
                className="w-full px-3 py-2 border text-black border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 pt-3"
                disabled={isLoading}
              />
            </div>

            <div className="flex items-center mt-2">
              <input
                id="showConnector"
                type="checkbox"
                onChange={onToggleConnector}
                checked={showConnector}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                disabled={isLoading}
              />
              <label htmlFor="showConnector" className="ml-2 block text-sm text-gray-900">
                Link Primes
              </label>
            </div>

            <div className="flex items-center mt-2">
              <input
                id="showPredictions"
                type="checkbox"
                onChange={onTogglePredictions}
                checked={showPredictions}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                disabled={isLoading}
              />
              <label htmlFor="showPredictions" className="ml-2 block text-sm text-gray-900">
                Show Spiral Arm Predictions
              </label>
            </div>

            <div className="flex flex-col space-y-2">
              <button
                onClick={onResetCamera}
                disabled={isLoading}
                className="w-full px-4 py-2 bg-gray-500 text-white rounded-md shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
              >
                Reset Camera
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrimeControls; 