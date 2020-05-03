import React, { useState, useEffect, useRef } from "react";
import { ControlPanel } from "./components/ControlPanel";
import { Canvas } from "./components/Canvas";
import { pointerEvent, updateScale, resetPosition, draw } from "./utils/Canvas";
import primes from "./primes.json";
import "./App.css";

export default function App() {
  const canvasRef = useRef(null);
  const [canvasState, setCanvasState] = useState({
    xPosition: 0,
    yPosition: 0,
    xHome: 0,
    yHome: 0,
    scale: 1,
    angleDelta: 36,
    traceRoute: 0,
    mouseDown: false,
  });

  useEffect(() => {
    draw(canvasRef, canvasState, primes);
  });

  return (
    <div className="App">
      <div id="container">
        <Canvas
          canvasRef={canvasRef}
          setCanvasState={setCanvasState}
          resetPosition={resetPosition}
          pointerEvent={pointerEvent}
          updateScale={updateScale}
        />
        <ControlPanel
          canvasState={canvasState}
          setCanvasState={setCanvasState}
          resetPosition={resetPosition}
        />
      </div>
    </div>
  );
}
