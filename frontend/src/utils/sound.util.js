// ── Web Audio API — sounds ───────────────────────────────────────────────────
let _ctx = null;
const getCtx = () => {
  if (!_ctx || _ctx.state === "closed") {
    _ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (_ctx.state === "suspended") _ctx.resume();
  return _ctx;
};

const _looping = {};

const makeOsc = (ctx, type, freq, startTime, endTime, maxGain = 0.3) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(maxGain, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, endTime);
  osc.start(startTime);
  osc.stop(endTime);
};

// ── 1. Âm tin nhắn đến ───────────────────────────────────────────────────────
const playMessageSound = () => {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    makeOsc(ctx, "sine", 1318, t, t + 0.18, 0.28);
    makeOsc(ctx, "sine", 1568, t + 0.1, t + 0.28, 0.22);
  } catch (e) {}
};

// ── 2. Âm chờ khi gọi đi ────────────────────────────────────────────────────
// Kiểu dial tone cổ điển: 2 nốt thấp xen kẽ nhau "bíp...bíp...bíp"
// 350Hz + 440Hz cùng lúc → tạo ra âm "bíp" trung tính đặc trưng
// Hoàn toàn khác chuông: sine thuần + tần số thấp vs square+LFO+tần số cao
let _callingAudio = null;

const startCallingSound = () => {
  try {
    stopCallingSound();
    _callingAudio = new Audio("/sounds/nhaccho.mp3");
    _callingAudio.loop = true;
    _callingAudio.volume = 0.7;
    _callingAudio.play().catch(() => {});
  } catch (e) {}
};

const stopCallingSound = () => {
  if (_callingAudio) {
    _callingAudio.pause();
    _callingAudio.currentTime = 0;
    _callingAudio = null;
  }
  if (_looping["calling"]) {
    clearInterval(_looping["calling"]);
    delete _looping["calling"];
  }
};

// ── 3. Âm chuông khi có cuộc gọi đến ────────────────────────────────────────
// "RENG RENG" — square wave cao + LFO rung mạnh
// Khác hẳn âm chờ: tần số cao hơn, loại sóng khác, có rung vibrato
export const playRingtoneBeep = () => {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;

    const playBurst = (offset) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.type = "sine";
      lfo.frequency.setValueAtTime(25, t + offset);
      lfoGain.gain.setValueAtTime(40, t + offset);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.type = "square";
      osc.frequency.setValueAtTime(480, t + offset);

      gainNode.gain.setValueAtTime(0, t + offset);
      gainNode.gain.linearRampToValueAtTime(0.5, t + offset + 0.03);
      gainNode.gain.setValueAtTime(0.5, t + offset + 0.32);
      gainNode.gain.linearRampToValueAtTime(0, t + offset + 0.4);

      lfo.start(t + offset);
      lfo.stop(t + offset + 0.4);
      osc.start(t + offset);
      osc.stop(t + offset + 0.4);
    };

    playBurst(0);
    playBurst(0.45);
  } catch (e) {}
};

// ── 4. Âm nhận cuộc gọi ─────────────────────────────────────────────────────
const playAcceptSound = () => {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    makeOsc(ctx, "sine", 523, t, t + 0.22, 0.35);
    makeOsc(ctx, "sine", 659, t + 0.13, t + 0.35, 0.32);
  } catch (e) {}
};

// ── 5. Âm tắt cuộc gọi ──────────────────────────────────────────────────────
const playHangupSound = () => {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    makeOsc(ctx, "sine", 392, t, t + 0.22, 0.38);
    makeOsc(ctx, "sine", 311, t + 0.15, t + 0.38, 0.32);
  } catch (e) {}
};

// ── Unified API ──────────────────────────────────────────────────────────────
export const playSound = (name) => {
  switch (name) {
    case "message":
      return playMessageSound();
    case "calling":
      return startCallingSound();
    case "accept":
      return playAcceptSound();
    case "hangup":
      return playHangupSound();
    default:
      break;
  }
};

export const stopSound = (name) => {
  if (name === "calling") stopCallingSound();
};
