const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { detectPitchYin } = require('../miniprogram/utils/pitch-yin');
const { frequencyToNote, frequencyToTargetCentOffset } = require('../miniprogram/utils/note');
const { calculatePracticeScore } = require('../miniprogram/utils/score');
const { concatArrayBuffers, createWavFileBuffer, createRingBuffer } = require('../miniprogram/utils/audio-frame');
const { getTuningStatus } = require('../miniprogram/utils/tuning-status');
const { getTargetNoteByKey } = require('../miniprogram/utils/target-notes');
const { getPieceById, listPieces } = require('../miniprogram/utils/score-practice/piece-library');
const { createTimeline, getActiveNoteIndex } = require('../miniprogram/utils/score-practice/metronome-timeline');
const { evaluateScorePractice } = require('../miniprogram/utils/score-practice/score-evaluator');
const { buildPerformanceAlignment, createPerformanceAligner } = require('../miniprogram/utils/score-practice/performance-aligner');
const { buildPitchGateAlignment, createPitchGateAligner } = require('../miniprogram/utils/score-practice/pitch-gate-aligner');
const { buildAdvice } = require('../miniprogram/utils/score-practice/score-feedback');
const { buildStaffScore, getStaffY, getLedgerLines, parsePitch } = require('../miniprogram/utils/score-practice/staff-layout');

const vivaldiPdfAuditPath = path.join(__dirname, '../docs/sources/sheet-music/vivaldi-rv356-pdf-notes.audit.json');

function readVivaldiPdfAudit() {
  return JSON.parse(fs.readFileSync(vivaldiPdfAuditPath, 'utf-8'));
}

function flattenVivaldiAuditSpecs(audit) {
  return audit.measures.flatMap((measure) => measure.notes);
}

function sineWave(frequency, sampleRate = 44100, seconds = 0.16) {
  const length = Math.floor(sampleRate * seconds);
  const buffer = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    buffer[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * 0.6;
  }
  return buffer;
}

test('YIN detects violin open string frequencies', () => {
  const cases = [
    { frequency: 196, label: 'G3' },
    { frequency: 293.66, label: 'D4' },
    { frequency: 440, label: 'A4' },
    { frequency: 659.25, label: 'E5' },
  ];

  for (const item of cases) {
    const result = detectPitchYin(sineWave(item.frequency), 44100);
    assert.ok(result.frequency, `expected frequency for ${item.label}`);
    assert.ok(Math.abs(result.frequency - item.frequency) < 1.5, `${item.label} frequency drift`);
    assert.ok(result.confidence > 0.8, `${item.label} confidence`);
    assert.equal(frequencyToNote(result.frequency).label, item.label);
  }
});

test('frequencyToNote returns cent offsets', () => {
  const a4 = frequencyToNote(442);
  assert.equal(a4.label, 'A4');
  assert.ok(a4.centOffset > 0);
  assert.ok(a4.centOffset < 10);
});

test('frequencyToTargetCentOffset compares against selected target note', () => {
  assert.ok(Math.abs(frequencyToTargetCentOffset(440, 440)) < 0.001);
  assert.ok(frequencyToTargetCentOffset(442, 440) > 0);
  assert.ok(frequencyToTargetCentOffset(438, 440) < 0);
  assert.ok(Math.abs(frequencyToTargetCentOffset(293.66, 293.66)) < 0.001);
});

test('violin target notes use accurate open string frequencies', () => {
  const cases = [
    ['G3', 196.0],
    ['D4', 293.6647679174076],
    ['A4', 440.0],
    ['E5', 659.2551138257398],
  ];

  for (const [key, expectedFrequency] of cases) {
    assert.ok(Math.abs(getTargetNoteByKey(key).frequency - expectedFrequency) < 1e-9);
  }
});

test('piece library includes Shanghai Conservatory grade 4 Haydn Serenade', () => {
  const piece = getPieceById('haydn_serenade_grade4');
  assert.ok(piece);
  assert.equal(piece.title, '小夜曲');
  assert.equal(piece.composer, '海顿');
  assert.equal(piece.examSystem, '上海音乐学院社会艺术水平考级');
  assert.equal(piece.edition, '小提琴考级曲集 第2册 四级-六级');
  assert.equal(piece.examLevel, '四级');
  assert.equal(piece.bpm, 80);
  assert.equal(piece.notes.length, 192);
  assert.equal(piece.notes[0].label, 'E5');
  assert.equal(piece.notes[0].durationBeat, 0.75);
  assert.equal(piece.notes[piece.notes.length - 1].label, 'G4');
  assert.equal(listPieces().some((item) => item.id === 'haydn_serenade_grade4'), true);
});

