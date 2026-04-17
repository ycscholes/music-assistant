const { listPracticeSessions } = require('../../services/practice-store');
const { formatCentOffset } = require('../../utils/note');

Page({
  data: {
    records: [],
    loading: true,
    errorText: '',
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
        targetNote: item.targetNote || '--',
        score: item.totalScore || 0,
        durationText: `${item.durationSec || 0}s`,
        avgCentText: formatCentOffset(item.avgCentOffset),
        createdText: this.formatDate(item.createdAt || item.startedAt),
      }));
      this.setData({ records, loading: false });
    } catch (error) {
      console.error('load practice sessions failed', error);
      this.setData({
        loading: false,
        errorText: '读取失败，请检查 CloudBase 环境和数据库权限。',
      });
    }
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
