const {
  int16PcmToFloat32,
  createRingBuffer,
} = require('../../utils/audio-frame');
const { detectPitchYin } = require('../../utils/pitch-yin');
const { frequencyToNote, formatCentOffset } = require('../../utils/note');
const { getPieceById } = require('../../utils/score-practice/piece-library');
const {
  getScoreAssetCursor,
  getStaticScoreSystems,
} = require('../../utils/score-practice/score-assets');
const { createTimeline, getActiveNoteIndex } = require('../../utils/score-practice/metronome-timeline');
const { evaluateScorePractice } = require('../../utils/score-practice/score-evaluator');
const { buildAdvice } = require('../../utils/score-practice/score-feedback');

const SAMPLE_RATE = 44100;
const ANALYSIS_WINDOW = 4096;
const UI_INTERVAL_MS = 80;
const ANALYSIS_INTERVAL_MS = 80;
const RING_BUFFER_CAPACITY = ANALYSIS_WINDOW * 2;

function clampNoteIndex(piece, value, fallback) {
  const lastIndex = piece && Array.isArray(piece.notes) ? piece.notes.length - 1 : 0;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return Math.max(0, Math.min(lastIndex, Number(fallback || 0)));
  }
  return Math.max(0, Math.min(lastIndex, Math.floor(numeric)));
}

function buildScoreRange(piece, startIndex, endIndex) {
  const lastIndex = piece.notes.length - 1;
  const start = clampNoteIndex(piece, Math.min(startIndex, endIndex), 0);
  const end = clampNoteIndex(piece, Math.max(startIndex, endIndex), lastIndex);
  const startNote = piece.notes[start];
  const endNote = piece.notes[end];
  const isFullPiece = start === 0 && end === lastIndex;
  return {
    startNoteIndex: start,
    endNoteIndex: end,
    startLabel: startNote.label,
    endLabel: endNote.label,
    noteCount: end - start + 1,
    isFullPiece,
    label: isFullPiece ? '整首' : `${startNote.label} 至 ${endNote.label}`,
  };
}

