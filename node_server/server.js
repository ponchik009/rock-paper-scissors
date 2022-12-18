const { default: axios } = require("axios");
const express = require("express");
const useSocket = require("socket.io");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

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

const IP = "localhost";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("./../"));

const PORT = process.env.PORT || 3001;

const figures = {
  0: "Бумага",
  1: "Камень",
  2: "Ножницы",
  666: "Не распознано",
};

const victories = {
  0: [1, 666],
  1: [2, 666],
  2: [0, 666],
  666: [],
};

function getWinner(r1, r2) {
  if (r1 === r2) return 0;

  if (victories[r1].includes(r2)) {
    return 1;
  } else {
    return -1;
  }
}

/*
@params
results: Array<Result>

interface Result {
  result: 0 | 1 | 2 | 666;
  ...any fields
}
*/
function resolveWinners(results) {
  const figures = results.map((r) => r.result);
  const figuresWithout666 = figures.filter((f) => f !== 666);

  console.log(figures);
  console.log(figuresWithout666);

  // у всех не распознано - все проиграли
  if (figuresWithout666.length === 0) {
    return results.map((r) => ({ ...r, win: -1 }));
  }

  const set = new Set(figuresWithout666);

  console.log(set);

  // 3 разных знака - ничья у всех
  if (set.size === 3) {
    return results.map((r) => ({ ...r, win: 0 }));
  }

  // 1 знак, кроме 666
  if (set.size === 1) {
    // в массиве есть 666
    if (figuresWithout666.length !== results.length) {
      return results.map((r) => ({ ...r, win: r.result === 666 ? -1 : 1 }));
    } else {
      // все показали один знак
      return results.map((r) => ({ ...r, win: 0 }));
    }
  }

  // 2 разных знака - определяем победителей и проигравших
  const [r1, r2] = set.values();
  const win = getWinner(r1, r2);

  return results.map((r) => ({
    ...r,
    win: r.result === 666 ? -1 : r.result === r1 ? win : -win,
  }));
}

/*
 СОКЕТ
*/

const maxPlayers = 3;
const rooms = new Map();

io.on("connection", (socket) => {
  socket.on("ROOM.JOIN", () => {
    // console.log(io.sockets.sockets);
    for (let [id, room] of rooms) {
      // комната на max человек
      if (room.size < maxPlayers) {
        room.set(socket.id, {
          name: socket.id,
          ready: false,
          result: null,
          image: null,
          win: null,
        });

        socket.join(id);

        if (room.size === maxPlayers) {
          socket.to(id).emit("ROOM.READY", { roomId: id, count: maxPlayers });
          socket.emit("ROOM.READY", { roomId: id, count: maxPlayers });
        } else {
          socket.to(id).emit("ROOM.WAIT", { roomId: id, count: room.size });
          socket.emit("ROOM.WAIT", { roomId: id, count: room.size });
        }

        // console.log(rooms);

        return;
      }
    }

    const roomId = uuidv4();

    socket.join(roomId);
    const users = new Map();
    users.set(socket.id, {
      name: socket.id,
      ready: false,
      result: null,
      image: null,
    });
    rooms.set(roomId, users);
    socket.emit("ROOM.WAIT", { roomId, count: 1 });

    // console.log(rooms);
  });

  socket.on("ROOM.READY", ({ roomId }) => {
    console.log(roomId);
    rooms
      .get(roomId)
      .set(socket.id, { ...rooms.get(roomId).get(socket.id), ready: true });
    if (
      Array.from(rooms.get(roomId).entries()).every(
        ([socketId, user]) => user.ready
      )
    ) {
      socket.emit("ROOM.GO", { roomId });
      socket.to(roomId).emit("ROOM.GO", { roomId });
    }
  });

  socket.on("ROOM.RECOGNIZE", ({ coordinates }) => {
    // console.log(image);
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

  // TODO переработать для мультиплеера
  socket.on("ROOM.RESULT", async ({ coordinates, image, roomId }) => {
    if (!coordinates) {
      rooms.get(roomId).set(socket.id, {
        ...rooms.get(roomId).get(socket.id),
        result: 666,
        image,
      });
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
        image,
      });
    }

    // результаты каждого игрока в комнате получены
    if (
      Array.from(rooms.get(roomId).entries()).every(
        ([socketId, user]) => user.result !== null
      )
    ) {
      const users = Array.from(rooms.get(roomId).values());
      const usersWithResults = resolveWinners(users);

      // console.log(usersWithResults);

      for (let user of usersWithResults) {
        const rivalImages = users
          .filter((u) => u.name !== user.name)
          .map((u) => u.image);

        // отправить конкретному сокету, по socketid
        io.sockets.sockets.get(user.name).emit("ROOM.RESULT", {
          result: user.win,
          rivalImages,
        });
      }

      // rooms.delete(roomId);
    }
  });

  socket.on("ROOM.NEXT_ROUND", ({ roomId }) => {
    console.log(roomId);
    const room = rooms.get(roomId);

    room.set(socket.id, {
      name: socket.id,
      ready: false,
      result: null,
      image: null,
    });

    if (!Array.from(room.values()).some((u) => typeof u.result === "number")) {
      socket.to(roomId).emit("ROOM.NEXT_ROUND", { roomId, count: room.size });
      socket.emit("ROOM.NEXT_ROUND", { roomId, count: room.size });
    }
  });

  socket.on("disconnect", () => {
    console.log("disconnecting");
    rooms.forEach((roomUsers, roomId) => {
      // console.log(roomUsers);
      // console.log(roomUsers.values());
      if (roomUsers.delete(socket.id)) {
        // if (
        //   roomUsers.size > 0 &&
        //   Array.from(roomUsers.values()).every(
        //     (u) => typeof u.result === "null"
        //   )
        // ) {
        //   socket
        //     .to(roomId)
        //     .emit("ROOM.UNREADY", { roomId, count: roomUsers.size });
        // } else {
        //   rooms.delete(roomId);
        // }
      }
    });
  });

  console.log("user connected", socket.id);
});

server.listen(3001, () => {
  console.log(`Example app listening on port ${3001}`);
});
