// Minicarte : terrain, bâtiments, champ de vision ; clic pour s'y rendre.
import { useEffect, useRef } from 'react';
import { MAP_W, MAP_H, T } from '../engine/sim.js';
import { K, CATEGORIES } from '../engine/defs.js';

const S = 2; // pixels par case
const TERRAIN = { [T.Grass]: '#7c9a4c', [T.Water]: '#3f6f9c', [T.Fertile]: '#9a8a4a', [T.Forest]: '#3d6230', [T.Rock]: '#8b857a' };
const CAT_COLORS = ['#cfc2a4', '#d9b23c', '#b5652e', '#5aa0d6', '#e6e0d0'];

function kindColor(k) {
  if (k === K.Road) return '#d8c9a3';
  if (k === K.House) return '#c45a3c';
  const i = CATEGORIES.findIndex((c) => c.kinds.includes(k));
  return CAT_COLORS[i] || '#eeeeee';
}

export function Minimap({ game, renderer }) {
  const base = useRef(null);
  const view = useRef(null);
  const stamp = useRef('');

  // fond : terrain + bâtiments, redessiné quand la cité change
  useEffect(() => {
    let raf;
    const draw = () => {
      const key = `${game.version}|${game.TerrainVer}|${game.Raiders ? game.Raiders.length : 0}`;
      const cv = base.current;
      if (cv && key !== stamp.current) {
        stamp.current = key;
        const ctx = cv.getContext('2d');
        for (let x = 0; x < MAP_W; x++) {
          for (let y = 0; y < MAP_H; y++) {
            const b = game.at(x, y);
            ctx.fillStyle = b ? kindColor(b.Kind) : TERRAIN[game.tile(x, y)] || '#777';
            ctx.fillRect(x * S, y * S, S, S);
          }
        }
        ctx.fillStyle = '#e02020';
        ctx.fillRect(0, game.EntryY * S - 2, 4, 5);
      }
      // champ de vision
      const vc = view.current;
      if (vc && renderer) {
        const ctx = vc.getContext('2d');
        ctx.clearRect(0, 0, vc.width, vc.height);
        const pts = renderer.viewCorners();
        ctx.strokeStyle = '#fff3c4'; ctx.lineWidth = 1.2;
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p.x * S, p.z * S) : ctx.moveTo(p.x * S, p.z * S)));
        ctx.closePath(); ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [game, renderer]);

  const go = (e) => {
    if (!renderer) return;
    const r = e.currentTarget.getBoundingClientRect();
    renderer.centerOn(((e.clientX - r.left) / r.width) * MAP_W, ((e.clientY - r.top) / r.height) * MAP_H);
  };

  return (
    <div className="iu-minimap" onMouseDown={(e) => { e.stopPropagation(); if (e.button === 0) go(e); }}
      onMouseMove={(e) => { if (e.buttons === 1) go(e); }} onMouseUp={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()} title="Minicarte — cliquez pour vous y rendre (Tab pour masquer)">
      <canvas ref={base} width={MAP_W * S} height={MAP_H * S} />
      <canvas ref={view} width={MAP_W * S} height={MAP_H * S} className="view" />
    </div>
  );
}