test('getTuningStatus highlights the in-tune range and tuning direction', () => {
  assert.equal(getTuningStatus(null).key, 'waiting');
  assert.equal(getTuningStatus(0).key, 'in-tune');
  assert.equal(getTuningStatus(8).key, 'in-tune');
  assert.equal(getTuningStatus(-8).key, 'in-tune');
  assert.equal(getTuningStatus(12).key, 'sharp');
  assert.equal(getTuningStatus(-12).key, 'flat');
  assert.equal(getTuningStatus(120).key, 'far');
});

test('score ignores invalid frames and combines pitch and stability', () => {
  const score = calculatePracticeScore([
    { centOffset: 5, confidence: 0.9 },
    { centOffset: -8, confidence: 0.85 },
    { centOffset: 12, confidence: 0.8 },
    { centOffset: 90, confidence: 0.1 },
  ]);

  assert.equal(score.validFrameCount, 3);
  assert.ok(score.pitchScore > 80);
  assert.ok(score.stabilityScore > 70);
  assert.ok(score.totalScore > 75);
});

test('score prefers targetCentOffset over detected nearest-note offset', () => {
  const score = calculatePracticeScore([
    { centOffset: 0, targetCentOffset: 20, confidence: 0.9 },
    { centOffset: 0, targetCentOffset: 22, confidence: 0.9 },
  ]);

  assert.equal(score.validFrameCount, 2);
  assert.ok(score.pitchScore < 65);
});

test('score returns zero for no valid frames', () => {
  const score = calculatePracticeScore([{ centOffset: 10, confidence: 0.2 }]);
  assert.equal(score.validFrameCount, 0);
  assert.equal(score.totalScore, 0);
});

test('createWavFileBuffer wraps pcm bytes with a wav header', () => {
  const first = new Uint8Array([1, 2, 3, 4]).buffer;
  const second = new Uint8Array([5, 6]).buffer;
  const pcm = concatArrayBuffers([first, second]);
  const wav = createWavFileBuffer(pcm, 44100, 1, 16);
  const bytes = new Uint8Array(wav);
  const view = new DataView(wav);
  const text = (start, length) =>
    String.fromCharCode.apply(null, Array.from(bytes.slice(start, start + length)));

  assert.equal(text(0, 4), 'RIFF');
  assert.equal(text(8, 4), 'WAVE');
  assert.equal(text(12, 4), 'fmt ');
  assert.equal(text(36, 4), 'data');
  assert.equal(view.getUint32(40, true), 6);
  assert.deepEqual(Array.from(bytes.slice(44)), [1, 2, 3, 4, 5, 6]);
});

test('score practice evaluator scores matched notes and penalizes misses', () => {
  const piece = getPieceById('scale_combo_b_major_g_minor');
  const timeline = createTimeline(piece, { createdAt: 1000 });
  const frames = [
    { frequency: 246.94, confidence: 0.9, timestamp: timeline.startTimestamp + 20 },
    { frequency: 277.18, confidence: 0.92, timestamp: timeline.startTimestamp + timeline.beatDurationMs + 10 },
    { frequency: 311.13, confidence: 0.9, timestamp: timeline.startTimestamp + timeline.beatDurationMs * 2 + 10 },
    { frequency: 329.63, confidence: 0.9, timestamp: timeline.startTimestamp + timeline.beatDurationMs * 3 + 10 },
  ];

  const result = evaluateScorePractice(frames, timeline);
  assert.equal(result.noteResults[0].matched, true);
  assert.equal(result.noteResults[4].issueTags.includes('missed'), true);
  assert.ok(result.summaryScores.completionRate < 0.5);
  assert.ok(result.summaryScores.totalScore < result.summaryScores.pitchScore);
});

test('score practice evaluator flags late and short notes', () => {
  const piece = getPieceById('scale_combo_b_major_g_minor');
  const timeline = createTimeline(piece, { createdAt: 1000 });
  // With systemDelayMs compensation, the timestamp must exceed
  // expectedStart + timingTolerance + effectiveSystemDelay to trigger "late".
  const lateTime = timeline.startTimestamp + timeline.windows[0].expectedStartMs + timeline.windows[0].timingToleranceMs + 200;
  const result = evaluateScorePractice(
    [
      { frequency: timeline.windows[0].note.targetFrequency, confidence: 0.9, timestamp: lateTime },
      { frequency: timeline.windows[1].note.targetFrequency, confidence: 0.9, timestamp: timeline.startTimestamp + timeline.windows[1].expectedStartMs + 10 },
    ],
    timeline
  );

  assert.equal(result.noteResults[0].issueTags.includes('late'), true);
  assert.equal(result.noteResults[0].issueTags.includes('too-short'), true);
});

