const generatedAssets = require('./generated-score-assets');
const { getPieceById } = require('./piece-library');

const TREBLE_MIDDLE_LINE_MIDI = 71;

function getActiveNoteShape(pieceId, noteIndex) {
  const piece = getPieceById(pieceId);
  const note = piece && Array.isArray(piece.notes) ? piece.notes[noteIndex] : null;
  if (!note) {
    return {
      stemDirection: 'up',
      long: false,
    };
  }

  return {
    stemDirection: Number(note.midi) >= TREBLE_MIDDLE_LINE_MIDI ? 'down' : 'up',
    long: Number(note.durationBeat || 0) > 1,
  };
}

function getPieceScoreAssets(pieceId) {
  if (!pieceId || !generatedAssets || !generatedAssets[pieceId]) {
    return null;
  }

  const assets = generatedAssets[pieceId];
  if (!assets || !Array.isArray(assets.systems) || assets.systems.length === 0) {
    return null;
  }

  return assets;
}

function getStaticScoreSystems(pieceId) {
  const assets = getPieceScoreAssets(pieceId);
  if (!assets) {
    return [];
  }

  return assets.systems.map((system) =>
    Object.assign({}, system, {
      anchorId: `score-system-${system.index}`,
    })
  );
}

function getScoreAssetCursor(pieceId, activeNoteIndex) {
  const assets = getPieceScoreAssets(pieceId);
  if (!assets) {
    return {
      hasFormalScore: false,
      currentSystem: null,
      previousSystemPreview: null,
      nextSystemPreview: null,
      activeNoteBox: null,
      activeSystemAnchor: '',
      activeSystemIndex: 0,
    };
  }

  const safeIndex = Math.max(0, Number(activeNoteIndex || 0));
  let currentSystem = assets.systems.find((system) => {
    const start = Number(system.noteStartIndex);
    const end = Number(system.noteEndIndex);
    return safeIndex >= start && safeIndex <= end;
  });

  if (!currentSystem) {
    currentSystem = safeIndex < Number(assets.systems[0].noteStartIndex)
      ? assets.systems[0]
      : assets.systems[assets.systems.length - 1];
  }

  const systemIndex = Number(currentSystem.index || 0);
  const activeNoteBox = Array.isArray(currentSystem.noteBoxes)
    ? currentSystem.noteBoxes.find((box) => Number(box.noteIndex) === safeIndex) || null
    : null;
  const activeNoteShape = activeNoteBox ? getActiveNoteShape(pieceId, safeIndex) : null;

  return {
    hasFormalScore: true,
    currentSystem,
    previousSystemPreview: assets.systems[systemIndex - 1] || null,
    nextSystemPreview: assets.systems[systemIndex + 1] || null,
    activeNoteBox: activeNoteBox
      ? Object.assign({}, activeNoteBox, activeNoteShape)
      : null,
    activeSystemAnchor: `score-system-${systemIndex}`,
    activeSystemIndex: systemIndex,
  };
}

function getCurrentSystemState(pieceId, activeNoteIndex) {
  const cursor = getScoreAssetCursor(pieceId, activeNoteIndex);
  if (!cursor.hasFormalScore) {
    return {
      hasFormalScore: false,
      systems: [],
      currentSystem: null,
      previousSystemPreview: null,
      nextSystemPreview: null,
      activeNoteBox: null,
      activeSystemAnchor: '',
    };
  }

  const systems = getStaticScoreSystems(pieceId).map((system) => {
    const isActive = Number(system.index) === cursor.activeSystemIndex;
    return Object.assign({}, system, {
      isActive,
      activeNoteBox: isActive ? cursor.activeNoteBox : null,
    });
  });

  return {
    hasFormalScore: true,
    systems,
    currentSystem: cursor.currentSystem,
    previousSystemPreview: cursor.previousSystemPreview,
    nextSystemPreview: cursor.nextSystemPreview,
    activeNoteBox: cursor.activeNoteBox,
    activeSystemAnchor: cursor.activeSystemAnchor,
  };
}

module.exports = {
  getPieceScoreAssets,
  getStaticScoreSystems,
  getScoreAssetCursor,
  getCurrentSystemState,
};
