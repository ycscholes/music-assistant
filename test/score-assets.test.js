const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  getCurrentSystemState,
  getPieceScoreAssets,
} = require('../miniprogram/utils/score-practice/score-assets');
const { getPieceById } = require('../miniprogram/utils/score-practice/piece-library');
const {
  createVivaldiEngravingForSystem,
  getVivaldiSystemEngraving,
} = require('../scripts/generate-score-assets');
const {
  buildRv356PdfReferenceCrops,
  getRv356PdfReferenceCrop,
} = require('../scripts/rv356-visual-baseline');

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
  const haydn = getPieceScoreAssets('haydn_serenade_grade4');

  assert.equal(twinkle.renderMode, 'source-image');
  assert.equal(twinkle.systems.length, 1);
  assert.equal(scale.systems.length, 9);
  assert.equal(vivaldi.systems.length, 80);
  assert.equal(haydn.systems.length, 17);
  assertScoreImageSrc(twinkle.systems[0].imageSrc, '/twinkle_twinkle_mvp/source-system-000.png');
  assert.equal(twinkle.systems[0].sourcePath, 'docs/sources/sheet-music/twinkle-twinkle-public-domain.png');
  assert.equal(twinkle.systems[0].renderMode, 'source-image');
  assert.equal(twinkle.systems[0].width, 1824);
  assert.equal(twinkle.systems[0].height, 782);
  assert.equal(twinkle.systems[0].noteStartIndex, 0);
  assert.equal(twinkle.systems[0].noteEndIndex, 41);
  assert.equal(twinkle.systems[0].noteBoxes[0].noteIndex, 0);
  assert.equal(twinkle.systems[0].noteBoxes[41].noteIndex, 41);
  assertScoreImageSrc(vivaldi.systems[0].imageSrc, '/vivaldi_rv356_excerpt/system-000.png');
  assertScoreImageSrc(vivaldi.systems[1].imageSrc, '/vivaldi_rv356_excerpt/system-001.png');
  assert.equal(vivaldi.systems.some((system) => system.imageSrc.includes('source-system-')), false);
  assert.equal(vivaldi.systems[0].height, 380);
  assert.equal(vivaldi.systems[1].height, 300);
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
  assert.ok(vivaldi.systems[0].noteBoxes[1].x > vivaldi.systems[0].noteBoxes[0].x + 70);
  assert.ok(vivaldi.systems[1].noteBoxes[0].x > 100);
  assert.equal(vivaldi.systems[79].beatStart, 316.5);
  assert.equal(vivaldi.systems[79].beatEnd, 320.5);
  assert.equal(vivaldi.systems[79].noteStartIndex, 894);
  assert.equal(vivaldi.systems[79].noteEndIndex, 894);
  assertScoreImageSrc(haydn.systems[0].imageSrc, '/haydn_serenade_grade4/system-000.png');
  assertScoreImageSrc(haydn.systems[16].imageSrc, '/haydn_serenade_grade4/system-016.png');
  assert.deepEqual(
    {
      beatStart: haydn.systems[0].beatStart,
      beatEnd: haydn.systems[0].beatEnd,
      noteStartIndex: haydn.systems[0].noteStartIndex,
      noteEndIndex: haydn.systems[0].noteEndIndex,
    },
    {
      beatStart: 0,
      beatEnd: 8,
      noteStartIndex: 0,
      noteEndIndex: 9,
    }
  );
  assert.deepEqual(
    {
      beatStart: haydn.systems[16].beatStart,
      beatEnd: haydn.systems[16].beatEnd,
      noteStartIndex: haydn.systems[16].noteStartIndex,
      noteEndIndex: haydn.systems[16].noteEndIndex,
    },
    {
      beatStart: 128,
      beatEnd: 131,
      noteStartIndex: 188,
      noteEndIndex: 191,
    }
  );
});

test('vivaldi generated engraving carries PDF beam groups and performance marks', () => {
  const piece = getPieceById('vivaldi_rv356_excerpt');
  const measureOne = createVivaldiEngravingForSystem(piece, 0, 0.5, 4.5);
  const measureEighteen = createVivaldiEngravingForSystem(piece, 17, 68.5, 72.5);
  const measureTwentyFour = createVivaldiEngravingForSystem(piece, 23, 92.5, 96.5);
  const measureTwentyFive = createVivaldiEngravingForSystem(piece, 24, 96.5, 100.5);
  const measureThirtyOne = createVivaldiEngravingForSystem(piece, 30, 120.5, 124.5);
  const measureSixtyThree = createVivaldiEngravingForSystem(piece, 62, 248.5, 252.5);
  const measureSixtyFour = createVivaldiEngravingForSystem(piece, 63, 252.5, 256.5);

  assert.ok(getVivaldiSystemEngraving(23).marks.some((mark) => mark.text === 'Solo'));
  assert.ok(measureOne.beamGroups.some((group) => group.includes(6) && group.includes(7)));
  assert.ok(measureOne.repetitionStrokes.some((stroke) => stroke.noteIndex === 1));
  assert.ok(measureTwentyFour.beamGroups.some((group) => group.length === 4 && group[0] === 218));
  assert.ok(measureTwentyFour.marks.some((mark) => mark.type === 'text' && mark.text === 'Solo'));
  assert.ok(measureTwentyFour.marks.some((mark) => mark.type === 'dynamic' && mark.text === 'f'));
  assert.ok(measureTwentyFour.slurs.some((slur) => slur.fromNoteIndex === 219 && slur.toNoteIndex === 221));
  assert.ok(measureTwentyFive.marks.some((mark) => mark.type === 'text' && mark.text === '0'));
  assert.ok(measureTwentyFive.slurs.some((slur) => slur.fromNoteIndex === 235 && slur.toNoteIndex === 237));
  assert.ok(measureThirtyOne.marks.some((mark) => mark.type === 'text' && mark.text === '0'));
  assert.ok(measureThirtyOne.marks.some((mark) => mark.type === 'hairpin'));
  assert.ok(measureEighteen.marks.some((mark) => mark.type === 'text' && mark.text === 'V'));
  assert.ok(measureSixtyThree.marks.some((mark) => mark.type === 'dynamic' && mark.text === 'p'));
  assert.ok(measureSixtyThree.slurs.some((slur) => slur.fromNoteIndex === 670 && slur.toNoteIndex === 672));
  assert.ok(measureSixtyFour.marks.some((mark) => mark.type === 'dynamic' && mark.text === 'pp'));
});