test('score practice evaluator flags early notes inside timing tolerance window', () => {
  const piece = getPieceById('vivaldi_rv356_excerpt');
  const timeline = createTimeline(piece, { createdAt: 1000 });
  const firstWindow = timeline.windows[0];
  const earlyTime =
    timeline.startTimestamp +
    firstWindow.expectedStartMs -
    firstWindow.timingToleranceMs +
    20;
  const result = evaluateScorePractice(
    [
      { frequency: 659.25, confidence: 0.9, timestamp: earlyTime },
      { frequency: 659.25, confidence: 0.9, timestamp: earlyTime + 120 },
    ],
    timeline
  );

  assert.equal(result.noteResults[0].matched, true);
  assert.equal(result.noteResults[0].timingOffsetMs < 0, true);
  assert.equal(result.noteResults[0].issueTags.includes('early'), true);
});

test('vivaldi generated score keeps PDF eighth and sixteenth note timing at 96 bpm', () => {
  const piece = getPieceById('vivaldi_rv356_excerpt');
  const timeline = createTimeline(piece, { createdAt: 1000 });
  const eighthWindow = timeline.windows[0];
  const sixteenthWindow = timeline.windows[6];
  const audit = readVivaldiPdfAudit();

  assert.ok(piece);
  assert.equal(piece.renderMode, 'generated');
  assert.equal(piece.bpm, 96);
  assert.equal(piece.notes.length, audit.noteCount);
  assert.equal(piece.notes[0].label, 'E5');
  assert.equal(piece.notes[0].durationBeat, 0.5);
  assert.equal(piece.notes[6].durationBeat, 0.25);
  assert.deepEqual(audit.measures[0].notes[0], [76, 0, 0.5]);
  assert.equal(timeline.beatDurationMs, 625);
  assert.equal(eighthWindow.expectedDurationMs, 313);
  assert.equal(sixteenthWindow.expectedDurationMs, 156);
});

test('vivaldi target notes match the PDF audit transcription', () => {
  const piece = getPieceById('vivaldi_rv356_excerpt');
  const audit = readVivaldiPdfAudit();
  const auditSpecs = flattenVivaldiAuditSpecs(audit);
  const pieceSpecs = piece.notes.map((note) => [note.midi, note.startBeat, note.durationBeat]);

  assert.equal(audit.sourcePdf, 'docs/sources/sheet-music/vivaldi-rv356-yqlq-pdf-source.pdf');
  assert.equal(audit.bpm, 96);
  assert.equal(audit.measures.length, 81);
  assert.equal(pieceSpecs.length, audit.noteCount);
  assert.deepEqual(pieceSpecs, auditSpecs);

  const checkedMeasures = new Set(audit.checkedMeasures);
  for (const measure of [0, 1, 31, 34, 63, 64, 66, 69, 72, 75, 78, 79, 80]) {
    assert.equal(checkedMeasures.has(measure), true);
    assert.ok(audit.measures[measure].notes.length > 0);
  }
});

test('score practice timeline can evaluate a selected note range', () => {
  const piece = getPieceById('twinkle_twinkle_mvp');
  const timeline = createTimeline(piece, {
    createdAt: 1000,
    startNoteIndex: 7,
    endNoteIndex: 13,
  });

  assert.equal(timeline.range.startNoteIndex, 7);
  assert.equal(timeline.range.endNoteIndex, 13);
  assert.equal(timeline.range.isFullPiece, false);
  assert.equal(timeline.windows.length, 7);
  assert.equal(timeline.windows[0].noteIndex, 7);
  assert.equal(timeline.windows[0].sequenceIndex, 0);
  assert.equal(timeline.windows[0].expectedStartMs, 0);
  assert.equal(timeline.getExpectedTimeForNote(7), timeline.startTimestamp);
  assert.equal(getActiveNoteIndex(timeline, timeline.startTimestamp + 20), 7);
  assert.equal(timeline.getWindowForNote(13).sequenceIndex, 6);
});

test('score practice evaluator completion rate is scoped to selected range', () => {
  const piece = getPieceById('twinkle_twinkle_mvp');
  const timeline = createTimeline(piece, {
    createdAt: 1000,
    startNoteIndex: 7,
    endNoteIndex: 9,
  });
  const result = evaluateScorePractice(
    [
      { frequency: 349.23, confidence: 0.9, timestamp: timeline.startTimestamp + 20 },
      {
        frequency: 349.23,
        confidence: 0.9,
        timestamp: timeline.startTimestamp + timeline.beatDurationMs + 20,
      },
    ],
    timeline
  );

  assert.equal(result.noteResults.length, 3);
  assert.equal(result.noteResults[0].noteIndex, 7);
  assert.equal(result.noteResults[1].noteIndex, 8);
  assert.equal(result.noteResults[2].noteIndex, 9);
  assert.equal(result.summaryScores.completionRate, 0.67);
});

