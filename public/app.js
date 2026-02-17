const socket = window.io ? io({ transports: ["websocket", "polling"] }) : null;

const cells = document.querySelectorAll(".cell");
const statusText = document.getElementById("status");
const resetBtn = document.getElementById("resetBtn");
const resetScoreBtn = document.getElementById("resetScoreBtn");
const scoreXEl = document.getElementById("scoreX");
const scoreOEl = document.getElementById("scoreO");
const scoreDrawEl = document.getElementById("scoreDraw");
const celebrationEl = document.getElementById("celebration");
const celebrationTextEl = document.getElementById("celebrationText");
const confettiWrapEl = document.getElementById("confettiWrap");
const roomCodeInput = document.getElementById("roomCodeInput");
const copyCodeBtn = document.getElementById("copyCodeBtn");
const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const leaveRoomBtn = document.getElementById("leaveRoomBtn");
const roomInfo = document.getElementById("roomInfo");
const connectionText = document.getElementById("connectionText");
const setupTabBtn = document.getElementById("setupTabBtn");
const gameTabBtn = document.getElementById("gameTabBtn");
const setupScreen = document.getElementById("setupScreen");
const gameScreen = document.getElementById("gameScreen");
const soundToggleBtn = document.getElementById("soundToggleBtn");

const ROOM_CODE_KEY = "xox_room_code";
const PLAYER_TOKEN_KEY = "xox_player_token";

let currentState = null;
let inRoom = false;
let previousWinner = "";
let isConnected = false;
let gameReady = false;
let previousRoundKey = "";
let audioCtx = null;
let soundEnabled = localStorage.getItem("xox_sound_enabled") !== "false";

function setSoundEnabled(enabled) {
  soundEnabled = Boolean(enabled);
  localStorage.setItem("xox_sound_enabled", soundEnabled ? "true" : "false");
  soundToggleBtn.textContent = soundEnabled ? "Sound: ON" : "Sound: OFF";
  soundToggleBtn.classList.toggle("off", !soundEnabled);
}

function storeSession(roomCode, playerToken) {
  localStorage.setItem(ROOM_CODE_KEY, roomCode);
  localStorage.setItem(PLAYER_TOKEN_KEY, playerToken);
}

function clearSession() {
  localStorage.removeItem(ROOM_CODE_KEY);
  localStorage.removeItem(PLAYER_TOKEN_KEY);
}

function loadSession() {
  const roomCode = localStorage.getItem(ROOM_CODE_KEY) || "";
  const playerToken = localStorage.getItem(PLAYER_TOKEN_KEY) || "";
  return { roomCode, playerToken };
}

function tryAutoRejoin() {
  if (!socket || !isConnected) {
    return;
  }
  const { roomCode, playerToken } = loadSession();
  if (!roomCode || !playerToken) {
    return;
  }
  socket.emit("rejoin_room", { roomCode, playerToken });
  statusText.textContent = "Trying to reconnect to your previous room...";
}

function getAudioContext() {
  if (!audioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      return null;
    }
    audioCtx = new AudioCtx();
  }
  return audioCtx;
}

function playTone({ frequency = 440, duration = 0.08, type = "sine", volume = 0.06 }) {
  if (!soundEnabled) {
    return;
  }
  const ctx = getAudioContext();
  if (!ctx) {
    return;
  }
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.01);
}

function playButtonSound() {
  playTone({ frequency: 560, duration: 0.05, type: "triangle", volume: 0.05 });
}

function playMoveSound(player) {
  if (player === "X") {
    playTone({ frequency: 420, duration: 0.07, type: "square", volume: 0.05 });
  } else {
    playTone({ frequency: 520, duration: 0.07, type: "triangle", volume: 0.05 });
  }
}

function playWinSound() {
  playTone({ frequency: 660, duration: 0.08, type: "triangle", volume: 0.06 });
  setTimeout(() => playTone({ frequency: 880, duration: 0.09, type: "triangle", volume: 0.06 }), 90);
}

function playLossSound() {
  playTone({ frequency: 320, duration: 0.1, type: "sawtooth", volume: 0.05 });
  setTimeout(() => playTone({ frequency: 220, duration: 0.12, type: "sawtooth", volume: 0.05 }), 110);
}

function playDrawSound() {
  playTone({ frequency: 500, duration: 0.06, type: "sine", volume: 0.05 });
  setTimeout(() => playTone({ frequency: 500, duration: 0.06, type: "sine", volume: 0.05 }), 80);
}

