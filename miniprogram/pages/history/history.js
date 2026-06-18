const { listPracticeSessions } = require('../../services/practice-store');
const { formatCentOffset } = require('../../utils/note');

Page({
  data: {
    records: [],
    loading: true,
    errorText: '',
    empty: false,
  },

  onShow() {
    this.loadRecords();
  },

  async loadRecords() {
    this.setData({ loading: true, errorText: '' });
    try {
      const res = await listPracticeSessions({ pageSize: 20 });
      const records = (res.data || []).map((item) => ({
        id: item._id,
        sessionType: item.sessionType || 'basic',
        title:
          item.sessionType === 'score_practice'
            ? this.getScorePracticeTitle(item)
            : `目标音 ${item.targetNote || '--'}`,
        detailText:
          item.sessionType === 'score_practice'
            ? `完成率 ${Math.round(((item.summaryScores && item.summaryScores.completionRate) || 0) * 100)}%`
            : `平均偏差 ${formatCentOffset(item.avgCentOffset)}`,
        score:
          item.sessionType === 'score_practice'
            ? (item.summaryScores && item.summaryScores.totalScore) || 0
            : item.totalScore || 0,
        durationText: `${item.durationSec || 0}s`,
        createdText: this.formatDate(item.createdAt || item.startedAt),
      }));
      this.setData({ records, loading: false, empty: records.length === 0 });
    } catch (error) {
      console.error('load practice sessions failed', error);
      this.setData({
        loading: false,
        errorText: '记录暂时不可用，请稍后再试。',
      });
    }
  },

  getScorePracticeTitle(item) {
    const title = item.pieceTitle || '--';
    const range = item.scoreRange;
    if (!range || range.isFullPiece) {
      return `${title} · 整首`;
    }
    return `${title} · ${range.label || `${range.startLabel} 至 ${range.endLabel}`}`;
  },

  formatDate(value) {
    if (!value) {
      return '--';
    }
    const date = typeof value === 'string' || typeof value === 'number' ? new Date(value) : value;
    if (!date || Number.isNaN(date.getTime())) {
      return '--';
    }
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    const hour = `${date.getHours()}`.padStart(2, '0');
    const minute = `${date.getMinutes()}`.padStart(2, '0');
    return `${month}-${day} ${hour}:${minute}`;
  },

  startPractice() {
    wx.navigateTo({
      url: '/pages/detect/detect',
    });
  },
});
