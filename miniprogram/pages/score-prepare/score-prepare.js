const { getPieceById } = require('../../utils/score-practice/piece-library');

Page({
  data: {
    piece: null,
    empty: false,
  },

  onLoad(options) {
    const piece = getPieceById(options.pieceId);
    if (!piece) {
      this.setData({ empty: true });
      return;
    }
    this.setData({
      piece: {
        id: piece.id,
        title: piece.title,
        difficulty: piece.difficulty,
        bpm: piece.bpm,
        timeSignature: piece.timeSignature,
        keySignature: piece.keySignature,
        clef: piece.clef,
        staffDisplayRange: piece.staffDisplayRange,
        estimatedDurationSec: piece.estimatedDurationSec,
        focusTips: piece.focusTips || [],
        sourceRefs: piece.sourceRefs || [],
        noteCount: piece.notes.length,
        countInBeats: piece.countInBeats || 4,
        notes: piece.notes,
      },
    });
  },

  startPractice() {
    if (!this.data.piece) {
      return;
    }
    wx.redirectTo({
      url: `/pages/score-practice/score-practice?pieceId=${this.data.piece.id}`,
    });
  },
});
