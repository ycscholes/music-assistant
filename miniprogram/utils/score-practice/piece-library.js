const { midiToFrequency } = require('../note');
const { VIVALDI_RV356_PDF_MIDI_SPECS } = require('./vivaldi-rv356-pdf-notes');

function buildNote(pitch, octave, startBeat, durationBeat, extras = {}) {
  const midi = pitchToMidi(pitch, octave);
  return Object.assign(
    {
      pitch,
      octave,
      label: `${pitch}${octave}`,
      midi,
      targetFrequency: Number(midiToFrequency(midi).toFixed(2)),
      startBeat,
      durationBeat,
    },
    extras
  );
}

function pitchToMidi(pitch, octave) {
  const values = {
    C: 0,
    'C#': 1,
    D: 2,
    'D#': 3,
    E: 4,
    F: 5,
    'F#': 6,
    G: 7,
    'G#': 8,
    A: 9,
    'A#': 10,
    B: 11,
  };
  return (octave + 1) * 12 + values[pitch];
}

function midiToPitchParts(midi) {
  const labels = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];
  return {
    pitch: labels[midi % 12],
    octave: Math.floor(midi / 12) - 1,
  };
}

function buildNoteFromMidi(midi, startBeat, durationBeat, extras = {}) {
  const pitchParts = midiToPitchParts(midi);
  return Object.assign(
    {
      pitch: pitchParts.pitch,
      octave: pitchParts.octave,
      label: pitchParts.pitch + pitchParts.octave,
      midi,
      targetFrequency: Number(midiToFrequency(midi).toFixed(2)),
      startBeat,
      durationBeat,
    },
    extras
  );
}

function buildNotesFromSpecs(specs) {
  let currentBeat = 0;
  return specs.map((spec) => {
    const [pitch, octave, durationBeat, displayLabel] = spec;
    const note = buildNote(pitch, octave, currentBeat, durationBeat, {
      phraseIndex: Math.floor(currentBeat / 16),
      measureIndex: Math.floor(currentBeat / 4),
      ...(displayLabel ? { label: displayLabel } : {}),
    });
    currentBeat += durationBeat;
    return note;
  });
}

function buildNotesFromMidiSpecs(specs) {
  return specs.map(([midi, startBeat, durationBeat]) =>
    buildNoteFromMidi(midi, startBeat, durationBeat, {
      phraseIndex: Math.floor(startBeat / 16),
      measureIndex: Math.floor(startBeat / 4),
    })
  );
}

function parseAbcLength(source, index, baseBeat) {
  let cursor = index;
  let numerator = '';
  while (/\d/.test(source[cursor] || '')) {
    numerator += source[cursor];
    cursor += 1;
  }

  if (source[cursor] !== '/') {
    return {
      durationBeat: baseBeat * (numerator ? Number(numerator) : 1),
      nextIndex: cursor,
    };
  }

  cursor += 1;
  let denominator = '';
  while (/\d/.test(source[cursor] || '')) {
    denominator += source[cursor];
    cursor += 1;
  }

  const top = numerator ? Number(numerator) : 1;
  const bottom = denominator ? Number(denominator) : 2;
  return {
    durationBeat: baseBeat * (top / bottom),
    nextIndex: cursor,
  };
}

function abcPitchToMidi(letter, accidental, octaveMarks) {
  const baseMidiByLetter = {
    C: 60,
    D: 62,
    E: 64,
    F: 65,
    G: 67,
    A: 69,
    B: 71,
  };
  const baseLetter = letter.toUpperCase();
  let midi = baseMidiByLetter[baseLetter] + accidental;
  if (letter === letter.toLowerCase()) {
    midi += 12;
  }
  for (const mark of octaveMarks) {
    midi += mark === "'" ? 12 : -12;
  }
  return midi;
}

