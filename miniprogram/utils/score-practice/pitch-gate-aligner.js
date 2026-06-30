const { frequencyToTargetCentOffset } = require('../note');

const DEFAULT_OPTIONS = {
  confidenceThreshold: 0.55,
  pitchToleranceCent: 30,
  confirmFrames: 2,
  minHoldMs: 160,
};

function average(values) {
  if (!values.length) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function createEmptyWindow(window) {
  return {
    noteIndex: window.noteIndex,
    sequenceIndex: window.sequenceIndex,
    targetNote: window.targetNote,
    note: window.note,
    expectedDurationMs: window.expectedDurationMs,
    expectedStartMs: window.expectedStartMs,
    expectedEndMs: window.expectedEndMs,
    observedStartMs: null,
    observedEndMs: null,
    matched: false,
    frames: [],
    avgCentOffset: null,
    confidence: 0,
    skipped: false,
  };
}

function normalizeFrame(frame) {
  if (!frame || typeof frame.timestamp !== 'number') {
    return null;
  }
  return Object.assign({}, frame, {
    frequency: Number(frame.frequency || 0),
    confidence: Number(frame.confidence || 0),
  });
}

function createPitchGateAligner(timeline, overrides = {}) {
  if (!timeline || !Array.isArray(timeline.windows) || !timeline.windows.length) {
    throw new Error('Timeline windows are required for pitch-gated alignment.');
  }

  const options = Object.assign({}, DEFAULT_OPTIONS, overrides);
  const windows = timeline.windows;
  const alignmentWindows = windows.map(createEmptyWindow);
  let activeSequenceIndex = 0;
  let confirmCount = 0;

  function appendFrame(sequenceIndex, frame, centOffset) {
    const target = alignmentWindows[sequenceIndex];
    if (!target) {
      return;
    }
    const relativeMs = Math.max(0, frame.timestamp - timeline.startTimestamp);
    if (target.observedStartMs === null) {
      target.observedStartMs = relativeMs;
    }
    target.observedEndMs = Math.max(relativeMs, target.observedEndMs || relativeMs);
    target.matched = true;
    target.frames.push(Object.assign({}, frame, {
      centOffset,
      relativeMs,
    }));
    target.avgCentOffset = Math.round(average(target.frames.map((item) => item.centOffset)) || 0);
    target.confidence = Number((average(target.frames.map((item) => item.confidence)) || 0).toFixed(2));
  }

  function hasEnoughHold(sequenceIndex, frame) {
    const target = alignmentWindows[sequenceIndex];
    if (!target || target.observedStartMs === null) {
      return false;
    }
    const relativeMs = Math.max(0, frame.timestamp - timeline.startTimestamp);
    return relativeMs - target.observedStartMs >= options.minHoldMs;
  }

  function advanceIfReady(frame) {
    if (activeSequenceIndex >= windows.length - 1) {
      return;
    }
    if (confirmCount >= options.confirmFrames && hasEnoughHold(activeSequenceIndex, frame)) {
      activeSequenceIndex += 1;
      confirmCount = 0;
    }
  }

  function processFrame(inputFrame) {
    const frame = normalizeFrame(inputFrame);
    if (!frame || frame.timestamp < timeline.startTimestamp) {
      return getState();
    }
    if (frame.confidence < options.confidenceThreshold || frame.frequency <= 0) {
      confirmCount = 0;
      return getState();
    }

    const window = windows[activeSequenceIndex];
    const centOffset = frequencyToTargetCentOffset(frame.frequency, window.note.targetFrequency);
    if (centOffset === null || Math.abs(centOffset) > options.pitchToleranceCent) {
      confirmCount = 0;
      return getState();
    }

    appendFrame(activeSequenceIndex, frame, centOffset);
    confirmCount += 1;
    advanceIfReady(frame);
    return getState();
  }

  function finish() {
    const lastMatched = alignmentWindows
      .filter((item) => item.matched && item.observedEndMs !== null)
      .slice(-1)[0];
    const fallbackEndMs = lastMatched
      ? lastMatched.observedEndMs
      : windows[windows.length - 1].expectedEndMs;

    for (let index = 0; index < alignmentWindows.length; index += 1) {
      const target = alignmentWindows[index];
      if (!target.matched) {
        target.skipped = true;
      }
      if (target.observedEndMs === null) {
        target.observedEndMs = fallbackEndMs;
      }
    }

    return getAlignment();
  }

  function getState() {
    const active = windows[activeSequenceIndex] || windows[windows.length - 1];
    return {
      activeNoteIndex: active.noteIndex,
      activeSequenceIndex,
      complete: activeSequenceIndex >= windows.length - 1 && alignmentWindows[activeSequenceIndex].matched,
    };
  }

  function getAlignment() {
    const matchedWindows = alignmentWindows.filter((item) => item.matched);
    return {
      mode: 'pitch-gate',
      pieceId: timeline.pieceId,
      startTimestamp: timeline.startTimestamp,
      range: timeline.range,
      activeNoteIndex: getState().activeNoteIndex,
      matchedCount: matchedWindows.length,
      windows: alignmentWindows.map((item) => Object.assign({}, item, {
        frames: item.frames.slice(),
      })),
    };
  }

  return {
    processFrame,
    finish,
    getState,
    getAlignment,
  };
}

function buildPitchGateAlignment(frames, timeline, overrides = {}) {
  const aligner = createPitchGateAligner(timeline, overrides);
  const sortedFrames = (frames || [])
    .slice()
    .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
  sortedFrames.forEach((frame) => aligner.processFrame(frame));
  return aligner.finish();
}

module.exports = {
  DEFAULT_OPTIONS,
  buildPitchGateAlignment,
  createPitchGateAligner,
};
