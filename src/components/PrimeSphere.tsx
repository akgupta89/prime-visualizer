import * as THREE from 'three';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { Font } from 'three/examples/jsm/loaders/FontLoader.js';

interface PrimeSphereProps {
  prime: number;
  position: { x: number; y: number };
  scale: number;
  color: THREE.Color;
  font: Font;
  group: THREE.Group;
}

export const createPrimeSphere = ({
  prime,
  position,
  scale,
  color,
  font,
  group
}: PrimeSphereProps) => {
  const { x, y } = position;
  
  // Create sphere geometry
  const sphereGeometry = new THREE.SphereGeometry(scale * 0.5, 32, 32);
  const sphereMaterial = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.8
  });
  
  const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  sphere.position.set(x, y, 0);
  sphere.userData = { type: 'prime', prime: prime };
  
  // Add sphere to group
  group.add(sphere);
  
  // Create text label for the prime number
  const textGeometry = new TextGeometry(prime.toString(), {
    font: font,
    size: scale * 0.3,
    depth: scale * 0.05,
    curveSegments: 4,
    bevelEnabled: true,
    bevelThickness: scale * 0.02,
    bevelSize: scale * 0.02,
    bevelSegments: 1
  });
  
  textGeometry.computeBoundingBox();
  const textWidth = textGeometry.boundingBox ? 
    (textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x) : 0;
  const textHeight = textGeometry.boundingBox ? 
    (textGeometry.boundingBox.max.y - textGeometry.boundingBox.min.y) : 0;
  
  // Create white text with black outline using bevel
  const materials = [
    new THREE.MeshBasicMaterial({ color: 0xFFFFFF }),
    new THREE.MeshBasicMaterial({ color: 0x000000 })
  ];
  
  const textMesh = new THREE.Mesh(textGeometry, materials);
  
  // Calculate sphere radius
  const sphereRadius = scale * 0.5;
  
  // Position text directly on top of the sphere
  textMesh.position.set(x, y, sphereRadius * 1.6);
  
  // Scale text to fit within sphere
  const maxTextSize = sphereRadius * 0.8;
  const scaleFactor = maxTextSize / Math.max(textWidth, textHeight, 0.001);
  textMesh.scale.set(scaleFactor, scaleFactor, scaleFactor);
  
  // Make text always face the camera
  textMesh.userData = { type: 'label', prime: prime };
  
  // Only show text when zoomed in
  textMesh.visible = false;
  
  // Add text to group
  group.add(textMesh);
  
  return { sphere, textMesh };
}; 