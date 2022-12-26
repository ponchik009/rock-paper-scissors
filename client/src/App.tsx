import { useEffect, useRef, useState } from "react";
import { Camera } from "@mediapipe/camera_utils";
import { drawLandmarks, drawConnectors } from "@mediapipe/drawing_utils";
import { Hands, HAND_CONNECTIONS } from "@mediapipe/hands";
import classnames from "classnames";

import "./App.css";
import { socket } from "./api/api";
import VideoOutput from "./components/VideoOutput/VideoOutput";

const figures = {
  0: "Бумага",
  1: "Камень",
  2: "Ножницы",
  666: "Не распознано",
};

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [recognizeActive, setRecognizeActive] = useState(true);
  const [recognized, setRecognized] = useState(false);

  const [currentFigure, setCurrentFigure] = useState<keyof typeof figures>(666);

  useEffect(() => {
    if (!canvasRef.current) return;

    socket.emit("ROOM.JOIN");

    let coordinates;

    const canvasCtx = canvasRef.current.getContext("2d")!;

    const hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      },
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    hands.onResults((results) => {
      if (!recognizeActive) return;

      setRecognized(true);

      canvasCtx.save();
      canvasCtx.clearRect(
        0,
        0,
        canvasRef.current!.width,
        canvasRef.current!.height
      );
      canvasCtx.drawImage(
        results.image,
        0,
        0,
        canvasRef.current!.width,
        canvasRef.current!.height
      );

      if (results.multiHandLandmarks) {
        coordinates = results.multiHandLandmarks[0];

        for (const landmarks of results.multiHandLandmarks) {
          drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
            color: "#00FF00",
            lineWidth: 5,
          });
          drawLandmarks(canvasCtx, landmarks, {
            color: "#FF0000",
            lineWidth: 2,
          });
        }
      } else {
        coordinates = null;
      }

      socket.emit("ROOM.RECOGNIZE", { coordinates });

      canvasCtx.restore();
    });

    socket.on("ROOM.RECOGNIZE", (figureNumber: keyof typeof figures) => {
      setCurrentFigure(figureNumber);
    });

    const camera = new Camera(videoRef.current!, {
      onFrame: async () => {
        await hands.send({ image: videoRef.current! });
      },
      width: 640,
      height: 480,
    });
    camera.start();
  }, []);

  console.log("App component render");

  return (
    <div className="app">
      <main>
        <h1>{recognized ? figures[currentFigure] : "Распознавание..."}</h1>
        <VideoOutput
          recognized={recognized}
          videoRef={videoRef}
          canvasRef={canvasRef}
        />
      </main>
      <aside>123</aside>
    </div>
  );
}

export default App;