test('performance aligner advances monotonically and ignores silence', () => {
  const piece = getPieceById('scale_combo_b_major_g_minor');
  const timeline = createTimeline(piece, {
    createdAt: 1000,
    startNoteIndex: 0,
    endNoteIndex: 3,
  });
  const aligner = createPerformanceAligner(timeline);
  const first = timeline.windows[0];
  const second = timeline.windows[1];

  let state = aligner.processFrame({
    frequency: first.note.targetFrequency,
    confidence: 0.9,
    timestamp: timeline.startTimestamp,
  });
  assert.equal(state.activeNoteIndex, first.noteIndex);

  state = aligner.processFrame({
    frequency: 0,
    confidence: 0,
    timestamp: timeline.startTimestamp + 900,
  });
  assert.equal(state.activeNoteIndex, first.noteIndex);

  aligner.processFrame({
    frequency: second.note.targetFrequency,
    confidence: 0.9,
    timestamp: timeline.startTimestamp + 1100,
  });
  state = aligner.processFrame({
    frequency: second.note.targetFrequency,
    confidence: 0.9,
    timestamp: timeline.startTimestamp + 1220,
  });
  assert.equal(state.activeNoteIndex, second.noteIndex);

  const alignment = aligner.finish();
  assert.equal(alignment.windows[0].matched, true);
  assert.equal(alignment.windows[1].matched, true);
  assert.equal(alignment.windows[2].matched, false);
  assert.equal(alignment.windows[2].skipped, true);
});

test('performance aligner segments repeated notes without silent auto-advance', () => {
  const piece = getPieceById('twinkle_twinkle_mvp');
  const timeline = createTimeline(piece, {
    createdAt: 1000,
    startNoteIndex: 0,
    endNoteIndex: 2,
  });
  const aligner = createPerformanceAligner(timeline);
  const c4 = timeline.windows[0].note.targetFrequency;
  const g4 = timeline.windows[2].note.targetFrequency;

  aligner.processFrame({ frequency: c4, confidence: 0.9, timestamp: timeline.startTimestamp });
  aligner.processFrame({ frequency: c4, confidence: 0.9, timestamp: timeline.startTimestamp + 460 });
  let state = aligner.processFrame({ frequency: c4, confidence: 0.9, timestamp: timeline.startTimestamp + 580 });
  assert.equal(state.activeNoteIndex, 1);

  aligner.processFrame({ frequency: 0, confidence: 0, timestamp: timeline.startTimestamp + 1100 });
  state = aligner.getState();
  assert.equal(state.activeNoteIndex, 1);

  aligner.processFrame({ frequency: g4, confidence: 0.9, timestamp: timeline.startTimestamp + 1500 });
  state = aligner.processFrame({ frequency: g4, confidence: 0.9, timestamp: timeline.startTimestamp + 1620 });
  assert.equal(state.activeNoteIndex, 2);

  const alignment = aligner.finish();
  assert.equal(alignment.windows[0].matched, true);
  assert.equal(alignment.windows[1].matched, true);
  assert.equal(alignment.windows[2].matched, true);
});

test('performance scoring does not punish a complete slow take as late', () => {
  const piece = getPieceById('scale_combo_b_major_g_minor');
  const timeline = createTimeline(piece, {
    createdAt: 1000,
    startNoteIndex: 0,
    endNoteIndex: 3,
  });
  const frames = [];
  const slowBeatMs = timeline.beatDurationMs * 2;

  timeline.windows.forEach((window, index) => {
    const timestamp = timeline.startTimestamp + index * slowBeatMs;
    frames.push({
      frequency: window.note.targetFrequency,
      confidence: 0.9,
      timestamp,
    });
    frames.push({
      frequency: window.note.targetFrequency,
      confidence: 0.9,
      timestamp: timestamp + 220,
    });
  });

  const performanceAlignment = buildPerformanceAlignment(frames, timeline);
  const result = evaluateScorePractice(frames, timeline, { performanceAlignment });

  assert.equal(result.summaryScores.completionRate, 1);
  assert.equal(result.noteResults.some((item) => item.issueTags.includes('late')), false);
  assert.ok(result.summaryScores.totalScore > 80);
});

test('performance scoring still flags pitch errors inside followed windows', () => {
  const piece = getPieceById('scale_combo_b_major_g_minor');
  const timeline = createTimeline(piece, {
    createdAt: 1000,
    startNoteIndex: 0,
    endNoteIndex: 0,
  });
  const window = timeline.windows[0];
  const sharpFreq = window.note.targetFrequency * Math.pow(2, 35 / 1200);
  const frames = [
    { frequency: sharpFreq, confidence: 0.9, timestamp: timeline.startTimestamp },
    { frequency: sharpFreq, confidence: 0.9, timestamp: timeline.startTimestamp + 220 },
  ];
  const performanceAlignment = buildPerformanceAlignment(frames, timeline, {
    pitchToleranceCent: 50,
  });
  const result = evaluateScorePractice(frames, timeline, { performanceAlignment });

  assert.equal(result.noteResults[0].matched, true);
  assert.equal(result.noteResults[0].issueTags.includes('pitch-high'), true);
});

