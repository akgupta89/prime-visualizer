import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { getPrimes } from '../lib/primes';
import { makePredictor } from '../lib/prediction';
import { armColor, computeColors, computeDim, ColorMode, HighlightSpec, Theme } from '../lib/colors';
import {
  armCandidates,
  calculateAccuracy,
  detectSpiralArms,
  layoutExtent,
  makeMapper,
  CustomFormulas,
  EMPTY_ACCURACY,
  Layout,
  VALUE_LAYOUTS,
} from '../lib/arms';
import { LabelPool } from '../lib/labels';
import AnalysisDock from './overlays/AnalysisDock';
import InspectorCard from './overlays/InspectorCard';
import { PANEL, MUTED } from './ui/primitives';

export type { Layout } from '../lib/arms';

export interface PrimeVizHandle {
  exportPNG: () => void;
}

interface PrimeVisualizationProps {
  width: number;
  height: number;
  primes: number[];
  angleDelta: number;
  showConnector: boolean;
  showPredictions: boolean;
  predictionCount: number;
  is2D: boolean;
  theme: Theme;
  colorMode: ColorMode;
  layout: Layout;
  highlight: HighlightSpec;
  showModelCurve: boolean;
  fibChords: boolean;
  fibLag: number;
  customFormulas: CustomFormulas;
  armFamily: number | null; // selected arm period; null = parastichy auto
  position: { x: number; y: number; z: number };
  ref?: React.Ref<PrimeVizHandle>;
}

const THEMES = {
  light: {
    background: 0xf4f6f8,
    grid1: 0x8b98a8,
    grid2: 0xc3ccd6,
    gridAlpha: 0.5,
    glow: 0.15,
    pointOpacity: 0.95,
    dimAlpha: 0.3,
    blending: THREE.NormalBlending,
    connectorOpacity: 0.45,
    modelCurve: 0x475569,
  },
  dark: {
    background: 0x050810,
    grid1: 0x3a4a63,
    grid2: 0x1c2740,
    gridAlpha: 0.4,
    glow: 0.55,
    pointOpacity: 1.0,
    dimAlpha: 0.15,
    blending: THREE.AdditiveBlending,
    connectorOpacity: 0.35,
    modelCurve: 0x94a3b8,
  },
} as const;

interface TooltipState {
  x: number;
  y: number;
  index: number;
  prime: number;
}

