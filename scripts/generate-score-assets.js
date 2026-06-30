const fs = require('node:fs/promises');
const path = require('node:path');
const { createCanvas, loadImage, registerFont } = require('canvas');
const { JSDOM } = require('jsdom');
const VexFlow = require('vexflow/bravura');
const {
  Accidental,
  Beam,
  Dot,
  Element,
  Formatter,
  Fraction,
  Renderer,
  Stave,
  StaveNote,
  StaveTie,
  Voice,
} = VexFlow;
const { listPieces } = require('../miniprogram/utils/score-practice/piece-library');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const GENERATED_ROOT = path.join(PROJECT_ROOT, 'generated/score-assets');
const SCORE_IMAGE_ROOT = path.join(GENERATED_ROOT, 'images');
const MINIPROGRAM_SCORE_IMAGE_ROOT = path.join(PROJECT_ROOT, 'miniprogram/images/scores');
const CLOUD_MANIFEST_PATH = path.join(GENERATED_ROOT, 'cloud-manifest.json');
const LOCAL_METADATA_PATH = path.join(GENERATED_ROOT, 'generated-score-assets.local.js');
const METADATA_PATH = path.join(PROJECT_ROOT, 'miniprogram/utils/score-practice/generated-score-assets.js');
const CLOUD_ASSET_VERSION = 'formal-score-v3';
const DEFAULT_SCORE_CONFIG = {
  beatsPerSystem: 8,
  assetFormat: 'png',
  assetExtension: 'png',
  systemWidth: 1080,
  systemHeight: 270,
  staveX: 38,
  staveY: 66,
  staveWidth: 1004,
  contentWidth: 930,
  background: '#fffaf1',
};
const VIVALDI_SCORE_CONFIG = {
  beatsPerSystem: 4,
  assetFormat: 'png',
  assetExtension: 'png',
  systemWidth: 1080,
  systemHeight: 300,
  firstSystemHeight: 380,
  staveX: 58,
  firstStaveY: 168,
  staveY: 118,
  staveWidth: 982,
  contentWidth: 910,
  background: '#ffffff',
  pickupBeatLength: 0.5,
  measuresPerSystem: 1,
  measureGap: 18,
  firstMeasureNumberX: 162,
  staveOptions: {
    spacingBetweenLinesPx: 16,
  },
  showHeader: true,
  showMeasureBoxes: true,
};
const VIVALDI_SYSTEM_ENGRAVING = {
  0: {
    marks: [
      { type: 'text', noteIndex: 1, text: '4', yShift: -50 },
    ],
  },
  2: {
    marks: [
      { type: 'text', noteIndex: 25, text: '3', yShift: -50 },
    ],
  },
  3: {
    marks: [
      { type: 'text', noteIndex: 30, text: '4', yShift: -50 },
    ],
  },
  6: {
    marks: [
      { type: 'text', noteIndex: 56, text: '4', yShift: -50 },
      { type: 'text', noteIndex: 63, text: '3', yShift: -50 },
    ],
  },
  9: {
    marks: [
      { type: 'text', noteIndex: 97, text: '4', yShift: -50 },
    ],
  },
  17: {
    marks: [
      { type: 'text', noteIndex: 167, text: '0', yShift: -50 },
      { type: 'text', noteIndex: 168, text: '4', yShift: -64 },
      { type: 'text', noteIndex: 171, text: 'V', yShift: -66 },
    ],
    slurs: [
      { fromNoteIndex: 168, toNoteIndex: 170, invert: true },
    ],
  },
  23: {
    marks: [
      { type: 'text', noteIndex: 218, text: 'Solo', yShift: -78, font: '24px Times New Roman' },
      { type: 'dynamic', noteIndex: 218, text: 'f', xShift: -10, yShift: 58 },
      { type: 'text', noteIndex: 226, text: '4', yShift: -54 },
    ],
    slurs: [
      { fromNoteIndex: 219, toNoteIndex: 221, invert: true },
      { fromNoteIndex: 223, toNoteIndex: 225, invert: true },
      { fromNoteIndex: 227, toNoteIndex: 229, invert: true },
      { fromNoteIndex: 231, toNoteIndex: 233, invert: true },
    ],
  },
  24: {
    marks: [
      { type: 'text', noteIndex: 234, text: '4', yShift: -54 },
      { type: 'text', noteIndex: 238, text: '0', yShift: -50 },
      { type: 'text', noteIndex: 242, text: '4', yShift: -54 },
      { type: 'text', noteIndex: 250, text: '0', yShift: -50 },
      { type: 'hairpin', fromNoteIndex: 234, toNoteIndex: 249, yShift: 72, opening: 15, direction: 'diminuendo' },
    ],
    slurs: [
      { fromNoteIndex: 235, toNoteIndex: 237, invert: true },
      { fromNoteIndex: 239, toNoteIndex: 241, invert: true },
      { fromNoteIndex: 243, toNoteIndex: 245, invert: true },
      { fromNoteIndex: 247, toNoteIndex: 249, invert: true },
    ],
  },
  30: {
    marks: [
      { type: 'text', noteIndex: 327, text: '4', yShift: -52 },
      { type: 'text', noteIndex: 328, text: '0', yShift: -50 },
      { type: 'text', noteIndex: 333, text: '4', yShift: -54 },
      { type: 'hairpin', fromNoteIndex: 320, toNoteIndex: 333, yShift: 70, opening: 18, direction: 'crescendo' },
    ],
  },
  31: {
    marks: [
      { type: 'text', noteIndex: 338, text: '4', yShift: -52 },
    ],
  },
  62: {
    marks: [
      { type: 'text', noteIndex: 669, text: '4', yShift: -52 },
      { type: 'text', noteIndex: 677, text: '2', yShift: -54 },
      { type: 'text', noteIndex: 681, text: '4', yShift: -52 },
      { type: 'dynamic', noteIndex: 676, text: 'p', xShift: 10, yShift: 58 },
      { type: 'hairpin', fromNoteIndex: 669, toNoteIndex: 676, yShift: 70, opening: 14, direction: 'diminuendo' },
    ],
    slurs: [
      { fromNoteIndex: 670, toNoteIndex: 672, invert: false },
      { fromNoteIndex: 677, toNoteIndex: 680, invert: false },
      { fromNoteIndex: 681, toNoteIndex: 684, invert: false },
    ],
  },
  63: {
    marks: [
      { type: 'text', noteIndex: 689, text: '0', yShift: -50 },
      { type: 'text', noteIndex: 690, text: '4', yShift: -64 },
      { type: 'text', noteIndex: 691, text: '3', yShift: -50 },
      { type: 'dynamic', noteIndex: 693, text: 'pp', xShift: 4, yShift: 58, font: 'italic 24px Times New Roman' },
      { type: 'hairpin', fromNoteIndex: 689, toNoteIndex: 697, yShift: 70, opening: 15, direction: 'crescendo' },
    ],
    slurs: [
      { fromNoteIndex: 685, toNoteIndex: 688, invert: false },
      { fromNoteIndex: 689, toNoteIndex: 692, invert: true },
      { fromNoteIndex: 693, toNoteIndex: 696, invert: false },
    ],
  },
  79: {
    marks: [
      { type: 'dynamic', noteIndex: 894, text: 'f', xShift: 0, yShift: 58 },
    ],
  },
};
const VIVALDI_ENGRAVING_MARKS = Object.values(VIVALDI_SYSTEM_ENGRAVING)
  .flatMap((engraving) => engraving.marks || []);
