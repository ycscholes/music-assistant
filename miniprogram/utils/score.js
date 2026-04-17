function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function average(values) {
  if (!values.length) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values) {
  if (values.length < 2) {
    return 0;
  }
  const avg = average(values);
  const variance = average(values.map((value) => Math.pow(value - avg, 2)));
  return Math.sqrt(variance);
}

function calculatePracticeScore(frames) {
  const validFrames = (frames || []).filter(
    (frame) =>
      frame &&
      typeof getFrameOffset(frame) === 'number' &&
      Number.isFinite(getFrameOffset(frame)) &&
      frame.confidence >= 0.55
  );

  if (!validFrames.length) {
    return {
      validFrameCount: 0,
      avgCentOffset: null,
      stabilityScore: 0,
      pitchScore: 0,
      totalScore: 0,
    };
  }

  const offsets = validFrames.map((frame) => getFrameOffset(frame));
  const absOffsets = offsets.map((value) => Math.abs(value));
  const avgAbsOffset = average(absOffsets);
  const avgSignedOffset = average(offsets);
  const deviation = standardDeviation(offsets);

  const pitchScore = clamp(100 - avgAbsOffset * 2, 0, 100);
  const stabilityScore = clamp(100 - deviation * 3, 0, 100);
  const totalScore = Math.round(pitchScore * 0.7 + stabilityScore * 0.3);

  return {
    validFrameCount: validFrames.length,
    avgCentOffset: Math.round(avgSignedOffset),
    stabilityScore: Math.round(stabilityScore),
    pitchScore: Math.round(pitchScore),
    totalScore,
  };
}

function getFrameOffset(frame) {
  if (frame && typeof frame.targetCentOffset === 'number') {
    return frame.targetCentOffset;
  }
  return frame ? frame.centOffset : null;
}

module.exports = {
  calculatePracticeScore,
  clamp,
};