function skipAbcDecoration(source, index) {
  const char = source[index];
  if (char === '"') {
    const end = source.indexOf('"', index + 1);
    return end === -1 ? source.length : end + 1;
  }
  if (char === '!') {
    const end = source.indexOf('!', index + 1);
    return end === -1 ? source.length : end + 1;
  }
  if (char === '{') {
    const end = source.indexOf('}', index + 1);
    return end === -1 ? source.length : end + 1;
  }
  return index;
}

function buildNotesFromAbcBody(abcBody) {
  const baseBeat = 0.5;
  const notes = [];
  let currentBeat = 0;
  let cursor = 0;
  let pendingBrokenRhythm = null;

  while (cursor < abcBody.length) {
    const decorationEnd = skipAbcDecoration(abcBody, cursor);
    if (decorationEnd !== cursor) {
      cursor = decorationEnd;
      continue;
    }

    const char = abcBody[cursor];
    if (char === '%') {
      const lineEnd = abcBody.indexOf('\n', cursor + 1);
      cursor = lineEnd === -1 ? abcBody.length : lineEnd + 1;
      continue;
    }
    if (char === '|' || char === '[' || char === ']' || char === '$' || /\s/.test(char)) {
      cursor += 1;
      continue;
    }
    if (char === '(' || char === ')' || char === '.' || char === 'u') {
      cursor += 1;
      continue;
    }

    let accidental = 0;
    while (abcBody[cursor] === '^' || abcBody[cursor] === '_' || abcBody[cursor] === '=') {
      if (abcBody[cursor] === '^') accidental += 1;
      if (abcBody[cursor] === '_') accidental -= 1;
      if (abcBody[cursor] === '=') accidental = 0;
      cursor += 1;
    }

    if (abcBody[cursor] === 'z') {
      const parsed = parseAbcLength(abcBody, cursor + 1, baseBeat);
      let restDuration = parsed.durationBeat;
      if (pendingBrokenRhythm === '>') restDuration *= 0.5;
      if (pendingBrokenRhythm === '<') restDuration *= 1.5;
      pendingBrokenRhythm = null;
      currentBeat = Number((currentBeat + restDuration).toFixed(4));
      cursor = parsed.nextIndex;
      continue;
    }

    if (!/[A-Ga-g]/.test(abcBody[cursor] || '')) {
      cursor += 1;
      continue;
    }

    const letter = abcBody[cursor];
    cursor += 1;
    const octaveMarks = [];
    while (abcBody[cursor] === "'" || abcBody[cursor] === ',') {
      octaveMarks.push(abcBody[cursor]);
      cursor += 1;
    }
    const parsed = parseAbcLength(abcBody, cursor, baseBeat);
    cursor = parsed.nextIndex;

    let durationBeat = parsed.durationBeat;
    if (pendingBrokenRhythm === '>') durationBeat *= 0.5;
    if (pendingBrokenRhythm === '<') durationBeat *= 1.5;
    pendingBrokenRhythm = null;

    let lookahead = cursor;
    while (lookahead < abcBody.length) {
      const next = skipAbcDecoration(abcBody, lookahead);
      if (next !== lookahead) {
        lookahead = next;
        continue;
      }
      if (abcBody[lookahead] === '(' || abcBody[lookahead] === ')' || abcBody[lookahead] === '.' || /\s/.test(abcBody[lookahead] || '')) {
        lookahead += 1;
        continue;
      }
      break;
    }

    if (abcBody[lookahead] === '>' || abcBody[lookahead] === '<') {
      pendingBrokenRhythm = abcBody[lookahead];
      durationBeat *= pendingBrokenRhythm === '>' ? 1.5 : 0.5;
      cursor = lookahead + 1;
    }

    const midi = abcPitchToMidi(letter, accidental, octaveMarks);
    notes.push(
      buildNoteFromMidi(midi, currentBeat, Number(durationBeat.toFixed(4)), {
        phraseIndex: Math.floor(currentBeat / 16),
        measureIndex: Math.floor(currentBeat / 4),
      })
    );
    currentBeat = Number((currentBeat + durationBeat).toFixed(4));
  }

  return notes;
}

