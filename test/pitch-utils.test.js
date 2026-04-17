const test = require('node:test');
const assert = require('node:assert/strict');

const { detectPitchYin } = require('../miniprogram/utils/pitch-yin');
const { frequencyToNote, frequencyToTargetCentOffset } = require('../miniprogram/utils/note');
const { calculatePracticeScore } = require('../miniprogram/utils/score');
const { concatArrayBuffers, createWavFileBuffer } = require('../miniprogram/utils/audio-frame');
const { getTuningStatus } = require('../miniprogram/utils/tuning-status');

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