test('pitch gate aligner waits on the current note until pitch is in range', () => {
  const piece = getPieceById('scale_combo_b_major_g_minor');
  const timeline = createTimeline(piece, {
    createdAt: 1000,
    startNoteIndex: 0,
    endNoteIndex: 2,
  });
  const aligner = createPitchGateAligner(timeline);
  const first = timeline.windows[0];
  const second = timeline.windows[1];
  const sharpOutsideTolerance = first.note.targetFrequency * Math.pow(2, 45 / 1200);

  let state = aligner.processFrame({
    frequency: sharpOutsideTolerance,
    confidence: 0.9,
    timestamp: timeline.startTimestamp,
  });
  assert.equal(state.activeNoteIndex, first.noteIndex);

  aligner.processFrame({
    frequency: first.note.targetFrequency,
    confidence: 0.9,
    timestamp: timeline.startTimestamp + 80,
  });
  state = aligner.processFrame({
    frequency: first.note.targetFrequency,
    confidence: 0.9,
    timestamp: timeline.startTimestamp + 240,
  });
  assert.equal(state.activeNoteIndex, second.noteIndex);
});

test('pitch gate aligner completes only after the final selected note is in tune', () => {
  const piece = getPieceById('twinkle_twinkle_mvp');
  const timeline = createTimeline(piece, {
    createdAt: 1000,
    startNoteIndex: 0,
    endNoteIndex: 1,
  });
  const aligner = createPitchGateAligner(timeline);
  const first = timeline.windows[0];
  const second = timeline.windows[1];

  aligner.processFrame({
    frequency: first.note.targetFrequency,
    confidence: 0.9,
    timestamp: timeline.startTimestamp,
  });
  let state = aligner.processFrame({
    frequency: first.note.targetFrequency,
    confidence: 0.9,
    timestamp: timeline.startTimestamp + 200,
  });
  assert.equal(state.activeNoteIndex, second.noteIndex);
  assert.equal(state.complete, false);

  aligner.processFrame({
    frequency: second.note.targetFrequency,
    confidence: 0.9,
    timestamp: timeline.startTimestamp + 320,
  });
  state = aligner.processFrame({
    frequency: second.note.targetFrequency,
    confidence: 0.9,
    timestamp: timeline.startTimestamp + 520,
  });
  assert.equal(state.activeNoteIndex, second.noteIndex);
  assert.equal(state.complete, true);

  const alignment = aligner.finish();
  assert.equal(alignment.mode, 'pitch-gate');
  assert.equal(alignment.matchedCount, 2);
  assert.equal(alignment.windows[0].matched, true);
  assert.equal(alignment.windows[1].matched, true);
});

test('pitch gate alignment can feed performance scoring', () => {
  const piece = getPieceById('twinkle_twinkle_mvp');
  const timeline = createTimeline(piece, {
    createdAt: 1000,
    startNoteIndex: 0,
    endNoteIndex: 1,
  });
  const frames = [
    { frequency: timeline.windows[0].note.targetFrequency, confidence: 0.9, timestamp: timeline.startTimestamp },
    { frequency: timeline.windows[0].note.targetFrequency, confidence: 0.9, timestamp: timeline.startTimestamp + 200 },
    { frequency: timeline.windows[1].note.targetFrequency, confidence: 0.9, timestamp: timeline.startTimestamp + 320 },
    { frequency: timeline.windows[1].note.targetFrequency, confidence: 0.9, timestamp: timeline.startTimestamp + 520 },
  ];
  const performanceAlignment = buildPitchGateAlignment(frames, timeline);
  const result = evaluateScorePractice(frames, timeline, { performanceAlignment });

  assert.equal(result.summaryScores.completionRate, 1);
  assert.equal(result.noteResults.length, 2);
  assert.equal(result.noteResults[0].matched, true);
  assert.equal(result.noteResults[1].matched, true);
});

test('score feedback aggregates repeated issues into advice text', () => {
  const { advice, feedbackTags } = buildAdvice([
    { issueTags: ['early'] },
    { issueTags: ['early'] },
    { issueTags: ['early'] },
    { issueTags: ['pitch-high'] },
  ]);

  assert.ok(advice.includes('节奏偏抢'));
  assert.equal(feedbackTags.includes('early'), true);
});