const SCALE_COMBO_NOTES = buildNotesFromSpecs([
  ['B', 3, 1],
  ['C#', 4, 1],
  ['D#', 4, 1],
  ['E', 4, 1],
  ['F#', 4, 1],
  ['G#', 4, 1],
  ['A#', 4, 1],
  ['B', 4, 2],
  ['A#', 4, 1],
  ['G#', 4, 1],
  ['F#', 4, 1],
  ['E', 4, 1],
  ['D#', 4, 1],
  ['C#', 4, 1],
  ['B', 3, 2],
  ['B', 3, 1],
  ['D#', 4, 1],
  ['F#', 4, 1],
  ['B', 4, 2],
  ['F#', 4, 1],
  ['D#', 4, 1],
  ['B', 3, 2],
  ['G', 3, 1],
  ['A', 3, 1],
  ['A#', 3, 1, 'Bb3'],
  ['C', 4, 1],
  ['D', 4, 1],
  ['D#', 4, 1, 'Eb4'],
  ['F#', 4, 1],
  ['G', 4, 2],
  ['F#', 4, 1],
  ['D#', 4, 1, 'Eb4'],
  ['D', 4, 1],
  ['C', 4, 1],
  ['A#', 3, 1, 'Bb3'],
  ['A', 3, 1],
  ['G', 3, 2],
  ['G', 3, 1],
  ['A', 3, 1],
  ['A#', 3, 1, 'Bb3'],
  ['C', 4, 1],
  ['D', 4, 1],
  ['E', 4, 1],
  ['F#', 4, 1],
  ['G', 4, 2],
  ['F', 4, 1],
  ['D#', 4, 1, 'Eb4'],
  ['D', 4, 1],
  ['C', 4, 1],
  ['A#', 3, 1, 'Bb3'],
  ['A', 3, 1],
  ['G', 3, 2],
  ['G', 3, 1],
  ['A#', 3, 1, 'Bb3'],
  ['D', 4, 1],
  ['G', 4, 2],
  ['D', 4, 1],
  ['A#', 3, 1, 'Bb3'],
  ['G', 3, 2],
]);

const VIVALDI_RV356_NOTES = buildNotesFromMidiSpecs(VIVALDI_RV356_PDF_MIDI_SPECS);

function vivaldiMeasureBeat(measureNumber) {
  return 0.5 + (Number(measureNumber) - 1) * 4;
}

const VIVALDI_SOURCE_TARGET_WIDTH = 1080;
const VIVALDI_PDF_PAGE_WIDTH = 1147;
const VIVALDI_ROW_START_CROP_PADDING_X = 32;
const VIVALDI_INNER_MEASURE_CROP_PADDING_X = 2;
const VIVALDI_MEASURE_CROP_PADDING_RIGHT_X = 4;

const VIVALDI_PDF_PICKUP_SYSTEM = {
  page: 1,
  xStart: 55,
  xEnd: 192,
  y: 260,
  height: 155,
};

