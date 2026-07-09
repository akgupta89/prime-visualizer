import React, { useMemo } from 'react';
import { ColorMode, Theme, legendStops, twinCssColor } from '../../lib/colors';
import { LABEL, MUTED, PANEL } from '../ui/primitives';

interface LegendProps {
  colorMode: ColorMode;
  theme: Theme;
  primes: number[];
  stepsPerRotation: number;
}

const TITLES: Record<ColorMode, string> = {
  arm: 'color · spiral arm',
  gap: 'color · gap to next prime',
  sequence: 'color · sequence position',
};

// Bound to the active color mode — the mapping IS the science.
const Legend: React.FC<LegendProps> = ({ colorMode, theme, primes, stepsPerRotation }) => {
  const gradient = useMemo(
    () => `linear-gradient(to right, ${legendStops(colorMode, theme).join(', ')})`,
    [colorMode, theme]
  );

  const maxGap = useMemo(() => {
    let m = 2;
    for (let i = 0; i < primes.length - 1; i++) m = Math.max(m, primes[i + 1] - primes[i]);
    return m;
  }, [primes]);

  if (primes.length < 3) return null;

  return (
    <div className={`${PANEL} pointer-events-auto absolute bottom-4 right-4 z-20 hidden w-52 p-3 md:block`}>
      <div className={`${LABEL} mb-2`}>{TITLES[colorMode]}</div>
      <div className="h-2 w-full rounded-full" style={{ background: gradient }} />
      <div className={`mt-1 flex justify-between font-mono text-[10px] tabular-nums ${MUTED}`}>
        {colorMode === 'arm' && (
          <>
            <span>arm 0</span>
            <span>arm {stepsPerRotation - 1}</span>
          </>
        )}
        {colorMode === 'gap' && (
          <>
            <span>2</span>
            <span>{maxGap}</span>
          </>
        )}
        {colorMode === 'sequence' && (
          <>
            <span>{primes[0]}</span>
            <span>{primes[primes.length - 1].toLocaleString('en-US')}</span>
          </>
        )}
      </div>
      {colorMode === 'gap' && (
        <div className={`mt-1.5 flex items-center gap-1.5 text-[10px] ${MUTED}`}>
          <span className="h-2 w-2 rounded-full" style={{ background: twinCssColor(theme) }} />
          <span>twin prime (gap 2)</span>
        </div>
      )}
      {colorMode === 'arm' && (
        <div className={`mt-1.5 text-[10px] ${MUTED}`}>hue = index mod {stepsPerRotation}</div>
      )}
    </div>
  );
};

export default Legend;
