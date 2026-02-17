const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const WEB_ROOT = path.join(__dirname, "public");

const rooms = new Map();
const socketSessions = new Map();

function createEmptyRoom() {
  return {
    board: Array(9).fill(""),
    players: { X: null, O: null },
    turn: "X",
    gameOver: false,
    winner: "",
    scores: { X: 0, O: 0, draw: 0 },
  };
}

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function checkWinner(board) {
  const patterns = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  for (const [a, b, c] of patterns) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }

  return "";
}

function buildState(roomCode, role) {
  const room = rooms.get(roomCode);
  return {
    roomCode,
    board: room.board,
    players: {
      X: Boolean(room.players.X),
      O: Boolean(room.players.O),
    },
    turn: room.turn,
    gameOver: room.gameOver,
    winner: room.winner,
    scores: room.scores,
    youRole: role,
  };
}

function emitRoomState(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) {
    return;
  }

  if (room.players.X) {
    io.to(room.players.X).emit("room_state", buildState(roomCode, "X"));
  }

  if (room.players.O) {
    io.to(room.players.O).emit("room_state", buildState(roomCode, "O"));
  }
}

function detachFromRoom(socketId) {
  const session = socketSessions.get(socketId);
  if (!session) {
    return;
  }

  const room = rooms.get(session.roomCode);
  if (!room) {
    socketSessions.delete(socketId);
    return;
  }

  room.players[session.role] = null;
  socketSessions.delete(socketId);

  const hasAnyPlayer = Boolean(room.players.X || room.players.O);
  if (!hasAnyPlayer) {
    rooms.delete(session.roomCode);
    return;
  }

  room.board = Array(9).fill("");
  room.turn = "X";
  room.gameOver = false;
  room.winner = "";
  emitRoomState(session.roomCode);
}

function sendStatic(res, fileName, contentType) {
  const filePath = path.join(WEB_ROOT, fileName);
  if (!fs.existsSync(filePath)) {
    res.status(404).send("Not found");
    return;
  }
  if (contentType) {
    res.setHeader("Content-Type", contentType);
  }
  res.sendFile(filePath);
}

app.get("/", (_req, res) => {
  sendStatic(res, "index.html", "text/html; charset=utf-8");
});

app.get("/index.html", (_req, res) => {
  sendStatic(res, "index.html", "text/html; charset=utf-8");
});

app.get("/styles.css", (_req, res) => {
  sendStatic(res, "styles.css", "text/css; charset=utf-8");
});

app.get("/app.js", (_req, res) => {
  sendStatic(res, "app.js", "application/javascript; charset=utf-8");
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

io.on("connection", (socket) => {
  socket.on("create_room", () => {
    detachFromRoom(socket.id);

    let roomCode = "";
    do {
      roomCode = generateRoomCode();
    } while (rooms.has(roomCode));

    const room = createEmptyRoom();
    room.players.X = socket.id;
    rooms.set(roomCode, room);
    socketSessions.set(socket.id, { roomCode, role: "X" });
    socket.join(roomCode);

    socket.emit("room_joined", { roomCode });
    emitRoomState(roomCode);
  });

  socket.on("join_room", ({ roomCode } = {}) => {
    const normalizedCode = (roomCode || "").trim().toUpperCase();
    if (!normalizedCode) {
      socket.emit("server_error", { message: "Enter a room code." });
      return;
    }

    const room = rooms.get(normalizedCode);
    if (!room) {
      socket.emit("server_error", { message: "Room not found." });
      return;
    }

    detachFromRoom(socket.id);

    if (room.players.X && room.players.O) {
      socket.emit("server_error", { message: "Room is full." });
      return;
    }

    const role = room.players.X ? "O" : "X";
    room.players[role] = socket.id;
    socketSessions.set(socket.id, { roomCode: normalizedCode, role });
    socket.join(normalizedCode);

    socket.emit("room_joined", { roomCode: normalizedCode });
    emitRoomState(normalizedCode);
  });

  socket.on("leave_room", () => {
    const session = socketSessions.get(socket.id);
    if (!session) {
      return;
    }

    socket.leave(session.roomCode);
    detachFromRoom(socket.id);
    socket.emit("room_left");
  });

  socket.on("make_move", ({ index } = {}) => {
    const session = socketSessions.get(socket.id);
    if (!session) {
      socket.emit("server_error", { message: "Join a room first." });
      return;
    }

    const room = rooms.get(session.roomCode);
    if (!room) {
      return;
    }

    if (!room.players.X || !room.players.O) {
      socket.emit("server_error", { message: "Waiting for second player." });
      return;
    }

    if (room.gameOver) {
      socket.emit("server_error", { message: "Round is over. Restart round." });
      return;
    }

    if (session.role !== room.turn) {
      socket.emit("server_error", { message: "Not your turn." });
      return;
    }

    if (!Number.isInteger(index) || index < 0 || index > 8) {
      socket.emit("server_error", { message: "Invalid move." });
      return;
    }

    if (room.board[index] !== "") {
      socket.emit("server_error", { message: "Cell already used." });
      return;
    }

    room.board[index] = session.role;

    const winner = checkWinner(room.board);
    if (winner) {
      room.gameOver = true;
      room.winner = winner;
      room.scores[winner] += 1;
    } else if (room.board.every((cell) => cell !== "")) {
      room.gameOver = true;
      room.winner = "";
      room.scores.draw += 1;
    } else {
      room.turn = room.turn === "X" ? "O" : "X";
    }

    emitRoomState(session.roomCode);
  });

  socket.on("restart_round", () => {
    const session = socketSessions.get(socket.id);
    if (!session) {
      return;
    }

    const room = rooms.get(session.roomCode);
    if (!room) {
      return;
    }

    room.board = Array(9).fill("");
    room.turn = "X";
    room.gameOver = false;
    room.winner = "";
    emitRoomState(session.roomCode);
  });

  socket.on("reset_score", () => {
    const session = socketSessions.get(socket.id);
    if (!session) {
      return;
    }

    const room = rooms.get(session.roomCode);
    if (!room) {
      return;
    }

    room.scores = { X: 0, O: 0, draw: 0 };
    room.board = Array(9).fill("");
    room.turn = "X";
    room.gameOver = false;
    room.winner = "";
    emitRoomState(session.roomCode);
  });

  socket.on("disconnect", () => {
    detachFromRoom(socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`XOX server running on http://localhost:${PORT}`);
});
