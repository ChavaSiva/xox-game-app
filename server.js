const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const WEB_ROOT = path.join(__dirname, "public");
const RECONNECT_GRACE_MS = 60000;

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

function generatePlayerToken() {
  return crypto.randomBytes(16).toString("hex");
}

function isPlayerConnected(room, role) {
  return Boolean(room.players[role] && room.players[role].connected);
}

function clearReconnectTimer(slot) {
  if (slot && slot.reconnectTimer) {
    clearTimeout(slot.reconnectTimer);
    slot.reconnectTimer = null;
  }
}

function resetRound(room) {
  room.board = Array(9).fill("");
  room.turn = "X";
  room.gameOver = false;
  room.winner = "";
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
      X: isPlayerConnected(room, "X"),
      O: isPlayerConnected(room, "O"),
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

  for (const role of ["X", "O"]) {
    const slot = room.players[role];
    if (slot && slot.connected && slot.socketId) {
      io.to(slot.socketId).emit("room_state", buildState(roomCode, role));
    }
  }
}

function removePlayerSlot(roomCode, role) {
  const room = rooms.get(roomCode);
  if (!room) {
    return;
  }

  const slot = room.players[role];
  if (!slot) {
    return;
  }

  clearReconnectTimer(slot);
  room.players[role] = null;

  const hasX = Boolean(room.players.X);
  const hasO = Boolean(room.players.O);

  if (!hasX && !hasO) {
    rooms.delete(roomCode);
    return;
  }

  resetRound(room);
  emitRoomState(roomCode);
}

function disconnectSession(socketId, keepForReconnect) {
  const session = socketSessions.get(socketId);
  if (!session) {
    return;
  }

  const room = rooms.get(session.roomCode);
  socketSessions.delete(socketId);

  if (!room) {
    return;
  }

  const slot = room.players[session.role];
  if (!slot || slot.token !== session.token) {
    return;
  }

  if (!keepForReconnect) {
    removePlayerSlot(session.roomCode, session.role);
    return;
  }

  slot.connected = false;
  slot.socketId = null;
  clearReconnectTimer(slot);

  slot.reconnectTimer = setTimeout(() => {
    const liveRoom = rooms.get(session.roomCode);
    if (!liveRoom) {
      return;
    }
    const liveSlot = liveRoom.players[session.role];
    if (!liveSlot) {
      return;
    }
    if (!liveSlot.connected && liveSlot.token === session.token) {
      removePlayerSlot(session.roomCode, session.role);
    }
  }, RECONNECT_GRACE_MS);

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
    disconnectSession(socket.id, false);

    let roomCode = "";
    do {
      roomCode = generateRoomCode();
    } while (rooms.has(roomCode));

    const room = createEmptyRoom();
    const token = generatePlayerToken();

    room.players.X = {
      socketId: socket.id,
      token,
      connected: true,
      reconnectTimer: null,
    };

    rooms.set(roomCode, room);
    socketSessions.set(socket.id, { roomCode, role: "X", token });
    socket.join(roomCode);

    socket.emit("room_joined", { roomCode, role: "X", playerToken: token });
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

    disconnectSession(socket.id, false);

    if (room.players.X && room.players.O) {
      socket.emit("server_error", { message: "Room is full." });
      return;
    }

    const role = room.players.X ? "O" : "X";
    const token = generatePlayerToken();

    room.players[role] = {
      socketId: socket.id,
      token,
      connected: true,
      reconnectTimer: null,
    };

    socketSessions.set(socket.id, { roomCode: normalizedCode, role, token });
    socket.join(normalizedCode);

    socket.emit("room_joined", { roomCode: normalizedCode, role, playerToken: token });
    emitRoomState(normalizedCode);
  });

  socket.on("rejoin_room", ({ roomCode, playerToken } = {}) => {
    const normalizedCode = (roomCode || "").trim().toUpperCase();
    const token = (playerToken || "").trim();

    if (!normalizedCode || !token) {
      socket.emit("server_error", { message: "Reconnect info missing." });
      return;
    }

    const room = rooms.get(normalizedCode);
    if (!room) {
      socket.emit("rejoin_failed", { message: "Previous room no longer exists." });
      return;
    }

    let role = "";
    for (const candidate of ["X", "O"]) {
      const slot = room.players[candidate];
      if (slot && slot.token === token) {
        role = candidate;
        break;
      }
    }

    if (!role) {
      socket.emit("rejoin_failed", { message: "Reconnect session expired." });
      return;
    }

    disconnectSession(socket.id, false);

    const slot = room.players[role];
    clearReconnectTimer(slot);
    slot.connected = true;
    slot.socketId = socket.id;

    socketSessions.set(socket.id, { roomCode: normalizedCode, role, token });
    socket.join(normalizedCode);

    socket.emit("room_joined", { roomCode: normalizedCode, role, playerToken: token });
    emitRoomState(normalizedCode);
  });

  socket.on("leave_room", () => {
    const session = socketSessions.get(socket.id);
    if (!session) {
      return;
    }

    socket.leave(session.roomCode);
    disconnectSession(socket.id, false);
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

    if (!isPlayerConnected(room, "X") || !isPlayerConnected(room, "O")) {
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

    resetRound(room);
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
    resetRound(room);
    emitRoomState(session.roomCode);
  });

  socket.on("disconnect", () => {
    disconnectSession(socket.id, true);
  });
});

server.listen(PORT, () => {
  console.log(`XOX server running on http://localhost:${PORT}`);
});
