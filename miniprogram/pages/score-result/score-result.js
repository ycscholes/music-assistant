const { saveSession } = require('../../utils/save-session');

function getEvaluationModeText(mode) {
  if (mode === 'pitch-gate') {
    return '音准闯关';
  }
  if (mode === 'performance-follow') {
    return '跟随模式';
  }
  return '固定节拍';
}

Page({
  data: {
    empty: false,
    session: null,
    scoreItems: [],
    issueItems: [],
    saveButtonText: '保存练习记录',
    saved: false,
    saving: false,
  },

  onLoad() {
    const app = getApp();
    const session = app.globalData.latestSession;
    if (!session || session.sessionType !== 'score_practice') {
      this.setData({ empty: true });
      return;
    }

    const scoreItems = [
      { label: '综合分', value: session.summaryScores.totalScore },
      { label: '音准分', value: session.summaryScores.pitchScore },
      { label: '节奏分', value: session.summaryScores.rhythmScore },
      { label: '完成率', value: `${Math.round(session.summaryScores.completionRate * 100)}%` },
    ];
    const rangeTitle = session.scoreRange && !session.scoreRange.isFullPiece
      ? `${session.pieceTitle} · ${session.scoreRange.label}`
      : session.pieceTitle;
    const resultMeta = [
      getEvaluationModeText(session.evaluationMode),
      `${session.bpm} BPM`,
      session.timeSignature,
      `${session.durationSec}s`,
    ].filter(Boolean).join(' · ');

    const issueItems = session.noteResults
      .filter((item) => item.issueTags.length)
      .slice(0, 6)
      .map((item, index) => ({
        id: `${item.targetNote}-${index}`,
        label: `${item.targetNote} · ${item.issueTags.join(' / ')}`,
      }));

    this.setData({
      session: Object.assign({}, session, { rangeTitle, resultMeta }),
      scoreItems,
      issueItems,
    });
  },

  async saveResult() {
    await saveSession(this, this.data.session);
  },

  practiceAgain() {
    if (!this.data.session) {
      return;
    }
    const range = this.data.session.scoreRange;
    const rangeQuery = range && !range.isFullPiece
      ? `&startNoteIndex=${range.startNoteIndex}&endNoteIndex=${range.endNoteIndex}`
      : '';
    wx.redirectTo({
      url: `/pages/score-practice/score-practice?pieceId=${this.data.session.pieceId}${rangeQuery}`,
    });
  },

  startScorePractice() {
    wx.redirectTo({
      url: '/pages/score-list/score-list',
    });
  },

  openHistory() {
    wx.redirectTo({
      url: '/pages/history/history',
    });
  },
});