test('staff layout maps treble notes to y positions, ledger lines, and accidentals', () => {
  assert.equal(getStaffY({ pitch: 'C', octave: 4 }), 122);
  assert.deepEqual(getLedgerLines(122), [122]);
  assert.equal(getStaffY({ pitch: 'B', octave: 3 }), 131);
  assert.deepEqual(getLedgerLines(131), [122]);
  assert.equal(getStaffY({ pitch: 'G', octave: 5 }), 23);
  assert.deepEqual(getLedgerLines(23), []);
  assert.equal(getStaffY({ pitch: 'F#', octave: 5 }), 32);
  assert.deepEqual(parsePitch('F#'), { letter: 'F', accidental: '#' });
  assert.equal(getStaffY({ pitch: 'Bb', octave: 4 }), 68);
  assert.deepEqual(parsePitch('Bb'), { letter: 'B', accidental: 'b' });
  assert.equal(getStaffY({ pitch: 'Eb', octave: 5 }), 41);
  assert.deepEqual(parsePitch('Eb'), { letter: 'E', accidental: 'b' });
});

test('staff layout generates measure bars from note beats', () => {
  const piece = getPieceById('twinkle_twinkle_mvp');
  const score = buildStaffScore(piece);

  assert.deepEqual(
    score.measureBars.map((bar) => bar.beat),
    [4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48]
  );
  assert.deepEqual(
    score.measureBars.map((bar) => bar.x),
    [290, 506, 722, 938, 1154, 1370, 1586, 1802, 2018, 2234, 2450, 2666]
  );
  assert.equal(score.notes[0].active, false);
  assert.equal(buildStaffScore(piece, { activeNoteIndex: 2 }).notes[2].active, true);
});

test('staff layout wraps score into two-measure systems', () => {
  const piece = getPieceById('twinkle_twinkle_mvp');
  const score = buildStaffScore(piece, {
    layoutMode: 'systems',
    measuresPerLine: 2,
    activeNoteIndex: 8,
  });

  assert.equal(score.isSystems, true);
  assert.equal(score.systems.length, 6);
  assert.deepEqual(
    score.systems.map((system) => [system.beatStart, system.beatEnd]),
    [
      [0, 8],
      [8, 16],
      [16, 24],
      [24, 32],
      [32, 40],
      [40, 48],
    ]
  );
  assert.deepEqual(
    score.systems[0].measureBars.map((bar) => [bar.beat, bar.x]),
    [
      [4, 290],
      [8, 506],
    ]
  );
  assert.deepEqual(
    score.systems[1].measureBars.map((bar) => [bar.beat, bar.x]),
    [
      [12, 290],
      [16, 506],
    ]
  );
  assert.equal(score.systems[0].notes.length, 7);
  assert.equal(score.systems[1].notes.length, 7);
  assert.equal(score.systems[1].notes[0].label, 'F4');
  assert.equal(score.systems[1].notes[0].x, 74);
  assert.equal(score.systems[1].notes[0].active, false);
  assert.equal(score.systems[1].notes[1].label, 'F4');
  assert.equal(score.systems[1].notes[1].active, true);
});

test('staff layout can wrap score into fixed eight-beat systems', () => {
  const piece = getPieceById('twinkle_twinkle_mvp');
  const score = buildStaffScore(piece, {
    layoutMode: 'systems',
    beatsPerLine: 8,
    beatWidth: 76,
    activeNoteIndex: 8,
  });

  assert.equal(score.systems.length, 6);
  assert.deepEqual(
    score.systems.map((system) => [system.beatStart, system.beatEnd]),
    [
      [0, 8],
      [8, 16],
      [16, 24],
      [24, 32],
      [32, 40],
      [40, 48],
    ]
  );
  assert.equal(score.systems[0].notes.length, 7);
  assert.equal(score.systems[1].notes.length, 7);
  assert.equal(score.systems[1].notes[0].label, 'F4');
  assert.equal(score.systems[1].notes[0].active, false);
  assert.equal(score.systems[1].notes[1].label, 'F4');
  assert.equal(score.systems[1].notes[1].active, true);
});

test('staff layout prefers display labels for enharmonic spellings', () => {
  const score = buildStaffScore(getPieceById('scale_combo_b_major_g_minor'));

  assert.equal(score.notes[24].label, 'Bb3');
  assert.equal(score.notes[24].accidental, 'b');
  assert.equal(score.notes[24].y, 131);
  assert.equal(score.notes[27].label, 'Eb4');
  assert.equal(score.notes[27].accidental, 'b');
  assert.equal(score.notes[27].y, 104);
});