const VIVALDI_SOURCE_ROW_SPECS = [
  { page: 1, measureStart: 1, y: 305, height: 105, boundaries: [192, 536, 853, 1109] },
  { page: 1, measureStart: 4, y: 424, height: 112, boundaries: [55, 426, 767, 1109] },
  { page: 1, measureStart: 7, y: 548, height: 120, boundaries: [55, 427, 815, 1109] },
  { page: 1, measureStart: 10, y: 676, height: 130, boundaries: [55, 449, 821, 1109] },
  { page: 1, measureStart: 13, y: 802, height: 120, boundaries: [55, 462, 819, 1109] },
  { page: 1, measureStart: 16, y: 930, height: 145, boundaries: [55, 459, 794, 1109] },
  { page: 1, measureStart: 19, y: 1064, height: 120, boundaries: [55, 445, 777, 1109] },
  { page: 1, measureStart: 22, y: 1190, height: 125, boundaries: [55, 409, 663, 1109] },
  { page: 1, measureStart: 25, y: 1316, height: 130, boundaries: [55, 438, 797, 1109] },
  { page: 1, measureStart: 28, y: 1444, height: 160, boundaries: [55, 435, 772, 1109] },
  { page: 2, measureStart: 31, y: 145, height: 110, boundaries: [55, 459, 773, 1109] },
  { page: 2, measureStart: 34, y: 265, height: 112, boundaries: [55, 411, 764, 1109] },
  { page: 2, measureStart: 37, y: 389, height: 112, boundaries: [55, 421, 765, 1109] },
  { page: 2, measureStart: 40, y: 500, height: 130, boundaries: [55, 409, 740, 1109] },
  { page: 2, measureStart: 43, y: 625, height: 120, boundaries: [55, 377, 730, 1109] },
  { page: 2, measureStart: 46, y: 760, height: 130, boundaries: [55, 408, 782, 1109] },
  { page: 2, measureStart: 49, y: 860, height: 125, boundaries: [55, 428, 752, 1109] },
  { page: 2, measureStart: 52, y: 990, height: 125, boundaries: [55, 425, 758, 1109] },
  { page: 2, measureStart: 55, y: 1115, height: 125, boundaries: [55, 430, 782, 1109] },
  { page: 2, measureStart: 58, y: 1235, height: 130, boundaries: [55, 414, 740, 1109] },
  { page: 2, measureStart: 61, y: 1355, height: 145, boundaries: [55, 662, 1109] },
  { page: 3, measureStart: 63, y: 145, height: 130, boundaries: [55, 1109] },
  { page: 3, measureStart: 64, y: 310, height: 145, boundaries: [55, 593, 1109] },
  { page: 3, measureStart: 66, y: 490, height: 145, boundaries: [55, 430, 757, 1109] },
  { page: 3, measureStart: 69, y: 665, height: 145, boundaries: [55, 434, 756, 1109] },
  { page: 3, measureStart: 72, y: 855, height: 145, boundaries: [55, 441, 775, 1109] },
  { page: 3, measureStart: 75, y: 1025, height: 145, boundaries: [55, 437, 844, 1109] },
  { page: 3, measureStart: 78, y: 1190, height: 190, boundaries: [55, 453, 858, 1109] },
];

function vivaldiPdfSourcePath(page) {
  return `docs/sources/sheet-music/vivaldi-rv356-pdf-clean-page-${String(page).padStart(3, '0')}.png`;
}

function buildVivaldiPdfSourceSystem({ page, index, xStart, xEnd, y, height, beatStart, beatEnd }) {
  const leftPadding = xStart <= 60
    ? VIVALDI_ROW_START_CROP_PADDING_X
    : VIVALDI_INNER_MEASURE_CROP_PADDING_X;
  const cropX = Math.max(0, xStart - leftPadding);
  const cropEnd = Math.min(VIVALDI_PDF_PAGE_WIDTH, xEnd + VIVALDI_MEASURE_CROP_PADDING_RIGHT_X);
  const cropWidth = cropEnd - cropX;
  const scale = VIVALDI_SOURCE_TARGET_WIDTH / cropWidth;
  const drawX = 0;
  const startAnchorX = drawX + (xStart - cropX) * scale;
  const endAnchorX = drawX + (xEnd - cropX) * scale;
  return {
    sourcePath: vivaldiPdfSourcePath(page),
    fileName: `source-system-${String(index).padStart(3, '0')}.png`,
    beatStart,
    beatEnd,
    crop: {
      x: cropX,
      y,
      width: cropWidth,
      height,
      targetWidth: VIVALDI_SOURCE_TARGET_WIDTH,
      pageWidth: VIVALDI_PDF_PAGE_WIDTH,
      scaleMode: 'stretch-x-page-y',
    },
    noteBoxMode: 'beat',
    noteBoxMinWidth: 34,
    noteBoxMaxWidth: 132,
    beatBox: {
      x: startAnchorX,
      width: endAnchorX - startAnchorX,
    },
    beatAnchors: [
      { beat: beatStart, x: startAnchorX },
      { beat: beatEnd, x: endAnchorX },
    ],
  };
}

