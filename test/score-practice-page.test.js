const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { getPieceById } = require('../miniprogram/utils/score-practice/piece-library');
const {
  createTimeline,
  getActiveNoteIndex,
} = require('../miniprogram/utils/score-practice/metronome-timeline');

const projectRoot = path.resolve(__dirname, '..');

function readProjectFile(filePath) {
  return fs.readFileSync(path.join(projectRoot, filePath), 'utf8');
}

test('score practice page does not play metronome click audio', () => {
  const source = readProjectFile('miniprogram/pages/score-practice/score-practice.js');
  const forbidden = [
    'wx.createInnerAudioContext',
    'click-high.wav',
    'click-low.wav',
    'playClick(',
  ];

  forbidden.forEach((pattern) => {
    assert.equal(source.includes(pattern), false, `${pattern} should not appear in score-practice.js`);
  });
});

test('score practice formal score uses a red playhead marker', () => {
  const markup = readProjectFile('miniprogram/pages/score-practice/score-practice.wxml');
  const styles = readProjectFile('miniprogram/pages/score-practice/score-practice.wxss');

  assert.equal(markup.includes('scroll-top="{{activeScoreScrollTop}}"'), true);
  assert.equal(markup.includes('scroll-into-view'), false);
  assert.equal(markup.includes('active-note-playhead'), true);
  assert.equal(markup.includes('active-note-head'), false);
  assert.equal(markup.includes('active-note-stem'), false);
  assert.equal(styles.includes('#D8261C'), true);
  assert.match(styles, /\.active-note-playhead\s*\{/);
});

test('score practice fixed mode polls active note faster than beat interval', () => {
  const source = readProjectFile('miniprogram/pages/score-practice/score-practice.js');

  assert.equal(source.includes('const timelinePollMs = Math.min(UI_INTERVAL_MS, beatMs);'), true);
  assert.equal(source.includes('getActiveNoteIndex(this.timeline, now)'), true);
  assert.match(source, /setInterval\([\s\S]*timelinePollMs\);/);
});

test('score practice running highlight does not rewrite score image state inside one system', () => {
  const source = readProjectFile('miniprogram/pages/score-practice/score-practice.js');
  const startBeatTimerBlock = source.slice(
    source.indexOf('  startBeatTimer()'),
    source.indexOf('  handleFrame(frameBuffer)')
  );
  const advanceActiveNoteBlock = source.slice(
    source.indexOf('  advanceActiveNote(noteIndex)'),
    source.indexOf('  updateDetectedUi(pitch)')
  );

  assert.match(source, /function buildScoreAssetUpdate[\s\S]*if \(systemChanged\)/);
  assert.equal(startBeatTimerBlock.includes('currentSystem:'), false);
  assert.equal(startBeatTimerBlock.includes('activeSystemAnchor:'), false);
  assert.equal(advanceActiveNoteBlock.includes('currentSystem:'), false);
  assert.equal(advanceActiveNoteBlock.includes('activeSystemAnchor:'), false);
  assert.match(startBeatTimerBlock, /this\.buildActiveScoreAssetUpdate\(activeIndex\)/);
  assert.match(advanceActiveNoteBlock, /this\.buildActiveScoreAssetUpdate\(noteIndex\)/);
});

test('score practice scroll keeps active note near midpoint until score bottom', () => {
  const source = readProjectFile('miniprogram/pages/score-practice/score-practice.js');

  assert.match(source, /function getMidlineClampedScrollTop[\s\S]*viewportHeightPx \/ 2/);
  assert.match(source, /noteCenterPercent[\s\S]*activeNoteBox\.yPercent[\s\S]*activeNoteBox\.heightPercent/);
  assert.match(source, /Math\.min\(metrics\.maxScrollTopPx, desiredScrollTopPx\)/);
  assert.match(source, /activeScoreScrollTop: 0/);
  assert.match(source, /getScrollTopForActiveNote/);
});

test('score practice timeline can activate notes inside one beat', () => {
  const piece = getPieceById('haydn_serenade_grade4');
  const timeline = createTimeline(piece, {
    createdAt: 1000,
    startNoteIndex: 0,
    endNoteIndex: 3,
  });
  const firstWindow = timeline.windows[0];
  const secondWindow = timeline.windows[1];

  assert.ok(firstWindow.expectedEndMs < timeline.beatDurationMs);
  assert.equal(getActiveNoteIndex(timeline, timeline.startTimestamp + 20), firstWindow.noteIndex);
  assert.equal(
    getActiveNoteIndex(timeline, timeline.startTimestamp + firstWindow.expectedEndMs + timeline.boundaryGraceMs + 1),
    secondWindow.noteIndex
  );
});
