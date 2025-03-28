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
  setPosition: (position: { x: number; y: number; z: number }) => void;
  setZoom: (zoom: number) => void;
  position: { x: number; y: number; z: number };
}

const PrimeVisualization: React.FC<PrimeVisualizationProps> = ({
  width,
  height,
  primes,
  angleDelta,
  showConnector,
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
    fontLoader.load('fonts/helvetiker_regular.typeface.json', (font) => {
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
    <canvas 
      ref={canvasRef} 
      width={width} 
      height={height} 
      className="w-full h-full absolute inset-0" 
      style={{ display: 'block', zIndex: 1 }}
    />
  );
};

export default PrimeVisualization; 