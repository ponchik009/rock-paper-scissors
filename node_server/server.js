const { default: axios } = require("axios");
const express = require("express");
const useSocket = require("socket.io");
const https = require("https");
const fs = require("fs");
const path = require("path");

const privateKey = fs.readFileSync(
  path.resolve(__dirname, "..", ".vscode/privatekey.key")
);
const certificate = fs.readFileSync(
  path.resolve(__dirname, "..", ".vscode/certificate.crt")
);

const app = express();
// const server = require("http").Server(app);
const server = https.createServer({ key: privateKey, cert: certificate }, app);
const io = useSocket(server, {
  cors: {
    origin: "*",
  },
});

// const IP = "192.168.43.66";
// const IP = "192.168.165.210";
const IP = "localhost";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("./../"));

const PORT = process.env.PORT || 3001;

const rooms = new Map();

function getWinner(r1, r2) {
  if (r1 === r2) return 0;

  if (r1 === 0) {
    if (r2 === 1) return 1;
    else if (r2 === 2) return -1;
  }

  if (r1 === 1) {
    if (r2 === 0) return -1;
    else if (r2 === 2) return 1;
  }

  if (r1 === 2) {
    if (r2 === 0) return 1;
    else if (r2 === 1) return -1;
  }
}

/*
 СОКЕТ
*/
const roomId = "random_string";

io.on("connection", (socket) => {
  socket.on("ROOM.JOIN", () => {
    if (!rooms.has(roomId)) {
      socket.join(roomId);
      const users = new Map();
      users.set(socket.id, {
        name: "user " + socket.id,
        ready: false,
        result: null,
      });
      rooms.set(roomId, users);
      socket.emit("ROOM.WAIT");
    } else {
      if (rooms.get(roomId).size === 1) {
        socket.join(roomId);
        rooms.get(roomId).set(socket.id, {
          name: "user " + socket.id,
          ready: false,
          result: null,
        });
        socket.to(roomId).emit("ROOM.READY");
        socket.emit("ROOM.READY");
      }
    }
    console.log(rooms);
  });

  socket.on("ROOM.READY", () => {
    rooms
      .get(roomId)
      .set(socket.id, { ...rooms.get(roomId).get(socket.id), ready: true });
    if (
      Array.from(rooms.get(roomId).entries()).every(
        ([socketId, user]) => user.ready
      )
    ) {
      socket.emit("ROOM.GO");
      socket.to(roomId).emit("ROOM.GO");
    }
  });

  socket.on("ROOM.RECOGNIZE", ({ coordinates }) => {
    if (coordinates === null) return;
    // логика распознавания
    // console.log(coordinates);
    axios
      .post(`http://${IP}:5000/recognize`, coordinates)
      .then(({ data }) => {
        socket.emit("ROOM.RECOGNIZE", data);
      })
      .catch((e) => socket.emit("ROOM.RECOGNIZE", 666));
  });

  socket.on("ROOM.RESULT", async ({ coordinates }) => {
    if (!coordinates) {
      rooms
        .get(roomId)
        .set(socket.id, { ...rooms.get(roomId).get(socket.id), result: 666 });
    } else {
      const result = await axios
        .post(`http://${IP}:5000/recognize`, coordinates)
        .then(({ data }) => {
          return data;
        })
        .catch((e) => 666);

      console.log(result);

      rooms.get(roomId).set(socket.id, {
        ...rooms.get(roomId).get(socket.id),
        result: +result,
      });
    }

    if (
      Array.from(rooms.get(roomId).entries()).every(
        ([socketId, user]) => user.result !== null
      )
    ) {
      const entries = Array.from(rooms.get(roomId).entries());
      const winner = getWinner(entries[0][1].result, entries[1][1].result);

      switch (winner) {
        case 0:
          socket.to(roomId).emit("ROOM.RESULT", null);
          socket.emit("ROOM.RESULT", null);
          break;
        case 1:
          socket.to(roomId).emit("ROOM.RESULT", entries[0][0]);
          socket.emit("ROOM.RESULT", entries[0][0]);
          break;
        case -1:
          socket.to(roomId).emit("ROOM.RESULT", entries[1][0]);
          socket.emit("ROOM.RESULT", entries[1][0]);
          break;
        default:
          socket.to(roomId).emit("ROOM.RESULT", null);
          socket.emit("ROOM.RESULT", null);
          break;
      }
    }
  });

  socket.on("disconnect", () => {
    console.log("disconnecting");
    rooms.forEach((roomUsers, roomId) => {
      if (roomUsers.delete(socket.id)) {
        if (roomUsers.size === 1) {
          socket.to(roomId).emit("ROOM.UNREADY");
        }
        if (roomUsers.size === 0) {
          rooms.delete(roomId);
        }
      }
    });
  });

  console.log("user connected", socket.id);
});

server.listen(3001, () => {
  console.log(`Example app listening on port ${3001}`);
});
