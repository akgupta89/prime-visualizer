import React, { useEffect, useRef } from 'react';
import { Theme } from '../../lib/colors';
import { riemannR } from '../../lib/prediction';

const W = 220;
const H = 80;

const CHART_COLORS = {
  dark: { line: 'hsl(207 70% 55%)', muted: 'rgba(148,163,184,0.85)', hairline: 'rgba(255,255,255,0.15)' },
  light: { line: 'hsl(207 70% 45%)', muted: 'rgba(71,85,105,0.85)', hairline: 'rgba(0,0,0,0.12)' },
};

// π(p_i) − R(p_i) = (i+1) − R(p_i): how the true prime count wobbles around
// the Riemann R curve — the residual the prediction model cannot remove.
const DeviationSparkline: React.FC<{ primes: number[]; theme: Theme }> = ({ primes, theme }) => {
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

    const samples = Math.min(200, primes.length);
    const values: number[] = [];
    for (let k = 0; k < samples; k++) {
      const i = Math.round((k * (primes.length - 1)) / (samples - 1));
      values.push(i + 1 - riemannR(primes[i]));
    }
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 0);
    const range = Math.max(max - min, 1e-9);
    const toY = (v: number) => 2 + (1 - (v - min) / range) * (H - 16);

    const colors = CHART_COLORS[theme];

    // zero axis
    ctx.strokeStyle = colors.hairline;
    ctx.beginPath();
    ctx.moveTo(0, toY(0) + 0.5);
    ctx.lineTo(W, toY(0) + 0.5);
    ctx.stroke();

    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    values.forEach((v, k) => {
      const x = (k * W) / (samples - 1);
      if (k === 0) ctx.moveTo(x, toY(v));
      else ctx.lineTo(x, toY(v));
    });
    ctx.stroke();

    ctx.fillStyle = colors.muted;
    ctx.font = '9px ui-monospace, monospace';
    ctx.fillText(max.toFixed(1), 1, 9);
    ctx.fillText(min.toFixed(1), 1, H - 2);
  }, [primes, theme]);

  return <canvas ref={canvasRef} style={{ width: W, height: H }} />;
};

export default DeviationSparkline;
