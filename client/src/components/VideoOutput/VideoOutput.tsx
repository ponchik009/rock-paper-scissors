import React, { memo } from "react";
import classnames from "classnames";

// import styles from "./VideoOutput.module.css";

interface IVideoOutputProps {
  recognized: boolean;
  videoRef: React.LegacyRef<HTMLVideoElement>;
  canvasRef: React.LegacyRef<HTMLCanvasElement>;
}

const VideoOutput: React.FC<IVideoOutputProps> = memo(
  ({ recognized = false, videoRef, canvasRef }) => {
    console.log("Video block render");

    return (
      <div>
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
);

export default VideoOutput;
