import React from 'react';
import { PredictionAccuracy } from '../../lib/arms';
import { Theme } from '../../lib/colors';
import GapHistogram from '../charts/GapHistogram';
import DeviationSparkline from '../charts/DeviationSparkline';
import { HAIRLINE, LABEL, MUTED, PANEL, VALUE } from '../ui/primitives';

interface AnalysisDockProps {
  accuracy: PredictionAccuracy;
  primes: number[];
  theme: Theme;
  armCount: number;
  period: number;
  driftDeg: number;
}

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-baseline justify-between gap-4">
    <span className={`text-xs ${MUTED}`}>{label}</span>
    <span className={VALUE}>{children}</span>
  </div>
);

const AnalysisDock: React.FC<AnalysisDockProps> = ({ accuracy, primes, theme, armCount, period, driftDeg }) => (
  <div className={`${PANEL} pointer-events-auto absolute right-4 top-16 z-20 hidden w-64 flex-col gap-3 p-3 md:flex`}>
    <div>
      <div className={`${LABEL} mb-2`}>prediction accuracy</div>
      {armCount === 0 ? (
        <p className={`text-xs leading-relaxed ${MUTED}`}>
          Too few primes to resolve an arm at this angle. Raise the prime count.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          <Row label="arms">{period.toLocaleString('en-US')}</Row>
          <Row label="precession">
            {driftDeg === 0 ? (
              <span className="text-emerald-600 dark:text-emerald-400">exact rays</span>
            ) : (
              `${driftDeg > 0 ? '+' : ''}${driftDeg.toFixed(2)}°/step`
            )}
          </Row>
          <Row label="predictions">{accuracy.totalPredictions.toLocaleString('en-US')}</Row>
          <Row label="within 0.1%">{accuracy.correctPredictions.toLocaleString('en-US')}</Row>
          <Row label="accuracy">
            <span className="text-emerald-600 dark:text-emerald-400">{accuracy.accuracy.toFixed(2)}%</span>
          </Row>
          <Row label="avg error">{accuracy.averageErrorPct.toFixed(3)}%</Row>
        </div>
      )}
    </div>

    <div className={`border-t pt-3 ${HAIRLINE}`}>
      <div className={`${LABEL} mb-1.5`}>gap distribution</div>
      <GapHistogram primes={primes} theme={theme} />
    </div>

    <div className={`border-t pt-3 ${HAIRLINE}`}>
      <div className={`${LABEL} mb-1.5`}>π(x) − R(x) deviation</div>
      <DeviationSparkline primes={primes} theme={theme} />
    </div>

    <div className={`flex flex-col gap-1.5 border-t pt-3 text-[10px] ${HAIRLINE} ${MUTED}`}>
      <div className="flex items-center gap-2">
        <span className="inline-block h-0.5 w-5 bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-amber-400" />
        <span>detected arms (hue per arm)</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
        <span>predicted position</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
        <span>actual position</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block h-0.5 w-5 bg-yellow-400" />
        <span>prediction error</span>
      </div>
    </div>
  </div>
);

export default AnalysisDock;
