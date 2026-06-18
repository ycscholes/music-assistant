const { int16PcmToFloat32, mergeFloat32Chunks } = require('../../utils/audio-frame');
const { detectPitchYin } = require('../../utils/pitch-yin');
const { frequencyToNote, frequencyToTargetCentOffset, formatCentOffset } = require('../../utils/note');
const { TARGET_NOTES, getDefaultTargetNote, getTargetNoteByKey } = require('../../utils/target-notes');
const { getTuningStatus } = require('../../utils/tuning-status');

const SAMPLE_RATE = 44100;
const ANALYSIS_WINDOW = 4096;
const MAX_CHUNKS = 12;
const UI_INTERVAL_MS = 80;
const MAX_NEEDLE_DEG = 42;
const DEFAULT_REFERENCE_PITCH = 440;
const NEEDLE_RANGE_PERCENT = 32;
const DEFAULT_TARGET = getDefaultTargetNote();
const DEFAULT_TARGET_OPTIONS = buildTargetNoteOptions(DEFAULT_TARGET.key);

function withReferencePitch(target, referencePitch) {
  const ratio = referencePitch / DEFAULT_REFERENCE_PITCH;
  return Object.assign({}, target, {
    frequency: target.frequency * ratio,
    referencePitch,
  });
}

function median(values) {
  if (!values.length) {
    return null;
  }
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function buildTargetNoteOptions(activeKey) {
  const positionMap = {
    G3: { controlClass: 'string-control left bottom', labelClass: 'string-label left bottom' },
    D4: { controlClass: 'string-control left top', labelClass: 'string-label left top' },
    A4: { controlClass: 'string-control right top', labelClass: 'string-label right top' },
    E5: { controlClass: 'string-control right bottom', labelClass: 'string-label right bottom' },
  };

  return TARGET_NOTES.map((item) =>
    Object.assign({}, item, {
      active: item.key === activeKey,
      noteName: item.label.replace(/\d/g, ''),
      controlClass: item.key === activeKey ? `${positionMap[item.key].controlClass} active` : positionMap[item.key].controlClass,
      labelClass: positionMap[item.key].labelClass,
    })
  );
}

function getNeedlePosition(centOffset) {
  if (centOffset === null || centOffset === undefined || Number.isNaN(centOffset)) {
    return 50;
  }
  const limitedCent = Math.max(-50, Math.min(50, centOffset));
  return 50 + (limitedCent / 50) * NEEDLE_RANGE_PERCENT;
}

function getNeedleColor(centOffset) {
  if (centOffset === null || centOffset === undefined || Number.isNaN(centOffset)) {
    return 'var(--accent)';
  }
  const abs = Math.abs(centOffset);
  if (abs <= 10) {
    return 'var(--success)';
  }
  return 'var(--accent)';
}

Page({
  data: {
    isRecording: false,
    isStartingDetect: false,
    reduceMotion: false,
    statusText: '请拉一根空弦开始调音。',
    headlineText: '请选择弦轴',
    targetNotes: DEFAULT_TARGET_OPTIONS,
    targetNote: withReferencePitch(DEFAULT_TARGET, DEFAULT_REFERENCE_PITCH),
    referencePitch: DEFAULT_REFERENCE_PITCH,
    isReference442: false,
    noteLabel: 'A',
    detectedNoteText: '检测音：--',
    frequencyText: '-- Hz',
    centText: '--',
    needlePosition: 50,
    needleColor: 'var(--accent)',
    tuningStatusText: '准备就绪',
    tuningActionText: '请选择弦轴',
    actionToneClass: 'action-tone waiting',
  },

  onLoad() {
    this.recorder = wx.getRecorderManager();
    this.chunks = [];
    this.pitchFrames = [];
    this.recentFrequencies = [];
    this.lastUiAt = 0;
    this.isStartingDetect = false;
    try {
      this.setData({ reduceMotion: Boolean(wx.getStorageSync('reduceMotion')) });
    } catch (_) { /* ignore */ }
    this.bindRecorder();
    this.startDetect();
  },

  onShow() {
    if (!this.data.isRecording) {
      this.startDetect();
    }
  },

  selectTarget(event) {
    const target = withReferencePitch(getTargetNoteByKey(event.currentTarget.dataset.key), this.data.referencePitch);
    this.chunks = [];
    this.recentFrequencies = [];
    this.setData({
      targetNote: target,
      targetNotes: buildTargetNoteOptions(target.key),
      statusText: this.data.isRecording
        ? `正在监听 ${target.noteName || target.label.replace(/\d/g, '')} 弦`
        : '请拉一根空弦开始调音。',
      headlineText: this.data.isRecording ? '正在监听，请保持长弓单音' : '请选择弦轴',
      noteLabel: target.label.replace(/\d/g, ''),
      detectedNoteText: '检测音：--',
      frequencyText: '-- Hz',
      centText: '--',
      needlePosition: 50,
      needleColor: 'var(--accent)',
      tuningStatusText: '准备就绪',
      tuningActionText: `请拉 ${target.label.replace(/\d/g, '')} 空弦`,
      actionToneClass: 'action-tone waiting',
    });
  },

  toggleReferencePitch() {
    const nextReference = this.data.referencePitch === 440 ? 442 : 440;
    const nextTarget = withReferencePitch(getTargetNoteByKey(this.data.targetNote.key), nextReference);
    this.setData({
      referencePitch: nextReference,
      isReference442: nextReference === 442,
      targetNote: nextTarget,
      statusText: `参考频率已切换到 ${nextReference}Hz`,
      frequencyText: '-- Hz',
      centText: '--',
      needlePosition: 50,
      needleColor: 'var(--accent)',
      tuningStatusText: '准备就绪',
      tuningActionText: `请拉 ${nextTarget.label.replace(/\d/g, '')} 空弦`,
      headlineText: '请选择弦轴',
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
      this.isStartingDetect = false;
      this.setData({
        isRecording: true,
        isStartingDetect: false,
        statusText: `当前参考频率 ${this.data.referencePitch}Hz`,
      });
    });

    this.recorder.onStop(() => {
      this.finishTuning();
    });

    this.recorder.onError((error) => {
      this.isStartingDetect = false;
      this.setData({
        isRecording: false,
        isStartingDetect: false,
        statusText: '录音失败，请检查麦克风权限。',
        headlineText: '麦克风异常',
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
    if (this.data.isRecording || this.isStartingDetect) {
      return;
    }

    this.isStartingDetect = true;
    this.setData({ isStartingDetect: true });
    wx.authorize({
      scope: 'scope.record',
      success: () => this.startRecorder(),
      fail: () => {
        this.isStartingDetect = false;
        this.setData({
          isStartingDetect: false,
          statusText: '调音需要麦克风权限。',
          headlineText: '需要麦克风权限',
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

  toggleListening() {
    if (this.data.isRecording) {
      this.stopDetect();
      return;
    }
    this.startDetect();
  },

  startRecorder() {
    this.chunks = [];
    this.pitchFrames = [];
    this.recentFrequencies = [];
    this.lastUiAt = 0;

    this.setData({
      noteLabel: this.data.targetNote.label.replace(/\d/g, ''),
      detectedNoteText: '检测音：--',
      frequencyText: '-- Hz',
      centText: '--',
      needlePosition: 50,
      needleColor: 'var(--accent)',
      tuningStatusText: '正在监听',
      tuningActionText: `请拉 ${this.data.targetNote.label.replace(/\d/g, '')} 空弦`,
      headlineText: '正在监听，请保持长弓单音',
      actionToneClass: 'action-tone waiting',
      statusText: `当前参考频率 ${this.data.referencePitch}Hz`,
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
      this.setData({ statusText: '调音已暂停。' });
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
            ? `请拉 ${this.data.targetNote.label.replace(/\d/g, '')} 空弦，并保持长弓单音`
            : '识别置信度较低，请靠近手机并保持单音。',
        headlineText: '等待稳定单音',
        tuningStatusText: '等待声音',
        tuningActionText: `请拉 ${this.data.targetNote.label.replace(/\d/g, '')} 空弦`,
        actionToneClass: 'action-tone waiting',
      });
      return;
    }

    const noteInfo = frequencyToNote(frame.frequency);
    const target = this.data.targetNote;
    const targetCentOffset = frequencyToTargetCentOffset(frame.frequency, target.frequency);
    const needlePosition = getNeedlePosition(targetCentOffset);
    const needleColor = getNeedleColor(targetCentOffset);
    const tuningStatus = getTuningStatus(targetCentOffset);
    const noteLetter = target.label.replace(/\d/g, '');
    const headlineMap = {
      'in-tune': '音准正确，保持当前弦轴',
      sharp: '音偏高，请放松弦轴',
      flat: '音偏低，请拧紧弦轴',
      far: '当前音不匹配，请检查弦轴',
    };

    this.setData({
      statusText: `${noteInfo.label} · ${frame.frequency.toFixed(1)} Hz · ${formatCentOffset(targetCentOffset)}`,
      headlineText: headlineMap[tuningStatus.key] || '正在监听，请继续微调',
      noteLabel: noteLetter,
      detectedNoteText: `检测音：${noteInfo.label}`,
      frequencyText: `${frame.frequency.toFixed(1)} Hz`,
      centText: formatCentOffset(targetCentOffset),
      needlePosition,
      needleColor,
      tuningStatusText: tuningStatus.label,
      tuningActionText: tuningStatus.actionText,
      actionToneClass: `action-tone ${tuningStatus.key}`,
    });
  },

  finishTuning() {
    this.setData({
      isRecording: false,
      statusText: `当前参考频率 ${this.data.referencePitch}Hz`,
      headlineText: '监听已暂停',
    });
  },

});
