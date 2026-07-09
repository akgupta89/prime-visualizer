import React, { useEffect, useMemo, useRef, useState } from 'react';
import { firstPrimes } from '../lib/primes';
import { ColorMode, HighlightSpec, Theme } from '../lib/colors';
import { armStructure, CustomFormulas, DEFAULT_CUSTOM, Layout } from '../lib/arms';
import Sidebar, { Residue } from './Sidebar';
import StatsStrip from './overlays/StatsStrip';
import Legend from './overlays/Legend';
import ViewControls from './overlays/ViewControls';
import PrimeVisualization, { PrimeVizHandle } from './PrimeVisualization';

interface ThreeGridProps {
  width: number;
  height: number;
}

const ThreeGrid: React.FC<ThreeGridProps> = ({ width, height }) => {
  const [primeCount, setPrimeCount] = useState(300);
  const [isComputing, setIsComputing] = useState(true);
  const [position, setPosition] = useState<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 20 });
  const [angleDelta, setAngleDelta] = useState(36);
  const [showConnector, setShowConnector] = useState(false);
  const [showPredictions, setShowPredictions] = useState(false);
  const [predictionCount, setPredictionCount] = useState(3);
  const [legacyArms, setLegacyArms] = useState(false);
  const [is2D, setIs2D] = useState(false);
  const [theme, setTheme] = useState<Theme>('dark');
  const [colorMode, setColorMode] = useState<ColorMode>('arm');
  const [layout, setLayout] = useState<Layout>('classic');
  const [twinSpotlight, setTwinSpotlight] = useState(false);
  const [residue, setResidue] = useState<Residue | null>(null);
  const [fibLens, setFibLens] = useState(false);
  const [fibChords, setFibChords] = useState(false);
  const [fibLag, setFibLag] = useState(8);
  const [customFormulas, setCustomFormulas] = useState<CustomFormulas>(DEFAULT_CUSTOM);
  const [showModelCurve, setShowModelCurve] = useState(false);
  const [primes, setPrimes] = useState<number[]>([]);
  const vizRef = useRef<PrimeVizHandle>(null);

  // Sieve off the current tick so the busy chip can paint first
  useEffect(() => {
    setIsComputing(true);
    const id = setTimeout(() => {
      setPrimes(firstPrimes(primeCount));
      setIsComputing(false);
    }, 0);
    return () => clearTimeout(id);
  }, [primeCount]);

  // Twin spotlight, residue filter, and Fibonacci lens are mutually exclusive
  const handleTwinSpotlight = (on: boolean) => {
    setTwinSpotlight(on);
    if (on) {
      setResidue(null);
      setFibLens(false);
    }
  };
  const handleResidue = (r: Residue | null) => {
    setResidue(r);
    if (r) {
      setTwinSpotlight(false);
      setFibLens(false);
    }
  };
  const handleFibLens = (on: boolean) => {
    setFibLens(on);
    if (on) {
      setTwinSpotlight(false);
      setResidue(null);
    }
  };

  const highlight = useMemo<HighlightSpec>(() => {
    if (residue) return { type: 'residue', q: residue.q, a: residue.a };
    if (twinSpotlight) return { type: 'twins' };
    if (fibLens) return { type: 'fibonacci' };
    return { type: 'none' };
  }, [residue, twinSpotlight, fibLens]);

  // Same arm structure the visualization uses, so the legend's "index mod N"
  // matches the hues actually drawn
  const stepsPerRotation =
    armStructure(angleDelta, primes.length, legacyArms)?.period ?? Math.max(1, Math.round(360 / angleDelta));

  return (
    <div
      data-theme={theme}
      className={`relative h-full w-full ${theme === 'dark' ? 'bg-[#050810]' : 'bg-[#f4f6f8]'}`}
    >
      <PrimeVisualization
        ref={vizRef}
        width={width}
        height={height}
        primes={primes}
        angleDelta={angleDelta}
        showConnector={showConnector}
        showPredictions={showPredictions}
        predictionCount={predictionCount}
        legacyArms={legacyArms}
        is2D={is2D}
        theme={theme}
        colorMode={colorMode}
        layout={layout}
        highlight={highlight}
        showModelCurve={showModelCurve}
        fibChords={fibChords}
        fibLag={fibLag}
        customFormulas={customFormulas}
        position={position}
      />
      <StatsStrip primes={primes} isComputing={isComputing} />
      <ViewControls
        is2D={is2D}
        onToggle2D={() => setIs2D(v => !v)}
        onResetCamera={() => setPosition({ x: 0, y: 0, z: 20 })}
      />
      <Legend colorMode={colorMode} theme={theme} primes={primes} stepsPerRotation={stepsPerRotation} />
      <Sidebar
        primeCount={primeCount}
        isComputing={isComputing}
        angleDelta={angleDelta}
        showConnector={showConnector}
        showPredictions={showPredictions}
        predictionCount={predictionCount}
        legacyArms={legacyArms}
        theme={theme}
        colorMode={colorMode}
        layout={layout}
        twinSpotlight={twinSpotlight}
        residue={residue}
        fibLens={fibLens}
        fibChords={fibChords}
        fibLag={fibLag}
        showModelCurve={showModelCurve}
        customFormulas={customFormulas}
        onPrimeCountCommit={setPrimeCount}
        onAngleDeltaChange={setAngleDelta}
        onPredictionCountChange={setPredictionCount}
        onToggleConnector={setShowConnector}
        onTogglePredictions={setShowPredictions}
        onLegacyArmsChange={setLegacyArms}
        onToggleTheme={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
        onColorModeChange={setColorMode}
        onLayoutChange={setLayout}
        onTwinSpotlightChange={handleTwinSpotlight}
        onResidueChange={handleResidue}
        onFibLensChange={handleFibLens}
        onFibChordsChange={setFibChords}
        onFibLagChange={setFibLag}
        onModelCurveChange={setShowModelCurve}
        onCustomFormulasChange={setCustomFormulas}
        onExport={() => vizRef.current?.exportPNG()}
      />
    </div>
  );
};

export default ThreeGrid;
