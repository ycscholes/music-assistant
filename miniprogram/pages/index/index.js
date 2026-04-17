Page({
  data: {},

  startPractice() {
    wx.navigateTo({
      url: '/pages/detect/detect',
    });
  },

  openHistory() {
    wx.navigateTo({
      url: '/pages/history/history',
    });
  },
});