function buildVivaldiSourceImageSystems() {
  const systems = [
    buildVivaldiPdfSourceSystem({
      page: VIVALDI_PDF_PICKUP_SYSTEM.page,
      index: 0,
      xStart: VIVALDI_PDF_PICKUP_SYSTEM.xStart,
      xEnd: VIVALDI_PDF_PICKUP_SYSTEM.xEnd,
      y: VIVALDI_PDF_PICKUP_SYSTEM.y,
      height: VIVALDI_PDF_PICKUP_SYSTEM.height,
      beatStart: 0,
      beatEnd: 0.5,
    }),
  ];

  for (const row of VIVALDI_SOURCE_ROW_SPECS) {
    for (let offset = 0; offset < row.boundaries.length - 1; offset += 1) {
      const measure = row.measureStart + offset;
      const beatStart = vivaldiMeasureBeat(measure);
      const beatEnd = measure === 80 ? 320.5 : vivaldiMeasureBeat(measure + 1);
      systems.push(buildVivaldiPdfSourceSystem({
        page: row.page,
        index: measure,
        xStart: row.boundaries[offset],
        xEnd: row.boundaries[offset + 1],
        y: row.y,
        height: row.height,
        beatStart,
        beatEnd,
      }));
    }
  }

  return systems;
}

const TWINKLE_TWINKLE_NOTES = buildNotesFromSpecs([
  ['C', 4, 1],
  ['C', 4, 1],
  ['G', 4, 1],
  ['G', 4, 1],
  ['A', 4, 1],
  ['A', 4, 1],
  ['G', 4, 2],
  ['F', 4, 1],
  ['F', 4, 1],
  ['E', 4, 1],
  ['E', 4, 1],
  ['D', 4, 1],
  ['D', 4, 1],
  ['C', 4, 2],
  ['G', 4, 1],
  ['G', 4, 1],
  ['F', 4, 1],
  ['F', 4, 1],
  ['E', 4, 1],
  ['E', 4, 1],
  ['D', 4, 2],
  ['G', 4, 1],
  ['G', 4, 1],
  ['F', 4, 1],
  ['F', 4, 1],
  ['E', 4, 1],
  ['E', 4, 1],
  ['D', 4, 2],
  ['C', 4, 1],
  ['C', 4, 1],
  ['G', 4, 1],
  ['G', 4, 1],
  ['A', 4, 1],
  ['A', 4, 1],
  ['G', 4, 2],
  ['F', 4, 1],
  ['F', 4, 1],
  ['E', 4, 1],
  ['E', 4, 1],
  ['D', 4, 1],
  ['D', 4, 1],
  ['C', 4, 2],
]);

const HAYDN_SERENADE_ABC_BODY = `
"^Andante Cantabile"!p! (ue>f) | (ge) c4 (ge) | (af) c4 (fa) | (agfe) (edcB) |$ (Bc) G4 (g>g) | %5
 (ga/)g/ fe (edcB) | (B2 c2) z2 (ue>f) | (ge) c4 (ge) | (af) c4 (fa) | agfe (edc!tenuto!B) |$ %10
 (d/c/)B/c/ G4 g>g | (ga/g/) fe (edcB) | (B2 c2) z2 (uc>d) | (ecge) d4 | (dc)ec A3 c | %15
!<(! ((B!<)!d'))!mf! d'4 (c'b) |$ (ba) a4 (bg) |!f!{/d} d'4 (c'_bag) |!f!{/^f} (d'3 a) (c'_bag) | %19
!>(! (g2!>)! ^f2) z2!p! ud2 |{/d} d'2 d'>d' (e'd').c'.b |\${/b} c'2 c'>c' c'4 | b2 ab (c'bag) | %23
{/^f} a2 (d>d) d2 (b>c') | d'2 d'>d' (e'd').c'.b |{/b} c'2 c'>c' c'4 |$ b2 ab (c'ag^f) | %27
 (^f2 g2) z2!p! (uB>c) | d2 cB (dcBA) | (Bg) g4 (Bc) | (ed)cB (cAG^F) |$ (G3 B) dcA^F | %32
 (G3 B/d/) (cAG^F) | (^F2 G2) z2 |] %34
`;

