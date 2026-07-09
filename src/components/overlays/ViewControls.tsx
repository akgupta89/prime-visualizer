import React from 'react';
import { PANEL } from '../ui/primitives';

interface ViewControlsProps {
  is2D: boolean;
  onToggle2D: () => void;
  onResetCamera: () => void;
}

const BUTTON =
  'flex h-8 w-8 items-center justify-center rounded-md text-[11px] font-semibold tabular-nums transition-colors duration-150 hover:bg-black/10 dark:hover:bg-white/10';

// Crosshair — recentres the camera on the origin
const TargetIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4">
    <circle cx="12" cy="12" r="6.5" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <path d="M12 1.5v3.5M12 19v3.5M1.5 12h3.5M19 12h3.5" strokeLinecap="round" />
  </svg>
);

const ViewControls: React.FC<ViewControlsProps> = ({ is2D, onToggle2D, onResetCamera }) => (
  <div className={`${PANEL} pointer-events-auto absolute right-4 top-4 z-20 flex items-center gap-0.5 p-1`}>
    <button
      onClick={onToggle2D}
      aria-pressed={is2D}
      title={is2D ? 'Switch to 3D (orbit)' : 'Switch to 2D (top-down, pan only)'}
      className={BUTTON}
    >
      {is2D ? '2D' : '3D'}
    </button>
    <button onClick={onResetCamera} title="Reset camera" aria-label="Reset camera" className={BUTTON}>
      <TargetIcon />
    </button>
  </div>
);

export default ViewControls;
