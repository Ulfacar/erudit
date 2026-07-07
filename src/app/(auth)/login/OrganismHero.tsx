'use client';

import { useEffect, useRef } from 'react';
import { CLUSTERS } from '@/shared/constants/role-clusters';

type Spark = {
  satellite: number;
  offset: number;
  lane: number;
};

const SATELLITES = CLUSTERS.slice(0, 8).map((cluster, index) => ({
  color: cluster.color,
  rx: 92 + index * 8,
  ry: 56 + (index % 4) * 12,
  period: 30000 + index * 5600,
  phase: (index / 8) * Math.PI * 2,
}));

const SPARKS: Spark[] = Array.from({ length: 12 }, (_, index) => ({
  satellite: index % SATELLITES.length,
  offset: index * 250,
  lane: (index % 5) - 2,
}));

function hexToRgba(hex: string, alpha: number) {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function drawSun(ctx: CanvasRenderingContext2D, cx: number, cy: number, time: number, still: boolean) {
  const pulse = still ? 1 : 1 + Math.sin((time / 2800) * Math.PI * 2) * 0.04;
  const r = 26 * pulse;
  const wave = still ? 0 : (time % 2800) / 2800;

  ctx.save();
  ctx.shadowBlur = 34;
  ctx.shadowColor = '#ffa94d';
  const core = ctx.createRadialGradient(cx - r * 0.28, cy - r * 0.34, 2, cx, cy, r);
  core.addColorStop(0, '#fff7e6');
  core.addColorStop(0.48, '#ffb454');
  core.addColorStop(1, '#ff8f3d');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, 52 + wave * 68, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255,169,77,${0.25 * (1 - wave)})`;
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

function satellitePoint(cx: number, cy: number, index: number, time: number, still: boolean) {
  const item = SATELLITES[index];
  const angle = item.phase + (still ? 0 : (time / item.period) * Math.PI * 2);
  return {
    x: cx + Math.cos(angle) * item.rx,
    y: cy + Math.sin(angle) * item.ry,
    angle,
    color: item.color,
  };
}

function drawFrame(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, still = false) {
  ctx.clearRect(0, 0, width, height);
  const cx = width * 0.52;
  const cy = height * 0.45;

  for (let i = 0; i < SATELLITES.length; i++) {
    const point = satellitePoint(cx, cy, i, time, still);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(cx, cy);
    ctx.strokeStyle = 'rgba(214,192,168,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  for (let i = 0; i < SATELLITES.length; i++) {
    const point = satellitePoint(cx, cy, i, time, still);
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = point.color;
    ctx.fillStyle = point.color;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(point.x, point.y, 13, 0, Math.PI * 2);
    ctx.strokeStyle = hexToRgba(point.color, 0.22);
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  if (!still) {
    for (const spark of SPARKS) {
      const progress = ((time + spark.offset) % 3000) / 3000;
      const point = satellitePoint(cx, cy, spark.satellite, time, false);
      const x = point.x + (cx - point.x) * progress + Math.sin(point.angle + progress * Math.PI) * spark.lane * 2;
      const y = point.y + (cy - point.y) * progress + Math.cos(point.angle + progress * Math.PI) * spark.lane * 2;

      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,216,168,${Math.sin(progress * Math.PI) * 0.8})`;
      ctx.fill();
    }
  }

  drawSun(ctx, cx, cy, time, still);
}

export default function OrganismHero() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawFrame(ctx, rect.width, rect.height, 0, reduced);
    };

    const tick = (time: number) => {
      if (!document.hidden) {
        const rect = canvas.getBoundingClientRect();
        drawFrame(ctx, rect.width, rect.height, time);
      }
      frame = window.requestAnimationFrame(tick);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    if (!reduced) frame = window.requestAnimationFrame(tick);

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: '0 0 auto 0',
        width: '100%',
        height: '58%',
        opacity: 0.92,
        pointerEvents: 'none',
      }}
    />
  );
}
