const LETTER_STEPS = {
  C: 0,
  D: 1,
  E: 2,
  F: 3,
  G: 4,
  A: 5,
  B: 6,
};

const TOP_LINE_STEP = noteStep('F', 5);
const BOTTOM_LINE_STEP = noteStep('E', 4);
const TOP_LINE_Y = 32;
const STEP_Y = 9;
const BEAT_WIDTH = 54;
const LEFT_PAD = 74;
const RIGHT_PAD = 36;
const DEFAULT_MEASURES_PER_LINE = 2;
const DEFAULT_BEATS_PER_LINE = 0;

function createGeometry(staffScale) {
  const scale = Math.max(0.72, Number(staffScale || 1));
  return {
    topLineY: Math.round(TOP_LINE_Y * scale + (scale - 1) * 24),
    stepY: STEP_Y * scale,
  };
}

function noteStep(letter, octave) {
  return octave * 7 + LETTER_STEPS[letter];
}

function parsePitch(pitch) {
  const match = String(pitch || '').match(/^([A-G])([#b]?)/);
  if (!match) {
    return { letter: 'C', accidental: '' };
  }
  return {
    letter: match[1],
    accidental: match[2] || '',
  };
}

function parseTimeSignature(signature) {
  const [beatsPerMeasure, beatUnit] = String(signature || '4/4')
    .split('/')
    .map((value) => Number(value));
  return {
    beatsPerMeasure: beatsPerMeasure || 4,
    beatUnit: beatUnit || 4,
  };
}

function getStaffY(note, geometry = createGeometry()) {
  const parsed = parsePitch(note.label || note.pitch);
  const step = noteStep(parsed.letter, Number(note.octave || 4));
  return geometry.topLineY + (TOP_LINE_STEP - step) * geometry.stepY;
}

function getLedgerLines(y, geometry = createGeometry()) {
  const lines = [];
  const bottomY = geometry.topLineY + (TOP_LINE_STEP - BOTTOM_LINE_STEP) * geometry.stepY;

  for (let lineY = geometry.topLineY - geometry.stepY * 2; lineY >= y - 1; lineY -= geometry.stepY * 2) {
    lines.push(lineY);
  }

  for (let lineY = bottomY + geometry.stepY * 2; lineY <= y + 1; lineY += geometry.stepY * 2) {
    lines.push(lineY);
  }

  return lines;
}

function getStemDirection(y, geometry = createGeometry()) {
  const middleLineY = geometry.topLineY + geometry.stepY * 4;
  return y <= middleLineY ? 'down' : 'up';
}

function getEndBeat(notes) {
  return notes.reduce(
    (max, note) => Math.max(max, Number(note.startBeat || 0) + Number(note.durationBeat || 0)),
    0
  );
}

function buildMeasureBars(notes, signature, beatWidth, leftPad, beatOffset = 0, visibleEndBeat) {
  if (!notes.length && !visibleEndBeat) {
    return [];
  }
  const { beatsPerMeasure } = parseTimeSignature(signature);
  const endBeat = typeof visibleEndBeat === 'number' ? visibleEndBeat : getEndBeat(notes);
  const bars = [];

  for (let beat = beatsPerMeasure; beat <= endBeat; beat += beatsPerMeasure) {
    if (beat <= beatOffset) {
      continue;
    }
    bars.push({
      beat,
      x: Math.round(leftPad + (beat - beatOffset) * beatWidth),
    });
  }

  return bars;
}

function buildDisplayNote(note, index, options) {
  const parsed = parsePitch(note.label || note.pitch);
  const geometry = options.geometry || createGeometry();
  const y = Math.round(getStaffY(note, geometry));
  const x = Math.round(options.leftPad + (Number(note.startBeat || 0) - options.beatOffset) * options.beatWidth);
  const stemDirection = getStemDirection(y, geometry);
  const durationBeat = Number(note.durationBeat || 1);
  const rangeStart = Number(options.rangeStartNoteIndex);
  const rangeEnd = Number(options.rangeEndNoteIndex);
  const hasRange = Number.isFinite(rangeStart) && Number.isFinite(rangeEnd) && rangeEnd >= rangeStart;

  return {
    index,
    label: note.label || `${note.pitch}${note.octave}`,
    x,
    y,
    accidental: parsed.accidental,
    active: index === options.activeNoteIndex,
    inRange: hasRange && index >= rangeStart && index <= rangeEnd,
    rangeStart: hasRange && index === rangeStart,
    rangeEnd: hasRange && index === rangeEnd,
    long: durationBeat > 1,
    headWidth: durationBeat > 1 ? 27 : 23,
    stemDirection,
    stemY: stemDirection === 'up' ? y - 50 : y + 9,
    ledgerLines: getLedgerLines(y, geometry).map((lineY) => ({
      y: Math.round(lineY),
    })),
  };
}

function buildSystems(notes, piece, options) {
  const signature = parseTimeSignature(piece && piece.timeSignature);
  const requestedBeatsPerLine = Number(options.beatsPerLine || DEFAULT_BEATS_PER_LINE);
  const measuresPerLine = Math.max(1, Number(options.measuresPerLine || DEFAULT_MEASURES_PER_LINE));
  const beatsPerLine = requestedBeatsPerLine > 0 ? requestedBeatsPerLine : signature.beatsPerMeasure * measuresPerLine;
  const endBeat = getEndBeat(notes);
  const systemCount = Math.max(1, Math.ceil(endBeat / beatsPerLine));
  const systems = [];

  for (let systemIndex = 0; systemIndex < systemCount; systemIndex += 1) {
    const beatStart = systemIndex * beatsPerLine;
    const beatEnd = beatStart + beatsPerLine;
    const systemNotes = notes
      .map((note, index) => ({ note, index }))
      .filter((item) => {
        const startBeat = Number(item.note.startBeat || 0);
        const durationBeat = Number(item.note.durationBeat || 0);
        return startBeat < beatEnd && startBeat + durationBeat > beatStart;
      });

    systems.push({
      index: systemIndex,
      beatStart,
      beatEnd,
      width: Math.max(360, Math.round(options.leftPad + beatsPerLine * options.beatWidth + RIGHT_PAD)),
      lineYs: buildLineYs(options.geometry),
      measureBars: buildMeasureBars(notes, piece && piece.timeSignature, options.beatWidth, options.leftPad, beatStart, beatEnd),
      notes: systemNotes.map((item) =>
        buildDisplayNote(item.note, item.index, {
          beatWidth: options.beatWidth,
          leftPad: options.leftPad,
          beatOffset: beatStart,
          activeNoteIndex: options.activeNoteIndex,
          rangeStartNoteIndex: options.rangeStartNoteIndex,
          rangeEndNoteIndex: options.rangeEndNoteIndex,
          geometry: options.geometry,
        })
      ),
    });
  }

  return systems;
}

function buildLineYs(geometry = createGeometry()) {
  return [0, 1, 2, 3, 4].map((index) => Math.round(geometry.topLineY + index * geometry.stepY * 2));
}

function buildStaffScore(piece, options = {}) {
  const notes = piece && Array.isArray(piece.notes) ? piece.notes : [];
  const beatWidth = Number(options.beatWidth || BEAT_WIDTH);
  const leftPad = Number(options.leftPad || LEFT_PAD);
  const activeNoteIndex = Number(options.activeNoteIndex);
  const layoutMode = options.layoutMode === 'systems' ? 'systems' : 'scroll';
  const geometry = createGeometry(options.staffScale);
  const endBeat = getEndBeat(notes);
  const width = Math.round(leftPad + endBeat * beatWidth + RIGHT_PAD);
  const shared = {
    width: Math.max(360, width),
    lineYs: buildLineYs(geometry),
    clef: piece && piece.clef ? piece.clef : 'treble',
    timeSignature: piece && piece.timeSignature ? piece.timeSignature : '4/4',
    keySignature: piece && piece.keySignature ? piece.keySignature : '',
    layoutMode,
    isSystems: layoutMode === 'systems',
    measureBars: buildMeasureBars(notes, piece && piece.timeSignature, beatWidth, leftPad),
    notes: notes.map((note, index) =>
      buildDisplayNote(note, index, {
        beatWidth,
        leftPad,
        beatOffset: 0,
        activeNoteIndex,
        rangeStartNoteIndex: options.rangeStartNoteIndex,
        rangeEndNoteIndex: options.rangeEndNoteIndex,
        geometry,
      })
    ),
  };

  if (layoutMode === 'systems') {
    shared.systems = buildSystems(notes, piece, {
      beatWidth,
      leftPad,
      activeNoteIndex,
      rangeStartNoteIndex: options.rangeStartNoteIndex,
      rangeEndNoteIndex: options.rangeEndNoteIndex,
      measuresPerLine: options.measuresPerLine,
      beatsPerLine: options.beatsPerLine,
      geometry,
    });
  } else {
    shared.systems = [];
  }

  return shared;
}

module.exports = {
  buildStaffScore,
  getStaffY,
  getLedgerLines,
  parsePitch,
};
