const {
  int16PcmToFloat32,
  createRingBuffer,
} = require('../../utils/audio-frame');
const { detectPitchYin } = require('../../utils/pitch-yin');
const { frequencyToNote } = require('../../utils/note');
const { getPieceById } = require('../../utils/score-practice/piece-library');
const {
  getScoreAssetCursor,
  getStaticScoreSystems,
} = require('../../utils/score-practice/score-assets');
const { createTimeline, getActiveNoteIndex } = require('../../utils/score-practice/metronome-timeline');
const { evaluateScorePractice } = require('../../utils/score-practice/score-evaluator');
const { buildAdvice } = require('../../utils/score-practice/score-feedback');
const { createPerformanceAligner } = require('../../utils/score-practice/performance-aligner');
const { createPitchGateAligner } = require('../../utils/score-practice/pitch-gate-aligner');

const SAMPLE_RATE = 44100;
const ANALYSIS_WINDOW = 4096;
const UI_INTERVAL_MS = 80;
const ANALYSIS_INTERVAL_MS = 80;
const RING_BUFFER_CAPACITY = ANALYSIS_WINDOW * 2;
const PRACTICE_MODES = ['fixed', 'follow', 'pitch-gate'];
const SCORE_SYSTEM_GAP_RPX = 14;
const SCORE_LIST_PADDING_TOP_RPX = 4;
const SCORE_LIST_RUNNING_PADDING_BOTTOM_RPX = 132;

function getPracticeModeCopy(mode) {
  if (mode === 'pitch-gate') {
    return {
      label: '音准闯关',
      statusText: '音准闯关：拉准当前音后才进入下一个音。',
    };
  }
  if (mode === 'follow') {
    return {
      label: '跟随模式',
      statusText: '跟随模式：高亮随演奏前进，可自由控制速度。',
    };
  }
  return {
    label: '固定节拍',
    statusText: '固定节拍：按曲谱速度评测。',
  };
}

function getPracticeModeState(mode) {
  return {
    practiceMode: mode,
    followMode: mode === 'follow',
    followModeText: getPracticeModeCopy(mode).label,
    isFixedMode: mode === 'fixed',
    isFollowPracticeMode: mode === 'follow',
    isPitchGatePracticeMode: mode === 'pitch-gate',
  };
}

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

function getRangeSelectionCopy(range, options = {}) {
  const awaitingEnd = Boolean(options.awaitingEnd);
  const selectionMode = Boolean(options.selectionMode);

  if (selectionMode) {
    return {
      rangeInstruction: awaitingEnd ? '请选择截止音符' : '请选择起点音符',
      rangeButtonText: '重新选段',
      startButtonText: awaitingEnd ? '等待终点' : '等待起点',
      startHelperText: awaitingEnd ? '起点已选，请在谱面上点选终点。' : '请先在谱面上点选起点。',
    };
  }

  if (range && !range.isFullPiece) {
    return {
      rangeInstruction: `已选 ${range.noteCount} 个音，可直接开始`,
      rangeButtonText: '重新选段',
      startButtonText: '开始片段评测',
      startHelperText: `将从 ${range.startLabel} 至 ${range.endLabel} 直接进入评测。`,
    };
  }

  return {
    rangeInstruction: '可切换为片段练习',
    rangeButtonText: '选择片段',
    startButtonText: '开始整首评测',
    startHelperText: '将从第一个音开始完整评测。',
  };
}

function rpxToPx(rpx, windowWidthPx) {
  return (Number(rpx || 0) * Number(windowWidthPx || 0)) / 750;
}

function getRenderedSystemHeight(system, windowWidthPx) {
  const width = Number(system && system.width);
  const height = Number(system && system.height);
  if (!width || !height || !windowWidthPx) {
    return 0;
  }
  return (height / width) * windowWidthPx;
}