const VIVALDI_ENGRAVING_SLURS = Object.values(VIVALDI_SYSTEM_ENGRAVING)
  .flatMap((engraving) => engraving.slurs || []);
const HIGHLIGHT_PAD_X = 22;
const HIGHLIGHT_PAD_Y = 36;
const BRAVURA_FONT_PATH = require.resolve('@vexflow-fonts/bravura/bravura.otf');

const dom = new JSDOM('<!doctype html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
registerFont(BRAVURA_FONT_PATH, { family: 'Bravura' });
VexFlow.setFonts('Bravura');
Element.setTextMeasurementCanvas(createCanvas(300, 150));

function parseArgs(argv) {
  const options = {
    mode: 'local',
  };

  for (const arg of argv) {
    if (arg === '--cloud') {
      options.mode = 'cloud';
      continue;
    }
    if (arg === '--local') {
      options.mode = 'local';
      continue;
    }
    if (arg === '--miniprogram') {
      options.mode = 'miniprogram';
      continue;
    }
    if (arg.startsWith('--mode=')) {
      options.mode = arg.slice('--mode='.length);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!['local', 'cloud', 'miniprogram'].includes(options.mode)) {
    throw new Error(`Unsupported score asset mode: ${options.mode}`);
  }

  return options;
}

function scoreAssetCloudPath(pieceId, fileName) {
  return `score-assets/${CLOUD_ASSET_VERSION}/${pieceId}/${fileName}`;
}

function scoreAssetLocalReference(pieceId, fileName) {
  return `/generated/score-assets/images/${pieceId}/${fileName}`;
}

function scoreAssetMiniProgramReference(pieceId, fileName) {
  return `/images/scores/${pieceId}/${fileName}`;
}

async function readCloudManifest() {
  let manifest;
  try {
    manifest = JSON.parse(await fs.readFile(CLOUD_MANIFEST_PATH, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      throw new Error(`Cloud manifest not found: ${path.relative(PROJECT_ROOT, CLOUD_MANIFEST_PATH)}`);
    }
    throw error;
  }

  if (!manifest || manifest.version !== CLOUD_ASSET_VERSION || !Array.isArray(manifest.files)) {
    throw new Error(`Cloud manifest must contain version "${CLOUD_ASSET_VERSION}" and a files array.`);
  }

  return new Map(manifest.files.map((file) => [file.cloudPath, file]));
}

function getEndBeat(notes) {
  return notes.reduce(
    (max, note) => Math.max(max, Number(note.startBeat || 0) + Number(note.durationBeat || 0)),
    0
  );
}

function getLastNoteStartBeat(notes) {
  return notes.reduce((max, note) => Math.max(max, Number(note.startBeat || 0)), 0);
}

function keySignatureForVexFlow(piece) {
  const key = String((piece && piece.keySignature) || '');
  if (key.includes('B 大调')) {
    return 'B';
  }
  if (key.includes('a 小调')) {
    return 'Am';
  }
  if (key.includes('g 小调')) {
    return 'Gm';
  }
  return 'C';
}

function timeSignatureParts(piece) {
  const [beats, beatValue] = String((piece && piece.timeSignature) || '4/4')
    .split('/')
    .map((value) => Number(value));
  return {
    beats: beats || 4,
    beatValue: beatValue || 4,
  };
}

function getScoreConfig(piece) {
  if (piece && piece.id === 'vivaldi_rv356_excerpt') {
    return VIVALDI_SCORE_CONFIG;
  }
  if (piece && piece.renderMode === 'source-image') {
    return Object.assign({}, DEFAULT_SCORE_CONFIG, {
      background: '#ffffff',
    });
  }
  return DEFAULT_SCORE_CONFIG;
}

function getSystemHeight(config, systemIndex) {
  return systemIndex === 0 && config.firstSystemHeight
    ? config.firstSystemHeight
    : config.systemHeight;
}

function vexKey(note) {
  const label = String(note.label || `${note.pitch}${note.octave}`);
  const match = label.match(/^([A-G])([#b]?)(-?\d+)$/);
  if (!match) {
    return 'c/4';
  }
  return `${match[1].toLowerCase()}${match[2] || ''}/${match[3]}`;
}

function durationToken(beatLength) {
  const rounded = Number(Number(beatLength).toFixed(4));
  if (rounded === 4) return { duration: 'w', dotted: false };
  if (rounded === 3) return { duration: 'h', dotted: true };
  if (rounded === 2) return { duration: 'h', dotted: false };
  if (rounded === 1.5) return { duration: 'q', dotted: true };
  if (rounded === 1) return { duration: 'q', dotted: false };
  if (rounded === 0.75) return { duration: '8', dotted: true };
  if (rounded === 0.5) return { duration: '8', dotted: false };
  return { duration: '16', dotted: false };
}

function decomposeDuration(beatLength) {
  const parts = [];
  let remaining = Number(Number(beatLength || 0).toFixed(4));
  const candidates = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.25];

  while (remaining > 0.001) {
    const part = candidates.find((candidate) => candidate <= remaining + 0.001) || 0.25;
    parts.push(part);
    remaining = Number((remaining - part).toFixed(4));
  }

  return parts;
}

function addAccidentalIfNeeded(staveNote, note) {
  const label = String(note.label || `${note.pitch}${note.octave}`);
  const match = label.match(/^[A-G]([#b]?)-?\d+$/);
  const accidental = match ? match[1] : '';
  if (accidental) {
    staveNote.addModifier(new Accidental(accidental), 0);
  }
}

function buildTickables(piece, systemBeatStart, systemBeatEnd, options = {}) {
  const tickables = [];
  const sourceSegments = new Map();
  let cursor = systemBeatStart;

  const notes = piece.notes
    .map((note, noteIndex) => ({ note, noteIndex }))
    .filter((item) => {
      const start = Number(item.note.startBeat || 0);
      const end = start + Number(item.note.durationBeat || 0);
      return start < systemBeatEnd && end > systemBeatStart;
    })
    .sort((a, b) => Number(a.note.startBeat || 0) - Number(b.note.startBeat || 0));

  for (const item of notes) {
    const noteStart = Math.max(systemBeatStart, Number(item.note.startBeat || 0));
    if (noteStart > cursor + 0.001) {
      addRestTickables(tickables, noteStart - cursor);
    }

    const noteEnd = Number(item.note.startBeat || 0) + Number(item.note.durationBeat || 0);
    const visibleDuration = Math.min(noteEnd, systemBeatEnd) - noteStart;
    const segments = [];
    const noteStyle = options.noteStyles && options.noteStyles[item.noteIndex];
    for (const part of decomposeDuration(visibleDuration)) {
      const token = durationToken(part);
      const staveNote = new StaveNote({
        keys: [vexKey(item.note)],
        duration: token.duration,
        stem_direction: noteStyle && noteStyle.stemDirection,
      });
      if (token.dotted) {
        Dot.buildAndAttach([staveNote]);
      }
      addAccidentalIfNeeded(staveNote, item.note);
      staveNote.sourceNoteIndex = item.noteIndex;
      staveNote.sourceBeatStart = noteStart;
      staveNote.sourceDurationBeat = Number(item.note.durationBeat || 0);
      staveNote.visibleDurationBeat = part;
      segments.push(staveNote);
      tickables.push(staveNote);
    }
    sourceSegments.set(item.noteIndex, segments);
    cursor = noteStart + visibleDuration;
  }

  if (systemBeatEnd > cursor + 0.001) {
    addRestTickables(tickables, systemBeatEnd - cursor);
  }

  return { tickables, sourceSegments, noteIndexes: notes.map((item) => item.noteIndex) };
}

function addRestTickables(tickables, beatLength) {
  for (const part of decomposeDuration(beatLength)) {
    const token = durationToken(part);
    const rest = new StaveNote({
      keys: ['b/4'],
      duration: `${token.duration}r`,
    });
    if (token.dotted) {
      Dot.buildAndAttach([rest]);
    }
    rest.isGeneratedRest = true;
    tickables.push(rest);
  }
}

function renderSystemImage(piece, systemIndex, systemBeatStart, systemBeatEnd, config) {
  if (piece.id === 'vivaldi_rv356_excerpt') {
    return renderVivaldiSystemImage(piece, systemIndex, systemBeatStart, systemBeatEnd, config);
  }

  const systemWidth = config.systemWidth;
  const systemHeight = getSystemHeight(config, systemIndex);
  const staveY = systemIndex === 0 && config.firstStaveY ? config.firstStaveY : config.staveY;
  const canvas = createCanvas(systemWidth, systemHeight);
  canvas.style = {};
  const renderer = new Renderer(canvas, Renderer.Backends.CANVAS);
  renderer.resize(systemWidth, systemHeight);
  const context = renderer.getContext();
  context.setFillStyle(config.background || '#fffaf1');
  context.fillRect(0, 0, systemWidth, systemHeight);
  context.setFillStyle('#000000');
  context.setStrokeStyle('#000000');
  context.setFont('Times New Roman', 12);

  drawSystemHeader(context, piece, systemIndex, config);

  const stave = new Stave(config.staveX, staveY, config.staveWidth, config.staveOptions);
  stave.addClef(piece.clef || 'treble');
  if (systemIndex === 0) {
    stave.addKeySignature(keySignatureForVexFlow(piece));
    stave.addTimeSignature(piece.timeSignature || '4/4');
  }
  stave.setContext(context).draw();

  const { beatValue } = timeSignatureParts(piece);
  const { tickables, sourceSegments, noteIndexes } = buildTickables(piece, systemBeatStart, systemBeatEnd);
  drawTickablesOnStave(context, stave, tickables, sourceSegments, {
    numBeats: config.beatsPerSystem,
    beatValue,
    contentWidth: config.contentWidth,
  });
  drawPracticeMarks(context, piece, systemIndex, sourceSegments);

  return {
    image: getCanvasImageBuffer(canvas, config),
    noteBoxes: buildNoteBoxes(piece, sourceSegments, systemWidth, systemHeight, systemBeatStart, config),
    noteIndexes,
  };
}

function renderVivaldiSystemImage(piece, systemIndex, systemBeatStart, systemBeatEnd, config) {
  const systemWidth = config.systemWidth;
  const systemHeight = getSystemHeight(config, systemIndex);
  const staveY = systemIndex === 0 ? config.firstStaveY : config.staveY;
  const canvas = createCanvas(systemWidth, systemHeight);
  canvas.style = {};
  const renderer = new Renderer(canvas, Renderer.Backends.CANVAS);
  renderer.resize(systemWidth, systemHeight);
  const context = renderer.getContext();
  context.setFillStyle(config.background || '#ffffff');
  context.fillRect(0, 0, systemWidth, systemHeight);
  context.setFillStyle('#000000');
  context.setStrokeStyle('#000000');
  context.setFont('Times New Roman', 12);

  drawSystemHeader(context, piece, systemIndex, config);

  const stave = new Stave(config.staveX, staveY, config.staveWidth, config.staveOptions);
  stave.addClef(piece.clef || 'treble');
  if (systemIndex === 0) {
    stave.addKeySignature(keySignatureForVexFlow(piece));
    stave.addTimeSignature(piece.timeSignature || '4/4');
  }
  stave.setContext(context).draw();

  const sourceSegments = new Map();
  const noteIndexes = [];
  const segments = getVivaldiMeasureSegments(piece, systemIndex, systemBeatStart, systemBeatEnd, config, stave);
  const engraving = createVivaldiEngravingForSystem(piece, systemIndex, systemBeatStart, systemBeatEnd);
  for (const segment of segments) {
    const segmentEngraving = createVivaldiEngravingForSystem(piece, systemIndex, segment.beatStart, segment.beatEnd);
    const result = buildTickables(piece, segment.beatStart, segment.beatEnd, {
      noteStyles: segmentEngraving.noteStyles,
    });
    const virtualStave = new Stave(segment.x, staveY, segment.width, config.staveOptions);
    virtualStave.setContext(context);
    virtualStave.setNoteStartX(segment.x);
    drawTickablesOnStave(context, virtualStave, result.tickables, result.sourceSegments, {
      numBeats: segment.numBeats,
      beatValue: segment.beatValue,
      contentWidth: segment.width,
      manualBeamGroups: segmentEngraving.beamGroups,
    });
    mergeSourceSegments(sourceSegments, result.sourceSegments);
    noteIndexes.push(...result.noteIndexes);
    if (segment.drawBarline) {
      drawManualBarline(context, segment.x + segment.width + Math.round(config.measureGap / 2), staveY, config);
    }
  }

  drawVivaldiEngraving(context, piece, systemIndex, sourceSegments, engraving, config);

  return {
    image: getCanvasImageBuffer(canvas, config),
    noteBoxes: buildNoteBoxes(piece, sourceSegments, systemWidth, systemHeight, systemBeatStart, config),
    noteIndexes: Array.from(new Set(noteIndexes)).sort((a, b) => a - b),
  };
}

function getVivaldiMeasureSegments(piece, systemIndex, systemBeatStart, systemBeatEnd, config, stave) {
  const { beats, beatValue } = timeSignatureParts(piece);
  const measureGap = Number(config.measureGap || 0);
  const pickupBeatLength = Number(config.pickupBeatLength || 0.5);
  const rightEdge = config.staveX + config.staveWidth - 18;
  const noteStartX = typeof stave.getNoteStartX === 'function'
    ? Number(stave.getNoteStartX())
    : config.staveX + 92;
  const contentX = Math.max(config.staveX + 80, noteStartX);
  const contentWidth = Math.max(120, rightEdge - contentX);

  if (systemIndex === 0) {
    const pickupWidth = Math.round(contentWidth * 0.12);
    const fullMeasureWidth = Math.max(120, contentWidth - pickupWidth - measureGap);
    return [
      {
        beatStart: 0,
        beatEnd: pickupBeatLength,
        x: contentX,
        width: pickupWidth,
        numBeats: 1,
        beatValue: 8,
        beamGroups: [new Fraction(1, 8)],
        drawBarline: true,
      },
      {
        beatStart: pickupBeatLength,
        beatEnd: Math.min(pickupBeatLength + beats, systemBeatEnd),
        x: contentX + pickupWidth + measureGap,
        width: fullMeasureWidth,
        numBeats: beats,
        beatValue,
        beamGroups: [new Fraction(1, 4)],
        drawBarline: false,
      },
    ];
  }

  return [
    {
      beatStart: systemBeatStart,
      beatEnd: systemBeatEnd,
      x: contentX,
      width: contentWidth,
      numBeats: beats,
      beatValue,
      beamGroups: [new Fraction(1, 4)],
      drawBarline: false,
    },
  ];
}

function mergeSourceSegments(target, source) {
  for (const [noteIndex, segments] of source.entries()) {
    target.set(noteIndex, (target.get(noteIndex) || []).concat(segments));
  }
}

function createVivaldiEngravingForSystem(piece, systemIndex, beatStart, beatEnd) {
  const visibleNoteIndexes = getVisibleNoteIndexes(piece, beatStart, beatEnd);
  const staticEngraving = getVivaldiSystemEngraving(systemIndex);
  return {
    systemIndex,
    beatStart,
    beatEnd,
    beamGroups: staticEngraving.beamGroups || buildDefaultVivaldiBeamGroups(piece, beatStart, beatEnd),
    marks: (staticEngraving.marks || []).filter((mark) => isVivaldiMarkVisible(mark, visibleNoteIndexes)),
    slurs: (staticEngraving.slurs || []).filter((slur) =>
      visibleNoteIndexes.has(slur.fromNoteIndex) && visibleNoteIndexes.has(slur.toNoteIndex)
    ),
    noteStyles: filterVisibleNoteStyles(staticEngraving.noteStyles, visibleNoteIndexes),
    repetitionStrokes: [
      ...buildDefaultVivaldiRepetitionStrokes(piece, beatStart, beatEnd),
      ...(staticEngraving.repetitionStrokes || []),
    ].filter((stroke) => visibleNoteIndexes.has(stroke.noteIndex)),
  };
}

function getVivaldiSystemEngraving(systemIndex) {
  return VIVALDI_SYSTEM_ENGRAVING[Number(systemIndex)] || {};
}

function filterVisibleNoteStyles(noteStyles, visibleNoteIndexes) {
  const visible = {};
  for (const [noteIndex, style] of Object.entries(noteStyles || {})) {
    if (visibleNoteIndexes.has(Number(noteIndex))) {
      visible[noteIndex] = style;
    }
  }
  return visible;
}

function getVisibleNoteIndexes(piece, beatStart, beatEnd) {
  const visible = new Set();
  piece.notes.forEach((note, noteIndex) => {
    const start = Number(note.startBeat || 0);
    const end = start + Number(note.durationBeat || 0);
    if (start < beatEnd && end > beatStart) {
      visible.add(noteIndex);
    }
  });
  return visible;
}

function isVivaldiMarkVisible(mark, visibleNoteIndexes) {
  if (Number.isFinite(mark.noteIndex)) {
    return visibleNoteIndexes.has(mark.noteIndex);
  }
  if (Number.isFinite(mark.fromNoteIndex) || Number.isFinite(mark.toNoteIndex)) {
    return visibleNoteIndexes.has(mark.fromNoteIndex) || visibleNoteIndexes.has(mark.toNoteIndex);
  }
  return false;
}

function buildDefaultVivaldiBeamGroups(piece, beatStart, beatEnd) {
  const groups = [];
  const epsilon = 0.0001;
  const beatCount = Math.ceil(beatEnd - beatStart);
  for (let beatOffset = 0; beatOffset < beatCount; beatOffset += 1) {
    const groupStart = beatStart + beatOffset;
    const groupEnd = Math.min(groupStart + 1, beatEnd);
    const group = piece.notes
      .map((note, noteIndex) => ({ note, noteIndex }))
      .filter(({ note }) => {
        const start = Number(note.startBeat || 0);
        const duration = Number(note.durationBeat || 0);
        return duration <= 0.5 + epsilon && start >= groupStart - epsilon && start < groupEnd - epsilon;
      })
      .map(({ noteIndex }) => noteIndex);
    if (group.length >= 2) {
      groups.push(group);
    }
  }
  return groups;
}

function buildDefaultVivaldiRepetitionStrokes(piece, beatStart, beatEnd) {
  const visibleNoteIndexes = getVisibleNoteIndexes(piece, beatStart, beatEnd);
  const strokes = [];
  for (const noteIndex of visibleNoteIndexes) {
    const note = piece.notes[noteIndex];
    if (!note) {
      continue;
    }
    const isRepeatedHighNote = Number(note.midi || 0) >= 76 && Number(note.durationBeat || 0) >= 0.5;
    if (!isRepeatedHighNote) {
      continue;
    }
    const previous = piece.notes[noteIndex - 1];
    const next = piece.notes[noteIndex + 1];
    const nearSamePitch = (previous && previous.midi === note.midi) || (next && next.midi === note.midi);
    if (nearSamePitch || noteIndex < 6) {
      strokes.push({ noteIndex });
    }
  }
  return strokes;
}

function getCanvasImageBuffer(canvas, config) {
  if (config.assetFormat === 'jpeg') {
    return canvas.toBuffer('image/jpeg', {
      quality: Number(config.assetQuality || 0.78),
      chromaSubsampling: false,
    });
  }

  if (Number(config.exportScale || 1) !== 1) {
    const scale = Number(config.exportScale);
    const scaledCanvas = createCanvas(
      Math.round(canvas.width * scale),
      Math.round(canvas.height * scale)
    );
    const scaledContext = scaledCanvas.getContext('2d');
    scaledContext.drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
    return scaledCanvas.toBuffer('image/png');
  }

  return canvas.toBuffer('image/png');
}

function drawTickablesOnStave(context, stave, tickables, sourceSegments, options) {
  const voice = new Voice({ numBeats: options.numBeats, beatValue: options.beatValue });
  voice.setStrict(false);
  voice.addTickables(tickables);

  const beams = options.manualBeamGroups
    ? buildManualBeams(options.manualBeamGroups, sourceSegments)
    : Beam.generateBeams(
      tickables.filter((tickable) => tickable instanceof StaveNote && !String(tickable.duration).includes('r')),
      {
        groups: options.beamGroups || [new Fraction(2, 8)],
      }
    );

  new Formatter().joinVoices([voice]).format([voice], options.contentWidth);
  voice.draw(context, stave);
  beams.forEach((beam) => beam.setContext(context).draw());

  const ties = [];
  for (const segments of sourceSegments.values()) {
    for (let index = 1; index < segments.length; index += 1) {
      ties.push(new StaveTie({
        firstNote: segments[index - 1],
        lastNote: segments[index],
        firstIndices: [0],
        lastIndices: [0],
      }));
    }
  }
  ties.forEach((tie) => tie.setContext(context).draw());
}

function buildManualBeams(noteIndexGroups, sourceSegments) {
  return noteIndexGroups
    .map((group) =>
      group
        .map((noteIndex) => {
          const segments = sourceSegments.get(noteIndex);
          return segments && segments[0];
        })
        .filter(Boolean)
    )
    .filter((notes) => notes.length >= 2)
    .map((notes) => new Beam(notes));
}

function drawManualBarline(context, x, staveY, config) {
  const lineSpacing = Number(config.staveOptions && config.staveOptions.spacingBetweenLinesPx) || 10;
  const ctx = context.context2D;
  ctx.save();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, staveY);
  ctx.lineTo(x, staveY + lineSpacing * 4);
  ctx.stroke();
  ctx.restore();
}

function drawVivaldiEngraving(context, piece, systemIndex, sourceSegments, engraving, config) {
  if (piece.id !== 'vivaldi_rv356_excerpt') {
    return;
  }

  drawVivaldiSlurs(context, sourceSegments, engraving.slurs);
  drawVivaldiRepetitionStrokes(context, sourceSegments, engraving.repetitionStrokes);
  drawVivaldiMarks(context, piece, sourceSegments, engraving.marks);
  if (systemIndex === 79) {
    drawVivaldiFinalBarline(context, systemIndex, config);
  }
}

function drawVivaldiSlurs(context, sourceSegments, slurs) {
  const ctx = context.context2D;
  ctx.save();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.7;
  for (const slur of slurs) {
    const from = getFirstVisibleSegment(sourceSegments, slur.fromNoteIndex);
    const to = getFirstVisibleSegment(sourceSegments, slur.toNoteIndex);
    if (!from || !to) {
      continue;
    }
    const start = getNoteAnchor(from);
    const end = getNoteAnchor(to);
    const above = Boolean(slur.invert);
    const startY = above ? start.topY + 8 : start.bottomY + 4;
    const endY = above ? end.topY + 8 : end.bottomY + 4;
    const controlY = above
      ? Math.min(start.topY, end.topY) - 20
      : Math.max(start.bottomY, end.bottomY) + 14;
    ctx.beginPath();
    ctx.moveTo(start.x + 4, startY);
    ctx.bezierCurveTo(
      start.x + Math.max(20, (end.x - start.x) * 0.28),
      controlY,
      end.x - Math.max(20, (end.x - start.x) * 0.28),
      controlY,
      end.x - 4,
      endY
    );
    ctx.stroke();
  }
  ctx.restore();
}

function drawVivaldiFinalBarline(context, systemIndex, config) {
  const ctx = context.context2D;
  const lineSpacing = Number(config.staveOptions && config.staveOptions.spacingBetweenLinesPx) || 10;
  const staveY = systemIndex === 0 && config.firstStaveY ? config.firstStaveY : config.staveY;
  const right = config.staveX + config.staveWidth;
  ctx.save();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(right - 9, staveY);
  ctx.lineTo(right - 9, staveY + lineSpacing * 4);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(right - 2, staveY);
  ctx.lineTo(right - 2, staveY + lineSpacing * 4);
  ctx.stroke();
  ctx.restore();
}

function drawVivaldiRepetitionStrokes(context, sourceSegments, strokes) {
  const ctx = context.context2D;
  ctx.save();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  for (const stroke of strokes || []) {
    const first = getFirstVisibleSegment(sourceSegments, stroke.noteIndex);
    if (!first || typeof first.getAbsoluteX !== 'function') {
      continue;
    }
    const anchor = getNoteAnchor(first);
    const yShift = Number(stroke.yShift || -30);
    const width = Number(stroke.width || 8);
    ctx.beginPath();
    ctx.moveTo(anchor.x - width, anchor.topY + yShift);
    ctx.lineTo(anchor.x + width, anchor.topY + yShift);
    ctx.stroke();
  }
  ctx.restore();
}

function drawVivaldiMarks(context, piece, sourceSegments, marks) {
  const ctx = context.context2D;
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  for (const mark of marks) {
    if (mark.type === 'hairpin') {
      drawVivaldiHairpin(ctx, sourceSegments, mark);
      continue;
    }
    const segment = getFirstVisibleSegment(sourceSegments, mark.noteIndex);
    if (!segment) {
      continue;
    }
    const anchor = getNoteAnchor(segment);
    const x = anchor.x + Number(mark.xShift || 0);
    const y = anchor.topY + Number(mark.yShift || -48);
    if (mark.type === 'dynamic') {
      ctx.font = mark.font || 'italic 28px Times New Roman';
      ctx.fillText(mark.text, x, anchor.bottomY + Number(mark.yShift || 58));
      continue;
    }
    if (mark.type === 'stroke') {
      ctx.lineWidth = Number(mark.lineWidth || 3);
      ctx.beginPath();
      ctx.moveTo(x - Number(mark.width || 9), y);
      ctx.lineTo(x + Number(mark.width || 9), y);
      ctx.stroke();
      continue;
    }
    ctx.font = mark.font || '24px Times New Roman';
    ctx.fillText(mark.text, x, y);
  }

  ctx.restore();
}

function drawVivaldiHairpin(ctx, sourceSegments, mark) {
  const from = getFirstVisibleSegment(sourceSegments, mark.fromNoteIndex);
  const to = getFirstVisibleSegment(sourceSegments, mark.toNoteIndex);
  if (!from || !to) {
    return;
  }
  const start = getNoteAnchor(from);
  const end = getNoteAnchor(to);
  const y = Math.max(start.bottomY, end.bottomY) + Number(mark.yShift || 62);
  const opening = Number(mark.opening || 14);
  const startX = start.x + Number(mark.xStartShift || 0);
  const endX = end.x + Number(mark.xEndShift || 0);
  const isCrescendo = mark.direction !== 'diminuendo';
  const leftTop = isCrescendo ? y : y - opening / 2;
  const leftBottom = isCrescendo ? y : y + opening / 2;
  const rightTop = isCrescendo ? y - opening / 2 : y;
  const rightBottom = isCrescendo ? y + opening / 2 : y;
  ctx.save();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(startX, leftTop);
  ctx.lineTo(endX, rightTop);
  ctx.moveTo(startX, leftBottom);
  ctx.lineTo(endX, rightBottom);
  ctx.stroke();
  ctx.restore();
}

function getFirstVisibleSegment(sourceSegments, noteIndex) {
  const segments = sourceSegments.get(noteIndex);
  return segments && segments[0];
}

function getNoteAnchor(segment) {
  const x = typeof segment.getAbsoluteX === 'function' ? Number(segment.getAbsoluteX()) : 0;
  const ys = typeof segment.getYs === 'function' ? segment.getYs() : [];
  return {
    x,
    topY: ys.length ? Math.min(...ys) : 120,
    bottomY: ys.length ? Math.max(...ys) : 160,
  };
}

function buildNoteBoxes(piece, sourceSegments, systemWidth, systemHeight, systemBeatStart, config) {
  const noteBoxes = [];
  for (const [noteIndex, segments] of sourceSegments.entries()) {
    const first = segments[0];
    const last = segments[segments.length - 1];
    const firstX = getTickableX(first, systemBeatStart, piece.notes[noteIndex], config);
    const lastX = getTickableX(last, systemBeatStart, piece.notes[noteIndex], config);
    const ys = segments.flatMap((segment) => (typeof segment.getYs === 'function' ? segment.getYs() : []));
    const centerY = ys.length ? ys.reduce((total, y) => total + y, 0) / ys.length : 126;
    const left = Math.max(0, Math.min(firstX, lastX) - HIGHLIGHT_PAD_X);
    const y = Math.max(0, centerY - HIGHLIGHT_PAD_Y);
    const width = Math.max(54, Math.abs(lastX - firstX) + HIGHLIGHT_PAD_X * 2);
    noteBoxes.push({
      noteIndex,
      x: Math.round(left),
      y: Math.round(y),
      width: Math.round(width),
      height: HIGHLIGHT_PAD_Y * 2,
      xPercent: Number(((left / systemWidth) * 100).toFixed(3)),
      yPercent: Number(((y / systemHeight) * 100).toFixed(3)),
      widthPercent: Number(((width / systemWidth) * 100).toFixed(3)),
      heightPercent: Number((((HIGHLIGHT_PAD_Y * 2) / systemHeight) * 100).toFixed(3)),
    });
  }

  return noteBoxes.sort((a, b) => a.noteIndex - b.noteIndex);
}

function buildGridSourceImageNoteBoxes(system, systemWidth, systemHeight) {
  const area = system.noteArea || {};
  const rowCount = Math.max(1, Number(area.rowCount || 1));
  const notesPerRow = Math.max(1, Number(area.notesPerRow || 8));
  const areaX = Number(area.x || 0);
  const areaY = Number(area.y || 0);
  const areaWidth = Number(area.width || systemWidth);
  const areaHeight = Number(area.height || systemHeight);
  const startIndex = Number(system.noteStartIndex || 0);
  const endIndex = Number(system.noteEndIndex || startIndex);
  const noteCount = Math.max(0, endIndex - startIndex + 1);
  const rowHeight = areaHeight / rowCount;
  const boxWidth = Math.max(42, Math.round(areaWidth / notesPerRow * 0.62));
  const boxHeight = Math.max(54, Math.round(rowHeight * 0.62));
  const boxes = [];

  for (let offset = 0; offset < noteCount; offset += 1) {
    const row = Math.min(rowCount - 1, Math.floor(offset / notesPerRow));
    const column = offset % notesPerRow;
    const columnWidth = areaWidth / notesPerRow;
    const x = areaX + column * columnWidth + (columnWidth - boxWidth) / 2;
    const y = areaY + row * rowHeight + (rowHeight - boxHeight) / 2;
    boxes.push({
      noteIndex: startIndex + offset,
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(boxWidth),
      height: Math.round(boxHeight),
      xPercent: Number(((x / systemWidth) * 100).toFixed(3)),
      yPercent: Number(((y / systemHeight) * 100).toFixed(3)),
      widthPercent: Number(((boxWidth / systemWidth) * 100).toFixed(3)),
      heightPercent: Number(((boxHeight / systemHeight) * 100).toFixed(3)),
    });
  }

  return boxes;
}

function getSourceImageNoteIndexes(piece, system) {
  if (Number.isFinite(Number(system.noteStartIndex)) && Number.isFinite(Number(system.noteEndIndex))) {
    const startIndex = Number(system.noteStartIndex);
    const endIndex = Number(system.noteEndIndex);
    const indexes = [];
    for (let noteIndex = startIndex; noteIndex <= endIndex; noteIndex += 1) {
      indexes.push(noteIndex);
    }
    return indexes;
  }

  const beatStart = Number(system.beatStart || 0);
  const beatEnd = Number(system.beatEnd || 0);
  if (!Array.isArray(piece.notes) || !Number.isFinite(beatEnd) || beatEnd <= beatStart) {
    return [];
  }

  const epsilon = 0.00001;
  return piece.notes
    .map((note, noteIndex) => ({ note, noteIndex }))
    .filter(({ note }) => {
      const startBeat = Number(note.startBeat || 0);
      return startBeat >= beatStart - epsilon && startBeat < beatEnd - epsilon;
    })
    .map(({ noteIndex }) => noteIndex);
}

function interpolateBeatX(beat, anchors) {
  if (!Array.isArray(anchors) || anchors.length < 2) {
    return null;
  }

  const sorted = anchors
    .map((anchor) => ({
      beat: Number(anchor.beat),
      x: Number(anchor.x),
    }))
    .filter((anchor) => Number.isFinite(anchor.beat) && Number.isFinite(anchor.x))
    .sort((a, b) => a.beat - b.beat);

  if (sorted.length < 2) {
    return null;
  }

  let left = sorted[0];
  let right = sorted[sorted.length - 1];
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const current = sorted[index];
    const next = sorted[index + 1];
    if (beat >= current.beat && beat <= next.beat) {
      left = current;
      right = next;
      break;
    }
  }

  const span = right.beat - left.beat || 1;
  return left.x + ((beat - left.beat) / span) * (right.x - left.x);
}

function buildBeatMappedSourceImageNoteBoxes(piece, system, systemWidth, systemHeight, noteIndexes) {
  const area = system.noteArea || {};
  const beatBox = system.beatBox || {};
  const areaX = Number(area.x ?? beatBox.x ?? 56);
  const areaY = Number(area.y ?? 0);
  const areaWidth = Number(area.width ?? beatBox.width ?? Math.max(1, systemWidth - areaX - 32));
  const areaHeight = Number(area.height ?? Math.max(1, systemHeight - areaY));
  const minWidth = Number(system.noteBoxMinWidth || 30);
  const maxWidth = Number(system.noteBoxMaxWidth || 96);
  const anchors = Array.isArray(system.beatAnchors) && system.beatAnchors.length >= 2
    ? system.beatAnchors
    : [
      { beat: Number(system.beatStart || 0), x: areaX },
      { beat: Number(system.beatEnd || 0), x: areaX + areaWidth },
    ];

  return noteIndexes.map((noteIndex) => {
    const note = piece.notes[noteIndex];
    const startBeat = Number(note.startBeat || 0);
    const endBeat = startBeat + Number(note.durationBeat || 0);
    const startX = interpolateBeatX(startBeat, anchors);
    const endX = interpolateBeatX(endBeat, anchors);
    const rawWidth = Math.max(1, Math.abs((endX || startX || 0) - (startX || 0)));
    const boxWidth = Math.max(minWidth, Math.min(maxWidth, Math.round(rawWidth * 0.95)));
    const centerX = Number.isFinite(startX) && Number.isFinite(endX)
      ? startX + (endX - startX) / 2
      : areaX;
    const x = Math.max(areaX, Math.min(areaX + areaWidth - boxWidth, centerX - boxWidth / 2));
    const y = areaY;
    const height = areaHeight;
    return {
      noteIndex,
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(boxWidth),
      height: Math.round(height),
      xPercent: Number(((x / systemWidth) * 100).toFixed(3)),
      yPercent: Number(((y / systemHeight) * 100).toFixed(3)),
      widthPercent: Number(((boxWidth / systemWidth) * 100).toFixed(3)),
      heightPercent: Number(((height / systemHeight) * 100).toFixed(3)),
    };
  });
}

function buildSourceImageNoteBoxes(piece, system, systemWidth, systemHeight, noteIndexes) {
  if (system.noteBoxMode === 'beat' || system.beatBox || system.beatAnchors) {
    return buildBeatMappedSourceImageNoteBoxes(piece, system, systemWidth, systemHeight, noteIndexes);
  }
  return buildGridSourceImageNoteBoxes(system, systemWidth, systemHeight);
}

function drawSystemHeader(context, piece, systemIndex, config) {
  if (piece.id !== 'vivaldi_rv356_excerpt') {
    return;
  }

  if (systemIndex === 0) {
    context.setFont('Times New Roman', 32, 'bold');
    context.fillText('Allegro(♩ = 96)', 104, 78);
    context.setFont('Times New Roman', 24);
    context.fillText('Tutti', 118, 138);
    context.setFont('Times New Roman', 22);
    context.fillText('1', config.firstMeasureNumberX || 446, 132);
    return;
  }

  if (config.showMeasureBoxes) {
    const ctx = context.context2D;
    const measureNumber = String(systemIndex + 1);
    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(14, 28, 44, 44);
    ctx.font = '26px Times New Roman';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(measureNumber, 36, 50);
    ctx.restore();
  }
}

function drawPracticeMarks(context, piece, systemIndex, sourceSegments) {
  if (piece.id !== 'vivaldi_rv356_excerpt') {
    return;
  }

  const ctx = context.context2D;
  ctx.save();
  ctx.strokeStyle = '#000000';
  ctx.fillStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.font = '24px Times New Roman';
  ctx.textAlign = 'center';

  for (const [noteIndex, segments] of sourceSegments.entries()) {
    const note = piece.notes[noteIndex];
    const first = segments[0];
    if (!note || !first || typeof first.getAbsoluteX !== 'function') {
      continue;
    }

    const x = Number(first.getAbsoluteX());
    const ys = typeof first.getYs === 'function' ? first.getYs() : [];
    const y = ys.length ? Math.min(...ys) : 150;
    const isLongRepeatedTopNote = note.midi >= 76 && Number(note.durationBeat || 0) >= 0.5;
    if (isLongRepeatedTopNote && (noteIndex < 6 || (systemIndex >= 2 && noteIndex % 2 === 0))) {
      ctx.beginPath();
      ctx.moveTo(x - 8, y - 30);
      ctx.lineTo(x + 8, y - 30);
      ctx.stroke();
    }

    if (noteIndex === 1 || noteIndex === 31 || noteIndex === 56 || noteIndex === 97) {
      ctx.fillText('4', x, y - 48);
    }
    if (noteIndex === 25 || noteIndex === 63) {
      ctx.fillText('3', x, y - 48);
    }
  }
  ctx.restore();
}

function getTickableX(tickable, systemBeatStart, sourceNote, config) {
  if (tickable && typeof tickable.getAbsoluteX === 'function') {
    const x = Number(tickable.getAbsoluteX());
    if (Number.isFinite(x) && x > 0) {
      return x;
    }
  }

  const beatOffset = Number(sourceNote.startBeat || 0) - systemBeatStart;
  return config.staveX + 74 + (beatOffset / config.beatsPerSystem) * config.contentWidth;
}

async function cleanOutputDir(dir) {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
}

function getImageSrcForMode(pieceId, fileName, options) {
  if (options.mode === 'local') {
    return scoreAssetLocalReference(pieceId, fileName);
  }
  if (options.mode === 'miniprogram') {
    return scoreAssetMiniProgramReference(pieceId, fileName);
  }

  const cloudPath = scoreAssetCloudPath(pieceId, fileName);
  const manifestFile = options.cloudFiles.get(cloudPath);
  if (!manifestFile || !manifestFile.fileID) {
    throw new Error(`Missing cloud fileID for ${cloudPath}. Run npm run upload:score-assets first.`);
  }

  return manifestFile.fileID;
}

async function generatePieceAssets(piece, options) {
  const pieceDir = path.join(SCORE_IMAGE_ROOT, piece.id);
  await cleanOutputDir(pieceDir);

  if (piece.renderMode === 'source-image') {
    return generateSourceImageAssets(piece, options, pieceDir);
  }

  const config = getScoreConfig(piece);
  const endBeat = getEndBeat(piece.notes);
  const windows = getSystemWindows(piece, config, endBeat);
  const systems = [];

  for (let index = 0; index < windows.length; index += 1) {
    const { beatStart, beatEnd, renderBeatEnd } = windows[index];
    const { image, noteBoxes, noteIndexes } = renderSystemImage(piece, index, beatStart, renderBeatEnd, config);
    const fileBase = [
      `system-${String(index).padStart(3, '0')}`,
      config.assetFileSuffix,
    ].filter(Boolean).join('-');
    const fileName = `${fileBase}.${config.assetExtension || 'png'}`;
    const imagePath = path.join(pieceDir, fileName);
    await fs.writeFile(imagePath, image);

    systems.push({
      index,
      imageSrc: getImageSrcForMode(piece.id, fileName, options),
      beatStart,
      beatEnd,
      noteStartIndex: noteIndexes.length ? noteIndexes[0] : 0,
      noteEndIndex: noteIndexes.length ? noteIndexes[noteIndexes.length - 1] : 0,
      width: config.systemWidth,
      height: getSystemHeight(config, index),
      noteBoxes,
    });
  }

  return {
    pieceId: piece.id,
    systems,
  };
}

async function generateSourceImageAssets(piece, options, pieceDir) {
  if (!Array.isArray(piece.sourceImageSystems) || !piece.sourceImageSystems.length) {
    throw new Error(`source-image piece ${piece.id} requires sourceImageSystems.`);
  }

  const systems = [];
  for (let index = 0; index < piece.sourceImageSystems.length; index += 1) {
    const sourceSystem = piece.sourceImageSystems[index];
    const sourcePath = path.join(PROJECT_ROOT, sourceSystem.sourcePath);
    const fileName = sourceSystem.fileName || `source-system-${String(index).padStart(3, '0')}.png`;
    const imagePath = path.join(pieceDir, fileName);

    let width = Number(sourceSystem.width || 0);
    let height = Number(sourceSystem.height || 0);
    if (sourceSystem.crop) {
      const sourceImage = await loadImage(sourcePath);
      const crop = sourceSystem.crop;
      const cropX = Number(crop.x || 0);
      const cropY = Number(crop.y || 0);
      const cropWidth = Number(crop.width || sourceImage.width);
      const cropHeight = Number(crop.height || sourceImage.height);
      width = Number(crop.targetWidth || sourceSystem.width || cropWidth);
      const usePageScale = crop.scaleMode === 'page-width';
      const useStretchXPageY = crop.scaleMode === 'stretch-x-page-y';
      const pageScale = (usePageScale || useStretchXPageY)
        ? width / Number(crop.pageWidth || sourceImage.width || width)
        : width / cropWidth;
      const drawnWidth = usePageScale ? cropWidth * pageScale : width;
      const drawnHeight = cropHeight * pageScale;
      height = Number(crop.targetHeight || sourceSystem.height || Math.round(drawnHeight));
      const drawX = usePageScale
        ? Math.round((width - drawnWidth) / 2)
        : 0;
      const drawY = Number(crop.offsetY || 0);
      const canvas = createCanvas(width, height);
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(
        sourceImage,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        drawX,
        drawY,
        Math.round(drawnWidth),
        Math.round(drawnHeight)
      );
      await fs.writeFile(imagePath, canvas.toBuffer('image/png'));
    } else {
      await fs.copyFile(sourcePath, imagePath);
    }

    if (!width || !height) {
      throw new Error(`source-image system ${piece.id}/${fileName} requires width and height.`);
    }

    const noteIndexes = getSourceImageNoteIndexes(piece, sourceSystem);
    systems.push({
      index,
      imageSrc: getImageSrcForMode(piece.id, fileName, options),
      sourcePath: sourceSystem.sourcePath,
      renderMode: 'source-image',
      beatStart: Number(sourceSystem.beatStart || 0),
      beatEnd: Number(sourceSystem.beatEnd || 0),
      noteStartIndex: noteIndexes.length ? noteIndexes[0] : Number(sourceSystem.noteStartIndex || 0),
      noteEndIndex: noteIndexes.length ? noteIndexes[noteIndexes.length - 1] : Number(sourceSystem.noteEndIndex || 0),
      width,
      height,
      noteBoxes: buildSourceImageNoteBoxes(piece, sourceSystem, width, height, noteIndexes),
    });
  }

  return {
    pieceId: piece.id,
    renderMode: 'source-image',
    systems,
  };
}

function getSystemWindows(piece, config, endBeat) {
  if (piece.id !== 'vivaldi_rv356_excerpt') {
    const systemCount = Math.max(1, Math.floor(getLastNoteStartBeat(piece.notes) / config.beatsPerSystem) + 1);
    return Array.from({ length: systemCount }, (_, index) => {
      const beatStart = index * config.beatsPerSystem;
      return {
        beatStart,
        beatEnd: Math.min(beatStart + config.beatsPerSystem, endBeat),
        renderBeatEnd: beatStart + config.beatsPerSystem,
      };
    });
  }

  const pickupBeatLength = Number(config.pickupBeatLength || 0.5);
  const shiftedLastStart = Math.max(0, getLastNoteStartBeat(piece.notes) - pickupBeatLength);
  const systemCount = Math.max(1, Math.floor(shiftedLastStart / config.beatsPerSystem) + 1);
  return Array.from({ length: systemCount }, (_, index) => {
    const beatStart = index === 0
      ? 0
      : pickupBeatLength + index * config.beatsPerSystem;
    const renderBeatEnd = index === 0
      ? pickupBeatLength + config.beatsPerSystem
      : beatStart + config.beatsPerSystem;
    return {
      beatStart,
      beatEnd: Math.min(renderBeatEnd, endBeat),
      renderBeatEnd,
    };
  });
}

async function writeMetadata(assetsByPiece, outputPath) {
  const content = [
    'module.exports = ',
    JSON.stringify(assetsByPiece),
    ';\n',
  ].join('');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, content, 'utf8');
}

async function syncMiniProgramImages(pieceIds) {
  await fs.mkdir(MINIPROGRAM_SCORE_IMAGE_ROOT, { recursive: true });
  for (const pieceId of pieceIds) {
    await fs.rm(path.join(MINIPROGRAM_SCORE_IMAGE_ROOT, pieceId), { recursive: true, force: true });
    await fs.cp(
      path.join(SCORE_IMAGE_ROOT, pieceId),
      path.join(MINIPROGRAM_SCORE_IMAGE_ROOT, pieceId),
      { recursive: true }
    );
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.mode === 'cloud') {
    options.cloudFiles = await readCloudManifest();
  }

  await fs.mkdir(SCORE_IMAGE_ROOT, { recursive: true });
  const assetsByPiece = {};
  for (const piece of listPieces()) {
    assetsByPiece[piece.id] = await generatePieceAssets(piece, options);
  }
  if (options.mode === 'miniprogram') {
    await syncMiniProgramImages(Object.keys(assetsByPiece));
  }
  const metadataPath = options.mode === 'cloud' || options.mode === 'miniprogram'
    ? METADATA_PATH
    : LOCAL_METADATA_PATH;
  await writeMetadata(assetsByPiece, metadataPath);
  console.log(
    `Generated ${options.mode} score assets for ${Object.keys(assetsByPiece).length} pieces at ${path.relative(PROJECT_ROOT, metadataPath)}.`
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  createVivaldiEngravingForSystem,
  getVivaldiSystemEngraving,
  VIVALDI_ENGRAVING_MARKS,
  VIVALDI_ENGRAVING_SLURS,
  VIVALDI_SYSTEM_ENGRAVING,
};
