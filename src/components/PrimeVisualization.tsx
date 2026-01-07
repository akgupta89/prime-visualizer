import React, { useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Font, FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { createPrimeSphere } from './PrimeSphere';

// Simple prime generator to extend primes for prediction visualization
const generatePrimesUpTo = (count: number, startingPrimes: number[]): number[] => {
  if (startingPrimes.length >= count) return startingPrimes.slice(0, count);

  const primes = [...startingPrimes];
  let candidate = primes.length > 0 ? primes[primes.length - 1] + 1 : 2;

  while (primes.length < count) {
    let isPrime = true;
    const sqrt = Math.sqrt(candidate);
    for (const p of primes) {
      if (p > sqrt) break;
      if (candidate % p === 0) {
        isPrime = false;
        break;
      }
    }
    if (isPrime) {
      primes.push(candidate);
    }
    candidate++;
  }

  return primes;
};

interface PrimeVisualizationProps {
  width: number;
  height: number;
  primes: number[];
  angleDelta: number;
  showConnector: boolean;
  showPredictions: boolean;
  predictionCount: number;
  setPosition: (position: { x: number; y: number; z: number }) => void;
  setZoom: (zoom: number) => void;
  position: { x: number; y: number; z: number };
  onAccuracyUpdate?: (accuracy: PredictionAccuracy) => void;
}

interface SpiralArmPoint {
  x: number;
  y: number;
  z: number;
  prime: number;
  index: number;
  angle: number;
  radius: number;
}

interface SpiralArm {
  armIndex: number; // The residue class (0 to stepsPerRotation-1)
  points: SpiralArmPoint[];
  predictions: { x: number; y: number; z: number; predictedPrime: number }[];
}

export interface PredictionAccuracy {
  totalPredictions: number;
  correctPredictions: number;
  averageDistance: number;
  accuracy: number;
}

// Helper function to predict next points along a spiral arm
// Uses the residue class pattern: next point is at index + stepsPerRotation
const predictArmExtension = (
  points: SpiralArmPoint[],
  stepsPerRotation: number,
  angleDeltaRad: number,
  numPredictions: number = 3
): { x: number; y: number; z: number; predictedPrime: number }[] => {
  const predictions: { x: number; y: number; z: number; predictedPrime: number }[] = [];

  if (points.length < 2) return predictions;

  const n = points.length;
  const lastPoint = points[n - 1];

  // Calculate prime gaps to estimate growth pattern
  // Use last several points for better estimation
  const numPointsToUse = Math.min(5, n);
  const recentPoints = points.slice(-numPointsToUse);

  const primeGaps: number[] = [];
  for (let i = 1; i < recentPoints.length; i++) {
    primeGaps.push(recentPoints[i].prime - recentPoints[i - 1].prime);
  }

  // Calculate average gap and acceleration
  const avgGap = primeGaps.length > 0
    ? primeGaps.reduce((a, b) => a + b, 0) / primeGaps.length
    : 100; // fallback

  const gapAcceleration = primeGaps.length > 1
    ? (primeGaps[primeGaps.length - 1] - primeGaps[0]) / (primeGaps.length - 1)
    : 0;

  // Generate predictions
  let predictedPrime = lastPoint.prime;
  let currentGap = avgGap;

  for (let step = 1; step <= numPredictions; step++) {
    // The next point on this arm would be at index: lastPoint.index + (step * stepsPerRotation)
    const predictedIndex = lastPoint.index + (step * stepsPerRotation);
    const predictedAngle = predictedIndex * angleDeltaRad;

    // Predict prime value using the growth pattern
    currentGap += gapAcceleration;
    predictedPrime += currentGap;

    // Calculate position
    const predictedRadius = 0.01 * predictedPrime;

    predictions.push({
      x: predictedRadius * Math.cos(predictedAngle),
      y: predictedRadius * Math.sin(predictedAngle),
      z: 0,
      predictedPrime: Math.round(predictedPrime)
    });
  }

  return predictions;
};

// Helper function to detect spiral arms using RESIDUE CLASS grouping
// Spiral arms are formed by primes at indices: k, k+N, k+2N, k+3N, ...
// where N = stepsPerRotation = 360 / angleDelta
const detectSpiralArms = (
  primes: number[],
  angleDelta: number,
  numPredictions: number = 3
): SpiralArm[] => {
  if (primes.length < 3) return [];

  const angleDeltaRad = angleDelta * Math.PI / 180;

  // Calculate how many steps make approximately one full rotation
  // This is the key insight: N = 360 / angleDelta
  const stepsPerRotation = Math.round(360 / angleDelta);

  // Create arm buckets based on residue class (index mod stepsPerRotation)
  const armBuckets: Map<number, SpiralArmPoint[]> = new Map();

  primes.forEach((prime, index) => {
    // The arm index is determined by the residue class
    const armIndex = index % stepsPerRotation;

    const angle = index * angleDeltaRad;
    const radius = 0.01 * prime;

    const point: SpiralArmPoint = {
      prime,
      index,
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
      z: 0,
      angle,
      radius
    };

    if (!armBuckets.has(armIndex)) {
      armBuckets.set(armIndex, []);
    }
    armBuckets.get(armIndex)!.push(point);
  });

  // Convert buckets to spiral arms
  // Points are naturally sorted by index since we iterate through primes in order
  const arms: SpiralArm[] = [];

  armBuckets.forEach((points, armIndex) => {
    if (points.length >= 2) {
      // Points should already be sorted by index (innermost to outermost on spiral)
      // But let's ensure they're sorted correctly
      points.sort((a, b) => a.index - b.index);

      const arm: SpiralArm = {
        armIndex,
        points,
        predictions: []
      };

      // Generate predictions extending the spiral arm
      if (points.length >= 2) {
        arm.predictions = predictArmExtension(points, stepsPerRotation, angleDeltaRad, numPredictions);
      }

      arms.push(arm);
    }
  });

  // Sort arms by their armIndex for consistent ordering
  arms.sort((a, b) => a.armIndex - b.armIndex);

  return arms;
};

// Helper function to calculate prediction accuracy using extended primes
// Compares predictions against actual prime positions (including generated ones)
const calculateAccuracyWithExtended = (
  actualPrimes: number[],
  extendedPrimes: number[],
  angleDelta: number,
  numPredictions: number
): PredictionAccuracy => {
  if (actualPrimes.length < 10) {
    return { totalPredictions: 0, correctPredictions: 0, averageDistance: 0, accuracy: 0 };
  }

  const angleDeltaRad = angleDelta * Math.PI / 180;
  const stepsPerRotation = Math.round(360 / angleDelta);

  // Detect arms using actual primes
  const arms = detectSpiralArms(actualPrimes, angleDelta, numPredictions);

  let totalPredictions = 0;
  let correctPredictions = 0;
  let totalDistance = 0;

  // For each arm, compare predictions to actual positions in extended primes
  arms.forEach(arm => {
    if (arm.points.length === 0) return;

    const lastPoint = arm.points[arm.points.length - 1];

    arm.predictions.forEach((prediction, predIdx) => {
      const predictedIndex = lastPoint.index + ((predIdx + 1) * stepsPerRotation);

      // Get actual position from extended primes
      if (predictedIndex < extendedPrimes.length) {
        totalPredictions++;

        const actualPrime = extendedPrimes[predictedIndex];
        const actualAngle = predictedIndex * angleDeltaRad;
        const actualRadius = 0.01 * actualPrime;
        const actualX = actualRadius * Math.cos(actualAngle);
        const actualY = actualRadius * Math.sin(actualAngle);

        // Calculate distance between predicted and actual
        const distance = Math.sqrt(
          Math.pow(prediction.x - actualX, 2) +
          Math.pow(prediction.y - actualY, 2)
        );

        totalDistance += distance;

        // Consider correct if within a reasonable threshold
        const avgRadius = (Math.sqrt(prediction.x * prediction.x + prediction.y * prediction.y) + actualRadius) / 2;
        const threshold = Math.max(0.3, avgRadius * 0.05); // 5% of radius or 0.3, whichever is larger
        if (distance < threshold) {
          correctPredictions++;
        }
      }
    });
  });

  const accuracy = totalPredictions > 0 ? (correctPredictions / totalPredictions) * 100 : 0;
  const averageDistance = totalPredictions > 0 ? totalDistance / totalPredictions : 0;

  return {
    totalPredictions,
    correctPredictions,
    averageDistance,
    accuracy
  };
};

const PrimeVisualization: React.FC<PrimeVisualizationProps> = ({
  width,
  height,
  primes,
  angleDelta,
  showConnector,
  showPredictions,
  predictionCount,
  setPosition,
  setZoom,
  position,
  onAccuracyUpdate
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const primesRef = useRef<THREE.Group | null>(null);
  const gridRef = useRef<THREE.Mesh | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const fontRef = useRef<Font | null>(null);
  const initializedRef = useRef(false);
  const lineRef = useRef<THREE.Line | null>(null);
  const predictionGroupRef = useRef<THREE.Group | null>(null);
  const accuracyRef = useRef<PredictionAccuracy | null>(null);
  const [accuracyState, setAccuracyState] = React.useState<PredictionAccuracy | null>(null);

  // Initialize Three.js
  useEffect(() => {
    if (!canvasRef.current) return;

    // Create renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    rendererRef.current = renderer;

    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    sceneRef.current = scene;

    // Create camera
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 0, 20);
    cameraRef.current = camera;

    // Create controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.screenSpacePanning = true;
    
    // Enable panning on mobile and desktop
    controls.enablePan = true;
    controls.panSpeed = 1.0;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    };
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,    // Single finger rotates the view
      TWO: THREE.TOUCH.PAN  // Two fingers pan the view
    };
    
    // Restrict camera movement to maintain proper axis orientation
    controls.minPolarAngle = 0; // Keep camera above the grid
    controls.maxPolarAngle = Math.PI; // Keep camera below vertical
    controls.minAzimuthAngle = -Math.PI / 2; // Restrict horizontal rotation to maintain axis orientation
    controls.maxAzimuthAngle = Math.PI / 2; // Restrict horizontal rotation to maintain axis orientation
    
    // Set zoom limits based on content
    const maxRadius = Math.max(...primes) * 0.01; // Maximum radius of the spiral
    controls.minDistance = 1; // Allow much closer zooming
    controls.maxDistance = maxRadius * 10; // Maximum zoom distance based on content size
    
    // Fix panning behavior
    controls.target.set(0, 0, 0);
    
    // Add event listener to enforce rotation limits and prevent negative z panning
    controls.addEventListener('change', () => {
      const camera = controls.object;
      const target = controls.target;
      
      // Calculate current azimuth angle
      const azimuth = Math.atan2(
        camera.position.x - target.x,
        camera.position.z - target.z
      );
      
      // Enforce azimuth limits
      if (azimuth < -Math.PI / 2) {
        camera.position.x = target.x + Math.sin(-Math.PI / 2) * camera.position.distanceTo(target);
        camera.position.z = target.z + Math.cos(-Math.PI / 2) * camera.position.distanceTo(target);
      } else if (azimuth > Math.PI / 2) {
        camera.position.x = target.x + Math.sin(Math.PI / 2) * camera.position.distanceTo(target);
        camera.position.z = target.z + Math.cos(Math.PI / 2) * camera.position.distanceTo(target);
      }

      // Prevent negative z panning
      if (target.z < 0) {
        target.z = 0;
      }
    });
    
    controlsRef.current = controls;

    // Create infinite grid using custom shader
    const infiniteGridShader = {
      uniforms: {
        uColor1: { value: new THREE.Color(0x888888) },
        uColor2: { value: new THREE.Color(0xcccccc) },
        uDistance: { value: 1000 },
        uSize1: { value: 1 },
        uSize2: { value: 10 },
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

          // Blend between small and large grid based on distance
          float gridAlpha = (g2 * 0.5 + g1 * 0.5) * pow(d, 2.0);

          vec3 color = mix(uColor2, uColor1, g1);

          if (gridAlpha < 0.01) discard;

          gl_FragColor = vec4(color, gridAlpha * 0.6);
        }
      `,
    };

    const gridGeometry = new THREE.PlaneGeometry(10000, 10000, 1, 1);
    const gridMaterial = new THREE.ShaderMaterial({
      uniforms: infiniteGridShader.uniforms,
      vertexShader: infiniteGridShader.vertexShader,
      fragmentShader: infiniteGridShader.fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const infiniteGrid = new THREE.Mesh(gridGeometry, gridMaterial);
    infiniteGrid.position.z = -0.01; // Slightly behind to avoid z-fighting
    scene.add(infiniteGrid);
    gridRef.current = infiniteGrid;

    // Create axes
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);

    // Clean up existing visualization
    cleanupPrimeVisualization();
    
    // Create a new group for the primes
    const primesGroup = new THREE.Group();
    sceneRef.current.add(primesGroup);
    primesRef.current = primesGroup;

    // Animation loop
    const animate = () => {
      if (!sceneRef.current || !cameraRef.current || !rendererRef.current) return;
      
      // Update controls
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      
      // Get camera position for zoom level calculation
      const cameraDistance = cameraRef.current.position.distanceTo(new THREE.Vector3(0, 0, 0));
      const zoomLevel = 10 / cameraDistance; // Adjust this threshold as needed
      
      // Update text labels to face camera and set visibility based on zoom
      if (sceneRef.current) {
        sceneRef.current.traverse((object) => {
          if (object.userData && object.userData.type === 'label') {
            // Make text always face the camera
            object.quaternion.copy(cameraRef.current!.quaternion);
            
            // Only show labels when zoomed in enough
            object.visible = zoomLevel > 1.5; // Adjust threshold as needed
          }
        });
      }
      
      // Render scene
      rendererRef.current.render(sceneRef.current, cameraRef.current);
      
      // Update animation frame
      requestAnimationFrame(animate);
    };
    
    animate();

    // Handle resize
    const handleResize = () => {
      if (cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = width / height;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(width, height);
      }
    };

    window.addEventListener('resize', handleResize);

    // Load font
    const fontLoader = new FontLoader();
    fontLoader.load('/prime-visualizer/fonts/helvetiker_regular.typeface.json', (font) => {
      fontRef.current = font;
      
      // Mark as initialized and force a render
      initializedRef.current = true;
      
      // This will trigger the visualization effect
      if (primesRef.current && sceneRef.current && primes.length > 0) {
        createVisualization();
      }
    });

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      
      if (controlsRef.current) {
        controlsRef.current.dispose();
      }
      
      cleanupPrimeVisualization();
      
      if (gridRef.current) {
        gridRef.current.geometry.dispose();
        if (gridRef.current.material instanceof THREE.Material) {
          gridRef.current.material.dispose();
        } else if (Array.isArray(gridRef.current.material)) {
          const materials = gridRef.current.material as THREE.Material[];
          materials.forEach((material: THREE.Material) => material.dispose());
        }
        scene.remove(gridRef.current);
      }
    };
  }, [width, height, setPosition, setZoom]);

  // Move the connector logic to a top-level useEffect
  useEffect(() => {
    if (!sceneRef.current || !primesRef.current) return;

    // Remove existing line if it exists
    if (lineRef.current) {
      sceneRef.current.remove(lineRef.current);
      lineRef.current = null;
    }

    // Create new line if showConnector is true
    if (showConnector && primesRef.current.children.length > 0) {
      const points: THREE.Vector3[] = [];

      // Get positions of all spheres in order
      primesRef.current.children.forEach((child) => {
        points.push(child.position.clone());
      });

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: 0x0088ff,
        linewidth: 2
      });
      const line = new THREE.Line(geometry, material);

      sceneRef.current.add(line);
      lineRef.current = line;
    }
  }, [showConnector, primes]);

  // Handle spiral arm predictions visualization
  useEffect(() => {
    if (!sceneRef.current) return;

    // Clean up existing prediction visualization
    if (predictionGroupRef.current) {
      sceneRef.current.remove(predictionGroupRef.current);
      predictionGroupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => mat.dispose());
          } else {
            child.material.dispose();
          }
        } else if (child instanceof THREE.Line) {
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

    // Create new prediction visualization if enabled
    if (showPredictions && primes.length > 10) {
      const predictionGroup = new THREE.Group();

      // Use ALL primes to detect arms and make predictions that extend beyond
      const stepsPerRotation = Math.round(360 / angleDelta);
      const angleDeltaRad = angleDelta * Math.PI / 180;

      // Calculate how many additional primes we need for visualization
      // The furthest prediction index is: lastPrimeIndex + (predictionCount * stepsPerRotation)
      const maxPredictionIndex = primes.length - 1 + (predictionCount * stepsPerRotation);

      // Generate temporary extended primes for visualization (not added to actual data)
      const extendedPrimes = generatePrimesUpTo(maxPredictionIndex + 1, primes);

      // Detect spiral arms using all actual primes
      const arms = detectSpiralArms(primes, angleDelta, predictionCount);

      // Calculate accuracy using extended primes
      const accuracy = calculateAccuracyWithExtended(primes, extendedPrimes, angleDelta, predictionCount);
      accuracyRef.current = accuracy;
      setAccuracyState(accuracy);

      // Notify parent of accuracy update
      if (onAccuracyUpdate) {
        onAccuracyUpdate(accuracy);
      }

      // Visualize each arm
      arms.forEach((arm) => {
        // Draw arm as a smooth curve through all points
        const armPoints = arm.points.map(p => new THREE.Vector3(p.x, p.y, p.z));

        if (armPoints.length >= 2) {
          let curvePoints: THREE.Vector3[];

          if (armPoints.length >= 3) {
            // Use CatmullRomCurve3 for smooth spiral curve
            const curve = new THREE.CatmullRomCurve3(armPoints, false, 'catmullrom', 0.5);
            curvePoints = curve.getPoints(armPoints.length * 10);
          } else {
            // Just use straight line for 2 points
            curvePoints = armPoints;
          }

          const armGeometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
          const armMaterial = new THREE.LineBasicMaterial({
            color: 0xff8800,
            linewidth: 3,
            transparent: true,
            opacity: 0.7
          });
          const armLine = new THREE.Line(armGeometry, armMaterial);
          predictionGroup.add(armLine);
        }

        // Draw predictions as a smooth extension of the arm
        if (arm.predictions.length > 0 && arm.points.length >= 1) {
          const lastArmPoint = arm.points[arm.points.length - 1];

          // Create curve from last few arm points through predictions for smooth transition
          const transitionPoints: THREE.Vector3[] = [];

          // Include last 2-3 arm points for smooth curve continuation
          const numTransitionPoints = Math.min(3, arm.points.length);
          for (let i = arm.points.length - numTransitionPoints; i < arm.points.length; i++) {
            const p = arm.points[i];
            transitionPoints.push(new THREE.Vector3(p.x, p.y, p.z));
          }

          // Add prediction points
          arm.predictions.forEach(p => {
            transitionPoints.push(new THREE.Vector3(p.x, p.y, p.z));
          });

          let predCurvePoints: THREE.Vector3[];
          if (transitionPoints.length >= 3) {
            const predCurve = new THREE.CatmullRomCurve3(transitionPoints, false, 'catmullrom', 0.5);
            predCurvePoints = predCurve.getPoints(transitionPoints.length * 10);
          } else {
            predCurvePoints = transitionPoints;
          }

          const predLineGeometry = new THREE.BufferGeometry().setFromPoints(predCurvePoints);
          const predLineMaterial = new THREE.LineBasicMaterial({
            color: 0xff0000,
            linewidth: 2,
            transparent: true,
            opacity: 0.7
          });
          const predLine = new THREE.Line(predLineGeometry, predLineMaterial);
          predictionGroup.add(predLine);

          // Draw prediction spheres and actual position comparison
          const numPreds = arm.predictions.length;

          arm.predictions.forEach((prediction, predIndex) => {
            // Calculate opacity that fades from 0.7 to 0.3 across all predictions
            const opacityRange = 0.4;
            const minOpacity = 0.3;
            const opacity = minOpacity + opacityRange * (1 - predIndex / Math.max(numPreds - 1, 1));

            // Draw predicted position (red sphere)
            const predSphereGeometry = new THREE.SphereGeometry(0.15, 16, 16);
            const predSphereMaterial = new THREE.MeshBasicMaterial({
              color: 0xff0000,
              transparent: true,
              opacity: opacity
            });
            const predSphere = new THREE.Mesh(predSphereGeometry, predSphereMaterial);
            predSphere.position.set(prediction.x, prediction.y, prediction.z);
            predictionGroup.add(predSphere);

            // Calculate where the actual prime would be at this predicted index
            // Use EXTENDED primes (includes generated temporary primes for visualization)
            const predictedIndex = lastArmPoint.index + ((predIndex + 1) * stepsPerRotation);

            // Get actual position from extended primes
            if (predictedIndex < extendedPrimes.length) {
              const actualPrime = extendedPrimes[predictedIndex];
              const actualAngle = predictedIndex * angleDeltaRad;
              const actualRadius = 0.01 * actualPrime;
              const actualX = actualRadius * Math.cos(actualAngle);
              const actualY = actualRadius * Math.sin(actualAngle);

              // Draw actual position (green sphere)
              const actualSphereGeometry = new THREE.SphereGeometry(0.12, 16, 16);
              const actualSphereMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ff00,
                transparent: true,
                opacity: opacity
              });
              const actualSphere = new THREE.Mesh(actualSphereGeometry, actualSphereMaterial);
              actualSphere.position.set(actualX, actualY, 0);
              predictionGroup.add(actualSphere);

              // Draw line connecting predicted to actual (shows error)
              const errorLineGeometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(prediction.x, prediction.y, prediction.z),
                new THREE.Vector3(actualX, actualY, 0)
              ]);
              const errorLineMaterial = new THREE.LineBasicMaterial({
                color: 0xffff00, // Yellow line shows the error
                transparent: true,
                opacity: opacity * 0.8,
                linewidth: 2
              });
              const errorLine = new THREE.Line(errorLineGeometry, errorLineMaterial);
              predictionGroup.add(errorLine);
            }
          });
        }
      });

      sceneRef.current.add(predictionGroup);
      predictionGroupRef.current = predictionGroup;
    } else {
      accuracyRef.current = null;
      setAccuracyState(null);
    }
  }, [showPredictions, primes, angleDelta, predictionCount, onAccuracyUpdate]);

  // Update the cleanup function
  const cleanupPrimeVisualization = () => {
    if (sceneRef.current && primesRef.current) {
      // Remove all children from the group
      while (primesRef.current.children.length > 0) {
        const child = primesRef.current.children[0];
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          } else if (Array.isArray(child.material)) {
            const materials = child.material as THREE.Material[];
            materials.forEach((material: THREE.Material) => material.dispose());
          }
        }
        primesRef.current.remove(child);
      }
      
      // Remove the group from the scene
      sceneRef.current.remove(primesRef.current);
    }
    
    // Remove line connector
    if (lineRef.current && sceneRef.current) {
      sceneRef.current.remove(lineRef.current);
      lineRef.current = null;
    }
  };

  // The createVisualization function should NOT contain hooks
  const createVisualization = () => {
    if (!sceneRef.current || !fontRef.current || !primesRef.current || primes.length === 0) return;

    // Clear existing visualization
    while (primesRef.current.children.length > 0) {
      const child = primesRef.current.children[0];
      primesRef.current.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(material => material.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
    
    // Create visualization for each prime
    primes.forEach((prime, index) => {
      // Calculate position using polar coordinates
      const angle = index * (angleDelta * Math.PI / 180);
      const radius = .01 * prime; //Math.sqrt(prime);
      // Convert polar to Cartesian coordinates
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);
      
      // Calculate color based on position in sequence
      const progress = index / (primes.length - 1);
      const color = new THREE.Color();
      color.setRGB( 1.0 - (progress * 0.5), 0, progress * 0.5);
      
      // Calculate scale based on prime value
      const scale = 0.05 + 0.02 * Math.log(prime);
      
      // Create prime sphere with its label
      createPrimeSphere({
        prime,
        position: { x, y },
        scale,
        color,
        font: fontRef.current!,
        group: primesRef.current!
      });
    });
  };

  // Modify the effect that responds to primes changes
  useEffect(() => {
    if (initializedRef.current) {
      createVisualization();
    }
  }, [primes, angleDelta]);

   // Add effect to handle camera position updates
   useEffect(() => {
    if (cameraRef.current && controlsRef.current) {
      const { x, y, z } = position;
      cameraRef.current.position.set(x, y, z);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [position]);

  return (
    <>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full h-full absolute inset-0"
        style={{ display: 'block', zIndex: 1 }}
      />
      {showPredictions && accuracyState && (
        <div className="absolute top-4 right-4 bg-white text-gray-900 p-4 rounded-lg shadow-lg" style={{ zIndex: 20 }}>
          <h3 className="text-lg font-bold mb-3">Prediction Accuracy</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Total Predictions:</span>
              <span className="font-mono font-semibold">{accuracyState.totalPredictions}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Correct Predictions:</span>
              <span className="font-mono font-semibold">{accuracyState.correctPredictions}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Accuracy:</span>
              <span className="font-mono font-bold text-green-600">
                {accuracyState.accuracy.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Avg Distance:</span>
              <span className="font-mono font-semibold text-gray-700">{accuracyState.averageDistance.toFixed(3)}</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="inline-block w-6 h-0.5 bg-orange-500 opacity-70"></span>
                <span>Detected Arms</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full bg-red-500"></span>
                <span>Predicted Position</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full bg-green-500"></span>
                <span>Actual Position</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-6 h-0.5 bg-yellow-400"></span>
                <span>Prediction Error</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PrimeVisualization; 