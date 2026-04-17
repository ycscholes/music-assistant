const IN_TUNE_CENTS = 8;
const FAR_CENTS = 100;

function getTuningStatus(centOffset) {
  if (centOffset === null || centOffset === undefined || Number.isNaN(centOffset)) {
    return {
      key: 'waiting',
      label: '等待声音',
      actionText: '请拉当前选择的空弦',
      inTune: false,
      statusClass: 'tuning-status waiting',
    };
  }

  const absOffset = Math.abs(centOffset);
  if (absOffset <= IN_TUNE_CENTS) {
    return {
      key: 'in-tune',
      label: '标准范围',
      actionText: '保持当前弦轴',
      inTune: true,
      statusClass: 'tuning-status in-tune',
    };
  }

  if (absOffset > FAR_CENTS) {
    return {
      key: 'far',
      label: '偏差较大',
      actionText: '请确认正在拉当前选择的空弦',
      inTune: false,
      statusClass: 'tuning-status far',
    };
  }

  if (centOffset > 0) {
    return {
      key: 'sharp',
      label: '偏高',
      actionText: '放松弦轴',
      inTune: false,
      statusClass: 'tuning-status sharp',
    };
  }

  return {
    key: 'flat',
    label: '偏低',
    actionText: '拧紧弦轴',
    inTune: false,
    statusClass: 'tuning-status flat',
  };
}

module.exports = {
  FAR_CENTS,
  IN_TUNE_CENTS,
  getTuningStatus,
};
