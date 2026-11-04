/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { RainSim, drawRain } from '../game/rain';

interface RainLayerProps {
  rain: number; // 0 .. 1
  /** Ground height for each tile column of this world, as a fraction of the view height. */
  ground: number[];
}

type Sender = (message: Record<string, unknown>) => void;

const sameColumns = (a: number[] | null, b: number[]) => !!a && a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * Rain for one world region. It lives inside the region, so it scrolls with the
 * terrain, and it draws in a worker so the game's own hiccups cannot freeze it.
 */
export const RainLayer: React.FC<RainLayerProps> = ({ rain, ground }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const send = useRef<Sender | null>(null);
  const latest = useRef({ rain, ground });
  latest.current = { rain, ground };
  const sentGround = useRef<number[] | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // A fresh canvas per mount: a canvas can only be handed to a worker once
    const canvas = document.createElement('canvas');
    canvas.setAttribute('data-testid', 'world-rain');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated;pointer-events:none;';
    host.appendChild(canvas);

    const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const size = () => ({ width: Math.max(1, Math.round(host.clientWidth)), height: Math.max(1, Math.round(host.clientHeight)) });
    let worker: Worker | null = null;
    let raf = 0;
    let observer: ResizeObserver | null = null;

    if (typeof canvas.transferControlToOffscreen === 'function' && typeof Worker !== 'undefined') {
      try {
        worker = new Worker(new URL('../game/rainWorker.tsx', import.meta.url), { type: 'module' });
        const offscreen = canvas.transferControlToOffscreen();
        const { width, height } = size();
        worker.postMessage({ type: 'init', canvas: offscreen, width, height, reduced }, [offscreen]);
        const w = worker;
        send.current = (message) => w.postMessage(message);
        if (typeof ResizeObserver !== 'undefined') {
          observer = new ResizeObserver(() => send.current?.({ type: 'resize', ...size() }));
          observer.observe(host);
        }
      } catch {
        worker?.terminate();
        worker = null;
      }
    }

    if (!worker) {
      // Fallback for browsers without off-screen canvas: draw on the main thread
      const ctx = canvas.getContext('2d');
      const sim = new RainSim(Math.random, reduced);
      let last = performance.now();
      const loop = (now: number) => {
        const { width, height } = size();
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        sim.resize(width, height);
        sim.step((now - last) / 1000);
        last = now;
        if (ctx) drawRain(ctx, sim);
        raf = requestAnimationFrame(loop);
      };
      send.current = (message) => {
        if (message.type === 'rain') sim.setRain(message.value as number);
        if (message.type === 'ground') sim.setGround(message.columns as number[]);
      };
      raf = requestAnimationFrame(loop);
    }

    sentGround.current = null;
    send.current?.({ type: 'ground', columns: latest.current.ground });
    sentGround.current = latest.current.ground;
    send.current?.({ type: 'rain', value: latest.current.rain });

    return () => {
      send.current = null;
      cancelAnimationFrame(raf);
      observer?.disconnect();
      worker?.terminate();
      canvas.remove();
    };
  }, []);

  useEffect(() => {
    send.current?.({ type: 'rain', value: rain });
  }, [rain]);

  useEffect(() => {
    if (sameColumns(sentGround.current, ground)) return;
    sentGround.current = ground;
    send.current?.({ type: 'ground', columns: ground });
  }, [ground]);

  return <div ref={hostRef} aria-hidden="true" className="absolute inset-0 pointer-events-none z-30" />;
};