function buildScoreScrollMetrics(systems, options = {}) {
  const windowWidthPx = Number(options.windowWidthPx || 0);
  const viewportHeightPx = Number(options.viewportHeightPx || 0);
  const paddingTopPx = rpxToPx(SCORE_LIST_PADDING_TOP_RPX, windowWidthPx);
  const gapPx = rpxToPx(SCORE_SYSTEM_GAP_RPX, windowWidthPx);
  const paddingBottomPx = rpxToPx(SCORE_LIST_RUNNING_PADDING_BOTTOM_RPX, windowWidthPx);
  const systemTops = [];
  let contentHeightPx = paddingTopPx;

  for (let i = 0; i < systems.length; i += 1) {
    systemTops[i] = contentHeightPx;
    contentHeightPx += getRenderedSystemHeight(systems[i], windowWidthPx);
    if (i < systems.length - 1) {
      contentHeightPx += gapPx;
    }
  }

  contentHeightPx += paddingBottomPx;

  return {
    systemTops,
    contentHeightPx,
    maxScrollTopPx: Math.max(0, contentHeightPx - viewportHeightPx),
  };
}

function getMidlineClampedScrollTop(systems, activeSystemIndex, options = {}) {
  const viewportHeightPx = Number(options.viewportHeightPx || 0);
  if (!systems || !systems.length || viewportHeightPx <= 0) {
    return 0;
  }

  const metrics = buildScoreScrollMetrics(systems, options);
  const safeIndex = Math.max(0, Math.min(systems.length - 1, Number(activeSystemIndex || 0)));
  const activeSystem = systems[safeIndex];
  const activeNoteBox = options.activeNoteBox || null;
  const noteCenterPercent = activeNoteBox
    ? Number(activeNoteBox.yPercent || 0) + Number(activeNoteBox.heightPercent || 0) / 2
    : 0;
  const noteOffsetPx = activeNoteBox
    ? getRenderedSystemHeight(activeSystem, Number(options.windowWidthPx || 0)) * (noteCenterPercent / 100)
    : 0;
  const targetTopPx = Number(metrics.systemTops[safeIndex] || 0) + noteOffsetPx;
  const desiredScrollTopPx = targetTopPx - viewportHeightPx / 2;
  return Math.round(Math.max(0, Math.min(metrics.maxScrollTopPx, desiredScrollTopPx)));
}

function buildScoreAssetUpdate(pieceId, noteIndex, currentActiveSystemIndex, options = {}) {
  const scoreAssetState = getScoreAssetCursor(pieceId, noteIndex);
  const systemChanged = Boolean(options.forceSystemUpdate) ||
    Number(scoreAssetState.activeSystemIndex) !== Number(currentActiveSystemIndex);
  const update = {
    activeNoteBox: scoreAssetState.activeNoteBox,
  };

  if (systemChanged) {
    update.currentSystem = scoreAssetState.currentSystem;
    update.previousSystemPreview = scoreAssetState.previousSystemPreview;
    update.nextSystemPreview = scoreAssetState.nextSystemPreview;
    update.activeSystemAnchor = scoreAssetState.activeSystemAnchor;
    update.activeSystemIndex = scoreAssetState.activeSystemIndex;
  }

  if (typeof options.getScrollTopForActiveNote === 'function') {
    update.activeScoreScrollTop = options.getScrollTopForActiveNote(
      scoreAssetState.activeSystemIndex,
      scoreAssetState.activeNoteBox
    );
  }

  return update;
}

