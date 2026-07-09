import React from 'react';

// Shared class tokens — the visual system in one place.
// Type scale (4 sizes): 10px uppercase labels, 12px body, 14px mono values, 16px title.
export const PANEL =
  'rounded-lg border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-950/75 backdrop-blur-lg text-gray-900 dark:text-slate-100 shadow-sm';
export const HAIRLINE = 'border-black/10 dark:border-white/10';
export const MUTED = 'text-gray-500 dark:text-slate-400';
export const LABEL = 'text-[10px] font-medium tracking-widest uppercase text-gray-500 dark:text-slate-400';
export const VALUE = 'font-mono text-sm tabular-nums';

export const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className={`flex flex-col gap-2 border-t ${HAIRLINE} pt-3 first:border-t-0 first:pt-0`}>
    <div className={LABEL}>{title}</div>
    {children}
  </div>
);

interface ToggleProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export const Toggle: React.FC<ToggleProps> = ({ id, label, checked, onChange, disabled }) => (
  <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-3">
    <span className="text-xs">{label}</span>
    <span className="relative inline-flex shrink-0 items-center">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        disabled={disabled}
        className="peer sr-only"
      />
      <span className="h-[18px] w-8 rounded-full bg-gray-300 transition-colors duration-150 peer-checked:bg-accent peer-disabled:opacity-50 peer-focus-visible:ring-2 peer-focus-visible:ring-accent dark:bg-slate-700" />
      <span className="absolute left-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-150 peer-checked:translate-x-[14px]" />
    </span>
  </label>
);

interface SegmentedProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}

export function Segmented<T extends string>({ options, value, onChange, disabled }: SegmentedProps<T>) {
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          disabled={disabled}
          className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors duration-150 disabled:opacity-50 ${
            value === opt.value
              ? 'bg-accent text-white'
              : 'bg-black/5 text-gray-700 hover:bg-black/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

interface NumberFieldProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCommit?: () => void;
}

export const NumberField: React.FC<NumberFieldProps> = ({ id, label, value, min, max, step, disabled, onChange, onCommit }) => (
  <div className="relative">
    <label
      htmlFor={id}
      className="absolute -top-2 left-2 bg-white px-1 text-[10px] tracking-wide text-gray-500 dark:bg-slate-950 dark:text-slate-400"
    >
      {label}
    </label>
    <input
      id={id}
      type="number"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={onChange}
      onBlur={onCommit}
      onKeyDown={e => e.key === 'Enter' && onCommit?.()}
      className={`w-full rounded-md border ${HAIRLINE} bg-transparent px-3 py-2 pt-3 font-mono text-sm tabular-nums transition-colors duration-150 focus:border-accent focus:outline-none disabled:opacity-50`}
    />
  </div>
);

interface FineSliderProps {
  id: string;
  min: number;
  max: number;
  step: number;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}

export const FineSlider: React.FC<FineSliderProps> = ({ id, min, max, step, value, disabled, onChange }) => (
  <input
    id={id}
    type="range"
    min={min}
    max={max}
    step={step}
    value={value}
    disabled={disabled}
    onChange={e => onChange(parseFloat(e.target.value))}
    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-black/10 accent-accent disabled:opacity-50 dark:bg-white/10"
  />
);

interface PresetChipsProps {
  presets: readonly { label: string; value: number }[];
  value: number;
  disabled?: boolean;
  onSelect: (value: number) => void;
}

export const PresetChips: React.FC<PresetChipsProps> = ({ presets, value, disabled, onSelect }) => (
  <div className="flex flex-wrap gap-1">
    {presets.map(p => (
      <button
        key={p.label}
        onClick={() => onSelect(p.value)}
        disabled={disabled}
        title={`${p.value}°`}
        className={`rounded-full px-2 py-0.5 font-mono text-[10px] tabular-nums transition-colors duration-150 disabled:opacity-50 ${
          Math.abs(value - p.value) < 0.0005
            ? 'bg-accent text-white'
            : 'bg-black/5 text-gray-600 hover:bg-black/10 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10'
        }`}
      >
        {p.label}
      </button>
    ))}
  </div>
);

interface ChipButtonProps {
  active?: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
  children: React.ReactNode;
}

export const ChipButton: React.FC<ChipButtonProps> = ({ active, disabled, title, onClick, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    aria-pressed={active}
    className={`rounded-md px-2 py-1 text-xs font-medium transition-colors duration-150 disabled:opacity-50 ${
      active
        ? 'bg-accent text-white'
        : 'bg-black/5 text-gray-700 hover:bg-black/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'
    }`}
  >
    {children}
  </button>
);
