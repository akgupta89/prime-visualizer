import React from 'react';
import { LABEL, MUTED, PANEL, VALUE } from '../ui/primitives';

interface InspectorCardProps {
  index: number;
  primes: number[];
  stepsPerRotation: number;
  smooth: (j: number) => number;
  onClose: () => void;
}

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-baseline justify-between gap-4">
    <span className={`text-xs ${MUTED}`}>{label}</span>
    <span className={VALUE}>{children}</span>
  </div>
);

// Pinned by clicking a prime; the prime's whole arm is highlighted while open.
const InspectorCard: React.FC<InspectorCardProps> = ({ index, primes, stepsPerRotation, smooth, onClose }) => {
  const prime = primes[index];
  if (prime === undefined) return null;

  const gapPrev = index > 0 ? prime - primes[index - 1] : null;
  const gapNext = index < primes.length - 1 ? primes[index + 1] - prime : null;
  const deviation = (prime / smooth(index) - 1) * 100;

  return (
    <div
      className={`${PANEL} pointer-events-auto absolute inset-x-2 bottom-2 z-30 p-3 md:inset-x-auto md:bottom-4 md:right-[14.5rem] md:w-52`}
    >
      <div className="mb-1 flex items-start justify-between">
        <span className={LABEL}>pinned prime</span>
        <button
          onClick={onClose}
          title="Release (Esc)"
          className={`-mr-1 -mt-1 rounded px-1.5 text-sm leading-none transition-colors duration-150 hover:bg-black/10 dark:hover:bg-white/10 ${MUTED}`}
        >
          ×
        </button>
      </div>
      <div className="mb-2 font-mono text-base font-semibold tabular-nums">{prime.toLocaleString('en-US')}</div>
      <div className="flex flex-col gap-1">
        <Row label="index">{index}</Row>
        <Row label="gap prev / next">
          {gapPrev ?? '—'} / {gapNext ?? '—'}
        </Row>
        <Row label="arm">{index % stepsPerRotation}</Row>
        <Row label="vs R-curve">
          {deviation >= 0 ? '+' : ''}
          {deviation.toFixed(2)}%
        </Row>
      </div>
    </div>
  );
};

export default InspectorCard;