Page({
  data: {
    empty: false,
    piece: null,
    isRunning: false,
    phaseText: '准备开始',
    statusText: '按既定拍速推进，适合完整节奏评测。',
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
    activeScoreScrollTop: 0,
    scoreRange: null,
    rangeStartNoteIndex: 0,
    rangeEndNoteIndex: 0,
    rangeLabel: '整首',
    hasPartialRange: false,
    showRangeMarkers: false,
    rangeSelectionMode: false,
    rangeInstruction: '可切换为片段练习',
    rangeButtonText: '选择片段',
    startButtonText: '开始整首评测',
    startHelperText: '将从第一个音开始完整评测。',
    focusTipText: '',
    followMode: false,
    practiceMode: 'fixed',
    followModeText: '固定节拍',
    isFixedMode: true,
    isFollowPracticeMode: false,
    isPitchGatePracticeMode: false,
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
    const initialRangeCopy = getRangeSelectionCopy(initialRange);
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

    this.bindRecorder();

    // R5: Preload score images.
    this.preloadScoreImages(formalScoreSystems);

    this.setData({
      piece: {
        id: piece.id,
        title: piece.title,
        difficulty: piece.difficulty,
        bpm: piece.bpm,
        timeSignature: piece.timeSignature,
        keySignature: piece.keySignature,
        clef: piece.clef,
        staffDisplayRange: piece.staffDisplayRange,
        estimatedDurationSec: piece.estimatedDurationSec,
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
      rangeInstruction: initialRangeCopy.rangeInstruction,
      rangeButtonText: initialRangeCopy.rangeButtonText,
      startButtonText: initialRangeCopy.startButtonText,
      startHelperText: initialRangeCopy.startHelperText,
      focusTipText: (piece.focusTips || []).join(' · '),
      notePreview: piece.notes.slice(0, 8).map((note, index) => ({
        label: note.label,
        index,
        active: index === 0,
      })),
    }, () => this.refreshScoreScrollViewport());
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

  getScoreWindowWidth() {
    if (this.scoreWindowWidthPx > 0) {
      return this.scoreWindowWidthPx;
    }

    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      this.scoreWindowWidthPx = Number(info.windowWidth || 0);
      this.scoreWindowHeightPx = Number(info.windowHeight || 0);
    } catch (e) {
      this.scoreWindowWidthPx = 375;
      this.scoreWindowHeightPx = 667;
    }

    return this.scoreWindowWidthPx;
  },

  getScoreScrollViewportHeight() {
    if (this.scoreScrollViewportHeightPx > 0) {
      return this.scoreScrollViewportHeightPx;
    }
    if (!this.scoreWindowHeightPx) {
      this.getScoreWindowWidth();
    }
    return Math.max(240, Math.round(Number(this.scoreWindowHeightPx || 667) * 0.52));
  },

  refreshScoreScrollViewport() {
    if (!this.data.hasFormalScore) {
      return;
    }

    wx.createSelectorQuery()
      .in(this)
      .select('.formal-score-scroll')
      .boundingClientRect((rect) => {
        if (rect && rect.height > 0) {
          this.scoreScrollViewportHeightPx = rect.height;
          this.syncActiveScoreScroll();
        }
      })
      .exec();
  },

  getScoreScrollTopForActiveNote(systemIndex, activeNoteBox) {
    return getMidlineClampedScrollTop(this.data.formalScoreSystems, systemIndex, {
      windowWidthPx: this.getScoreWindowWidth(),
      viewportHeightPx: this.getScoreScrollViewportHeight(),
      activeNoteBox,
    });
  },

  syncActiveScoreScroll() {
    if (!this.data.hasFormalScore) {
      return;
    }
    const activeScoreScrollTop = this.getScoreScrollTopForActiveNote(this.data.activeSystemIndex, this.data.activeNoteBox);
    if (activeScoreScrollTop !== this.data.activeScoreScrollTop) {
      this.setData({ activeScoreScrollTop });
    }
  },

  buildActiveScoreAssetUpdate(noteIndex, options = {}) {
    return buildScoreAssetUpdate(this.piece.id, noteIndex, this.data.activeSystemIndex, {
      forceSystemUpdate: options.forceSystemUpdate,
      getScrollTopForActiveNote: (systemIndex, activeNoteBox) =>
        this.getScoreScrollTopForActiveNote(systemIndex, activeNoteBox),
    });
  },

  toggleFollowMode() {
    if (this.data.isRunning) {
      return;
    }
    const currentIndex = PRACTICE_MODES.indexOf(this.data.practiceMode);
    const practiceMode = PRACTICE_MODES[(currentIndex + 1) % PRACTICE_MODES.length];
    this.setPracticeMode(practiceMode);
  },

  setPracticeModeByTap(event) {
    const mode = event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.mode
      : '';
    if (PRACTICE_MODES.indexOf(mode) < 0 || this.data.isRunning) {
      return;
    }
    this.setPracticeMode(mode);
  },

  setPracticeMode(practiceMode) {
    const copy = getPracticeModeCopy(practiceMode);
    this.setData(Object.assign({}, getPracticeModeState(practiceMode), {
      statusText: copy.statusText,
    }));
  },

  toggleRangeSelection() {
    if (this.data.isRunning || !this.piece) {
      return;
    }

    this.pendingRangeStartIndex = null;
    const selectionCopy = getRangeSelectionCopy(this.data.scoreRange, { selectionMode: true });
    this.setData({
      rangeSelectionMode: true,
      showRangeMarkers: true,
      rangeInstruction: selectionCopy.rangeInstruction,
      rangeButtonText: selectionCopy.rangeButtonText,
      startButtonText: selectionCopy.startButtonText,
      startHelperText: selectionCopy.startHelperText,
    });
  },

  resetScoreRange() {
    if (this.data.isRunning || !this.piece) {
      return;
    }
    const range = buildScoreRange(this.piece, 0, this.piece.notes.length - 1);
    const rangeCopy = getRangeSelectionCopy(range);
    this.pendingRangeStartIndex = null;
    this.setData(Object.assign({
      scoreRange: range,
      rangeStartNoteIndex: range.startNoteIndex,
      rangeEndNoteIndex: range.endNoteIndex,
      rangeLabel: range.label,
      hasPartialRange: false,
      showRangeMarkers: false,
      rangeSelectionMode: false,
      rangeInstruction: rangeCopy.rangeInstruction,
      rangeButtonText: rangeCopy.rangeButtonText,
      startButtonText: rangeCopy.startButtonText,
      startHelperText: rangeCopy.startHelperText,
      progressText: `0 / ${range.noteCount}`,
      currentTargetText: this.piece.notes[range.startNoteIndex].label,
      activeNoteIndex: range.startNoteIndex,
    }, this.buildActiveScoreAssetUpdate(range.startNoteIndex, { forceSystemUpdate: true })));
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
      const selectionCopy = getRangeSelectionCopy(range, { selectionMode: true, awaitingEnd: true });
      this.setData({
        scoreRange: range,
        rangeStartNoteIndex: range.startNoteIndex,
        rangeEndNoteIndex: range.endNoteIndex,
        rangeLabel: range.label,
        hasPartialRange: true,
        showRangeMarkers: true,
        rangeInstruction: selectionCopy.rangeInstruction,
        startButtonText: selectionCopy.startButtonText,
        startHelperText: selectionCopy.startHelperText,
      });
      return;
    }

    const range = buildScoreRange(this.piece, this.pendingRangeStartIndex, safeIndex);
    const rangeCopy = getRangeSelectionCopy(range);
    this.pendingRangeStartIndex = null;
    this.setData(Object.assign({
      scoreRange: range,
      rangeStartNoteIndex: range.startNoteIndex,
      rangeEndNoteIndex: range.endNoteIndex,
      rangeLabel: range.label,
      hasPartialRange: !range.isFullPiece,
      showRangeMarkers: !range.isFullPiece,
      rangeSelectionMode: false,
      rangeInstruction: rangeCopy.rangeInstruction,
      rangeButtonText: rangeCopy.rangeButtonText,
      startButtonText: rangeCopy.startButtonText,
      startHelperText: rangeCopy.startHelperText,
      progressText: `0 / ${range.noteCount}`,
      currentTargetText: this.piece.notes[range.startNoteIndex].label,
      activeNoteIndex: range.startNoteIndex,
    }, this.buildActiveScoreAssetUpdate(range.startNoteIndex, { forceSystemUpdate: true })));
  },

  onUnload() {
    this.clearTimers();
    this.shouldFinishOnStop = false;
    if (this.data.isRunning) {
      this.recorder.stop();
    }
  },

  bindRecorder() {
    this.recorder.onStart(() => {
      this.practiceStartTime = Date.now();
      this.setData({
        isRunning: true,
        statusText: '预备拍进行中，请观察拍点准备起弓。',
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
    this.performanceAligner = null;
    this.pitchGateAligner = null;
    this.pitchGateComplete = false;

    const scoreRange = this.data.scoreRange || buildScoreRange(this.piece, 0, this.piece.notes.length - 1);
    this.timeline = createTimeline(this.piece, {
      createdAt: Date.now(),
      startNoteIndex: scoreRange.startNoteIndex,
      endNoteIndex: scoreRange.endNoteIndex,
    });
    if (this.isFollowMode()) {
      this.performanceAligner = createPerformanceAligner(this.timeline);
    }
    if (this.isPitchGateMode()) {
      this.pitchGateAligner = createPitchGateAligner(this.timeline);
    }

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
      statusText: '预备拍进行中，请观察拍点准备起弓。',
      beatText: `1 / ${this.timeline.countInBeats}`,
      detectedText: '--',
      detectedPitchText: '--',
    }, () => this.refreshScoreScrollViewport());

    this.startBeatTimer();

    const fixedDurationMs =
      this.timeline.preRollMs +
      this.timeline.windows[this.timeline.windows.length - 1].expectedEndMs +
      this.timeline.beatDurationMs;
    const maxDurationMs = this.isPitchGateMode() ? 600000 : fixedDurationMs * (this.isFollowMode() ? 2.5 : 1);
    this.stopTimer = setTimeout(() => {
      this.stopPractice();
    }, maxDurationMs);
  },

  isFollowMode() {
    return this.data.practiceMode === 'follow' || this.data.followMode === true;
  },

  isPitchGateMode() {
    return this.data.practiceMode === 'pitch-gate';
  },

  startBeatTimer() {
    const totalBeats = Math.ceil(this.timeline.windows[this.timeline.windows.length - 1].expectedEndMs / this.timeline.beatDurationMs);
    const countInBeats = this.timeline.countInBeats;
    let lastCountInBeat = 0;
    let lastMusicalBeat = 0;

    const idealTickStart = this.timeline.createdAt;
    const beatMs = this.timeline.beatDurationMs;
    const timelinePollMs = Math.min(UI_INTERVAL_MS, beatMs);

    this.beatTimer = setInterval(() => {
      const now = Date.now();

      if (now < this.timeline.startTimestamp) {
        const countInBeat = Math.min(countInBeats, Math.floor((now - idealTickStart) / beatMs) + 1);
        if (countInBeat === lastCountInBeat) {
          return;
        }
        lastCountInBeat = countInBeat;
        this.setData({
          phaseText: '预备拍',
          beatText: `${countInBeat} / ${countInBeats}`,
          statusText: countInBeat === countInBeats ? '下一拍进入正式评测。' : '跟着视觉拍点准备起弓。',
          beatPulse: !this.data.beatPulse,
        });
        return;
      }

      const elapsedPracticeMs = Math.max(0, now - this.timeline.startTimestamp);
      const musicalBeat = Math.min(totalBeats, Math.floor(elapsedPracticeMs / beatMs) + 1);
      const beatChanged = musicalBeat !== lastMusicalBeat;
      if (beatChanged) {
        lastMusicalBeat = musicalBeat;
      }

      // F2: In follow-like modes, skip timeline-driven activeNoteIndex updates.
      // The highlight advances via pitch detection in handleFrame instead.
      if (this.isFollowMode() || this.isPitchGateMode()) {
        if (!beatChanged) {
          return;
        }
        if (this.isPitchGateMode()) {
          this.setData({
            phaseText: '音准闯关',
            beatText: '--',
            beatPulse: !this.data.beatPulse,
          });
          return;
        }
        this.setData({
          phaseText: '跟随中',
          beatText: `${musicalBeat} / ${totalBeats}`,
          beatPulse: !this.data.beatPulse,
        });
        return;
      }

      // Poll the timeline at UI cadence so short notes can become active between beat ticks.
      const activeIndex = getActiveNoteIndex(this.timeline, now);
      const currentNote = this.timeline.getWindowForNote(activeIndex);
      const sequenceProgress = currentNote ? currentNote.sequenceIndex + 1 : 0;

      // R2: Only update score asset data when system index changes.
      const scoreAssetChanged = activeIndex !== this.data.activeNoteIndex;
      let scoreAssetUpdate = {};
      if (scoreAssetChanged) {
        scoreAssetUpdate = this.buildActiveScoreAssetUpdate(activeIndex);
      }
      if (!beatChanged && !scoreAssetChanged) {
        return;
      }

      this.setData(Object.assign({
        phaseText: '评测中',
        beatText: `${musicalBeat} / ${totalBeats}`,
        beatPulse: beatChanged ? !this.data.beatPulse : this.data.beatPulse,
        currentTargetText: currentNote ? currentNote.targetNote : '--',
        progressText: `${Math.min(sequenceProgress, this.timeline.windows.length)} / ${this.timeline.windows.length}`,
        activeNoteIndex: Math.max(0, activeIndex),
      }, scoreAssetUpdate));
    }, timelinePollMs);
  },

  handleFrame(frameBuffer) {
    const chunk = int16PcmToFloat32(frameBuffer);
    if (!chunk.length) {
      return;
    }

    // P5: Append to ring buffer instead of maintaining chunk array.
    this.ringBuffer.append(chunk);

    const timestamp = Date.now();

    if (timestamp - this.lastAnalysisAt < ANALYSIS_INTERVAL_MS) {
      return;
    }
    this.lastAnalysisAt = timestamp;

    // R1: Run pitch analysis at a fixed cadence, and throttle UI updates separately.
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

    // F1: Follow mode — advance highlight from the same alignment model used by scoring.
    if (this.isFollowMode() && this.performanceAligner) {
      const state = this.performanceAligner.processFrame(this.pitchFrames[this.pitchFrames.length - 1]);
      if (state.activeNoteIndex !== this.data.activeNoteIndex) {
        this.advanceActiveNote(state.activeNoteIndex);
      }
    }

    if (this.isPitchGateMode() && this.pitchGateAligner && !this.pitchGateComplete) {
      const state = this.pitchGateAligner.processFrame(this.pitchFrames[this.pitchFrames.length - 1]);
      if (state.activeNoteIndex !== this.data.activeNoteIndex) {
        this.advanceActiveNote(state.activeNoteIndex);
      }
      if (state.complete) {
        this.pitchGateComplete = true;
        this.setData({
          phaseText: '已达成',
          statusText: '当前片段已完成，正在生成结果。',
        });
        this.stopPractice();
      }
    }

    if (timestamp - this.lastUiAt >= UI_INTERVAL_MS) {
      this.lastUiAt = timestamp;
      this.updateDetectedUi(pitch);
    }
  },

  advanceActiveNote(noteIndex) {
    if (!this.piece || noteIndex === this.data.activeNoteIndex) {
      return;
    }
    const window = this.timeline.getWindowForNote(noteIndex);
    const sequenceProgress = window ? window.sequenceIndex + 1 : 0;
    this.setData(Object.assign({
      activeNoteIndex: noteIndex,
      currentTargetText: window ? window.targetNote : '--',
      progressText: `${Math.min(sequenceProgress, this.timeline.windows.length)} / ${this.timeline.windows.length}`,
    }, this.buildActiveScoreAssetUpdate(noteIndex)));
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

    const isFollowMode = this.isFollowMode();
    const isPitchGateMode = this.isPitchGateMode();
    let evaluationFrames;
    let performanceAlignment = null;
    if (isFollowMode || isPitchGateMode) {
      evaluationFrames = this.pitchFrames.filter(
        (frame) => frame.timestamp >= this.timeline.startTimestamp
      );
      performanceAlignment = isPitchGateMode && this.pitchGateAligner
        ? this.pitchGateAligner.finish()
        : this.performanceAligner
        ? this.performanceAligner.finish()
        : null;
    } else {
      // O2: Truncate pitchFrames to the last window's expected end time.
      const lastWindowEnd = this.timeline.windows[this.timeline.windows.length - 1].expectedEndMs;
      const lastFrameTime = this.timeline.startTimestamp + lastWindowEnd;
      evaluationFrames = this.pitchFrames.filter(
        (frame) => frame.timestamp <= lastFrameTime
      );
    }

    const evaluation = evaluateScorePractice(
      evaluationFrames,
      this.timeline,
      performanceAlignment ? { performanceAlignment } : {}
    );
    const feedback = buildAdvice(evaluation.noteResults);
    const scoreRange = this.data.scoreRange || buildScoreRange(this.piece, 0, this.piece.notes.length - 1);
    const session = {
      sessionType: 'score_practice',
      pieceId: this.piece.id,
      pieceTitle: this.piece.title,
      scoreRange,
      evaluationMode: isPitchGateMode ? 'pitch-gate' : isFollowMode ? 'performance-follow' : 'fixed-bpm',
      performanceSummary: performanceAlignment
        ? {
          matchedCount: performanceAlignment.matchedCount,
          activeNoteIndex: performanceAlignment.activeNoteIndex,
          range: performanceAlignment.range,
        }
        : null,
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
    this.pitchGateComplete = false;
  },
});
