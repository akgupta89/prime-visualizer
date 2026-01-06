import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Font, FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { createPrimeSphere } from './PrimeSphere';

interface PrimeVisualizationProps {
  width: number;
  height: number;
  primes: number[];
  angleDelta: number;
  showConnector: boolean;
  showPredictions: boolean;
  setPosition: (position: { x: number; y: number; z: number }) => void;
  setZoom: (zoom: number) => void;
  position: { x: number; y: number; z: number };
}

interface SpiralArm {
  points: { x: number; y: number; z: number; prime: number; index: number }[];
  predictions: { x: number; y: number; z: number; predictedPrime: number }[];
}

interface PredictionAccuracy {
  totalPredictions: number;
  correctPredictions: number;
  averageDistance: number;
  accuracy: number;
}

// Helper function to predict the next point in a spiral arm
const predictNextPoint = (
  points: { x: number; y: number; z: number; prime: number; index: number }[],
  stepsAhead: number = 1
): { x: number; y: number; z: number; predictedPrime: number } | null => {
  if (points.length < 3) return null;

  const n = points.length;
  const p1 = points[n - 3];
  const p2 = points[n - 2];
  const p3 = points[n - 1];

  // Calculate radii for the last 3 points
  const r1 = Math.sqrt(p1.x * p1.x + p1.y * p1.y);
  const r2 = Math.sqrt(p2.x * p2.x + p2.y * p2.y);
  const r3 = Math.sqrt(p3.x * p3.x + p3.y * p3.y);

  // Calculate the radial direction (unit vector from origin to p3)
  const dirX = p3.x / r3;
  const dirY = p3.y / r3;

  // Predict next radius using pattern of radial growth
  const radiusDiff1 = r2 - r1;
  const radiusDiff2 = r3 - r2;
  const radiusAccel = radiusDiff2 - radiusDiff1;

  let predictedRadius = r3;
  let currentRadiusDiff = radiusDiff2;

  for (let i = 0; i < stepsAhead; i++) {
    currentRadiusDiff += radiusAccel;
    predictedRadius += currentRadiusDiff;
  }

  // Ensure predicted radius doesn't become negative
  if (predictedRadius < 0) predictedRadius = r3 + (stepsAhead * radiusDiff2);

  // Project along the radial direction
  const nextX = dirX * predictedRadius;
  const nextY = dirY * predictedRadius;

  // Predict prime value based on pattern
  const primeDiff1 = p2.prime - p1.prime;
  const primeDiff2 = p3.prime - p2.prime;
  const primeAccel = primeDiff2 - primeDiff1;

  let predictedPrime = p3.prime;
  let currentPrimeDiff = primeDiff2;

  for (let i = 0; i < stepsAhead; i++) {
    currentPrimeDiff += primeAccel;
    predictedPrime += currentPrimeDiff;
  }

  return {
    x: nextX,
    y: nextY,
    z: 0,
    predictedPrime: Math.round(predictedPrime)
  };
};

// Helper function to detect spiral arms
const detectSpiralArms = (primes: number[], angleDelta: number): SpiralArm[] => {
  if (primes.length < 10) return [];

  // Map primes to their positions
  const primePositions = primes.map((prime, index) => {
    const angle = index * (angleDelta * Math.PI / 180);
    const radius = 0.01 * prime;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);

    // Calculate the angular position from origin (theta)
    const theta = Math.atan2(y, x);

    return {
      prime,
      index,
      x,
      y,
      z: 0,
      angle,
      radius,
      theta
    };
  });

  // Group primes by their angular position (theta) - this creates radial arms
  const angularTolerance = 0.1; // radians - points within this tolerance are on same arm
  const arms: SpiralArm[] = [];
  const used = new Set<number>();

  primePositions.forEach((seed, seedIndex) => {
    if (used.has(seedIndex)) return;

    // Find all points at similar angular positions (same radial direction)
    const armPoints: typeof primePositions = [];

    primePositions.forEach((point, pointIndex) => {
      if (used.has(pointIndex)) return;

      // Calculate angular difference accounting for wrap-around
      let thetaDiff = Math.abs(point.theta - seed.theta);
      if (thetaDiff > Math.PI) thetaDiff = 2 * Math.PI - thetaDiff;

      if (thetaDiff < angularTolerance) {
        armPoints.push(point);
        used.add(pointIndex);
      }
    });

    // Only create arm if we have enough points
    if (armPoints.length >= 5) {
      // Sort by radius (inside to outside)
      armPoints.sort((a, b) => a.radius - b.radius);

      const arm: SpiralArm = {
        points: armPoints,
        predictions: []
      };

      // Generate predictions
      const numPredictions = 3;
      for (let k = 0; k < numPredictions; k++) {
        const prediction = predictNextPoint(armPoints, k + 1);
        if (prediction) {
          arm.predictions.push(prediction);
        }
      }

      arms.push(arm);
    }
  });

  return arms;
};

