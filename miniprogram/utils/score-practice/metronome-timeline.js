function parseTimeSignature(signature) {
  const [beatsPerMeasure, beatUnit] = String(signature || '4/4')
    .split('/')
    .map((value) => Number(value));
  return {
    beatsPerMeasure: beatsPerMeasure || 4,
    beatUnit: beatUnit || 4,
  };
}

function createTimeline(piece, options = {}) {
  if (!piece || !Array.isArray(piece.notes) || !piece.notes.length) {
    throw new Error('Piece notes are required to build a score practice timeline.');
  }

  const lastNoteIndex = piece.notes.length - 1;
  const rawStartIndex = Number(options.startNoteIndex);
  const rawEndIndex = Number(options.endNoteIndex);
  const startNoteIndex = Number.isFinite(rawStartIndex)
    ? Math.max(0, Math.min(lastNoteIndex, Math.floor(rawStartIndex)))
    : 0;
  const endNoteIndex = Number.isFinite(rawEndIndex)
    ? Math.max(startNoteIndex, Math.min(lastNoteIndex, Math.floor(rawEndIndex)))
    : lastNoteIndex;
  const selectedNotes = piece.notes.slice(startNoteIndex, endNoteIndex + 1);
  const beatOffset = Number(selectedNotes[0].startBeat || 0);
  const bpm = Number(options.bpm || piece.bpm || 72);
  const countInBeats = Number(options.countInBeats || piece.countInBeats || 4);
  const beatDurationMs = Math.round((60 * 1000) / bpm);
  const preRollMs = countInBeats * beatDurationMs;
  const createdAt = Number(options.createdAt || Date.now());
  const startTimestamp = createdAt + preRollMs;
  const signature = parseTimeSignature(piece.timeSignature);
  const timingToleranceMs = Math.max(110, Math.round(beatDurationMs * 0.35));

  // A4: Grace period to prevent skipping notes at boundary ticks.
  const boundaryGraceMs = Math.round(beatDurationMs * 0.08);

  const windows = selectedNotes.map((note, index) => {
    const originalNoteIndex = startNoteIndex + index;
    const relativeStartBeat = Number(note.startBeat || 0) - beatOffset;
    const expectedStartMs = Math.round(relativeStartBeat * beatDurationMs);
    const expectedEndMs = Math.round((relativeStartBeat + Number(note.durationBeat || 0)) * beatDurationMs);
    return {
      index: originalNoteIndex,
      sequenceIndex: index,
      noteIndex: originalNoteIndex,
      targetNote: note.label,
      expectedStartMs,
      expectedEndMs,
      expectedDurationMs: expectedEndMs - expectedStartMs,
      timingToleranceMs,
      pitchToleranceCent: 50,
      note,
    };
  });

  // P4: Pre-build noteIndex → window Map for O(1) lookup.
  const windowByNoteIndex = new Map();
  for (let i = 0; i < windows.length; i += 1) {
    windowByNoteIndex.set(windows[i].noteIndex, windows[i]);
  }

  return {
    pieceId: piece.id,
    bpm,
    countInBeats,
    beatDurationMs,
    preRollMs,
    startTimestamp,
    createdAt,
    signature,
    windows,
    boundaryGraceMs,
    range: {
      startNoteIndex,
      endNoteIndex,
      beatOffset,
      isFullPiece: startNoteIndex === 0 && endNoteIndex === lastNoteIndex,
    },
    getExpectedTimeForNote(noteIndex) {
      const window = windowByNoteIndex.get(noteIndex);
      return window ? startTimestamp + window.expectedStartMs : null;
    },
    getWindowForNote(noteIndex) {
      return windowByNoteIndex.get(noteIndex) || null;
    },
    getWindowBySequence(sequenceIndex) {
      return windows[sequenceIndex] || null;
    },
  };
}

// P3: Binary search replaces linear scan. Windows are sorted by expectedEndMs.
function getActiveNoteIndex(timeline, now) {
  if (!timeline || !timeline.windows || !timeline.windows.length) {
    return -1;
  }

  const elapsedMs = now - timeline.startTimestamp;
  const grace = timeline.boundaryGraceMs || 0;
  const windows = timeline.windows;
  let lo = 0;
  let hi = windows.length - 1;

  // Find the last window where expectedEndMs + grace > elapsedMs
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (windows[mid].expectedEndMs + grace <= elapsedMs) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  if (windows[lo].expectedEndMs + grace > elapsedMs) {
    return windows[lo].noteIndex;
  }
  return windows[windows.length - 1].noteIndex;
}

module.exports = {
  createTimeline,
  getActiveNoteIndex,
};
