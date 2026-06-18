const DEFAULT_BPM = 72;
const BPM_MIN = 20;
const BPM_MAX = 240;
const BPM_STEP = 2;
const TAP_WINDOW_MS = 2500;
const TAP_RESULT_HOLD_MS = 1500;

Page({
  data: {
    bpm: DEFAULT_BPM,
    beatsPerMeasure: 4,
    isRunning: false,
    currentBeat: 0,
    beatPulse: false,
    beatDots: [],
    tapHint: '点击打拍子',
    isTapPressed: false,
  },

  onLoad() {
    this.clickHigh = wx.createInnerAudioContext();
    this.clickHigh.src = '/audio/click-high.wav';
    this.clickLow = wx.createInnerAudioContext();
    this.clickLow.src = '/audio/click-low.wav';
    this.tapTimes = [];
    this.buildBeatDots();
  },

  onUnload() {
    this.clearTimer();
    if (this.tapHintTimer) {
      clearTimeout(this.tapHintTimer);
      this.tapHintTimer = null;
    }
    if (this.clickHigh) {
      this.clickHigh.destroy();
      this.clickHigh = null;
    }
    if (this.clickLow) {
      this.clickLow.destroy();
      this.clickLow = null;
    }
  },

  buildBeatDots() {
    const dots = [];
    for (let i = 1; i <= this.data.beatsPerMeasure; i++) {
      dots.push({ beat: i, active: false });
    }
    this.setData({ beatDots: dots });
  },

  updateBeatDots(activeBeat) {
    const dots = this.data.beatDots.map((d) =>
      Object.assign({}, d, { active: d.beat === activeBeat })
    );
    this.setData({ beatDots: dots });
  },

  increaseBpm() {
    const next = Math.min(BPM_MAX, this.data.bpm + BPM_STEP);
    this.setData({ bpm: next });
    if (this.data.isRunning) {
      this.restartTimer();
    }
  },

  decreaseBpm() {
    const next = Math.max(BPM_MIN, this.data.bpm - BPM_STEP);
    this.setData({ bpm: next });
    if (this.data.isRunning) {
      this.restartTimer();
    }
  },

  setTimeSignature(e) {
    const beats = Number(e.currentTarget.dataset.beats);
    if (!beats || beats === this.data.beatsPerMeasure) return;
    this.setData({ beatsPerMeasure: beats, currentBeat: 0 });
    this.buildBeatDots();
    if (this.data.isRunning) {
      this.restartTimer();
    }
  },

  handleTapTempoStart() {
    this.setData({ isTapPressed: true });
  },

  handleTapTempoEnd() {
    this.setData({ isTapPressed: false });
    this.handleTapTempo();
  },

  handleTapTempo() {
    const now = Date.now();
    this.tapTimes.push(now);

    while (this.tapTimes.length > 1 && now - this.tapTimes[0] > TAP_WINDOW_MS) {
      this.tapTimes.shift();
    }

    if (this.tapTimes.length >= 3) {
      let totalMs = 0;
      for (let i = 1; i < this.tapTimes.length; i++) {
        totalMs += this.tapTimes[i] - this.tapTimes[i - 1];
      }
      const avgMs = totalMs / (this.tapTimes.length - 1);
      const bpm = Math.round(60000 / avgMs);
      const clamped = Math.max(BPM_MIN, Math.min(BPM_MAX, bpm));
      this.setData({ bpm: clamped, tapHint: `${clamped} BPM` });

      if (this.data.isRunning) {
        this.restartTimer();
      }

      if (this.tapHintTimer) {
        clearTimeout(this.tapHintTimer);
      }
      this.tapHintTimer = setTimeout(() => {
        this.setData({ tapHint: '点击打拍子' });
      }, TAP_RESULT_HOLD_MS);
    } else {
      this.setData({ tapHint: `${this.tapTimes.length} 拍...` });
    }
  },

  toggleRunning() {
    if (this.data.isRunning) {
      this.stop();
    } else {
      this.start();
    }
  },

  start() {
    this.tapTimes = [];
    this.setData({ isRunning: true, currentBeat: 0, tapHint: '点击打拍子' });
    this.buildBeatDots();
    this.startBeatTimer();
  },

  stop() {
    this.clearTimer();
    this.setData({ isRunning: false, currentBeat: 0 });
    this.buildBeatDots();
  },

  startBeatTimer() {
    const beatMs = 60000 / this.data.bpm;
    let tick = -1;
    const startTime = Date.now();

    this.beatTimer = setInterval(() => {
      tick += 1;
      const idealTickTime = startTime + tick * beatMs;

      const beat = (tick % this.data.beatsPerMeasure) + 1;
      const isDownbeat = beat === 1;

      this.playClick(isDownbeat);

      this.setData({
        currentBeat: beat,
        beatPulse: !this.data.beatPulse,
      });
      this.updateBeatDots(beat);
    }, beatMs);
  },

  restartTimer() {
    this.clearTimer();
    this.startBeatTimer();
  },

  clearTimer() {
    if (this.beatTimer) {
      clearInterval(this.beatTimer);
      this.beatTimer = null;
    }
  },

  playClick(isDownbeat) {
    try {
      if (isDownbeat && this.clickLow) {
        this.clickLow.seek(0);
        this.clickLow.play();
      } else if (this.clickHigh) {
        this.clickHigh.seek(0);
        this.clickHigh.play();
      }
    } catch (_) {
      // Audio playback failures are non-critical.
    }
  },
});
