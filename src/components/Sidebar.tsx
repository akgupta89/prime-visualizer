import React, { useEffect, useState } from 'react';
import { ColorMode, Theme } from '../lib/colors';
import { compileFormula, ArmCandidate, ArmStructure, CustomFormulas, CUSTOM_PRESETS, Layout, VALUE_LAYOUTS } from '../lib/arms';
import {
  ChipButton,
  FineSlider,
  HAIRLINE,
  LABEL,
  MUTED,
  NumberField,
  PANEL,
  PresetChips,
  Section,
  Segmented,
  Toggle,
} from './ui/primitives';

export interface Residue {
  q: number;
  a: number;
}

interface SidebarProps {
  primeCount: number;
  isComputing: boolean;
  angleDelta: number;
  showConnector: boolean;
  showPredictions: boolean;
  predictionCount: number;
  theme: Theme;
  colorMode: ColorMode;
  layout: Layout;
  twinSpotlight: boolean;
  residue: Residue | null;
  fibLens: boolean;
  fibChords: boolean;
  fibLag: number;
  showModelCurve: boolean;
  customFormulas: CustomFormulas;
  candidates: ArmCandidate[];
  armFamily: number | null;
  onArmFamilyChange: (period: number | null) => void;
  onPrimeCountCommit: (count: number) => void;
  onAngleDeltaChange: (deg: number) => void;
  onPredictionCountChange: (count: number) => void;
  onToggleConnector: (on: boolean) => void;
  onTogglePredictions: (on: boolean) => void;
  onToggleTheme: () => void;
  onColorModeChange: (mode: ColorMode) => void;
  onLayoutChange: (layout: Layout) => void;
  onTwinSpotlightChange: (on: boolean) => void;
  onResidueChange: (residue: Residue | null) => void;
  onFibLensChange: (on: boolean) => void;
  onFibChordsChange: (on: boolean) => void;
  onFibLagChange: (lag: number) => void;
  onModelCurveChange: (on: boolean) => void;
  onCustomFormulasChange: (formulas: CustomFormulas) => void;
  onExport: () => void;
}

const COLOR_MODES = [
  { value: 'arm', label: 'Arm' },
  { value: 'gap', label: 'Gap' },
  { value: 'sequence', label: 'Sequence' },
] as const;

const FLAT_LAYOUTS = [
  { value: 'classic', label: 'Classic' },
  { value: 'residual', label: 'Residual' },
  { value: 'helix', label: 'Helix' },
] as const;

const VALUE_LAYOUT_OPTIONS = [
  { value: 'pi', label: 'π' },
  { value: 'vogel', label: 'Vogel' },
  { value: 'ulam', label: 'Ulam' },
  { value: 'custom', label: 'ƒ(p,i)' },
] as const;

const ANGLE_PRESETS = [
  { label: '36°', value: 36 },
  { label: 'φ 137.508°', value: 137.508 },
  { label: '1 rad', value: 57.2958 },
  { label: '20°', value: 20 },
  { label: '1°', value: 1 },
] as const;

const FIB_LAGS = [5, 8, 13, 21];

// Residue classes coprime to each preset modulus (others contain ≤1 prime)
const RESIDUE_CLASSES: Record<number, number[]> = {
  4: [1, 3],
  6: [1, 5],
  12: [1, 5, 7, 11],
};

const describeArms = (arms: ArmStructure | null): string => {
  if (!arms) return 'too few primes to resolve an arm';
  if (arms.period === 1) return `single spiral — ${arms.driftDeg.toFixed(2)}°/step`;
  if (arms.driftDeg === 0) return `${arms.period} arms — exact rays`;
  const sign = arms.driftDeg > 0 ? '+' : '';
  return `${arms.period} arms — precessing ${sign}${arms.driftDeg.toFixed(2)}°/step`;
};

// Compact chip label for one arm family
const familyLabel = (c: ArmCandidate): string => {
  if (c.period === 1) return '1 spiral';
  if (c.driftDeg === 0) return `${c.period} rays`;
  return `${c.period} · ${c.driftDeg > 0 ? '+' : ''}${c.driftDeg.toFixed(1)}°`;
};

const SecondaryButton: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button
    onClick={onClick}
    className="w-full rounded-md bg-black/5 px-3 py-2 text-xs font-medium text-gray-700 transition-colors duration-150 hover:bg-black/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
  >
    {children}
  </button>
);

// One formula row: draft locally, commit on blur/Enter, flag bad expressions
const FormulaInput: React.FC<{
  id: string;
  label: string;
  value: string;
  onCommit: (expr: string) => void;
}> = ({ id, label, value, onCommit }) => {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const valid = compileFormula(draft) !== null;

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className={`w-4 shrink-0 font-mono text-xs ${MUTED}`}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        spellCheck={false}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => (valid ? onCommit(draft) : setDraft(value))}
        onKeyDown={e => e.key === 'Enter' && valid && onCommit(draft)}
        className={`w-full rounded-md border bg-transparent px-2 py-1 font-mono text-xs transition-colors duration-150 focus:outline-none ${
          valid ? `${HAIRLINE} focus:border-accent` : 'border-red-500/70'
        }`}
      />
    </div>
  );
};