test('twinkle piece is available and works with the score practice timeline', () => {
  const pieces = listPieces();
  const piece = getPieceById('twinkle_twinkle_mvp');

  assert.equal(pieces.length, 4);
  assert.ok(piece);
  assert.equal(piece.keySignature, 'C 大调');
  assert.equal(piece.clef, 'treble');
  assert.equal(piece.notes.length, 42);
  assert.deepEqual(
    piece.notes.map((note) => note.label),
    [
      'C4', 'C4', 'G4', 'G4', 'A4', 'A4', 'G4',
      'F4', 'F4', 'E4', 'E4', 'D4', 'D4', 'C4',
      'G4', 'G4', 'F4', 'F4', 'E4', 'E4', 'D4',
      'G4', 'G4', 'F4', 'F4', 'E4', 'E4', 'D4',
      'C4', 'C4', 'G4', 'G4', 'A4', 'A4', 'G4',
      'F4', 'F4', 'E4', 'E4', 'D4', 'D4', 'C4',
    ]
  );

  const timeline = createTimeline(piece, { createdAt: 1000 });
  const musicalDurationSec = Math.round(
    timeline.windows[timeline.windows.length - 1].expectedEndMs / 1000
  );
  assert.equal(piece.estimatedDurationSec, musicalDurationSec);

  const result = evaluateScorePractice(
    [
      { frequency: 261.63, confidence: 0.9, timestamp: timeline.startTimestamp + 20 },
      { frequency: 261.63, confidence: 0.9, timestamp: timeline.startTimestamp + timeline.beatDurationMs + 20 },
      { frequency: 392, confidence: 0.9, timestamp: timeline.startTimestamp + timeline.beatDurationMs * 2 + 20 },
    ],
    timeline
  );
  assert.equal(result.noteResults[0].matched, true);
  assert.equal(result.noteResults[3].matched, false);
});

// --- New tests for review improvements ---

test('YIN DC removal rejects constant DC offset', () => {
  const dcBuffer = new Float32Array(4096);
  for (let i = 0; i < dcBuffer.length; i += 1) {
    dcBuffer[i] = 0.5;
  }
  const result = detectPitchYin(dcBuffer, 44100);
  assert.equal(result.frequency, null, 'pure DC should not produce a pitch');
});

test('YIN detects low G3 even when flat by 30 cents', () => {
  const g3Flat = 196 * Math.pow(2, -30 / 1200);
  const result = detectPitchYin(sineWave(g3Flat), 44100);
  assert.ok(result.frequency, 'should detect flat G3');
  assert.ok(Math.abs(result.frequency - g3Flat) < 2, `flat G3 frequency drift: got ${result.frequency}, expected ~${g3Flat.toFixed(1)}`);
});

test('YIN with minFrequency=160 still detects G3', () => {
  const result = detectPitchYin(sineWave(196), 44100, 0.16);
  assert.ok(result.frequency, 'should detect G3 with lowered minFrequency');
  assert.ok(Math.abs(result.frequency - 196) < 1.5);
});

