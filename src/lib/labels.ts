import * as THREE from 'three';
import type { Theme } from './colors';

// Pooled canvas-sprite labels: instead of one extruded TextGeometry per prime
// (the old approach — unusable at 100k primes), only the ~MAX_SHOWN points
// nearest the camera get a label, drawn to a pooled canvas texture on demand.
// Sprites billboard natively, so no per-frame work at all.

const MAX_SHOWN = 150;
const CANVAS_W = 192;
const CANVAS_H = 56;

interface PooledSprite {
  sprite: THREE.Sprite;
  texture: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
  text: string;
}

export class LabelPool {
  readonly group = new THREE.Group();
  private pool: PooledSprite[] = [];
  private shown = new Map<number, PooledSprite>(); // point index -> sprite
  private tmp = new THREE.Vector3();
  private mvp = new THREE.Matrix4();

  private draw(entry: PooledSprite, text: string, theme: Theme) {
    const ctx = entry.canvas.getContext('2d')!;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.font = '600 34px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (theme === 'dark') {
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 6;
      ctx.fillStyle = 'rgba(235,242,255,0.95)';
    } else {
      ctx.shadowColor = 'rgba(255,255,255,0.9)';
      ctx.shadowBlur = 6;
      ctx.fillStyle = 'rgba(15,23,42,0.9)';
    }
    ctx.fillText(text, CANVAS_W / 2, CANVAS_H / 2);
    entry.texture.needsUpdate = true;
    entry.text = text;
  }

  private acquire(): PooledSprite {
    const pooled = this.pool.pop();
    if (pooled) return pooled;
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.renderOrder = 10;
    return { sprite, texture, canvas, text: '' };
  }

  // Rebuild the visible label set for the current camera. Returns true if the
  // scene changed (caller should re-render).
  refresh(
    camera: THREE.PerspectiveCamera,
    primes: number[],
    positions: Float32Array | null,
    theme: Theme
  ): boolean {
    const camDist = camera.position.distanceTo(new THREE.Vector3(0, 0, 0));
    const zoomedIn = 10 / camDist > 1.5;
    if (!zoomedIn || !positions || primes.length === 0) return this.clear();

    camera.updateMatrixWorld();
    this.mvp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;

    // Single O(n) pass: keep points inside the viewport, nearest-first
    const candidates: { i: number; d: number }[] = [];
    for (let i = 0; i < primes.length; i++) {
      const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
      this.tmp.set(x, y, z).applyMatrix4(this.mvp);
      if (this.tmp.x < -1.02 || this.tmp.x > 1.02 || this.tmp.y < -1.02 || this.tmp.y > 1.02 || this.tmp.z > 1 || this.tmp.z < -1) continue;
      const dx = x - cx, dy = y - cy, dz = z - cz;
      candidates.push({ i, d: dx * dx + dy * dy + dz * dz });
    }
    candidates.sort((a, b) => a.d - b.d);
    const keep = candidates.slice(0, MAX_SHOWN);
    const keepSet = new Set(keep.map(c => c.i));

    let changed = false;

    // Drop labels that fell out of view
    this.shown.forEach((entry, i) => {
      if (!keepSet.has(i)) {
        this.group.remove(entry.sprite);
        this.pool.push(entry);
        this.shown.delete(i);
        changed = true;
      }
    });

    // Size labels relative to camera distance so they stay readable
    const h = camDist * 0.055;
    const w = h * (CANVAS_W / CANVAS_H);

    keep.forEach(({ i }) => {
      let entry = this.shown.get(i);
      if (!entry) {
        entry = this.acquire();
        this.draw(entry, String(primes[i]), theme);
        this.group.add(entry.sprite);
        this.shown.set(i, entry);
        changed = true;
      } else if (entry.text !== String(primes[i])) {
        this.draw(entry, String(primes[i]), theme);
        changed = true;
      }
      entry.sprite.position.set(positions[i * 3], positions[i * 3 + 1] + h * 0.8, positions[i * 3 + 2]);
      entry.sprite.scale.set(w, h, 1);
    });
    if (keep.length > 0) changed = true; // positions/scales may have shifted

    return changed;
  }

  // Remove all labels from the scene (kept in the pool for reuse)
  clear(): boolean {
    if (this.shown.size === 0) return false;
    this.shown.forEach(entry => {
      this.group.remove(entry.sprite);
      this.pool.push(entry);
    });
    this.shown.clear();
    return true;
  }

  // Theme changed: force redraw of any reused canvases
  invalidate(): void {
    this.clear();
    this.pool.forEach(entry => { entry.text = ''; });
  }

  dispose(): void {
    this.clear();
    this.pool.forEach(entry => {
      entry.texture.dispose();
      (entry.sprite.material as THREE.Material).dispose();
    });
    this.pool = [];
  }
}