const PrimeVisualization: React.FC<PrimeVisualizationProps> = ({
  width,
  height,
  primes,
  angleDelta,
  showConnector,
  showPredictions,
  predictionCount,
  is2D,
  theme,
  colorMode,
  layout,
  highlight,
  showModelCurve,
  fibChords,
  fibLag,
  customFormulas,
  armFamily,
  position,
  ref,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const gridMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const pointsMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const lineRef = useRef<THREE.Line | null>(null);
  const predictionGroupRef = useRef<THREE.Group | null>(null);
  const modelCurveRef = useRef<THREE.Line | null>(null);
  const fibChordsRef = useRef<THREE.LineSegments | null>(null);
  const markerRef = useRef<THREE.Mesh | null>(null);
  const labelPoolRef = useRef<LabelPool | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const raycasterRef = useRef<THREE.Raycaster | null>(null);

  // Demand rendering: effects and camera motion set this; the loop renders
  // only when it's true
  const needsRenderRef = useRef(true);
  const activeRef = useRef(false); // there was activity since the last idle frame
  const positionsRef = useRef<Float32Array | null>(null);
  const primesRef = useRef<number[]>([]);
  const themeRef = useRef<Theme>(theme);
  const pointerRef = useRef({
    dirty: false,
    ndcX: 0,
    ndcY: 0,
    clientX: 0,
    clientY: 0,
    inside: false,
    downX: 0,
    downY: 0,
    downT: 0,
  });
  const hoverIndexRef = useRef<number>(-1);
  const selectedRef = useRef<number | null>(null);

  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  // All arm families this data can show, parastichy-dominant first; the user
  // can pin an alternate family via armFamily
  const candidates = useMemo(() => armCandidates(angleDelta, primes.length), [angleDelta, primes.length]);
  const structure = useMemo(
    () => candidates.find(c => c.period === armFamily) ?? candidates[0] ?? null,
    [candidates, armFamily]
  );
  const stepsPerRotation = structure?.period ?? Math.max(1, Math.round(360 / angleDelta));
  const valueLayout = VALUE_LAYOUTS.has(layout);
  const mapper = useMemo(
    () => makeMapper(primes, angleDelta, layout, customFormulas),
    [primes, angleDelta, layout, customFormulas]
  );

  // Smooth anchored inverse-R curve — shared by the model overlay and inspector
  const smooth = useMemo(() => makePredictor(primes), [primes]);

  // One effective highlight at a time: a pinned prime's arm wins over filters —
  // except in value layouts, where index-residue arms have no spatial meaning
  const effectiveHighlight = useMemo<HighlightSpec>(() => {
    if (selected !== null && !valueLayout) {
      return { type: 'arm', armIndex: selected % stepsPerRotation, stepsPerRotation };
    }
    return highlight;
  }, [selected, valueLayout, stepsPerRotation, highlight]);

  // Every prediction-derived value, recomputed as a unit whenever any one input
  // changes. Kept out of the render effect so the arms/accuracy math is not
  // entangled with Three.js object lifecycle.
  const analysis = useMemo(() => {
    if (!showPredictions || primes.length <= 10) return null;

    // No convergent fits: too few primes to resolve any arm at this angle
    if (!structure) {
      return { arms: [], accuracy: EMPTY_ACCURACY, extendedPrimes: [], period: 0, driftDeg: 0 };
    }
    const { period, driftDeg } = structure;

    // Cap scene objects: each prediction adds ~3 objects per arm, so small
    // angleDelta (many arms) with a high prediction count would otherwise
    // create ~100k meshes
    const armCount = Math.min(period, Math.ceil(primes.length / 2));
    const effectivePredictionCount = Math.max(1, Math.min(predictionCount, Math.floor(6000 / Math.max(armCount, 1))));

    const arms = detectSpiralArms(primes, period, effectivePredictionCount, driftDeg);

    // ponytail: capped at the 200k-th prime — beyond that, far predictions still
    // render from the model, they just lose their green "actual" comparison
    const MAX_EXTENDED = 200_000;
    const maxPredictionIndex = Math.min(
      primes.length - 1 + effectivePredictionCount * period,
      MAX_EXTENDED - 1
    );
    const extendedPrimes = getPrimes(maxPredictionIndex + 1);

    const accuracy = calculateAccuracy(arms, extendedPrimes);

    return { arms, accuracy, extendedPrimes, period, driftDeg };
  }, [showPredictions, primes, structure, predictionCount]);

  // Shared picking helper (hover + click)
  const pick = (ndcX: number, ndcY: number): number => {
    const cam = cameraRef.current;
    const points = pointsRef.current;
    const controls = controlsRef.current;
    const raycaster = raycasterRef.current;
    if (!cam || !points || !controls || !raycaster || primesRef.current.length === 0) return -1;
    const camDist = cam.position.distanceTo(controls.target);
    raycaster.params.Points.threshold = Math.max(0.05, camDist * 0.008);
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam);
    const hits = raycaster.intersectObject(points, false);
    let best: THREE.Intersection | null = null;
    for (const hit of hits) {
      if (hit.index === undefined) continue;
      if (!best || (hit.distanceToRay ?? Infinity) < (best.distanceToRay ?? Infinity)) best = hit;
    }
    return best?.index ?? -1;
  };

  const exportPNG = () => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera) return;
    // No preserveDrawingBuffer: render and read the pixels in the same task
    const prevRatio = renderer.getPixelRatio();
    renderer.setPixelRatio(Math.min(prevRatio * 2, 4));
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    renderer.setPixelRatio(prevRatio);
    needsRenderRef.current = true;
    const a = document.createElement('a');
    a.href = url;
    a.download = `primes-${primes.length}-delta${angleDelta}.png`;
    a.click();
  };

  useImperativeHandle(ref, () => ({ exportPNG }));

  // ---------- Scene bootstrap (once) ----------
  useEffect(() => {
    if (!canvasRef.current) return;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(THEMES[themeRef.current].background);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 0, 20);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.screenSpacePanning = true;
    controls.enablePan = true;
    controls.panSpeed = 1.0;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.PAN,
    };
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI;
    controls.minAzimuthAngle = -Math.PI / 2;
    controls.maxAzimuthAngle = Math.PI / 2;
    controls.minDistance = 1;
    controls.target.set(0, 0, 0);

    controls.addEventListener('change', () => {
      needsRenderRef.current = true;

      // Enforce azimuth limits
      const cam = controls.object;
      const target = controls.target;
      const azimuth = Math.atan2(cam.position.x - target.x, cam.position.z - target.z);
      if (azimuth < -Math.PI / 2) {
        cam.position.x = target.x + Math.sin(-Math.PI / 2) * cam.position.distanceTo(target);
        cam.position.z = target.z + Math.cos(-Math.PI / 2) * cam.position.distanceTo(target);
      } else if (azimuth > Math.PI / 2) {
        cam.position.x = target.x + Math.sin(Math.PI / 2) * cam.position.distanceTo(target);
        cam.position.z = target.z + Math.cos(Math.PI / 2) * cam.position.distanceTo(target);
      }
    });
    controlsRef.current = controls;

    // Infinite grid (custom shader)
    const themeCfg = THEMES[themeRef.current];
    const gridMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uColor1: { value: new THREE.Color(themeCfg.grid1) },
        uColor2: { value: new THREE.Color(themeCfg.grid2) },
        uDistance: { value: 1000 },
        uSize1: { value: 1 },
        uSize2: { value: 10 },
        uAlpha: { value: themeCfg.gridAlpha },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform float uDistance;
        uniform float uSize1;
        uniform float uSize2;
        uniform float uAlpha;

        varying vec3 vWorldPosition;

        float getGrid(float size) {
          vec2 r = vWorldPosition.xy / size;
          vec2 grid = abs(fract(r - 0.5) - 0.5) / fwidth(r);
          float line = min(grid.x, grid.y);
          return 1.0 - min(line, 1.0);
        }

        void main() {
          float d = 1.0 - min(length(vWorldPosition.xy) / uDistance, 1.0);
          float g1 = getGrid(uSize1);
          float g2 = getGrid(uSize2);
          float gridAlpha = (g2 * 0.5 + g1 * 0.5) * pow(d, 2.0);
          vec3 color = mix(uColor2, uColor1, g1);
          if (gridAlpha < 0.01) discard;
          gl_FragColor = vec4(color, gridAlpha * uAlpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const grid = new THREE.Mesh(new THREE.PlaneGeometry(10000, 10000, 1, 1), gridMaterial);
    grid.position.z = -0.01;
    scene.add(grid);
    gridMaterialRef.current = gridMaterial;

    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);

    // Point cloud material — soft glowing discs, one draw call for all primes.
    // aDim (0 = dimmed, 1 = lit) carries highlights without touching colors.
    const pointsMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uScale: { value: 1 },
        uGlow: { value: themeCfg.glow },
        uOpacity: { value: themeCfg.pointOpacity },
        uDimAlpha: { value: themeCfg.dimAlpha },
      },
      vertexShader: `
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aDim;
        uniform float uScale;
        varying vec3 vColor;
        varying float vDim;
        void main() {
          vColor = aColor;
          vDim = aDim;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(aSize * uScale / -mv.z, 1.5, 256.0) * mix(0.7, 1.0, aDim);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform float uGlow;
        uniform float uOpacity;
        uniform float uDimAlpha;
        varying vec3 vColor;
        varying float vDim;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c) * 2.0;
          float disc = 1.0 - smoothstep(0.55, 0.75, d);
          float halo = exp(-3.0 * d) * uGlow;
          float alpha = (disc + halo) * uOpacity * mix(uDimAlpha, 1.0, vDim);
          if (alpha < 0.02) discard;
          gl_FragColor = vec4(vColor, alpha);
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: themeCfg.blending,
    });
    pointsMaterialRef.current = pointsMaterial;

    // Selection marker: one persistent ring, repositioned per pin
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(1.15, 1.4, 48),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        depthTest: false,
      })
    );
    marker.visible = false;
    marker.renderOrder = 5;
    scene.add(marker);
    markerRef.current = marker;

    const labelPool = new LabelPool();
    scene.add(labelPool.group);
    labelPoolRef.current = labelPool;

    raycasterRef.current = new THREE.Raycaster();

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      const cam = cameraRef.current;
      if (!sceneRef.current || !cam || !rendererRef.current) return;

      // update() advances damping; it fires 'change' (→ needsRender) while moving
      controlsRef.current?.update();

      // Hover picking, at most once per frame
      const pointer = pointerRef.current;
      if (pointer.dirty) {
        pointer.dirty = false;
        let hover = -1;
        const uScale = pointsMaterialRef.current?.uniforms.uScale.value ?? 1;
        const camDist = cam.position.distanceTo(controls.target);
        // Only pick when points are visibly distinguishable (≥ ~3px) — at far
        // zoom the distance-scaled threshold would match thousands of points
        // per mouse move and stall the frame
        const approxPointPx = (0.2 * uScale) / Math.max(camDist, 0.001);
        if (pointer.inside && approxPointPx >= 3) {
          hover = pick(pointer.ndcX, pointer.ndcY);
        }
        if (hover === selectedRef.current && hover !== -1) hover = -1; // pinned: card shows it already
        if (hover !== hoverIndexRef.current) {
          hoverIndexRef.current = hover;
          setTooltip(
            hover >= 0
              ? { x: pointer.clientX, y: pointer.clientY, index: hover, prime: primesRef.current[hover] }
              : null
          );
        }
      }

      if (needsRenderRef.current) {
        needsRenderRef.current = false;
        rendererRef.current.render(sceneRef.current, cam);
        activeRef.current = true;
      } else if (activeRef.current) {
        // First idle frame after activity: rebuild the lazy label set
        activeRef.current = false;
        if (labelPoolRef.current?.refresh(cam, primesRef.current, positionsRef.current, themeRef.current)) {
          rendererRef.current.render(sceneRef.current, cam);
        }
      }
    };
    animate();

    return () => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      labelPool.dispose();
      pointsMaterial.dispose();
      gridMaterial.dispose();
      grid.geometry.dispose();
      marker.geometry.dispose();
      (marker.material as THREE.Material).dispose();
      controls.dispose();
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Resize (no scene teardown) ----------
  useEffect(() => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const pointsMaterial = pointsMaterialRef.current;
    if (!renderer || !camera) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    if (pointsMaterial) {
      // world size -> pixel size conversion for gl_PointSize
      const bufferHeight = renderer.domElement.height;
      pointsMaterial.uniforms.uScale.value = bufferHeight / (2 * Math.tan((75 * Math.PI) / 360));
    }
    needsRenderRef.current = true;
  }, [width, height]);

  // ---------- Point cloud geometry (positions/sizes; colors+dim seeded) ----------
  useEffect(() => {
    const scene = sceneRef.current;
    const material = pointsMaterialRef.current;
    if (!scene || !material) return;

    if (pointsRef.current) {
      scene.remove(pointsRef.current);
      pointsRef.current.geometry.dispose();
      pointsRef.current = null;
    }

    const n = primes.length;
    primesRef.current = primes;
    if (n === 0) {
      positionsRef.current = null;
      return;
    }

    const positions = new Float32Array(n * 3);
    const sizes = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      mapper(i, primes[i], positions, i * 3);
      sizes[i] = 0.05 + 0.02 * Math.log(primes[i]);
    }
    // Seed colors/dim with current values so there is no blank frame; the
    // recolor/dim effects below own subsequent updates (in place, no rebuild)
    const colors = new Float32Array(n * 3);
    computeColors(primes, colorMode, angleDelta, theme, colors);
    const dims = new Float32Array(n);
    computeDim(primes, effectiveHighlight, dims);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aDim', new THREE.BufferAttribute(dims, 1));
    geometry.computeBoundingSphere();

    const points = new THREE.Points(geometry, material);
    scene.add(points);
    pointsRef.current = points;
    positionsRef.current = positions;

    labelPoolRef.current?.invalidate();
    needsRenderRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primes, mapper]);

  // ---------- Recolor in place (no geometry rebuild) ----------
  useEffect(() => {
    const points = pointsRef.current;
    if (!points || primes.length === 0) return;
    const attr = points.geometry.getAttribute('aColor') as THREE.BufferAttribute;
    if (attr.count !== primes.length) return;
    computeColors(primes, colorMode, angleDelta, theme, attr.array as Float32Array);
    attr.needsUpdate = true;
    labelPoolRef.current?.invalidate();
    needsRenderRef.current = true;
  }, [primes, colorMode, angleDelta, theme]);

  // ---------- Highlight dim in place ----------
  useEffect(() => {
    const points = pointsRef.current;
    if (!points || primes.length === 0) return;
    const attr = points.geometry.getAttribute('aDim') as THREE.BufferAttribute;
    if (attr.count !== primes.length) return;
    computeDim(primes, effectiveHighlight, attr.array as Float32Array);
    attr.needsUpdate = true;
    needsRenderRef.current = true;
  }, [primes, effectiveHighlight]);

  // ---------- Camera range follows the data ----------
  useEffect(() => {
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    if (!controls || !camera || primes.length === 0) return;
    const pLast = primes[primes.length - 1];
    // Custom formulas can reach anywhere — measure the actual cloud instead
    const extent =
      layout === 'custom'
        ? pointsRef.current?.geometry.boundingSphere?.radius || 0.01 * pLast
        : layoutExtent(layout, pLast);
    controls.maxDistance = Math.max(30, extent * 10);
    camera.far = Math.max(1000, extent * 25);
    camera.updateProjectionMatrix();
    needsRenderRef.current = true;
  }, [primes, layout, mapper]);

  // ---------- Theme ----------
  useEffect(() => {
    themeRef.current = theme;
    const cfg = THEMES[theme];
    const scene = sceneRef.current;
    if (scene && scene.background instanceof THREE.Color) scene.background.setHex(cfg.background);
    const grid = gridMaterialRef.current;
    if (grid) {
      (grid.uniforms.uColor1.value as THREE.Color).setHex(cfg.grid1);
      (grid.uniforms.uColor2.value as THREE.Color).setHex(cfg.grid2);
      grid.uniforms.uAlpha.value = cfg.gridAlpha;
    }
    const material = pointsMaterialRef.current;
    if (material) {
      material.uniforms.uGlow.value = cfg.glow;
      material.uniforms.uOpacity.value = cfg.pointOpacity;
      material.uniforms.uDimAlpha.value = cfg.dimAlpha;
      material.blending = cfg.blending;
      material.needsUpdate = true;
    }
    labelPoolRef.current?.invalidate();
    needsRenderRef.current = true;
  }, [theme]);

  // ---------- Connector ("Link Primes") ----------
  // Shares the point cloud's position/color buffers — zero copies, and it
  // recolors automatically with the color mode. It can't read aDim, so it
  // fades as a whole while a highlight is active.
  const highlightActive = effectiveHighlight.type !== 'none';
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (lineRef.current) {
      scene.remove(lineRef.current);
      (lineRef.current.material as THREE.Material).dispose();
      // ponytail: the wrapper geometry is NOT disposed — its buffers belong to
      // the point cloud; the tiny VAO is reclaimed when the points rebuild
      lineRef.current = null;
    }

    const points = pointsRef.current;
    if (showConnector && points && primes.length > 1) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', points.geometry.getAttribute('position'));
      geometry.setAttribute('color', points.geometry.getAttribute('aColor'));
      geometry.boundingSphere = points.geometry.boundingSphere;
      const material = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: THEMES[theme].connectorOpacity * (highlightActive ? 0.4 : 1),
      });
      const line = new THREE.Line(geometry, material);
      scene.add(line);
      lineRef.current = line;
    }
    needsRenderRef.current = true;
  }, [showConnector, primes, mapper, theme, highlightActive]);

  // ---------- Model curve overlay ----------
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (modelCurveRef.current) {
      scene.remove(modelCurveRef.current);
      modelCurveRef.current.geometry.dispose();
      (modelCurveRef.current.material as THREE.Material).dispose();
      modelCurveRef.current = null;
    }

    // In value layouts the mapper ignores the index, so sampling the smooth
    // curve produces aliased noise with zero information — skip entirely
    if (showModelCurve && primes.length > 2 && !valueLayout) {
      const nPts = Math.min(20000, Math.max(200, (primes.length - 1) * 4));
      const step = (primes.length - 1) / (nPts - 1);
      const buf = new Float32Array(nPts * 3);
      for (let k = 0; k < nPts; k++) {
        const t = k * step;
        mapper(t, smooth(t), buf, k * 3);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(buf, 3));
      const material = new THREE.LineBasicMaterial({
        color: THEMES[theme].modelCurve,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      });
      const curve = new THREE.Line(geometry, material);
      scene.add(curve);
      modelCurveRef.current = curve;
    }
    needsRenderRef.current = true;
  }, [showModelCurve, primes, mapper, smooth, theme, valueLayout]);

  // ---------- Spiral arm predictions ----------
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (predictionGroupRef.current) {
      scene.remove(predictionGroupRef.current);
      predictionGroupRef.current.traverse(child => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      predictionGroupRef.current = null;
    }

    if (analysis) {
      const { arms, extendedPrimes } = analysis;
      const predictionGroup = new THREE.Group();
      const tmp: number[] = [0, 0, 0];
      const vec = (index: number, prime: number) => {
        mapper(index, prime, tmp, 0);
        return new THREE.Vector3(tmp[0], tmp[1], tmp[2]);
      };

      // In value layouts arm points are spatially scattered, so the index-order
      // curves would be spaghetti — draw only the predicted/actual markers there
      const drawArmCurves = !valueLayout;

      // Maps a fractional-index extension sample onto the arm's VISUAL path:
      // the angle advances by drift per period step (integer steps agree with
      // the standard mapper mod 2π, but fractional indices through the mapper
      // would wind through every intermediate turn and scribble across the
      // scene). Radius/height follow the layout's own formulas.
      const rad = (angleDelta * Math.PI) / 180;
      const driftRad = (analysis.driftDeg * Math.PI) / 180;
      const pLastAll = primes[primes.length - 1];
      const zStepHelix = (6 * Math.log(pLastAll)) / Math.max(primes.length, 1);
      const armPathVec = (anchorIndex: number, index: number, prime: number): THREE.Vector3 => {
        const t = (index - anchorIndex) / analysis.period;
        const theta = anchorIndex * rad + t * driftRad;
        let r = 0.01 * prime;
        let z = 0;
        if (layout === 'helix') {
          r = 1.5 * Math.log(prime);
          z = zStepHelix * index;
        } else if (layout === 'residual') {
          r = 0.01 * smooth(index); // predictions ride the reference sheet (z ≈ 0)
        }
        return new THREE.Vector3(r * Math.cos(theta), r * Math.sin(theta), z);
      };

      arms.forEach(arm => {
        const hue = armColor(arm.armIndex, analysis.period, theme);
        const armPoints = arm.points.map(p => vec(p.index, p.prime));

        // The observed arm, tinted with the arm's own hue
        if (drawArmCurves && armPoints.length >= 2) {
          const curvePoints =
            armPoints.length >= 3
              ? new THREE.CatmullRomCurve3(armPoints, false, 'catmullrom', 0.5).getPoints(armPoints.length * 10)
              : armPoints;
          const armLine = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(curvePoints),
            new THREE.LineBasicMaterial({ color: hue, transparent: true, opacity: 0.7 })
          );
          predictionGroup.add(armLine);
        }

        if (arm.predictions.length > 0) {
          if (drawArmCurves && arm.extensionPath.length > 0) {
            // The extension continues the arm's precessing path smoothly
            const anchor = arm.points[arm.points.length - 1].index;
            const extPoints = [
              armPoints[armPoints.length - 1],
              ...arm.extensionPath.map(p => armPathVec(anchor, p.index, p.prime)),
            ];
            const predLine = new THREE.Line(
              new THREE.BufferGeometry().setFromPoints(extPoints),
              new THREE.LineBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0.7 })
            );
            predictionGroup.add(predLine);
          }

          const numPreds = arm.predictions.length;
          arm.predictions.forEach((prediction, predIndex) => {
            const opacity = 0.3 + 0.4 * (1 - predIndex / Math.max(numPreds - 1, 1));
            const sphereScale = 0.05 + 0.02 * Math.log(prediction.prime);
            const predictedPos = vec(prediction.index, prediction.prime);

            const predSphere = new THREE.Mesh(
              new THREE.SphereGeometry(sphereScale * 1.2, 16, 16),
              new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true, opacity })
            );
            predSphere.position.copy(predictedPos);
            predictionGroup.add(predSphere);

            if (prediction.index < extendedPrimes.length) {
              const actualPrime = extendedPrimes[prediction.index];
              const actualPos = vec(prediction.index, actualPrime);

              const actualSphere = new THREE.Mesh(
                new THREE.SphereGeometry(sphereScale, 16, 16),
                new THREE.MeshBasicMaterial({ color: 0x22dd66, transparent: true, opacity })
              );
              actualSphere.position.copy(actualPos);
              predictionGroup.add(actualSphere);

              const errorLine = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints([predictedPos, actualPos]),
                new THREE.LineBasicMaterial({ color: 0xffdd00, transparent: true, opacity: opacity * 0.8 })
              );
              predictionGroup.add(errorLine);
            }
          });
        }
      });

      scene.add(predictionGroup);
      predictionGroupRef.current = predictionGroup;
    }
    needsRenderRef.current = true;
  }, [analysis, mapper, theme, valueLayout]);

  // ---------- Fibonacci chords: p_i -> p_(i+F) ----------
  // Shares the point cloud's buffers with its own segment index — recolors and
  // re-lays-out automatically, like the connector.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (fibChordsRef.current) {
      scene.remove(fibChordsRef.current);
      (fibChordsRef.current.material as THREE.Material).dispose();
      // ponytail: shared buffers belong to the point cloud — only the material
      // and the tiny index wrapper are ours
      fibChordsRef.current = null;
    }

    const points = pointsRef.current;
    if (fibChords && points && primes.length > fibLag) {
      const n = primes.length;
      const idx = new Uint32Array((n - fibLag) * 2);
      for (let i = 0; i < n - fibLag; i++) {
        idx[i * 2] = i;
        idx[i * 2 + 1] = i + fibLag;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', points.geometry.getAttribute('position'));
      geometry.setAttribute('color', points.geometry.getAttribute('aColor'));
      geometry.setIndex(new THREE.BufferAttribute(idx, 1));
      geometry.boundingSphere = points.geometry.boundingSphere;
      const material = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.3 * (highlightActive ? 0.4 : 1),
        depthWrite: false,
      });
      const chords = new THREE.LineSegments(geometry, material);
      scene.add(chords);
      fibChordsRef.current = chords;
    }
    needsRenderRef.current = true;
  }, [fibChords, fibLag, primes, mapper, highlightActive]);

  // ---------- Selection marker + lifecycle ----------
  useEffect(() => {
    selectedRef.current = selected;
    const marker = markerRef.current;
    if (!marker) return;
    if (selected === null || selected >= primes.length) {
      marker.visible = false;
    } else {
      const tmp: number[] = [0, 0, 0];
      mapper(selected, primes[selected], tmp, 0);
      marker.position.set(tmp[0], tmp[1], tmp[2]);
      marker.scale.setScalar(0.05 + 0.02 * Math.log(primes[selected]));
      marker.visible = true;
    }
    needsRenderRef.current = true;
  }, [selected, mapper, primes]);

  // Selection identity shifts when the data or arm structure changes
  useEffect(() => {
    setSelected(null);
  }, [primes, angleDelta]);

  // Esc releases the pin
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---------- Camera reset ----------
  useEffect(() => {
    if (cameraRef.current && controlsRef.current) {
      const { x, y, z } = position;
      cameraRef.current.position.set(x, y, z);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
      needsRenderRef.current = true;
    }
  }, [position]);

  // ---------- 2D mode: look down the z axis, drag to pan, no rotation ----------
  useEffect(() => {
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    if (!controls || !camera) return;

    controls.enableRotate = !is2D;
    controls.mouseButtons.LEFT = is2D ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
    controls.touches.ONE = is2D ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;

    if (is2D) {
      // Snap onto the +z axis, keeping the current zoom distance and pan target
      const distance = camera.position.distanceTo(controls.target);
      camera.position.set(controls.target.x, controls.target.y, distance);
      controls.update();
    }
    needsRenderRef.current = true;
  }, [is2D]);

  // ---------- Pointer handlers (hover tooltip + click-to-pin) ----------
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pointer = pointerRef.current;
    pointer.ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.ndcY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    pointer.clientX = e.clientX;
    pointer.clientY = e.clientY;
    pointer.inside = true;
    pointer.dirty = true;
  };
  const handlePointerLeave = () => {
    pointerRef.current.inside = false;
    pointerRef.current.dirty = true;
  };
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pointer = pointerRef.current;
    pointer.downX = e.clientX;
    pointer.downY = e.clientY;
    pointer.downT = performance.now();
  };
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pointer = pointerRef.current;
    const dist = Math.hypot(e.clientX - pointer.downX, e.clientY - pointer.downY);
    if (dist > 5 || performance.now() - pointer.downT > 300) return; // it was a drag
    const rect = e.currentTarget.getBoundingClientRect();
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    const hit = pick(ndcX, ndcY);
    setSelected(hit >= 0 ? hit : null);
  };

  const tooltipGap =
    tooltip && tooltip.index < primes.length - 1
      ? primes[tooltip.index + 1] - primes[tooltip.index]
      : null;

  return (
    <>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="absolute inset-0 h-full w-full"
        style={{ display: 'block', zIndex: 1 }}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      />
      {tooltip && (
        <div
          className={`${PANEL} pointer-events-none fixed px-3 py-2 font-mono text-xs`}
          style={{ left: tooltip.x + 14, top: tooltip.y + 14, zIndex: 30 }}
        >
          <div className="text-sm font-bold tabular-nums">{tooltip.prime.toLocaleString('en-US')}</div>
          <div className={MUTED}>index {tooltip.index}</div>
          {tooltipGap !== null && <div className={MUTED}>gap +{tooltipGap}</div>}
          {!valueLayout && <div className={MUTED}>arm {tooltip.index % stepsPerRotation}</div>}
        </div>
      )}
      {analysis && (
        <AnalysisDock
          accuracy={analysis.accuracy}
          primes={primes}
          theme={theme}
          armCount={analysis.arms.length}
          period={analysis.period}
          driftDeg={analysis.driftDeg}
        />
      )}
      {selected !== null && selected < primes.length && (
        <InspectorCard
          index={selected}
          primes={primes}
          stepsPerRotation={stepsPerRotation}
          smooth={smooth}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
};

export default PrimeVisualization;