Page({
  data: {
    empty: false,
    piece: null,
    isRunning: false,
    phaseText: '准备开始',
    statusText: '先稳定持琴，再点击开始。',
    countInText: '预备拍 4 拍',
    beatText: '--',
    beatPulse: false,
    progressText: '0 / 0',
    currentTargetText: '--',
    detectedText: '--',
    detectedPitchText: '--',
    notePreview: [],
    activeNoteIndex: 0,
    staffCompact: false,
    staffBeatWidth: 76,
    staffScale: 1.18,
    hasFormalScore: false,
    formalScoreSystems: [],
    currentSystem: null,
    previousSystemPreview: null,
    nextSystemPreview: null,
    activeNoteBox: null,
    activeSystemAnchor: '',
    activeSystemIndex: 0,
    scoreRange: null,
    rangeStartNoteIndex: 0,
    rangeEndNoteIndex: 0,
    rangeLabel: '整首',
    hasPartialRange: false,
    showRangeMarkers: false,
    rangeSelectionMode: false,
    rangeInstruction: '可选择片段练习',
    rangeButtonText: '选择片段',
    followMode: false,
    followModeText: '固定节拍',
  },

  onLoad(options) {
    const piece = getPieceById(options.pieceId);
    if (!piece) {
      this.setData({ empty: true });
      return;
    }

    this.piece = piece;
    const initialRange = buildScoreRange(
      piece,
      clampNoteIndex(piece, options.startNoteIndex, 0),
      clampNoteIndex(piece, options.endNoteIndex, piece.notes.length - 1)
    );
    const endBeat = piece.notes.reduce(
      (max, note) => Math.max(max, Number(note.startBeat || 0) + Number(note.durationBeat || 0)),
      0
    );
    const staffCompact = endBeat <= 64;
    const formalScoreSystems = getStaticScoreSystems(piece.id);
    const scoreAssetState = getScoreAssetCursor(piece.id, initialRange.startNoteIndex);
    this.recorder = wx.getRecorderManager();
    this.ringBuffer = null;
    this.pitchFrames = [];
    this.shouldFinishOnStop = false;

    // R3: Pre-create audio contexts for metronome clicks.
    this.clickHigh = wx.createInnerAudioContext();
    this.clickHigh.src = '/audio/click-high.wav';
    this.clickLow = wx.createInnerAudioContext();
    this.clickLow.src = '/audio/click-low.wav';

    this.bindRecorder();

    // R5: Preload score images.
    this.preloadScoreImages(formalScoreSystems);

    this.setData({
      piece: {
        id: piece.id,
        title: piece.title,
        bpm: piece.bpm,
        timeSignature: piece.timeSignature,
        keySignature: piece.keySignature,
        clef: piece.clef,
        staffDisplayRange: piece.staffDisplayRange,
        notes: piece.notes,
      },
      countInText: `预备拍 ${piece.countInBeats || 4} 拍`,
      progressText: `0 / ${initialRange.noteCount}`,
      currentTargetText: piece.notes[initialRange.startNoteIndex].label,
      activeNoteIndex: initialRange.startNoteIndex,
      staffCompact,
      staffBeatWidth: staffCompact ? 76 : 76,
      staffScale: staffCompact ? 0.78 : 1.18,
      hasFormalScore: scoreAssetState.hasFormalScore,
      formalScoreSystems,
      currentSystem: scoreAssetState.currentSystem,
      previousSystemPreview: scoreAssetState.previousSystemPreview,
      nextSystemPreview: scoreAssetState.nextSystemPreview,
      activeNoteBox: scoreAssetState.activeNoteBox,
      activeSystemAnchor: scoreAssetState.activeSystemAnchor,
      activeSystemIndex: scoreAssetState.activeSystemIndex,
      scoreRange: initialRange,
      rangeStartNoteIndex: initialRange.startNoteIndex,
      rangeEndNoteIndex: initialRange.endNoteIndex,
      rangeLabel: initialRange.label,
      hasPartialRange: !initialRange.isFullPiece,
      showRangeMarkers: !initialRange.isFullPiece,
      rangeInstruction: initialRange.isFullPiece ? '可选择片段练习' : `已选 ${initialRange.noteCount} 个音`,
      rangeButtonText: '选择片段',
      notePreview: piece.notes.slice(0, 8).map((note, index) => ({
        label: note.label,
        index,
        active: index === 0,
      })),
    });
  },

  preloadScoreImages(systems) {
    if (!systems || !systems.length) {
      return;
    }
    for (let i = 0; i < systems.length; i += 1) {
      if (systems[i] && systems[i].imageSrc) {
        wx.getImageInfo({
          src: systems[i].imageSrc,
          fail: function () { /* ignore preload failures */ },
        });
      }
    }
  },

  toggleFollowMode() {
    if (this.data.isRunning) {
      return;
    }
    const followMode = !this.data.followMode;
    this.setData({
      followMode,
      followModeText: followMode ? '跟随模式' : '固定节拍',
      statusText: followMode
        ? '跟随模式：高亮随演奏前进，可自由控制速度。'
        : '固定节拍：按曲谱速度评测。',
    });
  },

  toggleRangeSelection() {
    if (this.data.isRunning || !this.piece) {
      return;
    }

    this.pendingRangeStartIndex = null;
    this.setData({
      rangeSelectionMode: true,
      showRangeMarkers: true,
      rangeInstruction: '请选择起点音符',
      rangeButtonText: '重新选择',
    });
  },

  resetScoreRange() {
    if (this.data.isRunning || !this.piece) {
      return;
    }
    const range = buildScoreRange(this.piece, 0, this.piece.notes.length - 1);
    const scoreAssetState = getScoreAssetCursor(this.piece.id, range.startNoteIndex);
    this.pendingRangeStartIndex = null;
    this.setData({
      scoreRange: range,
      rangeStartNoteIndex: range.startNoteIndex,
      rangeEndNoteIndex: range.endNoteIndex,
      rangeLabel: range.label,
      hasPartialRange: false,
      showRangeMarkers: false,
      rangeSelectionMode: false,
      rangeInstruction: '可选择片段练习',
      rangeButtonText: '选择片段',
      progressText: `0 / ${range.noteCount}`,
      currentTargetText: this.piece.notes[range.startNoteIndex].label,
      activeNoteIndex: range.startNoteIndex,
      currentSystem: scoreAssetState.currentSystem,
      previousSystemPreview: scoreAssetState.previousSystemPreview,
      nextSystemPreview: scoreAssetState.nextSystemPreview,
      activeNoteBox: scoreAssetState.activeNoteBox,
      activeSystemAnchor: scoreAssetState.activeSystemAnchor,
      activeSystemIndex: scoreAssetState.activeSystemIndex,
    });
  },

  selectScoreNote(event) {
    if (!this.data.rangeSelectionMode || this.data.isRunning || !this.piece) {
      return;
    }
    const noteIndex = Number(event.currentTarget.dataset.noteIndex);
    this.applySelectedNote(noteIndex);
  },

  selectStaffNote(event) {
    if (!event || !event.detail) {
      return;
    }
    this.applySelectedNote(Number(event.detail.noteIndex));
  },

  applySelectedNote(noteIndex) {
    if (!Number.isFinite(noteIndex)) {
      return;
    }
    const safeIndex = clampNoteIndex(this.piece, noteIndex, 0);

    if (this.pendingRangeStartIndex === null || this.pendingRangeStartIndex === undefined) {
      this.pendingRangeStartIndex = safeIndex;
      const range = buildScoreRange(this.piece, safeIndex, safeIndex);
      this.setData({
        scoreRange: range,
        rangeStartNoteIndex: range.startNoteIndex,
        rangeEndNoteIndex: range.endNoteIndex,
        rangeLabel: range.label,
        hasPartialRange: true,
        showRangeMarkers: true,
        rangeInstruction: '请选择截止音符',
      });
      return;
    }

    const range = buildScoreRange(this.piece, this.pendingRangeStartIndex, safeIndex);
    const scoreAssetState = getScoreAssetCursor(this.piece.id, range.startNoteIndex);
    this.pendingRangeStartIndex = null;
    this.setData({
      scoreRange: range,
      rangeStartNoteIndex: range.startNoteIndex,
      rangeEndNoteIndex: range.endNoteIndex,
      rangeLabel: range.label,
      hasPartialRange: !range.isFullPiece,
      showRangeMarkers: !range.isFullPiece,
      rangeSelectionMode: false,
      rangeInstruction: range.isFullPiece ? '可选择片段练习' : `已选 ${range.noteCount} 个音`,
      rangeButtonText: '选择片段',
      progressText: `0 / ${range.noteCount}`,
      currentTargetText: this.piece.notes[range.startNoteIndex].label,
      activeNoteIndex: range.startNoteIndex,
      currentSystem: scoreAssetState.currentSystem,
      previousSystemPreview: scoreAssetState.previousSystemPreview,
      nextSystemPreview: scoreAssetState.nextSystemPreview,
      activeNoteBox: scoreAssetState.activeNoteBox,
      activeSystemAnchor: scoreAssetState.activeSystemAnchor,
      activeSystemIndex: scoreAssetState.activeSystemIndex,
    });
  },

  onUnload() {
    this.clearTimers();
    this.shouldFinishOnStop = false;
    if (this.data.isRunning) {
      this.recorder.stop();
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

  bindRecorder() {
    this.recorder.onStart(() => {
      this.practiceStartTime = Date.now();
      this.setData({
        isRunning: true,
        statusText: '预备拍进行中，请准备起弓。',
      });
    });

    this.recorder.onStop(() => {
      if (this.shouldFinishOnStop) {
        this.shouldFinishOnStop = false;
        this.finishPractice();
        return;
      }

      this.setData({ isRunning: false });
    });

    this.recorder.onError((error) => {
      this.clearTimers();
      this.shouldFinishOnStop = false;
      this.setData({
        isRunning: false,
        phaseText: '录音失败',
        statusText: '请检查麦克风权限后重试。',
      });
      wx.showToast({
        title: error.errMsg || '录音失败',
        icon: 'none',
      });
    });

    this.recorder.onFrameRecorded((res) => {
      if (!res || !res.frameBuffer) {
        return;
      }
      this.handleFrame(res.frameBuffer);
    });
  },

  startPractice() {
    if (!this.piece || this.data.isRunning) {
      return;
    }
    if (this.data.rangeSelectionMode) {
      wx.showToast({
        title: this.pendingRangeStartIndex === null || this.pendingRangeStartIndex === undefined
          ? '请先选择起点'
          : '请先选择截止音',
        icon: 'none',
      });
      return;
    }

    wx.authorize({
      scope: 'scope.record',
      success: () => this.startRecorder(),
      fail: () => {
        wx.showModal({
          title: '需要麦克风权限',
          content: '请允许录音权限后重新开始曲谱评测。',
          confirmText: '去设置',
          success: (res) => {
            if (res.confirm) {
              wx.openSetting();
            }
          },
        });
      },
    });
  },

  stopPractice() {
    if (this.data.isRunning) {
      this.recorder.stop();
    }
  },

  startRecorder() {
    this.ringBuffer = createRingBuffer(RING_BUFFER_CAPACITY);
    this.pitchFrames = [];
    this.lastUiAt = 0;
    this.lastAnalysisAt = 0;
    this.shouldFinishOnStop = true;
    this.practiceStartTime = null;
    this.lastActiveSystemIndex = -1;

    const scoreRange = this.data.scoreRange || buildScoreRange(this.piece, 0, this.piece.notes.length - 1);
    this.timeline = createTimeline(this.piece, {
      createdAt: Date.now(),
      startNoteIndex: scoreRange.startNoteIndex,
      endNoteIndex: scoreRange.endNoteIndex,
    });

    this.recorder.start({
      duration: 600000,
      sampleRate: SAMPLE_RATE,
      numberOfChannels: 1,
      encodeBitRate: 256000,
      format: 'PCM',
      frameSize: 4,
    });

    this.setData({
      rangeSelectionMode: false,
      phaseText: '预备拍',
      statusText: '预备拍进行中，请准备起弓。',
      beatText: `1 / ${this.timeline.countInBeats}`,
    });

    this.startBeatTimer();

    // F3: Follow mode allows extra time (2x) for users to play at their own pace.
    const followMultiplier = this.data.followMode ? 2.5 : 1;
    this.stopTimer = setTimeout(() => {
      this.stopPractice();
    }, (this.timeline.preRollMs + this.timeline.windows[this.timeline.windows.length - 1].expectedEndMs + this.timeline.beatDurationMs) * followMultiplier);
  },

  playClick(isDownbeat) {
    // R3: Metronome click sound. High pitch for downbeat, low for others.
    try {
      if (isDownbeat && this.clickLow) {
        this.clickLow.play();
      } else if (this.clickHigh) {
        this.clickHigh.play();
      }
    } catch (e) {
      // Audio playback failures are non-critical.
    }
  },

  startBeatTimer() {
    const totalBeats = Math.ceil(this.timeline.windows[this.timeline.windows.length - 1].expectedEndMs / this.timeline.beatDurationMs);
    const countInBeats = this.timeline.countInBeats;
    const beatsPerMeasure = this.timeline.signature.beatsPerMeasure || 4;
    let tick = 0;

    // A5: Track ideal beat times to compensate for setInterval drift.
    const idealTickStart = this.timeline.createdAt;
    const beatMs = this.timeline.beatDurationMs;

    this.beatTimer = setInterval(() => {
      tick += 1;
      // A5: Compute ideal time for this tick instead of relying on Date.now().
      const idealTickTime = idealTickStart + tick * beatMs;

      if (tick <= countInBeats) {
        // R4: Play click during count-in.
        const isDownbeat = tick === 1;
        this.playClick(isDownbeat);

        this.setData({
          phaseText: '预备拍',
          beatText: `${tick} / ${countInBeats}`,
          statusText: tick === countInBeats ? '下一拍进入正式评测。' : '跟着拍点准备起弓。',
          beatPulse: !this.data.beatPulse,
        });
        return;
      }

      const musicalBeat = tick - countInBeats;
      const isDownbeat = (musicalBeat - 1) % beatsPerMeasure === 0;
      this.playClick(isDownbeat);

      // F2: In follow mode, skip timeline-driven activeNoteIndex updates.
      // The highlight advances via pitch detection in handleFrame instead.
      if (this.data.followMode) {
        this.setData({
          phaseText: '跟随中',
          beatText: `${musicalBeat} / ${totalBeats}`,
          beatPulse: !this.data.beatPulse,
        });
        return;
      }

      // A5: Use ideal tick time for note lookup to avoid setInterval drift.
      const activeIndex = getActiveNoteIndex(this.timeline, idealTickTime);
      const currentNote = this.timeline.getWindowForNote(activeIndex);
      const sequenceProgress = currentNote ? currentNote.sequenceIndex + 1 : 0;

      // R2: Only update score asset data when system index changes.
      const scoreAssetChanged = activeIndex !== this.data.activeNoteIndex;
      let scoreAssetUpdate = {};
      if (scoreAssetChanged) {
        const scoreAssetState = getScoreAssetCursor(this.piece.id, activeIndex);
        scoreAssetUpdate = {
          currentSystem: scoreAssetState.currentSystem,
          previousSystemPreview: scoreAssetState.previousSystemPreview,
          nextSystemPreview: scoreAssetState.nextSystemPreview,
          activeNoteBox: scoreAssetState.activeNoteBox,
          activeSystemAnchor: scoreAssetState.activeSystemAnchor,
          activeSystemIndex: scoreAssetState.activeSystemIndex,
        };
      }

      this.setData(Object.assign({
        phaseText: '评测中',
        beatText: `${musicalBeat} / ${totalBeats}`,
        beatPulse: !this.data.beatPulse,
        currentTargetText: currentNote ? currentNote.targetNote : '--',
        progressText: `${Math.min(sequenceProgress, this.timeline.windows.length)} / ${this.timeline.windows.length}`,
        activeNoteIndex: Math.max(0, activeIndex),
      }, scoreAssetUpdate));
    }, beatMs);
  },

  handleFrame(frameBuffer) {
    const chunk = int16PcmToFloat32(frameBuffer);
    if (!chunk.length) {
      return;
    }

    // P5: Append to ring buffer instead of maintaining chunk array.
    this.ringBuffer.append(chunk);

    const timestamp = Date.now();

    // R1: Run analysis on every frame (no throttling), but throttle UI updates.
    const windowBuffer = this.ringBuffer.getRecent(ANALYSIS_WINDOW);
    if (windowBuffer.length < ANALYSIS_WINDOW) {
      return;
    }

    const pitch = detectPitchYin(windowBuffer, SAMPLE_RATE);
    this.pitchFrames.push({
      frequency: pitch.frequency,
      confidence: pitch.confidence,
      rms: pitch.rms,
      timestamp,
    });

    // F1: Follow mode — advance highlight based on detected pitch.
    if (this.data.followMode && pitch.confidence >= 0.55 && pitch.frequency > 0) {
      this.tryAdvanceByPitch(pitch.frequency, timestamp);
    }

    if (timestamp - this.lastUiAt >= UI_INTERVAL_MS) {
      this.lastUiAt = timestamp;
      this.updateDetectedUi(pitch);
    }
  },

  tryAdvanceByPitch(detectedFreq, timestamp) {
    if (!this.timeline || !this.data.isRunning || !this.piece) {
      return;
    }

    // Only active after count-in.
    const elapsedSinceStart = timestamp - this.timeline.startTimestamp;
    if (elapsedSinceStart < 0) {
      return;
    }

    const { frequencyToTargetCentOffset } = require('../../utils/note');
    const windows = this.timeline.windows;
    const currentSeqIndex = this.data.activeNoteIndex - this.timeline.range.startNoteIndex;

    // Look ahead up to 2 notes (current + next) to find a match.
    for (let i = 0; i <= 1; i += 1) {
      const seqIdx = currentSeqIndex + i;
      if (seqIdx < 0 || seqIdx >= windows.length) {
        break;
      }
      const window = windows[seqIdx];
      const centOffset = frequencyToTargetCentOffset(detectedFreq, window.note.targetFrequency);
      if (centOffset === null) {
        continue;
      }

      if (Math.abs(centOffset) <= window.pitchToleranceCent) {
        // Require consecutive confirmations before advancing to avoid spurious jumps.
        if (seqIdx > currentSeqIndex) {
          if (this.pendingFollowIndex === window.noteIndex) {
            this.pendingFollowConfirmCount = (this.pendingFollowConfirmCount || 0) + 1;
          } else {
            this.pendingFollowIndex = window.noteIndex;
            this.pendingFollowConfirmCount = 1;
          }
          if (this.pendingFollowConfirmCount >= 2) {
            this.advanceActiveNote(window.noteIndex);
            this.pendingFollowIndex = null;
            this.pendingFollowConfirmCount = 0;
          }
        }
        break;
      }
    }
  },

  advanceActiveNote(noteIndex) {
    if (!this.piece || noteIndex === this.data.activeNoteIndex) {
      return;
    }
    const window = this.timeline.getWindowForNote(noteIndex);
    const sequenceProgress = window ? window.sequenceIndex + 1 : 0;
    const scoreAssetState = getScoreAssetCursor(this.piece.id, noteIndex);
    this.setData({
      activeNoteIndex: noteIndex,
      currentTargetText: window ? window.targetNote : '--',
      progressText: `${Math.min(sequenceProgress, this.timeline.windows.length)} / ${this.timeline.windows.length}`,
      currentSystem: scoreAssetState.currentSystem,
      previousSystemPreview: scoreAssetState.previousSystemPreview,
      nextSystemPreview: scoreAssetState.nextSystemPreview,
      activeNoteBox: scoreAssetState.activeNoteBox,
      activeSystemAnchor: scoreAssetState.activeSystemAnchor,
      activeSystemIndex: scoreAssetState.activeSystemIndex,
    });
  },

  updateDetectedUi(pitch) {
    if (!pitch.frequency || pitch.confidence < 0.55) {
      this.setData({
        detectedText: '检测音：--',
        detectedPitchText: pitch.rms < 0.01 ? '请拉出稳定单音' : '当前置信度较低',
      });
      return;
    }

    const noteInfo = frequencyToNote(pitch.frequency);
    this.setData({
      detectedText: `检测音：${noteInfo.label}`,
      detectedPitchText: `${pitch.frequency.toFixed(1)} Hz`,
    });
  },

  finishPractice() {
    this.clearTimers();
    // O1: Use actual practice duration, not theoretical.
    const actualDurationMs = this.practiceStartTime
      ? Date.now() - this.practiceStartTime
      : this.timeline.windows[this.timeline.windows.length - 1].expectedEndMs;

    // O2: Truncate pitchFrames to the last window's expected end time.
    const lastWindowEnd = this.timeline.windows[this.timeline.windows.length - 1].expectedEndMs;
    const lastFrameTime = this.timeline.startTimestamp + lastWindowEnd;
    const trimmedFrames = this.pitchFrames.filter(
      (frame) => frame.timestamp <= lastFrameTime
    );

    const evaluation = evaluateScorePractice(trimmedFrames, this.timeline);
    const feedback = buildAdvice(evaluation.noteResults);
    const scoreRange = this.data.scoreRange || buildScoreRange(this.piece, 0, this.piece.notes.length - 1);
    const session = {
      sessionType: 'score_practice',
      pieceId: this.piece.id,
      pieceTitle: this.piece.title,
      scoreRange,
      bpm: this.timeline.bpm,
      timeSignature: this.piece.timeSignature,
      summaryScores: Object.assign({}, evaluation.summaryScores),
      noteResults: evaluation.noteResults,
      feedbackTags: feedback.feedbackTags,
      advice: feedback.advice,
      startedAt: this.timeline.startTimestamp,
      durationSec: Math.round(actualDurationMs / 1000),
    };

    const app = getApp();
    app.globalData.latestSession = session;
    app.globalData.latestRecordingPath = '';
    app.globalData.latestRecordingMeta = null;

    this.setData({
      isRunning: false,
      phaseText: '已完成',
      statusText: '正在生成结果页。',
    });

    wx.redirectTo({
      url: `/pages/score-result/score-result?pieceId=${this.piece.id}`,
    });
  },

  clearTimers() {
    if (this.beatTimer) {
      clearInterval(this.beatTimer);
      this.beatTimer = null;
    }
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    this.pendingFollowIndex = null;
    this.pendingFollowConfirmCount = 0;
  },
});
