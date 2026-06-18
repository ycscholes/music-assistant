Page({
  data: {
    reduceMotion: false,
  },

  onLoad() {
    try {
      const value = wx.getStorageSync('reduceMotion');
      this.setData({ reduceMotion: Boolean(value) });
    } catch (_) {
      // Default to false if storage is unavailable.
    }
  },

  toggleReduceMotion() {
    const next = !this.data.reduceMotion;
    try {
      wx.setStorageSync('reduceMotion', next);
    } catch (_) {
      // Non-critical storage failure.
    }
    this.setData({ reduceMotion: next });
  },
});
