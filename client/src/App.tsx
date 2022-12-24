import { useEffect, useRef, useState } from "react";
import { Camera } from "@mediapipe/camera_utils";
import { drawLandmarks, drawConnectors } from "@mediapipe/drawing_utils";
import { Hands, HAND_CONNECTIONS } from "@mediapipe/hands";
import classnames from "classnames";

import "./App.css";

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [recognized, setRecognized] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;

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

    let times = 0;
    let timer: NodeJS.Timeout | null = null;
    const callback = () => {
      console.log(1 / times);
      times = 0;
      timer = setTimeout(callback, 1000);
    };

    hands.onResults((results) => {
      times++;
      if (!timer) {
        timer = setTimeout(callback, 1000);
      }

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
      let coordinates;
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
      canvasCtx.restore();
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

  console.log(1);

  return (
    <div className="App">
      <video
        className={classnames("input_video")}
        ref={videoRef}
        hidden={recognized}
      />
      <canvas
        className={classnames("output_canvas")}
        hidden={!recognized}
        ref={canvasRef}
        width="640"
        height="480"
      />
    </div>
  );
}

export default App;
