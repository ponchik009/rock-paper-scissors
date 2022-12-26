import classnames from "classnames";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera } from "@mediapipe/camera_utils";
import {
  drawLandmarks,
  drawConnectors,
  NormalizedLandmarkList,
} from "@mediapipe/drawing_utils";
import { Hands, HAND_CONNECTIONS } from "@mediapipe/hands";

import "./App.css";

import VideoOutput from "./components/VideoOutput/VideoOutput";

import { socket } from "./api/api";

import { Figure, Players, WinStatus } from "./types/types";
import {
  figures,
  gameResult,
  readyStatuses,
  secondsToStart,
} from "./const/const";

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [counter, setCounter] = useState(secondsToStart);

  const [roomId, setRoomId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Players | null>(null);
  const [result, setResult] = useState<WinStatus | null>(null);

  const [recognizeActive, setRecognizeActive] = useState(true);
  const [recognized, setRecognized] = useState(false);
  const [canStart, setCanStart] = useState(false);
  const [ready, setReady] = useState(false);
  const [start, setStart] = useState(false);

  const [coordinates, setCoordinates] = useState<null | NormalizedLandmarkList>(
    null
  );
  const [currentFigure, setCurrentFigure] = useState<Figure>(666);

  const onReadyClick = useCallback(() => {
    setReady(true);
    socket.emit("ROOM.READY", { roomId });
  }, [roomId]);

  const onRestartClick = useCallback(() => {
    socket.emit("ROOM.JOIN");
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;

    socket.emit("ROOM.JOIN");

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
        setCoordinates(results.multiHandLandmarks[0]);

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
        setCoordinates(null);
      }

      canvasCtx.restore();
    });

    // TODO типизировать сокеты

    socket.on("ROOM.RECOGNIZE", (figureNumber: Figure) => {
      setCurrentFigure(figureNumber);
    });

    socket.on("ROOM.JOIN", ({ roomId }) => {
      setRoomId(roomId);
    });
    socket.on("ROOM.WAIT_FOR_PLAYERS", ({ players }) => {
      setPlayers(players);
      setCanStart(false);
    });
    socket.on("ROOM.CAN_START", ({ players }) => {
      setPlayers(players);
      setCanStart(true);
    });
    socket.on("ROOM.PLAYERS_UPDATE", ({ players }) => {
      setPlayers(players);
    });
    socket.on("ROOM.GO", () => {
      setStart(true);
      timerRef.current = setInterval(() => {
        setCounter((prev) => --prev);
      }, 1000);
    });
    socket.on("ROOM.RESULT", ({ result, rivalImages, winnersCount }) => {
      console.log(result, rivalImages, winnersCount);

      setResult(result);
      setStart(false);
      setReady(false);
      setCounter(secondsToStart);
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

  useEffect(() => {
    if (recognizeActive) {
      socket.emit("ROOM.RECOGNIZE", { coordinates });
    }
  }, [recognizeActive, coordinates]);

  useEffect(() => {
    if (counter === 0) {
      const image = canvasRef.current!.toDataURL();

      setRecognizeActive(false);
      clearInterval(Number(timerRef.current));
      socket.emit("ROOM.RESULT", {
        coordinates,
        image,
        roomId,
      });
    }
  }, [counter]);

  // console.log("App component render");

  return (
    <div className="app">
      <main>
        {roomId && <h1>Комната {roomId}</h1>}
        <h1>{recognized ? figures[currentFigure] : "Распознавание..."}</h1>
        {(start || result) && <h1>{!result ? counter : gameResult[result]}</h1>}
        <VideoOutput
          recognized={recognized}
          videoRef={videoRef}
          canvasRef={canvasRef}
        />
        <button onClick={onReadyClick} disabled={ready || !canStart}>
          Готов
        </button>
        {!recognizeActive && <button onClick={onRestartClick}>Заново</button>}
      </main>
      <aside>
        <h3>Игроки</h3>
        {players && (
          <ul>
            {players.map(([id, user]) => (
              <li key={id}>
                Пользователь {id} - {readyStatuses.get(user.ready)}
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

export default App;
