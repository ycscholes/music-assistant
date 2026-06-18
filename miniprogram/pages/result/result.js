const { saveSession } = require('../../utils/save-session');
const { formatCentOffset } = require('../../utils/note');

Page({
  data: {
    session: null,
    avgCentText: '--',
    adviceText: '',
    targetText: '--',
    detectedSummaryText: '--',
    saveButtonText: '保存练习记录',
    playbackButtonText: '播放本次录音',
    playbackHint: '仅本机临时文件，不会保存到云端。',
    recordingPath: '',
    hasRecording: false,
    isPlaying: false,
    saved: false,
    saving: false,
    empty: false,
  },

  onLoad() {
    const app = getApp();
    const session = app.globalData.latestSession;
    if (!session) {
      this.setData({ empty: true });
      return;
    }

    const recordingPath = app.globalData.latestRecordingPath || '';
    this.setData({
      session,
      targetText: session.targetNote ? `${session.targetNote} · ${session.targetFrequency} Hz` : '--',
      detectedSummaryText: session.detectedNoteSummary || '--',
      avgCentText: formatCentOffset(session.avgCentOffset),
      adviceText: this.buildAdvice(session),
      recordingPath,
      hasRecording: Boolean(recordingPath),
      playbackHint: recordingPath
        ? '仅本机临时文件，不会保存到云端。'
        : '未生成可播放录音，请用真机重新测试。',
    });
  },

  onUnload() {
    this.destroyAudioContext();
  },

  buildAdvice(session) {
    if (session.validFrameCount === 0) {
      return `没有检测到稳定的 ${session.targetNote || '目标音'}。请靠近手机，保持长弓，并减少环境噪声。`;
    }
    if (session.totalScore >= 85) {
      return `${session.targetNote || '目标音'} 的音准和稳定性都不错。继续保持单音长弓。`;
    }
    if (session.totalScore >= 60) {
      return `已经能检测到有效音高。下一次继续练 ${session.targetNote || '目标音'}，重点减少音高上下晃动。`;
    }
    return `建议先慢练 ${session.targetNote || '目标音'}。每次保持 3-5 秒长音，等指针稳定后再停止。`;
  },

  async saveResult() {
    await saveSession(this, this.data.session);
  },

  togglePlayback() {
    if (!this.data.hasRecording || !this.data.recordingPath) {
      wx.showToast({
        title: '暂无可播放录音',
        icon: 'none',
      });
      return;
    }

    const audio = this.getAudioContext();
    if (this.data.isPlaying) {
      audio.stop();
      return;
    }

    audio.src = this.data.recordingPath;
    audio.play();
  },

  getAudioContext() {
    if (this.audioContext) {
      return this.audioContext;
    }

    const audio = wx.createInnerAudioContext();
    audio.obeyMuteSwitch = false;
    audio.onPlay(() => {
      this.setData({
        isPlaying: true,
        playbackButtonText: '停止播放',
      });
    });
    audio.onEnded(() => this.resetPlaybackState());
    audio.onStop(() => this.resetPlaybackState());
    audio.onError((error) => {
      this.resetPlaybackState();
      wx.showToast({
        title: '录音播放失败',
        icon: 'none',
      });
      console.error('play local recording failed', error);
    });

    this.audioContext = audio;
    return audio;
  },

  resetPlaybackState() {
    this.setData({
      isPlaying: false,
      playbackButtonText: '播放本次录音',
    });
  },

  destroyAudioContext() {
    if (!this.audioContext) {
      return;
    }

    this.audioContext.stop();
    this.audioContext.destroy();
    this.audioContext = null;
  },

  practiceAgain() {
    wx.redirectTo({
      url: '/pages/detect/detect',
    });
  },

  openHistory() {
    wx.redirectTo({
      url: '/pages/history/history',
    });
  },
});
