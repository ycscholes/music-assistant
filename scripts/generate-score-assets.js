const fs = require('node:fs/promises');
const path = require('node:path');
const { createCanvas, registerFont } = require('canvas');
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
const CLOUD_MANIFEST_PATH = path.join(GENERATED_ROOT, 'cloud-manifest.json');
const LOCAL_METADATA_PATH = path.join(GENERATED_ROOT, 'generated-score-assets.local.js');
const METADATA_PATH = path.join(PROJECT_ROOT, 'miniprogram/utils/score-practice/generated-score-assets.js');
const CLOUD_ASSET_VERSION = 'formal-score-v2';
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
  assetFileSuffix: 'pickup-v2',
  systemWidth: 1080,
  systemHeight: 350,
  firstSystemHeight: 410,
  staveX: 58,
  firstStaveY: 186,
  staveY: 126,
  staveWidth: 982,
  contentWidth: 910,
  background: '#ffffff',
  pickupBeatLength: 0.5,
  firstPickupX: 266,
  firstPickupWidth: 94,
  firstBarlineX: 384,
  firstMeasureX: 424,
  firstMeasureWidth: 548,
  firstMeasureNumberX: 446,
  staveOptions: {
    spacingBetweenLinesPx: 16,
  },
  showHeader: true,
  showMeasureBoxes: true,
};
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
    if (arg.startsWith('--mode=')) {
      options.mode = arg.slice('--mode='.length);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!['local', 'cloud'].includes(options.mode)) {
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

function buildTickables(piece, systemBeatStart, systemBeatEnd) {
  const tickables = [];
  const sourceSegments = new Map();
  let cursor = systemBeatStart;

  const notes = piece.notes
    .map((note, noteIndex) => ({ note, noteIndex }))
    .filter((item) => {
      const start = Number(item.note.startBeat || 0);
      const end = start + Number(item.note.durationBeat || 0);
      return start >= systemBeatStart && start < systemBeatEnd && end > systemBeatStart;
    })
    .sort((a, b) => Number(a.note.startBeat || 0) - Number(b.note.startBeat || 0));

  for (const item of notes) {
    const noteStart = Math.max(systemBeatStart, Number(item.note.startBeat || 0));
    if (noteStart > cursor + 0.001) {
      addRestTickables(tickables, noteStart - cursor);
    }

    const visibleDuration = Math.min(
      Number(item.note.durationBeat || 0),
      systemBeatEnd - noteStart
    );
    const segments = [];
    for (const part of decomposeDuration(visibleDuration)) {
      const token = durationToken(part);
      const staveNote = new StaveNote({
        keys: [vexKey(item.note)],
        duration: token.duration,
      });
      if (token.dotted) {
        Dot.buildAndAttach([staveNote]);
      }
      addAccidentalIfNeeded(staveNote, item.note);
      staveNote.sourceNoteIndex = item.noteIndex;
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
    tickables.push(rest);
  }
}

function renderSystemImage(piece, systemIndex, systemBeatStart, systemBeatEnd, config) {
  if (piece.id === 'vivaldi_rv356_excerpt' && systemIndex === 0) {
    return renderVivaldiFirstSystemImage(piece, config);
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

function renderVivaldiFirstSystemImage(piece, config) {
  const systemWidth = config.systemWidth;
  const systemHeight = getSystemHeight(config, 0);
  const staveY = config.firstStaveY;
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

  drawSystemHeader(context, piece, 0, config);

  const stave = new Stave(config.staveX, staveY, config.staveWidth, config.staveOptions);
  stave.addClef(piece.clef || 'treble');
  stave.addKeySignature(keySignatureForVexFlow(piece));
  stave.addTimeSignature(piece.timeSignature || '4/4');
  stave.setContext(context).draw();

  const pickupEnd = Number(config.pickupBeatLength || 0.5);
  const measureEnd = pickupEnd + config.beatsPerSystem;
  const pickup = buildTickables(piece, 0, pickupEnd);
  const measure = buildTickables(piece, pickupEnd, measureEnd);
  const { beatValue } = timeSignatureParts(piece);

  const pickupStave = new Stave(config.firstPickupX, staveY, config.firstPickupWidth, config.staveOptions);
  pickupStave.setContext(context);
  pickupStave.setNoteStartX(config.firstPickupX);
  drawTickablesOnStave(context, pickupStave, pickup.tickables, pickup.sourceSegments, {
    numBeats: 1,
    beatValue: 8,
    contentWidth: config.firstPickupWidth,
  });

  drawManualBarline(context, config.firstBarlineX, staveY, config);

  const measureStave = new Stave(config.firstMeasureX, staveY, config.firstMeasureWidth, config.staveOptions);
  measureStave.setContext(context);
  measureStave.setNoteStartX(config.firstMeasureX);
  drawTickablesOnStave(context, measureStave, measure.tickables, measure.sourceSegments, {
    numBeats: config.beatsPerSystem,
    beatValue,
    contentWidth: config.firstMeasureWidth,
  });

  const sourceSegments = new Map([...pickup.sourceSegments, ...measure.sourceSegments]);
  drawPracticeMarks(context, piece, 0, sourceSegments);

  return {
    image: getCanvasImageBuffer(canvas, config),
    noteBoxes: buildNoteBoxes(piece, sourceSegments, systemWidth, systemHeight, 0, config),
    noteIndexes: [...pickup.noteIndexes, ...measure.noteIndexes],
  };
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

  const beams = Beam.generateBeams(
    tickables.filter((tickable) => tickable instanceof StaveNote && !String(tickable.duration).includes('r')),
    {
      groups: [new Fraction(2, 8)],
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
  const metadataPath = options.mode === 'cloud' ? METADATA_PATH : LOCAL_METADATA_PATH;
  await writeMetadata(assetsByPiece, metadataPath);
  console.log(
    `Generated ${options.mode} score assets for ${Object.keys(assetsByPiece).length} pieces at ${path.relative(PROJECT_ROOT, metadataPath)}.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
