const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  getCurrentSystemState,
  getPieceScoreAssets,
} = require('../miniprogram/utils/score-practice/score-assets');

const cloudManifestPath = path.join(__dirname, '../generated/score-assets/cloud-manifest.json');
const projectConfigPath = path.join(__dirname, '../project.config.json');
const privateProjectConfigPath = path.join(__dirname, '../project.private.config.json');

function assertScoreImageSrc(imageSrc, expectedSuffix) {
  assert.equal(imageSrc.endsWith(expectedSuffix), true);
  if (fs.existsSync(cloudManifestPath)) {
    assert.equal(imageSrc.startsWith('cloud://'), true);
  } else {
    assert.equal(imageSrc.startsWith('/images/scores/'), true);
  }
}

test('generated score assets are available for all bundled pieces', () => {
  const twinkle = getPieceScoreAssets('twinkle_twinkle_mvp');
  const scale = getPieceScoreAssets('scale_combo_b_major_g_minor');
  const vivaldi = getPieceScoreAssets('vivaldi_rv356_excerpt');

  assert.equal(twinkle.systems.length, 6);
  assert.equal(scale.systems.length, 9);
  assert.equal(vivaldi.systems.length, 80);
  assertScoreImageSrc(twinkle.systems[0].imageSrc, '/twinkle_twinkle_mvp/system-000.png');
  assertScoreImageSrc(vivaldi.systems[0].imageSrc, '/vivaldi_rv356_excerpt/system-000-pickup-v2.png');
  assertScoreImageSrc(vivaldi.systems[1].imageSrc, '/vivaldi_rv356_excerpt/system-001-pickup-v2.png');
  assert.equal(vivaldi.systems[0].height, 410);
  assert.equal(vivaldi.systems[1].height, 350);
  assert.deepEqual(
    {
      beatStart: vivaldi.systems[0].beatStart,
      beatEnd: vivaldi.systems[0].beatEnd,
      noteStartIndex: vivaldi.systems[0].noteStartIndex,
      noteEndIndex: vivaldi.systems[0].noteEndIndex,
    },
    {
      beatStart: 0,
      beatEnd: 4.5,
      noteStartIndex: 0,
      noteEndIndex: 10,
    }
  );
  assert.deepEqual(
    {
      beatStart: vivaldi.systems[1].beatStart,
      beatEnd: vivaldi.systems[1].beatEnd,
      noteStartIndex: vivaldi.systems[1].noteStartIndex,
      noteEndIndex: vivaldi.systems[1].noteEndIndex,
    },
    {
      beatStart: 4.5,
      beatEnd: 8.5,
      noteStartIndex: 11,
      noteEndIndex: 21,
    }
  );
  assert.equal(vivaldi.systems[0].noteBoxes[0].noteIndex, 0);
  assert.equal(vivaldi.systems[0].noteBoxes[1].noteIndex, 1);
  assert.ok(vivaldi.systems[0].noteBoxes[1].x > vivaldi.systems[0].noteBoxes[0].x + 100);
  assert.ok(vivaldi.systems[1].noteBoxes[0].x < 100);
});

test('local score images are included in real-device preview packages', () => {
  const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, 'utf-8'));
  const ignoredValues = (projectConfig.packOptions && projectConfig.packOptions.ignore || [])
    .map((item) => item && item.value)
    .filter(Boolean);

  assert.equal(
    ignoredValues.some((value) => value === 'images/scores/**' || value.startsWith('images/scores')),
    false
  );

  if (fs.existsSync(privateProjectConfigPath)) {
    const privateProjectConfig = JSON.parse(fs.readFileSync(privateProjectConfigPath, 'utf-8'));
    assert.notEqual(privateProjectConfig.setting && privateProjectConfig.setting.ignoreDevUnusedFiles, true);
  }
});

test('score asset lookup returns the active system and note box', () => {
  const first = getCurrentSystemState('twinkle_twinkle_mvp', 0);
  assert.equal(first.hasFormalScore, true);
  assert.equal(first.systems.length, 6);
  assert.equal(first.currentSystem.index, 0);
  assert.equal(first.activeNoteBox.noteIndex, 0);
  assert.equal(first.activeNoteBox.stemDirection, 'up');
  assert.equal(first.activeNoteBox.long, false);
  assert.equal(first.systems[0].activeNoteBox.noteIndex, 0);
  assert.equal(first.systems[1].activeNoteBox, null);
  assert.equal(first.activeSystemAnchor, 'score-system-0');
  assert.equal(first.previousSystemPreview, null);
  assert.equal(first.nextSystemPreview.index, 1);

  const highLong = getCurrentSystemState('scale_combo_b_major_g_minor', 7);
  assert.equal(highLong.activeNoteBox.noteIndex, 7);
  assert.equal(highLong.activeNoteBox.stemDirection, 'down');
  assert.equal(highLong.activeNoteBox.long, true);

  const boundary = getCurrentSystemState('twinkle_twinkle_mvp', 7);
  assert.equal(boundary.currentSystem.index, 1);
  assert.equal(boundary.activeNoteBox.noteIndex, 7);
  assert.equal(boundary.systems[1].isActive, true);
  assert.equal(boundary.systems[1].activeNoteBox.noteIndex, 7);
  assert.equal(boundary.activeSystemAnchor, 'score-system-1');
  assert.equal(boundary.previousSystemPreview.index, 0);

  const last = getCurrentSystemState('twinkle_twinkle_mvp', 41);
  assert.equal(last.currentSystem.index, 5);
  assert.equal(last.activeNoteBox.noteIndex, 41);
  assert.equal(last.nextSystemPreview, null);
});

test('score asset lookup falls back when metadata is missing', () => {
  const missing = getCurrentSystemState('unknown_piece', 0);

  assert.equal(missing.hasFormalScore, false);
  assert.equal(missing.currentSystem, null);
  assert.equal(missing.activeNoteBox, null);
});