function setActiveTab(tabName) {
  const isSetup = tabName === "setup";
  setupTabBtn.classList.toggle("active", isSetup);
  gameTabBtn.classList.toggle("active", !isSetup);
  setupTabBtn.setAttribute("aria-selected", String(isSetup));
  gameTabBtn.setAttribute("aria-selected", String(!isSetup));
  setupScreen.classList.toggle("hidden", !isSetup);
  gameScreen.classList.toggle("hidden", isSetup);
}

function updateGameGate(state) {
  const wasReady = gameReady;
  gameReady = Boolean(state && state.players && state.players.X && state.players.O);
  gameTabBtn.disabled = !gameReady;
  if (!wasReady && gameReady) {
    setActiveTab("game");
  }
}

function updateScoreboard(scores) {
  scoreXEl.textContent = String(scores?.X ?? 0);
  scoreOEl.textContent = String(scores?.O ?? 0);
  scoreDrawEl.textContent = String(scores?.draw ?? 0);
}

function canPlayCell(index) {
  if (!currentState || !inRoom || !gameReady) {
    return false;
  }

  if (currentState.gameOver) {
    return false;
  }

  if (currentState.youRole !== currentState.turn) {
    return false;
  }

  return currentState.board[index] === "";
}

function renderBoard(state) {
  cells.forEach((cell, index) => {
    const value = state?.board?.[index] ?? "";
    cell.textContent = value;
    cell.classList.remove("x", "o");
    if (value === "X") {
      cell.classList.add("x");
    }
    if (value === "O") {
      cell.classList.add("o");
    }
    cell.disabled = !canPlayCell(index);
  });
}

function renderStatus(state) {
  if (!state || !inRoom) {
    statusText.textContent = "Create or join a room to start.";
    return;
  }

  if (!gameReady) {
    statusText.textContent = "Waiting for second player to join...";
    return;
  }

  if (state.gameOver) {
    if (state.winner) {
      statusText.textContent = `Player ${state.winner} wins this round!`;
    } else {
      statusText.textContent = "Round is a draw.";
    }
    return;
  }

  const myTurn = state.youRole === state.turn;
  statusText.textContent = myTurn
    ? `Your turn (${state.youRole})`
    : `Opponent's turn (${state.turn})`;
}

function renderRoomInfo(state) {
  if (!state || !inRoom) {
    roomInfo.textContent = "Create a room and share code with your friend.";
    return;
  }

  const opponentRole = state.youRole === "X" ? "O" : "X";
  const opponentReady = state.players[opponentRole];
  roomInfo.textContent = `Room ${state.roomCode} | You are ${state.youRole} | Opponent: ${opponentReady ? "Connected" : "Waiting"}`;
}

function showCelebration(message, mood = "happy") {
  celebrationTextEl.textContent = message;
  celebrationTextEl.classList.remove("happy", "sad", "draw");
  celebrationTextEl.classList.add(mood);
  celebrationEl.classList.remove("sad-mode", "draw-mode");
  if (mood === "sad") {
    celebrationEl.classList.add("sad-mode");
    document.body.classList.add("loser-shake");
  } else if (mood === "draw") {
    celebrationEl.classList.add("draw-mode");
  }
  celebrationEl.classList.add("show");
  confettiWrapEl.innerHTML = "";

  const colorsByMood = {
    happy: ["#ff4d8d", "#2b7bff", "#7a57ff", "#22c55e", "#f59e0b"],
    sad: ["#9ca3af", "#6b7280", "#94a3b8", "#64748b", "#475569"],
    draw: ["#60a5fa", "#a78bfa", "#34d399", "#f59e0b", "#f472b6"],
  };
  const colors = colorsByMood[mood] || colorsByMood.happy;
  const pieces = mood === "happy" ? 70 : 30;

  for (let i = 0; i < pieces; i += 1) {
    const confetti = document.createElement("span");
    confetti.className = "confetti";
    confetti.style.left = `${Math.random() * 100}%`;
    confetti.style.backgroundColor = colors[i % colors.length];
    confetti.style.animationDelay = `${Math.random() * 0.5}s`;
    confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
    confettiWrapEl.appendChild(confetti);
  }

  setTimeout(() => {
    celebrationEl.classList.remove("show");
    celebrationEl.classList.remove("sad-mode", "draw-mode");
    document.body.classList.remove("loser-shake");
    confettiWrapEl.innerHTML = "";
  }, 1600);
}

