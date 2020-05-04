const dataLogger = [];
const pointers = [];
let previousDistance = -1;

const createPointer = (e) => {
  return {
    id: e.pointerId,
    x: e.clientX,
    y: e.clientY,
  };
};

export const pointerEvent = function (e, setCanvasState) {
  const idx = pointers.findIndex((pointer) => pointer.id === e.pointerId);

  if (e.type === "pointermove" && idx >= 0) {
    if (pointers.length === 2) {
      const currentDistance = Math.abs(pointers[0].x - pointers[1].x);
      if (previousDistance > 0) {
        e.deltaY = currentDistance - previousDistance;
        updateScale(e, setCanvasState);
      }
      previousDistance = currentDistance;
    } else {
      setCanvasState((prevState) => {
        return {
          ...prevState,
          xPosition: prevState.xHome + (e.clientX - pointers[idx].x),
          yPosition: prevState.yHome + (e.clientY - pointers[idx].y),
          xHome: prevState.xHome + (e.clientX - pointers[idx].x),
          yHome: prevState.yHome + (e.clientY - pointers[idx].y),
        };
      });
    }
    pointers.splice(idx, 1, createPointer(e));
  } else if (e.type !== "pointermove") {
    if (e.type === "pointerdown") {
      pointers.push(createPointer(e));
    } else if (idx >= 0) {
      pointers.splice(idx, 1);
      setCanvasState((prevState) => {
        return {
          ...prevState,
          xHome: prevState.xPosition,
          yHome: prevState.yPosition,
        };
      });
    }
  }
};

export const updateScale = (e, setCanvasState) => {
  e.preventDefault();
  setCanvasState((prevState) => {
    const diff =
      prevState.scale -
      (e.deltaY / Math.abs(e.deltaY)) * (prevState.scale / 10);
    return {
      ...prevState,
      scale: 0.001 < diff && diff < 10 ? diff : prevState.scale,
    };
  });
};

export const resetPosition = (e, setCanvasState) =>
  setCanvasState((prevState) => {
    return {
      ...prevState,
      xPosition: 0,
      yPosition: 0,
      xHome: 0,
      yHome: 0,
    };
  });

export const draw = (canvasRef, canvasState, primes) => {
  const canvas = canvasRef.current;
  const ctx = canvas.getContext("2d");
  const { angleDelta, scale, traceRoute } = canvasState;
  const lastPosition = {
    x: canvasState.xPosition + window.innerWidth / 2,
    y: canvasState.yPosition + window.innerHeight / 2,
  };
  const points = [];

  pointers.y = Math.floor(canvas.height / 2);
  pointers.x = Math.floor(canvas.width / 2);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();

  {
    // draw grid
    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#CCC";
    ctx.font = "12px arial";
    ctx.fillStyle = "#AAA";
    const gridSize = 150;
    const gridCount = 10;

    for (let i = -gridCount; i < gridCount; i++) {
      const xOffset = Math.floor(canvasState.xPosition / gridSize);
      const yOffset = Math.floor(canvasState.yPosition / gridSize);
      const xPos = gridSize * (i - xOffset) + lastPosition.x;
      const yPos = gridSize * (i - yOffset) + lastPosition.y;
      const gridValueX = ((gridSize * (i - yOffset)) / scale).toFixed(2);
      const gridValueY = ((gridSize * (i - xOffset)) / scale).toFixed(2);

      ctx.moveTo(xPos, 0);
      ctx.lineTo(xPos, canvas.height);
      ctx.moveTo(0, yPos);
      ctx.lineTo(canvas.width, yPos);

      ctx.textAlign = "left";
      ctx.fillText(`${gridValueY}`, xPos + 20, 20);
      ctx.fillText(`${gridValueY}`, xPos + 20, canvas.height - 10);
      ctx.fillText(`${-gridValueX}`, 10, yPos + 20);
      ctx.textAlign = "right";
      ctx.fillText(`${-gridValueX}`, canvas.width - 10, yPos + 20);
    }

    ctx.stroke();
  }

  {
    // draw prime lines
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(0,0,255,.2)";
    ctx.moveTo(lastPosition.x, lastPosition.y);
    let currentAngle = 0;
    points.push({ ...lastPosition });
    primes.forEach((prime) => {
      currentAngle += angleDelta;
      lastPosition.x +=
        prime * Math.cos((currentAngle * Math.PI) / 180) * scale;
      lastPosition.y -=
        prime * Math.sin((currentAngle * Math.PI) / 180) * scale;
      ctx.lineTo(lastPosition.x, lastPosition.y);
      points.push({ ...lastPosition });
    });
    ctx.stroke();
  }

  {
    // draw prime blips
    const blipGradient = ctx.createRadialGradient(
      canvasState.xPosition + window.innerWidth / 2,
      canvasState.yPosition + window.innerHeight / 2,
      0,
      canvasState.xPosition + window.innerWidth / 2,
      canvasState.yPosition + window.innerHeight / 2,
      20000 * scale
    );
    blipGradient.addColorStop(0, "blue");
    blipGradient.addColorStop(0.5, "purple");
    blipGradient.addColorStop(1, "red");
    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.fillStyle = blipGradient;
    points.forEach((point) => {
      ctx.moveTo(point.x, point.y);
      ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
    });
    ctx.fill();
    // ctx.stroke();
  }

  {
    // draw tracer
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "green";
    ctx.moveTo(points[0].x, points[0].y);
    const totalBends = Math.floor(360 / angleDelta);
    let location = traceRoute;

    while (location < points.length) {
      ctx.lineTo(points[location].x, points[location].y);
      if (location - totalBends >= 0) {
        dataLogger.push(
          Math.sqrt(
            Math.pow(points[location - totalBends].y - points[location].y, 2) +
              Math.pow(points[location - totalBends].x - points[location].x, 2)
          )
        );
      }
      location += totalBends;
    }

    ctx.stroke();
  }
};
