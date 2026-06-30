const { frequencyToTargetCentOffset } = require('../note');

const DEFAULT_OPTIONS = {
  confidenceThreshold: 0.55,
  pitchToleranceCent: 50,
  lookAheadNotes: 2,
  confirmFrames: 2,
  minRepeatAdvanceMs: 320,
  minCurrentHoldRatio: 0.45,
  defaultFrameDurationMs: 120,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

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
  const frequency = Number(frame.frequency || 0);
  const confidence = Number(frame.confidence || 0);
  return Object.assign({}, frame, {
    frequency,
    confidence,
  });
}

function createPerformanceAligner(timeline, overrides = {}) {
  if (!timeline || !Array.isArray(timeline.windows) || !timeline.windows.length) {
    throw new Error('Timeline windows are required for performance alignment.');
  }

  const options = Object.assign({}, DEFAULT_OPTIONS, overrides);
  const windows = timeline.windows;
  const alignmentWindows = windows.map(createEmptyWindow);
  let activeSequenceIndex = 0;
  let pendingSequenceIndex = null;
  let pendingConfirmCount = 0;

  function currentWindow() {
    return alignmentWindows[activeSequenceIndex] || null;
  }

  function expectedDurationFor(sequenceIndex) {
    const window = windows[sequenceIndex];
    return window ? Number(window.expectedDurationMs || 0) : 0;
  }

  function getMinHoldMs(sequenceIndex) {
    const expectedDuration = expectedDurationFor(sequenceIndex);
    return Math.max(
      options.minRepeatAdvanceMs,
      Math.round(expectedDuration * options.minCurrentHoldRatio)
    );
  }

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

  function finalizeUntil(sequenceIndex, frame) {
    const previousIndex = activeSequenceIndex;
    for (let index = activeSequenceIndex; index < sequenceIndex; index += 1) {
      const target = alignmentWindows[index];
      if (!target) {
        continue;
      }
      if (!target.matched) {
        target.skipped = true;
      }
      if (target.observedEndMs === null) {
        target.observedEndMs = Math.max(0, frame.timestamp - timeline.startTimestamp);
      }
    }
    activeSequenceIndex = clamp(sequenceIndex, 0, windows.length - 1);
    if (previousIndex !== activeSequenceIndex) {
      pendingSequenceIndex = null;
      pendingConfirmCount = 0;
    }
  }

  function hasEnoughHoldForAdvance(sequenceIndex, frame) {
    const target = alignmentWindows[sequenceIndex];
    if (!target || target.observedStartMs === null) {
      return false;
    }
    const relativeMs = Math.max(0, frame.timestamp - timeline.startTimestamp);
    return relativeMs - target.observedStartMs >= getMinHoldMs(sequenceIndex);
  }

  function findCandidate(frame) {
    const maxSequenceIndex = Math.min(
      windows.length - 1,
      activeSequenceIndex + Math.max(0, Number(options.lookAheadNotes || 0))
    );
    const candidates = [];

    for (let sequenceIndex = activeSequenceIndex; sequenceIndex <= maxSequenceIndex; sequenceIndex += 1) {
      const window = windows[sequenceIndex];
      const centOffset = frequencyToTargetCentOffset(frame.frequency, window.note.targetFrequency);
      if (centOffset === null || Math.abs(centOffset) > options.pitchToleranceCent) {
        continue;
      }
      candidates.push({ sequenceIndex, centOffset });
    }

    if (!candidates.length) {
      return null;
    }

    if (
      candidates.length > 1 &&
      candidates[0].sequenceIndex === activeSequenceIndex &&
      hasEnoughHoldForAdvance(activeSequenceIndex, frame)
    ) {
      return candidates[1];
    }

    return candidates[0];
  }

  function processFrame(inputFrame) {
    const frame = normalizeFrame(inputFrame);
    if (!frame || frame.timestamp < timeline.startTimestamp) {
      return getState();
    }
    if (frame.confidence < options.confidenceThreshold || frame.frequency <= 0) {
      pendingSequenceIndex = null;
      pendingConfirmCount = 0;
      return getState();
    }

    const candidate = findCandidate(frame);
    if (!candidate) {
      pendingSequenceIndex = null;
      pendingConfirmCount = 0;
      return getState();
    }

    if (candidate.sequenceIndex === activeSequenceIndex) {
      appendFrame(candidate.sequenceIndex, frame, candidate.centOffset);
      pendingSequenceIndex = null;
      pendingConfirmCount = 0;
      return getState();
    }

    if (!hasEnoughHoldForAdvance(activeSequenceIndex, frame)) {
      const active = currentWindow();
      if (active && active.matched) {
        const activeCentOffset = frequencyToTargetCentOffset(frame.frequency, active.note.targetFrequency);
        if (activeCentOffset !== null && Math.abs(activeCentOffset) <= options.pitchToleranceCent) {
          appendFrame(activeSequenceIndex, frame, activeCentOffset);
        }
      }
      return getState();
    }

    if (pendingSequenceIndex === candidate.sequenceIndex) {
      pendingConfirmCount += 1;
    } else {
      pendingSequenceIndex = candidate.sequenceIndex;
      pendingConfirmCount = 1;
    }

    if (pendingConfirmCount >= options.confirmFrames) {
      finalizeUntil(candidate.sequenceIndex, frame);
      appendFrame(candidate.sequenceIndex, frame, candidate.centOffset);
    }

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
      mode: 'performance',
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

function buildPerformanceAlignment(frames, timeline, overrides = {}) {
  const aligner = createPerformanceAligner(timeline, overrides);
  const sortedFrames = (frames || [])
    .slice()
    .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
  sortedFrames.forEach((frame) => aligner.processFrame(frame));
  return aligner.finish();
}

module.exports = {
  DEFAULT_OPTIONS,
  buildPerformanceAlignment,
  createPerformanceAligner,
};