const HAYDN_SERENADE_NOTES = buildNotesFromAbcBody(HAYDN_SERENADE_ABC_BODY);

const PIECES = [
  {
    id: 'scale_combo_b_major_g_minor',
    title: 'B大调 + g小调练习音阶',
    sourceId: 'violinspiration_scale_combo_2026_05',
    examSystem: 'practice-source',
    instrument: 'violin',
    edition: 'web-source-2026',
    examLevel: 'scale-practice',
    examCategory: '音阶与琶音',
    renderMode: 'generated',
    notesVerifiedAt: '2026-05-06',
    difficulty: '入门',
    keySignature: 'B 大调 / g 小调',
    clef: 'treble',
    staffDisplayRange: { low: 'G3', high: 'B4' },
    timeSignature: '4/4',
    bpm: 72,
    countInBeats: 4,
    estimatedDurationSec: 58,
    focusTips: ['先完成 B 大调音阶与琶音上下行', 'g 小调分别练习和声小调、旋律小调与主和弦琶音'],
    sourceRefs: [
      {
        title: 'B Major Scales & Arpeggios Violin Sheet Music - source page',
        url: 'https://violinspiration.com/b-major-scales-arpeggios-violin-sheet-music/',
        scoreScope: 'source-page-cover',
        notesScope: 'full scale and arpeggio practice sequence',
        targetFile: 'b-major-scale-violin.jpg',
      },
      {
        title: 'G Minor Scales & Arpeggios Violin Sheet Music Tutorial - source page',
        url: 'https://violinspiration.com/g-minor-scales-arpeggios-violin-sheet-music-tutorial/',
        scoreScope: 'source-page-cover',
        notesScope: 'full harmonic minor, melodic minor, and arpeggio practice sequence',
        targetFile: 'g-minor-scale-violin.jpg',
      },
    ],
    notes: SCALE_COMBO_NOTES,
  },
  {
    id: 'vivaldi_rv356_excerpt',
    title: '维瓦尔第 a小调协奏曲 RV356 第一乐章',
    sourceId: 'yqlq_vivaldi_rv356_pdf_notes_2026_06',
    examSystem: 'practice-source',
    instrument: 'violin',
    edition: '一起练琴 PDF 谱 / PDF visual note audit',
    examLevel: 'advanced-reference',
    examCategory: '乐曲',
    renderMode: 'generated',
    notesVerifiedAt: '2026-06-29',
    difficulty: '进阶',
    keySignature: 'a 小调',
    clef: 'treble',
    staffDisplayRange: { low: 'G3', high: 'D6' },
    timeSignature: '4/4',
    bpm: 96,
    countInBeats: 4,
    estimatedDurationSec: 201,
    focusTips: ['以 PDF 谱面标注的 Allegro ♩=96 练习', '每行显示一个小节，八分与十六分音符按 PDF 转录时值评测'],
    sourceRefs: [
      {
        title: '一起练琴 PDF 谱清洗版 - a 小调协奏曲第一乐章',
        scoreScope: 'PDF visible score pages, logo and QR area removed',
        targetFiles: [
          'vivaldi-rv356-yqlq-pdf-source.pdf',
          'vivaldi-rv356-pdf-clean-page-001.png',
          'vivaldi-rv356-pdf-clean-page-002.png',
          'vivaldi-rv356-pdf-clean-page-003.png',
          'vivaldi-rv356-pdf-notes.audit.json',
        ],
      },
    ],
    sourceImageSystems: buildVivaldiSourceImageSystems(),
    notes: VIVALDI_RV356_NOTES,
  },
  {
    id: 'haydn_serenade_grade4',
    title: '小夜曲',
    sourceId: 'shcm_violin_grade4_haydn_serenade_qintongji_2026_06',
    examSystem: '上海音乐学院社会艺术水平考级',
    instrument: 'violin',
    edition: '小提琴考级曲集 第2册 四级-六级',
    examLevel: '四级',
    examCategory: '乐曲',
    renderMode: 'generated',
    notesVerifiedAt: '2026-06-27',
    difficulty: '四级',
    composer: '海顿',
    workTitle: 'Serenade',
    keySignature: 'C 大调',
    clef: 'treble',
    staffDisplayRange: { low: 'G4', high: 'D6' },
    timeSignature: '4/4',
    bpm: 80,
    countInBeats: 4,
    estimatedDurationSec: 118,
    focusTips: ['保持 Andante Cantabile 的连贯乐句', '注意高把位 d6 与 c6 周边音准', '带附点节奏的二音连线要从容'],
    sourceRefs: [
      {
        title: '上音小提琴四级曲目列表 - 海顿《小夜曲》',
        url: 'https://qintongji.com/kaoji-violin/',
        scoreScope: 'catalog-listing',
      },
      {
        title: "海顿《小夜曲》小提琴曲 - Haydn's Serenade",
        url: 'https://qintongji.com/%e6%b5%b7%e9%a1%bf%e3%80%8a%e5%b0%8f%e5%a4%9c%e6%9b%b2%e3%80%8b%e5%b0%8f%e6%8f%90%e7%90%b4%e6%9b%b2-haydns-serenade/',
        scoreScope: 'interactive-score-abc',
        targetFile: 'haydn-serenade-qintongji.abc',
      },
      {
        title: 'String Quartet in F major, Hob.III:17 / Op.3 No.5 source reference',
        url: 'https://imslp.org/wiki/String_Quartet_in_F_major%2C_Hob.III%3A17_%28Hoffstetter%2C_Roman%29',
        scoreScope: 'work-identification-reference',
        note: 'The serenade is traditionally attributed to Joseph Haydn in exam catalogs; modern sources often identify Roman Hoffstetter as the composer.',
      },
    ],
    notes: HAYDN_SERENADE_NOTES,
  },
  {
    id: 'twinkle_twinkle_mvp',
    title: '小星星 Twinkle Twinkle Little Star 完整旋律',
    sourceId: 'wikimedia_twinkle_public_domain_2026_05',
    examSystem: 'source-image-poc',
    instrument: 'violin',
    edition: 'public-domain-source',
    examLevel: 'poc',
    examCategory: '乐曲',
    renderMode: 'source-image',
    notesVerifiedAt: '2026-05-06',
    difficulty: '入门',
    keySignature: 'C 大调',
    clef: 'treble',
    staffDisplayRange: { low: 'C4', high: 'A4' },
    timeSignature: '4/4',
    bpm: 72,
    countInBeats: 4,
    estimatedDurationSec: 40,
    focusTips: ['用一拍一音保持稳定音准', '两个二拍长音要完整拉满'],
    sourceRefs: [
      {
        title: 'Twinkle Twinkle Sheet Music.png - full public domain source',
        url: 'https://commons.wikimedia.org/wiki/File:Twinkle_Twinkle_Sheet_Music.png',
        license: 'Public domain',
        scoreScope: 'full',
        targetFile: 'twinkle-twinkle-public-domain.png',
      },
    ],
    sourceImageSystems: [
      {
        sourcePath: 'docs/sources/sheet-music/twinkle-twinkle-public-domain.png',
        fileName: 'source-system-000.png',
        noteStartIndex: 0,
        noteEndIndex: 41,
        beatStart: 0,
        beatEnd: 48,
        width: 1824,
        height: 782,
        noteArea: {
          x: 160,
          y: 210,
          width: 1500,
          height: 360,
          rowCount: 3,
          notesPerRow: 14,
        },
      },
    ],
    notes: TWINKLE_TWINKLE_NOTES,
  },
];

function listPieces() {
  return PIECES.slice();
}

function getPieceById(id) {
  return PIECES.find((piece) => piece.id === id) || null;
}

module.exports = {
  listPieces,
  getPieceById,
  buildNote,
};