test('ring buffer appends and retrieves recent samples', () => {
  const ring = createRingBuffer(10);
  ring.append(new Float32Array([1, 2, 3]));
  ring.append(new Float32Array([4, 5, 6]));
  assert.equal(ring.length(), 6);
  const recent = ring.getRecent(5);
  assert.deepEqual(Array.from(recent), [2, 3, 4, 5, 6]);

  ring.append(new Float32Array([7, 8]));
  assert.equal(ring.length(), 8);
  const full = ring.getRecent(8);
  assert.deepEqual(Array.from(full), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('ring buffer wraps around correctly', () => {
  const ring = createRingBuffer(5);
  ring.append(new Float32Array([1, 2, 3, 4, 5]));
  ring.append(new Float32Array([6, 7]));
  assert.equal(ring.length(), 5);
  const recent = ring.getRecent(5);
  assert.deepEqual(Array.from(recent), [3, 4, 5, 6, 7]);
});

test('ring buffer clear resets state', () => {
  const ring = createRingBuffer(10);
  ring.append(new Float32Array([1, 2, 3]));
  ring.clear();
  assert.equal(ring.length(), 0);
  const recent = ring.getRecent(5);
  assert.equal(recent.length, 0);
});

test('timeline uses Map for O(1) getWindowForNote', () => {
  const piece = getPieceById('twinkle_twinkle_mvp');
  const timeline = createTimeline(piece, { createdAt: 1000 });
  const w = timeline.getWindowForNote(5);
  assert.ok(w, 'should find window by noteIndex');
  assert.equal(w.noteIndex, 5);
  assert.equal(timeline.getWindowForNote(9999), null);
});

test('getActiveNoteIndex uses binary search with boundary grace', () => {
  const piece = getPieceById('twinkle_twinkle_mvp');
  const timeline = createTimeline(piece, { createdAt: 1000 });
  const grace = timeline.boundaryGraceMs || 0;
  assert.ok(grace > 0, 'boundary grace should be positive');
  // At the exact expectedEndMs of window 0, grace should still return window 0
  const boundaryTime = timeline.startTimestamp + timeline.windows[0].expectedEndMs;
  const indexAtBoundary = getActiveNoteIndex(timeline, boundaryTime);
  assert.equal(indexAtBoundary, timeline.windows[0].noteIndex);
});

test('timingOffsetMs is compensated for system delay', () => {
  const piece = getPieceById('scale_combo_b_major_g_minor');
  const timeline = createTimeline(piece, { createdAt: 1000 });
  const w0 = timeline.windows[0];
  // Frame at expectedStart + 50ms should NOT be flagged late after compensation
  const frameTime = timeline.startTimestamp + w0.expectedStartMs + 50;
  const result = evaluateScorePractice(
    [{ frequency: w0.note.targetFrequency, confidence: 0.9, timestamp: frameTime }],
    timeline
  );
  assert.equal(result.noteResults[0].issueTags.includes('late'), false,
    'frame 50ms after expected start should not be late with delay compensation');
});

test('pitchToleranceCent is 30 by default (tighter than before)', () => {
  const piece = getPieceById('scale_combo_b_major_g_minor');
  const timeline = createTimeline(piece, { createdAt: 1000 });
  const w0 = timeline.windows[0];
  // Create a frame that's 35 cents sharp (above 30-cent threshold)
  const sharpFreq = w0.note.targetFrequency * Math.pow(2, 35 / 1200);
  const frameTime = timeline.startTimestamp + w0.expectedStartMs + 20;
  const result = evaluateScorePractice(
    [{ frequency: sharpFreq, confidence: 0.9, timestamp: frameTime }],
    timeline
  );
  assert.equal(result.noteResults[0].issueTags.includes('pitch-high'), true,
    '35-cent offset should trigger pitch-high with 30-cent threshold');
});

test('completionRate does not double-penalize missed notes', () => {
  const piece = getPieceById('twinkle_twinkle_mvp');
  const timeline = createTimeline(piece, { createdAt: 1000, startNoteIndex: 0, endNoteIndex: 4 });
  // Provide only 1 frame for the first note, rest are missed
  const w0 = timeline.windows[0];
  const result = evaluateScorePractice(
    [{ frequency: w0.note.targetFrequency, confidence: 0.9, timestamp: timeline.startTimestamp + 20 }],
    timeline
  );
  const s = result.summaryScores;
  // pitchScore should only average matched notes, not be dragged down by missed=0
  assert.ok(s.pitchScore > 0, 'pitchScore should be > 0 for the matched note');
  assert.ok(s.completionRate < 1, 'completionRate should reflect 1/5 matched');
  // The effective penalty should be ~completionRate, not ~completionRate^2
  const expectedApproxTotal = Math.round((s.pitchScore * 0.6 + s.rhythmScore * 0.4) * s.completionRate);
  assert.equal(s.totalScore, expectedApproxTotal);
});

test('holdRatio compensation scales with note duration', () => {
  const piece = getPieceById('scale_combo_b_major_g_minor');
  const timeline = createTimeline(piece, { createdAt: 1000 });
  const w0 = timeline.windows[0];
  // Create a very short capture (just 1 frame at start)
  const result = evaluateScorePractice(
    [{ frequency: w0.note.targetFrequency, confidence: 0.9, timestamp: timeline.startTimestamp + 20 }],
    timeline
  );
  // The holdRatio should reflect the scaled compensation, not a fixed 120ms
  assert.ok(result.noteResults[0].holdRatio < 1);
  assert.ok(result.noteResults[0].holdRatio > 0);
});

test('feedback advice includes severity modifiers', () => {
  const { advice } = buildAdvice([
    { issueTags: ['early'] },
    { issueTags: ['early'] },
    { issueTags: ['early'] },
    { issueTags: ['early'] },
    { issueTags: ['early'] },
  ]);
  assert.ok(advice.includes('略有'), '5-note run should use "略有" severity');
});

test('feedback advice uses "明显" for medium severity', () => {
  const notes = [];
  for (let i = 0; i < 10; i += 1) {
    notes.push({ issueTags: ['pitch-high'] });
  }
  for (let i = 0; i < 5; i += 1) {
    notes.push({ issueTags: [] });
  }
  const { advice } = buildAdvice(notes);
  assert.ok(advice.includes('明显'), '10-note run should use "明显" severity');
});

test('feedback advice uses "严重" for high severity', () => {
  const notes = [];
  for (let i = 0; i < 20; i += 1) {
    notes.push({ issueTags: ['pitch-low'] });
  }
  const { advice } = buildAdvice(notes);
  assert.ok(advice.includes('严重'), '20-note run should use "严重" severity');
});
