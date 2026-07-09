import React, { useEffect, useRef } from 'react';
import { Theme, twinCssColor } from '../../lib/colors';

const W = 220;
const H = 80;

const CHART_COLORS = {
  dark: { bar: 'hsl(207 70% 55%)', muted: 'rgba(148,163,184,0.85)', hairline: 'rgba(255,255,255,0.15)' },
  light: { bar: 'hsl(207 70% 45%)', muted: 'rgba(71,85,105,0.85)', hairline: 'rgba(0,0,0,0.12)' },
};

// Distribution of prime gaps, log-count y axis. Twin bin (gap 2) tinted gold.
const GapHistogram: React.FC<{ primes: number[]; theme: Theme }> = ({ primes, theme }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || primes.length < 3) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    // Bin gaps by value: gap g -> bin round(g/2)-1 (the lone gap 1, from 2->3, folds into bin 0)
    let maxGap = 2;
    for (let i = 0; i < primes.length - 1; i++) maxGap = Math.max(maxGap, primes[i + 1] - primes[i]);
    const binCount = Math.round(maxGap / 2);
    const bins = new Array(binCount).fill(0);
    for (let i = 0; i < primes.length - 1; i++) {
      const g = primes[i + 1] - primes[i];
      bins[Math.max(0, Math.round(g / 2) - 1)]++;
    }

    // Group adjacent bins if there are too many to draw at >=2px each
    const group = Math.max(1, Math.ceil(binCount / 70));
    const drawn: number[] = [];
    for (let b = 0; b < binCount; b += group) {
      let sum = 0;
      for (let k = b; k < Math.min(b + group, binCount); k++) sum += bins[k];
      drawn.push(sum);
    }

    const maxCount = Math.max(...drawn, 1);
    const colors = CHART_COLORS[theme];
    const plotH = H - 14;
    const barW = Math.max(1, W / drawn.length - 1);

    drawn.forEach((count, k) => {
      if (count === 0) return;
      const y = (Math.log2(1 + count) / Math.log2(1 + maxCount)) * (plotH - 2);
      const x = (k * W) / drawn.length;
      ctx.fillStyle = k === 0 && group === 1 ? twinCssColor(theme) : colors.bar;
      ctx.fillRect(x, plotH - y, barW, y);
    });

    // Baseline + min/max gap ticks
    ctx.strokeStyle = colors.hairline;
    ctx.beginPath();
    ctx.moveTo(0, plotH + 0.5);
    ctx.lineTo(W, plotH + 0.5);
    ctx.stroke();
    ctx.fillStyle = colors.muted;
    ctx.font = '9px ui-monospace, monospace';
    ctx.fillText('2', 1, H - 2);
    const maxLabel = String(maxGap);
    ctx.fillText(maxLabel, W - ctx.measureText(maxLabel).width - 1, H - 2);
  }, [primes, theme]);

  return <canvas ref={canvasRef} style={{ width: W, height: H }} />;
};

export default GapHistogram;