test('vivaldi visual PDF reference crops cover all generated systems', () => {
  const crops = buildRv356PdfReferenceCrops();
  assert.equal(crops.length, 80);
  assert.deepEqual(crops.map((crop) => crop.systemIndex), Array.from({ length: 80 }, (_, index) => index));
  assert.equal(getRv356PdfReferenceCrop(0).pageIndex, 0);
  assert.equal(getRv356PdfReferenceCrop(30).pageIndex, 1);
  assert.equal(getRv356PdfReferenceCrop(62).pageIndex, 2);
  assert.equal(getRv356PdfReferenceCrop(79).measureNumber, 80);
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
  assert.equal(first.systems.length, 1);
  assert.equal(first.currentSystem.index, 0);
  assert.equal(first.activeNoteBox.noteIndex, 0);
  assert.equal(first.activeNoteBox.stemDirection, 'up');
  assert.equal(first.activeNoteBox.long, false);
  assert.equal(first.systems[0].activeNoteBox.noteIndex, 0);
  assert.equal(first.activeSystemAnchor, 'score-system-0');
  assert.equal(first.previousSystemPreview, null);
  assert.equal(first.nextSystemPreview, null);

  const highLong = getCurrentSystemState('scale_combo_b_major_g_minor', 7);
  assert.equal(highLong.activeNoteBox.noteIndex, 7);
  assert.equal(highLong.activeNoteBox.stemDirection, 'down');
  assert.equal(highLong.activeNoteBox.long, true);

  const boundary = getCurrentSystemState('twinkle_twinkle_mvp', 7);
  assert.equal(boundary.currentSystem.index, 0);
  assert.equal(boundary.activeNoteBox.noteIndex, 7);
  assert.equal(boundary.systems[0].isActive, true);
  assert.equal(boundary.systems[0].activeNoteBox.noteIndex, 7);
  assert.equal(boundary.activeSystemAnchor, 'score-system-0');
  assert.equal(boundary.previousSystemPreview, null);

  const last = getCurrentSystemState('twinkle_twinkle_mvp', 41);
  assert.equal(last.currentSystem.index, 0);
  assert.equal(last.activeNoteBox.noteIndex, 41);
  assert.equal(last.nextSystemPreview, null);

  const vivaldiStart = getCurrentSystemState('vivaldi_rv356_excerpt', 0);
  assert.equal(vivaldiStart.currentSystem.index, 0);
  assert.equal(vivaldiStart.activeNoteBox.noteIndex, 0);

  const vivaldiMeasureOne = getCurrentSystemState('vivaldi_rv356_excerpt', 1);
  assert.equal(vivaldiMeasureOne.currentSystem.index, 0);
  assert.equal(vivaldiMeasureOne.activeNoteBox.noteIndex, 1);

  const vivaldiPageTwo = getCurrentSystemState('vivaldi_rv356_excerpt', 320);
  assert.equal(vivaldiPageTwo.currentSystem.index, 30);
  assert.equal(vivaldiPageTwo.activeNoteBox.noteIndex, 320);

  const vivaldiPageThree = getCurrentSystemState('vivaldi_rv356_excerpt', 669);
  assert.equal(vivaldiPageThree.currentSystem.index, 62);
  assert.equal(vivaldiPageThree.activeNoteBox.noteIndex, 669);

  const vivaldiEnd = getCurrentSystemState('vivaldi_rv356_excerpt', 894);
  assert.equal(vivaldiEnd.currentSystem.index, 79);
  assert.equal(vivaldiEnd.activeNoteBox.noteIndex, 894);
  assert.equal(vivaldiEnd.nextSystemPreview, null);
});

test('score asset lookup falls back when metadata is missing', () => {
  const missing = getCurrentSystemState('unknown_piece', 0);

  assert.equal(missing.hasFormalScore, false);
  assert.equal(missing.currentSystem, null);
  assert.equal(missing.activeNoteBox, null);
});
