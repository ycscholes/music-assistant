Page({
  data: {},

  startPractice() {
    wx.navigateTo({
      url: '/pages/detect/detect',
    });
  },

  openScorePractice() {
    wx.navigateTo({
      url: '/pages/score-list/score-list',
    });
  },

  openHistory() {
    wx.navigateTo({
      url: '/pages/history/history',
    });
  },

  openMetronome() {
    wx.navigateTo({
      url: '/pages/metronome/metronome',
    });
  },

  openSettings() {
    wx.navigateTo({
      url: '/pages/settings/settings',
    });
  },
});
