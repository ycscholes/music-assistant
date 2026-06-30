const { frequencyToNote, frequencyToTargetCentOffset } = require('../note');

const DEFAULT_OPTIONS = {
  confidenceThreshold: 0.55,
  pitchToleranceCent: 30,
  lateToleranceRatio: 0.35,
  holdRatioThreshold: 0.65,
  analysisIntervalMs: 120,
  systemDelayMs: 180,
};

function average(values) {
  if (!values.length) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function collectWindowFrames(frames, timeline, options) {
  return timeline.windows.map((window) => {
    const start =
      timeline.startTimestamp +
      window.expectedStartMs -
      Number(window.timingToleranceMs || 0);
    const end = timeline.startTimestamp + window.expectedEndMs;
    const validFrames = frames.filter(
      (frame) =>
        frame &&
        typeof frame.timestamp === 'number' &&
        frame.timestamp >= start &&
        frame.timestamp < end &&
        frame.confidence >= options.confidenceThreshold &&
        typeof frame.frequency === 'number'
    );

    return {
      window,
      frames: validFrames,
    };
  });
}

function collectPerformanceWindowFrames(frames, timeline, performanceAlignment, options) {
  const alignmentWindows = performanceAlignment && Array.isArray(performanceAlignment.windows)
    ? performanceAlignment.windows
    : [];
  const frameByTimestamp = new Map((frames || []).map((frame) => [frame.timestamp, frame]));
  const items = alignmentWindows.map((alignedWindow) => {
    const window = timeline.getWindowForNote(alignedWindow.noteIndex);
    const alignedFrames = (alignedWindow.frames || [])
      .map((frame) => frameByTimestamp.get(frame.timestamp) || frame)
      .filter(
        (frame) =>
          frame &&
          frame.confidence >= options.confidenceThreshold &&
          typeof frame.frequency === 'number'
      );
    return {
      window,
      alignedWindow,
      frames: alignedFrames,
    };
  }).filter((item) => item.window);

  const matchedItems = items.filter(
    (item) =>
      item.alignedWindow.matched &&
      item.alignedWindow.observedStartMs !== null &&
      item.alignedWindow.observedEndMs !== null
  );
  const totalExpected = matchedItems.reduce(
    (sum, item) => sum + Math.max(1, Number(item.window.expectedDurationMs || 0)),
    0
  );
  const totalObserved = matchedItems.reduce((sum, item) => {
    const observedMs = Math.max(
      options.analysisIntervalMs,
      Number(item.alignedWindow.observedEndMs) - Number(item.alignedWindow.observedStartMs) + options.analysisIntervalMs
    );
    return sum + observedMs;
  }, 0);
  const tempoFactor = totalExpected > 0
    ? clamp(totalObserved / totalExpected, 0.4, 3)
    : 1;

  return {
    items,
    tempoFactor,
  };
}

function buildNoteResult(item, timeline, options) {
  const { window, frames } = item;
  const frameOffsets = frames
    .map((frame) => {
      const centOffset = frequencyToTargetCentOffset(frame.frequency, window.note.targetFrequency);
      return Number.isFinite(centOffset) ? centOffset : null;
    })
    .filter((value) => value !== null);

  if (!frames.length || !frameOffsets.length) {
    return {
      targetNote: window.note.label,
      noteIndex: window.noteIndex,
      startBeat: window.note.startBeat,
      durationBeat: window.note.durationBeat,
      matched: false,
      avgCentOffset: null,
      timingOffsetMs: null,
      holdRatio: 0,
      confidence: 0,
      issueTags: ['missed'],
      noteScore: 0,
    };
  }

  const firstFrame = frames[0];
  const lastFrame = frames[frames.length - 1];
  const expectedStartAt = timeline.startTimestamp + window.expectedStartMs;
  // E2: Compensate for system delay (analysis interval + buffer latency).
  // Without this, nearly every note is flagged as "late" because the first
  // detected frame arrives ~180ms after the real onset.
  // Cap the compensation to half the timing tolerance so that "late" detection
  // remains possible even for short notes (e.g. Vivaldi 16th notes at 250ms).
  const effectiveSystemDelay = Math.min(
    options.systemDelayMs,
    Math.floor(window.timingToleranceMs * 0.5)
  );
  const timingOffsetMs = firstFrame.timestamp - expectedStartAt - effectiveSystemDelay;
  // E1: Scale the compensation to frame interval rather than a fixed 120ms.
  const frameCompensationMs = Math.min(
    options.analysisIntervalMs,
    window.expectedDurationMs * 0.15
  );
  const capturedDurationMs = Math.max(0, lastFrame.timestamp - firstFrame.timestamp + frameCompensationMs);
  const holdRatio = clamp(capturedDurationMs / window.expectedDurationMs, 0, 1);
  const avgCentOffset = average(frameOffsets);
  const avgConfidence = average(frames.map((frame) => frame.confidence)) || 0;
  const absOffset = Math.abs(avgCentOffset);
  const issueTags = [];

  // E6: Lowered pitchToleranceCent to 30 (was 50) for better sensitivity.
  if (avgCentOffset > options.pitchToleranceCent) {
    issueTags.push('pitch-high');
  } else if (avgCentOffset < -options.pitchToleranceCent) {
    issueTags.push('pitch-low');
  }

  if (timingOffsetMs > window.timingToleranceMs) {
    issueTags.push('late');
  } else if (timingOffsetMs < 0) {
    issueTags.push('early');
  }

  if (holdRatio < options.holdRatioThreshold) {
    issueTags.push('too-short');
  }

  // O5: Adjusted coefficient from 1.4 to 2.0 so that 50-cent offset → 0 pitchScore.
  const pitchScore = clamp(100 - absOffset * 2.0, 0, 100);
  const timingPenalty = clamp(Math.abs(timingOffsetMs) / window.timingToleranceMs, 0, 1) * 35;
  const holdPenalty = clamp((options.holdRatioThreshold - holdRatio) / options.holdRatioThreshold, 0, 1) * 30;
  const noteScore = Math.round(clamp(pitchScore - timingPenalty - holdPenalty, 0, 100));

  return {
    targetNote: window.note.label,
    noteIndex: window.noteIndex,
    startBeat: window.note.startBeat,
    durationBeat: window.note.durationBeat,
    matched: issueTags.indexOf('missed') === -1,
    avgCentOffset: Math.round(avgCentOffset),
    timingOffsetMs: Math.round(timingOffsetMs),
    holdRatio: Number(holdRatio.toFixed(2)),
    confidence: Number(avgConfidence.toFixed(2)),
    issueTags,
    noteScore,
    detectedSummary: frequencyToNote(firstFrame.frequency).label,
  };
}

function buildPerformanceNoteResult(item, tempoFactor, options) {
  const { window, alignedWindow, frames } = item;
  const frameOffsets = frames
    .map((frame) => {
      if (typeof frame.centOffset === 'number') {
        return frame.centOffset;
      }
      const centOffset = frequencyToTargetCentOffset(frame.frequency, window.note.targetFrequency);
      return Number.isFinite(centOffset) ? centOffset : null;
    })
    .filter((value) => value !== null);

  if (!alignedWindow.matched || !frames.length || !frameOffsets.length) {
    return {
      targetNote: window.note.label,
      noteIndex: window.noteIndex,
      startBeat: window.note.startBeat,
      durationBeat: window.note.durationBeat,
      observedStartMs: alignedWindow.observedStartMs,
      observedEndMs: alignedWindow.observedEndMs,
      matched: false,
      avgCentOffset: null,
      timingOffsetMs: null,
      holdRatio: 0,
      confidence: 0,
      issueTags: ['missed'],
      noteScore: 0,
    };
  }

  const observedDurationMs = Math.max(
    options.analysisIntervalMs,
    Number(alignedWindow.observedEndMs) - Number(alignedWindow.observedStartMs) + options.analysisIntervalMs
  );
  const expectedObservedDurationMs = Math.max(
    1,
    Number(window.expectedDurationMs || 0) * tempoFactor
  );
  const holdRatio = clamp(observedDurationMs / expectedObservedDurationMs, 0, 1.6);
  const avgCentOffset = average(frameOffsets);
  const avgConfidence = average(frames.map((frame) => frame.confidence)) || 0;
  const absOffset = Math.abs(avgCentOffset);
  const issueTags = [];

  if (avgCentOffset > options.pitchToleranceCent) {
    issueTags.push('pitch-high');
  } else if (avgCentOffset < -options.pitchToleranceCent) {
    issueTags.push('pitch-low');
  }

  if (holdRatio < options.holdRatioThreshold) {
    issueTags.push('too-short');
  }

  const pitchScore = clamp(100 - absOffset * 2.0, 0, 100);
  const holdPenalty = clamp((options.holdRatioThreshold - holdRatio) / options.holdRatioThreshold, 0, 1) * 30;
  const noteScore = Math.round(clamp(pitchScore - holdPenalty, 0, 100));

  return {
    targetNote: window.note.label,
    noteIndex: window.noteIndex,
    startBeat: window.note.startBeat,
    durationBeat: window.note.durationBeat,
    observedStartMs: Math.round(alignedWindow.observedStartMs),
    observedEndMs: Math.round(alignedWindow.observedEndMs),
    matched: true,
    avgCentOffset: Math.round(avgCentOffset),
    timingOffsetMs: 0,
    holdRatio: Number(Math.min(holdRatio, 1).toFixed(2)),
    confidence: Number(avgConfidence.toFixed(2)),
    issueTags,
    noteScore,
    detectedSummary: frequencyToNote(frames[0].frequency).label,
  };
}

function summarizeNoteResults(noteResults) {
  const matchedResults = noteResults.filter((item) => item.matched);
  const completionRate = Number((matchedResults.length / noteResults.length).toFixed(2));

  // E4: Exclude missed notes from pitchScore/rhythmScore averages.
  // Completion is already penalized via completionRate multiplier on totalScore.
  const pitchSamples = noteResults
    .filter((item) => item.matched && item.avgCentOffset !== null)
    .map((item) => clamp(100 - Math.abs(item.avgCentOffset) * 2.0, 0, 100));

  // E3: Use continuous penalty amounts instead of 0/1 tag-based deductions
  // to avoid double-penalizing notes that have both timing and hold issues.
  const rhythmSamples = noteResults
    .filter((item) => item.matched)
    .map((item) => {
      let score = 100;
      if (item.issueTags.indexOf('early') >= 0 || item.issueTags.indexOf('late') >= 0) {
        const timingFraction = clamp(
          Math.abs(item.timingOffsetMs) / (item.durationBeat * 500 || 500),
          0,
          1
        );
        score -= 20 + timingFraction * 15;
      }
      if (item.issueTags.indexOf('too-short') >= 0) {
        const shortFraction = clamp(
          (0.65 - item.holdRatio) / 0.65,
          0,
          1
        );
        score -= 15 + shortFraction * 15;
      }
      return clamp(score, 0, 100);
    });

  const pitchScore = Math.round(average(pitchSamples) || 0);
  const rhythmScore = Math.round(average(rhythmSamples) || 0);
  const baseScore = pitchScore * 0.6 + rhythmScore * 0.4;
  const totalScore = Math.round(baseScore * completionRate);

  return {
    pitchScore,
    rhythmScore,
    completionRate,
    totalScore,
  };
}

function evaluateScorePractice(frames, timeline, overrides = {}) {
  const options = Object.assign({}, DEFAULT_OPTIONS, overrides);
  let noteResults;
  if (options.performanceAlignment) {
    const grouped = collectPerformanceWindowFrames(
      frames || [],
      timeline,
      options.performanceAlignment,
      options
    );
    noteResults = grouped.items.map((item) =>
      buildPerformanceNoteResult(item, grouped.tempoFactor, options)
    );
  } else {
    const grouped = collectWindowFrames(frames || [], timeline, options);
    noteResults = grouped.map((item) => buildNoteResult(item, timeline, options));
  }
  const summaryScores = summarizeNoteResults(noteResults);

  return {
    summaryScores,
    noteResults,
    feedbackTags: Array.from(
      new Set(noteResults.reduce((tags, item) => tags.concat(item.issueTags), []))
    ),
  };
}

module.exports = {
  evaluateScorePractice,
  summarizeNoteResults,
};