const Sidebar: React.FC<SidebarProps> = ({
  primeCount,
  isComputing,
  angleDelta,
  showConnector,
  showPredictions,
  predictionCount,
  theme,
  colorMode,
  layout,
  twinSpotlight,
  residue,
  fibLens,
  fibChords,
  fibLag,
  showModelCurve,
  customFormulas,
  candidates,
  armFamily,
  onArmFamilyChange,
  onPrimeCountCommit,
  onAngleDeltaChange,
  onPredictionCountChange,
  onToggleConnector,
  onTogglePredictions,
  onToggleTheme,
  onColorModeChange,
  onLayoutChange,
  onTwinSpotlightChange,
  onResidueChange,
  onFibLensChange,
  onFibChordsChange,
  onFibLagChange,
  onModelCurveChange,
  onCustomFormulasChange,
  onExport,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [countDraft, setCountDraft] = useState(primeCount);

  useEffect(() => setCountDraft(primeCount), [primeCount]);

  const commitCount = () => {
    const value = Math.round(countDraft);
    if (!isNaN(value) && value >= 10 && value <= 100000 && value !== primeCount) {
      onPrimeCountCommit(value);
    } else {
      setCountDraft(primeCount);
    }
  };

  // Angle drives nothing when positions come from the prime's value / a formula
  const angleUnused = VALUE_LAYOUTS.has(layout) || layout === 'custom';

  // Arms exist at every angle; which N you see depends on how many primes are on
  // screen (best rational approximation of Δ/360 that still fills each arm)
  const arms = candidates.find(c => c.period === armFamily) ?? candidates[0] ?? null;

  // Mobile drawer touch handling
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isOpen) {
      e.stopPropagation();
      setTouchStart(e.touches[0].clientY);
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (isOpen) {
      e.stopPropagation();
      setTouchEnd(e.touches[0].clientY);
    }
  };
  const handleTouchEnd = () => {
    if (isOpen && touchStart && touchEnd) {
      if (touchStart - touchEnd < -50) setIsOpen(false);
      setTouchStart(null);
      setTouchEnd(null);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const drawer = document.getElementById('sidebar-drawer');
      if (drawer && !drawer.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 10 }}>
      <div
        id="sidebar-drawer"
        className={`${PANEL} pointer-events-auto fixed inset-x-0 bottom-0 max-h-[70vh] overflow-y-auto rounded-b-none rounded-t-2xl transition-transform duration-300 ease-in-out
          md:absolute md:inset-x-auto md:bottom-4 md:left-4 md:top-4 md:max-h-none md:w-72 md:translate-y-0 md:rounded-lg
          ${isOpen ? 'translate-y-0' : 'translate-y-[calc(100%-2.5rem)]'}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Mobile drawer handle */}
        <div
          className={`flex h-10 cursor-pointer items-center justify-center border-b md:hidden ${HAIRLINE}`}
          onClick={() => setIsOpen(o => !o)}
        >
          <div className="h-1 w-10 rounded-full bg-black/20 dark:bg-white/20" />
        </div>

        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-center justify-between">
            <span className="text-base font-semibold">Prime Visualizer</span>
            <button
              onClick={onToggleTheme}
              title="Toggle light/dark theme"
              className={`rounded-md px-2 py-1 text-xs transition-colors duration-150 hover:bg-black/10 dark:hover:bg-white/10 ${MUTED}`}
            >
              {theme === 'dark' ? '☀' : '🌙'}
            </button>
          </div>

          <Section title="sequence">
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                id="primeCount"
                label="Primes"
                value={countDraft}
                min={10}
                max={100000}
                disabled={isComputing}
                onChange={e => setCountDraft(parseInt(e.target.value) || 0)}
                onCommit={commitCount}
              />
              <NumberField
                id="angleDelta"
                label="Angle Δ°"
                value={angleDelta}
                min={0.1}
                max={179.9}
                step={0.1}
                disabled={angleUnused}
                onChange={e => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v > 0 && v < 180) onAngleDeltaChange(v);
                }}
              />
            </div>
            <FineSlider
              id="angleSlider"
              min={0.5}
              max={179.9}
              step={0.1}
              value={angleDelta}
              disabled={angleUnused}
              onChange={onAngleDeltaChange}
            />
            <PresetChips presets={ANGLE_PRESETS} value={angleDelta} disabled={angleUnused} onSelect={onAngleDeltaChange} />
            <div className={`font-mono text-[10px] tabular-nums ${MUTED}`}>
              {angleUnused ? 'angle unused — position comes from the prime itself' : describeArms(arms)}
            </div>
          </Section>

          <Section title="view">
            <div>
              <div className={`${LABEL} mb-1`}>index-mapped</div>
              <Segmented options={FLAT_LAYOUTS} value={layout} onChange={onLayoutChange} />
            </div>
            <div>
              <div className={`${LABEL} mb-1`}>value-mapped</div>
              <Segmented options={VALUE_LAYOUT_OPTIONS} value={layout} onChange={onLayoutChange} />
            </div>
            {layout === 'custom' && (
              <div className="flex flex-col gap-1.5">
                <FormulaInput
                  id="formulaR"
                  label="r"
                  value={customFormulas.r}
                  onCommit={r => onCustomFormulasChange({ ...customFormulas, r })}
                />
                <FormulaInput
                  id="formulaTheta"
                  label="θ"
                  value={customFormulas.theta}
                  onCommit={theta => onCustomFormulasChange({ ...customFormulas, theta })}
                />
                <FormulaInput
                  id="formulaZ"
                  label="z"
                  value={customFormulas.z}
                  onCommit={z => onCustomFormulasChange({ ...customFormulas, z })}
                />
                <div className="flex flex-wrap gap-1">
                  {CUSTOM_PRESETS.map(p => (
                    <ChipButton key={p.label} onClick={() => onCustomFormulasChange(p.formulas)}>
                      {p.label}
                    </ChipButton>
                  ))}
                </div>
                <div className={`text-[10px] leading-relaxed ${MUTED}`}>
                  p = prime, i = index, n = count · Math + PI, TAU, PHI, GOLDEN, fib(k) · θ in radians
                </div>
              </div>
            )}
            <SecondaryButton onClick={onExport}>Export PNG</SecondaryButton>
          </Section>

          <Section title="display">
            <Segmented options={COLOR_MODES} value={colorMode} onChange={onColorModeChange} />
            <Toggle id="showConnector" label="Link primes in sequence" checked={showConnector} onChange={onToggleConnector} />
            <Toggle
              id="fibChords"
              label="Fibonacci chords p(i)→p(i+F)"
              checked={fibChords}
              onChange={onFibChordsChange}
            />
            {fibChords && (
              <div className="flex gap-1">
                {FIB_LAGS.map(lag => (
                  <ChipButton key={lag} active={fibLag === lag} onClick={() => onFibLagChange(lag)}>
                    F={lag}
                  </ChipButton>
                ))}
              </div>
            )}
            <Toggle
              id="modelCurve"
              label="Model curve R⁻¹"
              checked={showModelCurve}
              onChange={onModelCurveChange}
              disabled={VALUE_LAYOUTS.has(layout)}
            />
            <Toggle id="twinSpotlight" label="Twin-prime spotlight" checked={twinSpotlight} onChange={onTwinSpotlightChange} />
            <Toggle id="fibLens" label="Fibonacci primes only" checked={fibLens} onChange={onFibLensChange} />
            <div>
              <div className={`${LABEL} mb-1 normal-case tracking-normal`}>Residue filter · p ≡ a (mod q)</div>
              <Segmented
                options={[
                  { value: 'off', label: 'Off' },
                  { value: '4', label: 'mod 4' },
                  { value: '6', label: 'mod 6' },
                  { value: '12', label: 'mod 12' },
                ]}
                value={residue ? String(residue.q) : 'off'}
                onChange={v => onResidueChange(v === 'off' ? null : { q: parseInt(v), a: 1 })}
              />
              {residue && (
                <div className="mt-1.5 flex gap-1">
                  {RESIDUE_CLASSES[residue.q].map(a => (
                    <ChipButton
                      key={a}
                      active={residue.a === a}
                      onClick={() => onResidueChange({ q: residue.q, a })}
                    >
                      ≡ {a}
                    </ChipButton>
                  ))}
                </div>
              )}
            </div>
          </Section>

          <Section title="analysis">
            {!angleUnused && candidates.length > 1 && (
              <div>
                <div className={`${LABEL} mb-1 normal-case tracking-normal`}>Arm family</div>
                <div className="flex flex-wrap gap-1">
                  <ChipButton active={armFamily === null} onClick={() => onArmFamilyChange(null)} title="Parastichy-dominant family (what the eye picks out)">
                    Auto
                  </ChipButton>
                  {candidates.slice(0, 4).map(c => (
                    <ChipButton
                      key={c.period}
                      active={armFamily === c.period}
                      onClick={() => onArmFamilyChange(c.period)}
                      title={`${c.pointsPerArm} points per arm`}
                    >
                      {familyLabel(c)}
                    </ChipButton>
                  ))}
                </div>
              </div>
            )}
            <Toggle id="showPredictions" label="Spiral-arm predictions" checked={showPredictions} onChange={onTogglePredictions} />
            {showPredictions && (
              <div>
                <div className={`mb-1 flex justify-between text-[10px] ${MUTED}`}>
                  <span>Predictions per arm</span>
                  <span className="font-mono tabular-nums">{predictionCount}</span>
                </div>
                <FineSlider
                  id="predictionCount"
                  min={1}
                  max={100}
                  step={1}
                  value={predictionCount}
                  onChange={v => onPredictionCountChange(Math.round(v))}
                />
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
