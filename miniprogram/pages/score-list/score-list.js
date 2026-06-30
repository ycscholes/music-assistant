const { listPieces } = require('../../utils/score-practice/piece-library');

Page({
  data: {
    pieces: [],
  },

  onLoad() {
    const pieces = listPieces().map((piece) => ({
      id: piece.id,
      title: piece.title,
      difficulty: piece.difficulty,
      keySignature: piece.keySignature,
      timeSignature: piece.timeSignature,
      bpm: piece.bpm,
      estimatedDurationSec: piece.estimatedDurationSec,
      noteCount: piece.notes ? piece.notes.length : 0,
      focusText: (piece.focusTips || []).join(' · '),
    }));
    this.setData({ pieces });
  },

  openPiece(event) {
    const { id } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/score-practice/score-practice?pieceId=${id}`,
    });
  },
});
