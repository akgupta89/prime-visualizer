import React, { useEffect, useRef, useState } from 'react';

interface PrimeAnalysisProps {
  primes: number[];
  angleDelta: number;
  width: number;
  height: number;
}

interface SpiralArm {
  points: { x: number; y: number; prime: number }[];
  nextPredicted: { x: number; y: number; prime: number } | null;
}

const PrimeAnalysis: React.FC<PrimeAnalysisProps> = ({
  primes,
  angleDelta,
  width,
  height
}) => {
  const [spiralArms, setSpiralArms] = useState<SpiralArm[]>([]);
  const [selectedArm, setSelectedArm] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);

  // Detect spiral arms in the prime visualization
  useEffect(() => {
    if (primes.length === 0) return;
    
    // Map primes to their positions
    const primePositions = primes.map((prime, index) => {
      const angle = index * (angleDelta * Math.PI / 180);
      const radius = 0.01 * prime;
      return {
        prime,
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
        angle
      };
    });
    
    // Group primes into potential spiral arms
    // A spiral arm is defined as a sequence of primes that form a relatively straight line
    const arms: SpiralArm[] = [];
    const usedPrimes = new Set<number>();
    
    // For each prime, check if it could be the start of a spiral arm
    primePositions.forEach((startPoint, i) => {
      if (usedPrimes.has(startPoint.prime)) return;
      
      // Look for at least 3 points that form a consistent pattern
      const arm: { x: number; y: number; prime: number }[] = [
        { x: startPoint.x, y: startPoint.y, prime: startPoint.prime }
      ];
      
      // Find points that might belong to the same arm
      for (let j = i + 1; j < primePositions.length; j++) {
        const nextPoint = primePositions[j];
        if (usedPrimes.has(nextPoint.prime)) continue;
        
        // Check if this point continues the pattern
        // For a spiral arm, the angle between consecutive points should be roughly consistent
        if (arm.length >= 2) {
          const lastPoint = arm[arm.length - 1];
          const secondLastPoint = arm[arm.length - 2];
          
          const lastAngle = Math.atan2(lastPoint.y - secondLastPoint.y, lastPoint.x - secondLastPoint.x);
          const currentAngle = Math.atan2(nextPoint.y - lastPoint.y, nextPoint.x - lastPoint.x);
          
          // If the angle difference is too large, this point doesn't belong to the arm
          const angleDiff = Math.abs(lastAngle - currentAngle);
          if (angleDiff > 0.2 && angleDiff < (2 * Math.PI - 0.2)) continue;
        }
        
        arm.push({ x: nextPoint.x, y: nextPoint.y, prime: nextPoint.prime });
        usedPrimes.add(nextPoint.prime);
      }
      
      // Only consider it an arm if it has at least 3 points
      if (arm.length >= 3) {
        // Predict the next position in the arm
        const nextPredicted = predictNextPosition(arm);
        arms.push({ 
          points: arm,
          nextPredicted
        });
        usedPrimes.add(startPoint.prime);
      }
    });
    
    setSpiralArms(arms);
  }, [primes, angleDelta]);

  // Predict the next position in a spiral arm
  const predictNextPosition = (points: { x: number; y: number; prime: number }[]) => {
    if (points.length < 3) return null;
    
    // Use the last few points to predict the next one
    const n = points.length;
    const p1 = points[n - 3];
    const p2 = points[n - 2];
    const p3 = points[n - 1];
    
    // Calculate vectors between consecutive points
    const v1 = { x: p2.x - p1.x, y: p2.y - p1.y };
    const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
    
    // Calculate the rate of change in the vector
    const deltaX = v2.x - v1.x;
    const deltaY = v2.y - v1.y;
    
    // Predict the next vector by applying the rate of change
    const v3 = { x: v2.x + deltaX, y: v2.y + deltaY };
    
    // Calculate the next point
    const nextX = p3.x + v3.x;
    const nextY = p3.y + v3.y;
    
    // Estimate the next prime based on the pattern
    const primeDiff1 = p2.prime - p1.prime;
    const primeDiff2 = p3.prime - p2.prime;
    const nextPrime = p3.prime + primeDiff2 + (primeDiff2 - primeDiff1);
    
    return { x: nextX, y: nextY, prime: Math.round(nextPrime) };
  };

  // Draw the spiral arms and predictions on the canvas
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    canvas.width = width;
    canvas.height = height;
    
    const context = canvas.getContext('2d');
    if (!context) return;
    contextRef.current = context;
    
    // Clear canvas
    context.clearRect(0, 0, width, height);
    
    // Set up coordinate system with origin at center
    context.translate(width / 2, height / 2);
    context.scale(20, 20); // Scale to match the visualization
    
    // Draw each spiral arm
    spiralArms.forEach((arm, index) => {
      const isSelected = selectedArm === index;
      
      // Draw the arm
      context.beginPath();
      context.moveTo(arm.points[0].x, arm.points[0].y);
      
      for (let i = 1; i < arm.points.length; i++) {
        context.lineTo(arm.points[i].x, arm.points[i].y);
      }
      
      context.strokeStyle = isSelected ? '#00FF00' : '#FFAA00';
      context.lineWidth = isSelected ? 0.1 : 0.05;
      context.stroke();
      
      // Draw the predicted next position
      if (arm.nextPredicted) {
        context.beginPath();
        context.moveTo(arm.points[arm.points.length - 1].x, arm.points[arm.points.length - 1].y);
        context.lineTo(arm.nextPredicted.x, arm.nextPredicted.y);
        context.strokeStyle = '#FF0000';
        context.lineWidth = 0.05;
        context.stroke();
        
        // Draw a circle at the predicted position
        context.beginPath();
        context.arc(arm.nextPredicted.x, arm.nextPredicted.y, 0.2, 0, 2 * Math.PI);
        context.fillStyle = 'rgba(255, 0, 0, 0.5)';
        context.fill();
        
        // Draw the predicted prime number
        context.fillStyle = '#FFFFFF';
        context.font = '0.2px Arial';
        context.fillText(
          arm.nextPredicted.prime.toString(), 
          arm.nextPredicted.x + 0.3, 
          arm.nextPredicted.y - 0.3
        );
      }
    });
    
    // Reset transformation
    context.setTransform(1, 0, 0, 1, 0, 0);
  }, [spiralArms, selectedArm, width, height]);

  // Handle clicking on a spiral arm
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !contextRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Convert click coordinates to canvas coordinates
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Convert to visualization coordinates (centered, scaled)
    const vizX = (x - width / 2) / 20;
    const vizY = (y - height / 2) / 20;
    
    // Find the closest arm
    let closestDistance = Infinity;
    let closestArmIndex = -1;
    
    spiralArms.forEach((arm, index) => {
      // Check distance to each point in the arm
      for (const point of arm.points) {
        const distance = Math.sqrt(
          Math.pow(point.x - vizX, 2) + Math.pow(point.y - vizY, 2)
        );
        
        if (distance < closestDistance) {
          closestDistance = distance;
          closestArmIndex = index;
        }
      }
    });
    
    // If we found a close arm and it's within a reasonable distance
    if (closestArmIndex >= 0 && closestDistance < 1) {
      setSelectedArm(closestArmIndex);
    } else {
      setSelectedArm(null);
    }
  };

  return (
    <div className="prime-analysis">
      <h3>Spiral Arm Analysis</h3>
      <canvas 
        ref={canvasRef} 
        onClick={handleCanvasClick}
        style={{ 
          border: '1px solid #333',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'auto',
          zIndex: 10
        }}
      />
      
      {selectedArm !== null && spiralArms[selectedArm] && (
        <div className="arm-details" style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '10px',
          borderRadius: '5px',
          zIndex: 11
        }}>
          <h4>Selected Arm</h4>
          <p>Points: {spiralArms[selectedArm].points.length}</p>
          <p>Primes: {spiralArms[selectedArm].points.map(p => p.prime).join(', ')}</p>
          {spiralArms[selectedArm].nextPredicted && (
            <p>Next predicted prime: {spiralArms[selectedArm].nextPredicted?.prime}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default PrimeAnalysis; 