// Helper function to calculate prediction accuracy
const calculateAccuracy = (
  arms: SpiralArm[],
  allPrimes: number[],
  angleDelta: number
): PredictionAccuracy => {
  let totalPredictions = 0;
  let correctPredictions = 0;
  let totalDistance = 0;

  // Map all primes to positions for comparison
  const primePositionMap = new Map<number, { x: number; y: number }>();
  allPrimes.forEach((prime, index) => {
    const angle = index * (angleDelta * Math.PI / 180);
    const radius = 0.01 * prime;
    primePositionMap.set(prime, {
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle)
    });
  });

  arms.forEach(arm => {
    arm.predictions.forEach(prediction => {
      totalPredictions++;

      // Check if the predicted prime exists
      const actualPos = primePositionMap.get(prediction.predictedPrime);
      if (actualPos) {
        const distance = Math.sqrt(
          Math.pow(prediction.x - actualPos.x, 2) +
          Math.pow(prediction.y - actualPos.y, 2)
        );

        totalDistance += distance;

        // Consider it correct if within a threshold
        if (distance < 0.5) {
          correctPredictions++;
        }
      } else {
        // If prime doesn't exist, find closest actual prime position
        let minDistance = Infinity;
        primePositionMap.forEach((pos) => {
          const distance = Math.sqrt(
            Math.pow(prediction.x - pos.x, 2) +
            Math.pow(prediction.y - pos.y, 2)
          );
          if (distance < minDistance) {
            minDistance = distance;
          }
        });
        totalDistance += minDistance;
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
  setPosition,
  setZoom,
  position
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const primesRef = useRef<THREE.Group | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
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

    // Create grid
    const gridSize = 200; // Much larger grid
    const gridDivisions = 2000; // More divisions for better detail
    const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x888888, 0xcccccc);
    gridHelper.rotation.x = Math.PI / 2; // Make grid horizontal (x-y plane)
    
    scene.add(gridHelper);
    gridRef.current = gridHelper;

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

      // Detect spiral arms
      const arms = detectSpiralArms(primes, angleDelta);

      // Calculate accuracy
      const accuracy = calculateAccuracy(arms, primes, angleDelta);
      accuracyRef.current = accuracy;
      setAccuracyState(accuracy);

      // Visualize each arm
      arms.forEach((arm) => {
        // Draw arm line in orange
        const armPoints = arm.points.map(p => new THREE.Vector3(p.x, p.y, p.z));
        const armGeometry = new THREE.BufferGeometry().setFromPoints(armPoints);
        const armMaterial = new THREE.LineBasicMaterial({
          color: 0xff8800,
          linewidth: 3,
          transparent: true,
          opacity: 0.6
        });
        const armLine = new THREE.Line(armGeometry, armMaterial);
        predictionGroup.add(armLine);

        // Draw predictions as a continuous extension
        if (arm.predictions.length > 0) {
          const lastArmPoint = arm.points[arm.points.length - 1];

          // Create continuous line from last arm point through all predictions
          const predictionLinePoints = [
            new THREE.Vector3(lastArmPoint.x, lastArmPoint.y, lastArmPoint.z),
            ...arm.predictions.map(p => new THREE.Vector3(p.x, p.y, p.z))
          ];

          const predLineGeometry = new THREE.BufferGeometry().setFromPoints(predictionLinePoints);
          const predLineMaterial = new THREE.LineBasicMaterial({
            color: 0xff0000,
            linewidth: 2,
            transparent: true,
            opacity: 0.7
          });
          const predLine = new THREE.Line(predLineGeometry, predLineMaterial);
          predictionGroup.add(predLine);

          // Draw prediction spheres
          arm.predictions.forEach((prediction, predIndex) => {
            const predSphereGeometry = new THREE.SphereGeometry(0.15, 16, 16);
            const predSphereMaterial = new THREE.MeshBasicMaterial({
              color: 0xff0000,
              transparent: true,
              opacity: 0.5 - (predIndex * 0.1)
            });
            const predSphere = new THREE.Mesh(predSphereGeometry, predSphereMaterial);
            predSphere.position.set(prediction.x, prediction.y, prediction.z);
            predictionGroup.add(predSphere);
          });
        }
      });

      sceneRef.current.add(predictionGroup);
      predictionGroupRef.current = predictionGroup;
    } else {
      accuracyRef.current = null;
      setAccuracyState(null);
    }
  }, [showPredictions, primes, angleDelta]);

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
                <span className="inline-block w-6 h-0.5 bg-orange-500 opacity-60"></span>
                <span>Detected Arms</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-6 h-0.5 bg-red-500"></span>
                <span>Predictions</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PrimeVisualization; 