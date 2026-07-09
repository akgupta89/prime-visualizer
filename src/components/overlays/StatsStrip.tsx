import React, { useMemo } from 'react';
import { LABEL, PANEL, VALUE } from '../ui/primitives';

const fmt = (n: number) => n.toLocaleString('en-US');

const Stat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex shrink-0 flex-col">
    <span className={LABEL}>{label}</span>
    <span className={VALUE}>{value}</span>
  </div>
);

// Always-visible readout: the screen should answer the basic questions at a glance.
const StatsStrip: React.FC<{ primes: number[]; isComputing: boolean }> = ({ primes, isComputing }) => {
  const stats = useMemo(() => {
    const n = primes.length;
    if (n < 3) return null;
    let maxGap = 0;
    let twins = 0;
    for (let i = 0; i < n - 1; i++) {
      const g = primes[i + 1] - primes[i];
      if (g > maxGap) maxGap = g;
      if (g === 2) twins++;
    }
    const largest = primes[n - 1];
    return {
      n,
      largest,
      maxGap,
      twins,
      meanGap: (largest - 2) / (n - 1),
      lnP: Math.log(largest),
    };
  }, [primes]);

  if (!stats) return null;

  return (
    <div
      className={`${PANEL} pointer-events-auto absolute left-4 top-4 z-20 flex max-w-[calc(100%-2rem)] items-center gap-5 overflow-x-auto px-4 py-2 md:left-[20rem]`}
    >
      <Stat label="primes" value={fmt(stats.n)} />
      <Stat label="largest" value={fmt(stats.largest)} />
      <Stat label="max gap" value={stats.maxGap} />
      <Stat label="twins" value={fmt(stats.twins)} />
      <div className="hidden md:block">
        <Stat label="mean gap / ln p" value={`${stats.meanGap.toFixed(1)} / ${stats.lnP.toFixed(1)}`} />
      </div>
      {isComputing && (
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          <span className="text-xs text-gray-500 dark:text-slate-400">sieving…</span>
        </div>
      )}
    </div>
  );
};

export default StatsStrip;
