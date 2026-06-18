const { savePracticeSession } = require('../services/practice-store');

/**
 * Shared save-session flow for result pages.
 * Manages saving state, button text, toast feedback, and error handling.
 *
 * @param {Object} page - WeChat Page instance with setData method
 * @param {Object} session - Practice session object to persist
 */
async function saveSession(page, session) {
  if (!session || page.data.saving || page.data.saved) {
    return;
  }

  page.setData({ saving: true });
  try {
    await savePracticeSession(session);
    page.setData({ saved: true, saving: false, saveButtonText: '已保存' });
    wx.showToast({ title: '已保存', icon: 'success' });
  } catch (error) {
    page.setData({ saving: false });
    wx.showToast({ title: '保存失败，请检查云开发配置', icon: 'none' });
    console.error('save practice session failed', error);
  }
}

module.exports = { saveSession };