function renderAll(state) {
  currentState = state;
  updateGameGate(state);
  updateScoreboard(state?.scores);
  renderBoard(state);
  renderStatus(state);
  renderRoomInfo(state);

  const roundKey = state?.gameOver ? `${state.winner || "draw"}-${state.board.join("")}` : "";

  if (state?.gameOver && roundKey && previousRoundKey !== roundKey) {
    if (state.winner && state.youRole === state.winner) {
      showCelebration("You Won! 🤩🎉🔥", "happy");
      playWinSound();
    } else if (state.winner) {
      showCelebration("You Lost... 😢😶", "sad");
      playLossSound();
    } else {
      showCelebration("Draw Round 🤝🙂", "draw");
      playDrawSound();
    }
  }

  if (!state?.gameOver) {
    previousWinner = "";
    previousRoundKey = "";
  } else {
    previousWinner = state.winner || "draw";
    previousRoundKey = roundKey;
  }
}

function normalizeRoomCode() {
  return roomCodeInput.value.trim().toUpperCase();
}

async function copyRoomCode() {
  const roomCode = normalizeRoomCode();
  if (!roomCode) {
    statusText.textContent = "No room code to copy yet.";
    return;
  }

  try {
    await navigator.clipboard.writeText(roomCode);
    statusText.textContent = `Room code copied: ${roomCode}`;
    playButtonSound();
  } catch (_error) {
    statusText.textContent = "Could not copy automatically. Please copy room code manually.";
  }
}

setupTabBtn.addEventListener("click", () => {
  playButtonSound();
  setActiveTab("setup");
});

gameTabBtn.addEventListener("click", () => {
  playButtonSound();
  if (!gameReady) {
    statusText.textContent = "Room not ready yet. Waiting for second player.";
    setActiveTab("setup");
    return;
  }
  setActiveTab("game");
});

copyCodeBtn.addEventListener("click", () => {
  copyRoomCode();
});

cells.forEach((cell) => {
  cell.addEventListener("click", (event) => {
    const index = Number(event.target.dataset.index);
    if (!canPlayCell(index) || !socket || !isConnected) {
      return;
    }
    playMoveSound(currentState?.youRole || "X");
    socket.emit("make_move", { index });
  });
});

createRoomBtn.addEventListener("click", () => {
  playButtonSound();
  if (!socket || !isConnected) {
    statusText.textContent = "Server not connected. Run npm start and open http://YOUR_PC_IP:3000";
    return;
  }
  socket.emit("create_room");
});

joinRoomBtn.addEventListener("click", () => {
  playButtonSound();
  if (!socket || !isConnected) {
    statusText.textContent = "Server not connected. Run npm start and open http://YOUR_PC_IP:3000";
    return;
  }

  const roomCode = normalizeRoomCode();
  if (!roomCode) {
    statusText.textContent = "Enter room code to join.";
    return;
  }
  socket.emit("join_room", { roomCode });
});

leaveRoomBtn.addEventListener("click", () => {
  playButtonSound();
  if (!socket || !isConnected) {
    return;
  }
  clearSession();
  socket.emit("leave_room");
});

resetBtn.addEventListener("click", () => {
  playButtonSound();
  if (!socket || !isConnected) {
    return;
  }
  socket.emit("restart_round");
});

resetScoreBtn.addEventListener("click", () => {
  playButtonSound();
  if (!socket || !isConnected) {
    return;
  }
  socket.emit("reset_score");
});

soundToggleBtn.addEventListener("click", () => {
  setSoundEnabled(!soundEnabled);
  playButtonSound();
});

if (!socket) {
  connectionText.textContent = "Socket library not loaded";
  statusText.textContent = "Start from server URL: http://localhost:3000";
} else {
  socket.on("connect", () => {
    isConnected = true;
    connectionText.textContent = "Connected";
    tryAutoRejoin();
  });

  socket.on("disconnect", () => {
    isConnected = false;
    connectionText.textContent = "Disconnected";
  });

  socket.on("room_joined", ({ roomCode, playerToken }) => {
    inRoom = true;
    roomCodeInput.value = roomCode;
    if (playerToken) {
      storeSession(roomCode, playerToken);
    }
    setActiveTab("setup");
  });

  socket.on("rejoin_failed", ({ message }) => {
    clearSession();
    statusText.textContent = message || "Could not reconnect to previous room.";
  });

  socket.on("room_left", () => {
    inRoom = false;
    currentState = null;
    previousWinner = "";
    previousRoundKey = "";
    updateGameGate(null);
    updateScoreboard();
    renderBoard(null);
    renderStatus(null);
    renderRoomInfo(null);
    setActiveTab("setup");
  });

  socket.on("room_state", (state) => {
    inRoom = true;
    renderAll(state);
  });

  socket.on("server_error", ({ message }) => {
    statusText.textContent = message;
  });
}

updateGameGate(null);
updateScoreboard();
renderBoard(null);
renderStatus(null);
renderRoomInfo(null);
setActiveTab("setup");
setSoundEnabled(soundEnabled);
