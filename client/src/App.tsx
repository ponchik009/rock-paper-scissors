import React, { useEffect, useRef } from "react";

import "./App.css";

function getRandomColor() {
  const letters = "0123456789ABCDEF";
  let color = "#";

  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }

  return color;
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const context = canvasRef.current.getContext("2d")!;

    setInterval(() => {
      context.fillStyle = getRandomColor();
      context.fillRect(0, 0, context.canvas.width, context.canvas.height);
    }, 200);
  }, []);

  useEffect(() => {
    console.log(1);
  });

  return (
    <div className="App">
      <canvas
        className="output_canvas"
        width="640px"
        height="480px"
        ref={canvasRef}
      />
    </div>
  );
}

export default App;
