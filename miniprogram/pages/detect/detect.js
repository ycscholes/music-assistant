const { int16PcmToFloat32, mergeFloat32Chunks } = require('../../utils/audio-frame');
const { detectPitchYin } = require('../../utils/pitch-yin');
const { frequencyToNote, frequencyToTargetCentOffset, formatCentOffset } = require('../../utils/note');
const { TARGET_NOTES, getDefaultTargetNote, getTargetNoteByKey } = require('../../utils/target-notes');
const { getTuningStatus } = require('../../utils/tuning-status');

const SAMPLE_RATE = 44100;
const ANALYSIS_WINDOW = 4096;
const MAX_CHUNKS = 12;
const UI_INTERVAL_MS = 120;
const MAX_NEEDLE_DEG = 42;
const DEFAULT_TARGET = getDefaultTargetNote();
const DEFAULT_TARGET_GROUPS = buildTargetNoteGroups(DEFAULT_TARGET.key);

function median(values) {
  if (!values.length) {
    return null;
  }
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function buildTargetNoteOptions(activeKey) {
  return TARGET_NOTES.map((item) =>
    Object.assign({}, item, {
      active: item.key === activeKey,
      noteName: item.label.replace(/\d/g, ''),
      buttonClass: item.key === activeKey ? 'string-button active' : 'string-button',
    })
  );
}

function buildTargetNoteGroups(activeKey) {
  const options = buildTargetNoteOptions(activeKey);
  return {
    targetNotes: options,
    targetNotesLeft: options.slice(0, 2),
    targetNotesRight: options.slice(2),
  };
}

function getNeedleRotation(centOffset) {
  if (centOffset === null || centOffset === undefined || Number.isNaN(centOffset)) {
    return 0;
  }
  const limitedCent = Math.max(-50, Math.min(50, centOffset));
  return Math.round((limitedCent / 50) * MAX_NEEDLE_DEG);
}

Page({
  data: {
    isRecording: false,
    statusText: '准备调音',
    targetNotes: DEFAULT_TARGET_GROUPS.targetNotes,
    targetNotesLeft: DEFAULT_TARGET_GROUPS.targetNotesLeft,
    targetNotesRight: DEFAULT_TARGET_GROUPS.targetNotesRight,
    targetNote: DEFAULT_TARGET,
    noteLabel: 'A',
    detectedNoteText: '当前音：--',
    frequencyText: '-- Hz',
    centText: '--',
    needleRotation: 0,
    tuningStatusText: '等待声音',
    tuningActionText: '请选择琴弦并启动麦克风',
    actionToneClass: 'action-tone waiting',
  },

  onLoad() {
    this.recorder = wx.getRecorderManager();
    this.chunks = [];
    this.pitchFrames = [];
    this.recentFrequencies = [];
    this.lastUiAt = 0;
    this.bindRecorder();
  },

  selectTarget(event) {
    const target = getTargetNoteByKey(event.currentTarget.dataset.key);
    const targetNoteGroups = buildTargetNoteGroups(target.key);
    this.chunks = [];
    this.recentFrequencies = [];
    this.setData({
      targetNote: target,
      targetNotes: targetNoteGroups.targetNotes,
      targetNotesLeft: targetNoteGroups.targetNotesLeft,
      targetNotesRight: targetNoteGroups.targetNotesRight,
      statusText: this.data.isRecording ? `正在调 ${target.stringName}` : `准备调 ${target.stringName}`,
      noteLabel: target.label.replace(/\d/g, ''),
      detectedNoteText: '当前音：--',
      frequencyText: '-- Hz',
      centText: '--',
      needleRotation: 0,
      tuningStatusText: '等待声音',
      tuningActionText: `请拉 ${target.stringName} 空弦`,
      actionToneClass: 'action-tone waiting',
    });
  },

  closeTuner() {
    wx.navigateBack({
      fail: () => {
        wx.redirectTo({ url: '/pages/index/index' });
      },
    });
  },

  onUnload() {
    if (this.data.isRecording) {
      this.recorder.stop();
    }
  },

  bindRecorder() {
    this.recorder.onStart(() => {
      this.setData({
        isRecording: true,
        statusText: '正在听音',
      });
    });

    this.recorder.onStop(() => {
      this.finishTuning();
    });

    this.recorder.onError((error) => {
      this.setData({
        isRecording: false,
        statusText: '录音失败，请检查麦克风权限',
      });
      wx.showToast({
        title: error.errMsg || '录音失败',
        icon: 'none',
      });
    });

    this.recorder.onFrameRecorded((res) => {
      if (!res || !res.frameBuffer) {
        return;
      }
      this.handleFrame(res.frameBuffer);
    });
  },

  startDetect() {
    wx.authorize({
      scope: 'scope.record',
      success: () => this.startRecorder(),
      fail: () => {
        this.setData({
          statusText: '需要麦克风权限才能检测音准',
        });
        wx.showModal({
          title: '需要麦克风权限',
          content: '请在设置中允许录音权限，然后重新开始检测。',
          confirmText: '去设置',
          success: (res) => {
            if (res.confirm) {
              wx.openSetting();
            }
          },
        });
      },
    });
  },

  startRecorder() {
    this.chunks = [];
    this.pitchFrames = [];
    this.recentFrequencies = [];
    this.lastUiAt = 0;

    this.setData({
      noteLabel: this.data.targetNote.label.replace(/\d/g, ''),
      detectedNoteText: '当前音：--',
      frequencyText: '-- Hz',
      centText: '--',
      needleRotation: 0,
      tuningStatusText: '等待声音',
      tuningActionText: `请拉 ${this.data.targetNote.stringName} 空弦`,
      actionToneClass: 'action-tone waiting',
      statusText: '正在启动麦克风',
    });

    this.recorder.start({
      duration: 600000,
      sampleRate: SAMPLE_RATE,
      numberOfChannels: 1,
      encodeBitRate: 256000,
      format: 'PCM',
      frameSize: 4,
    });
  },

  stopDetect() {
    if (this.data.isRecording) {
      this.setData({ statusText: '已暂停调音' });
      this.recorder.stop();
    }
  },

  handleFrame(frameBuffer) {
    const chunk = int16PcmToFloat32(frameBuffer);
    if (!chunk.length) {
      return;
    }

    this.chunks.push(chunk);
    if (this.chunks.length > MAX_CHUNKS) {
      this.chunks.shift();
    }

    const windowBuffer = mergeFloat32Chunks(this.chunks, ANALYSIS_WINDOW);
    if (windowBuffer.length < ANALYSIS_WINDOW) {
      return;
    }

    const pitch = detectPitchYin(windowBuffer, SAMPLE_RATE);
    const frame = this.buildPitchFrame(pitch);
    this.pitchFrames.push(frame);

    const now = Date.now();
    if (now - this.lastUiAt >= UI_INTERVAL_MS) {
      this.lastUiAt = now;
      this.updatePitchUi(frame);
    }
  },

  buildPitchFrame(pitch) {
    let frequency = pitch.frequency;
    if (frequency) {
      this.recentFrequencies.push(frequency);
      if (this.recentFrequencies.length > 5) {
        this.recentFrequencies.shift();
      }
      frequency = median(this.recentFrequencies) || frequency;
    }

    const noteInfo = frequencyToNote(frequency);
    const target = this.data.targetNote;
    const targetCentOffset = frequencyToTargetCentOffset(frequency, target.frequency);
    return {
      frequency,
      note: target.label,
      octave: null,
      centOffset: targetCentOffset,
      targetNote: target.label,
      targetFrequency: target.frequency,
      targetCentOffset,
      detectedNote: noteInfo.label,
      detectedFrequency: frequency,
      confidence: pitch.confidence,
      rms: pitch.rms,
      timestamp: Date.now(),
    };
  },

  updatePitchUi(frame) {
    const isValid = frame.frequency && frame.confidence >= 0.55;

    if (!isValid) {
      this.setData({
        statusText:
          frame.rms < 0.01
            ? `请拉 ${this.data.targetNote.label}，保持单音长弓`
            : '置信度较低，请靠近手机并保持单音',
        tuningStatusText: '等待声音',
        tuningActionText: `请拉 ${this.data.targetNote.stringName} 空弦`,
        actionToneClass: 'action-tone waiting',
      });
      return;
    }

    const noteInfo = frequencyToNote(frame.frequency);
    const target = this.data.targetNote;
    const targetCentOffset = frequencyToTargetCentOffset(frame.frequency, target.frequency);
    const needleRotation = getNeedleRotation(targetCentOffset);
    const tuningStatus = getTuningStatus(targetCentOffset);
    const direction =
      tuningStatus.key === 'in-tune'
        ? `${target.label} 已校准`
        : `${target.label} ${tuningStatus.label} ${formatCentOffset(targetCentOffset)}`;
    const noteLetter = target.label.replace(/\d/g, '');

    this.setData({
      statusText: direction,
      noteLabel: noteLetter,
      detectedNoteText: `当前音：${noteInfo.label}`,
      frequencyText: `${frame.frequency.toFixed(1)} Hz`,
      centText: formatCentOffset(targetCentOffset),
      needleRotation,
      tuningStatusText: tuningStatus.label,
      tuningActionText: tuningStatus.actionText,
      actionToneClass: `action-tone ${tuningStatus.key}`,
    });
  },

  finishTuning() {
    this.setData({
      isRecording: false,
      statusText: '调音已暂停',
    });
  },

});
