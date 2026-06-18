const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const A4_FREQUENCY = 440;
const A4_MIDI = 69;

function frequencyToMidi(frequency) {
  return A4_MIDI + 12 * Math.log2(frequency / A4_FREQUENCY);
}

function midiToFrequency(midi) {
  return A4_FREQUENCY * Math.pow(2, (midi - A4_MIDI) / 12);
}

function frequencyToNote(frequency) {
  if (!frequency || frequency <= 0) {
    return {
      note: null,
      octave: null,
      midi: null,
      targetFrequency: null,
      centOffset: null,
      label: '--',
    };
  }

  const midi = frequencyToMidi(frequency);
  const nearestMidi = Math.round(midi);
  const note = NOTE_NAMES[((nearestMidi % 12) + 12) % 12];
  const octave = Math.floor(nearestMidi / 12) - 1;
  const targetFrequency = midiToFrequency(nearestMidi);
  const centOffset = (midi - nearestMidi) * 100;

  return {
    note,
    octave,
    midi: nearestMidi,
    targetFrequency,
    centOffset,
    label: `${note}${octave}`,
  };
}

function frequencyToTargetCentOffset(frequency, targetFrequency) {
  if (!frequency || !targetFrequency || frequency <= 0 || targetFrequency <= 0) {
    return null;
  }
  return 1200 * Math.log2(frequency / targetFrequency);
}

function formatCentOffset(centOffset) {
  if (centOffset === null || centOffset === undefined || Number.isNaN(centOffset)) {
    return '--';
  }
  const rounded = Math.round(centOffset);
  if (Math.abs(rounded) <= 2) {
    return 'in tune';
  }
  return `${rounded > 0 ? '+' : ''}${rounded} cents`;
}

module.exports = {
  NOTE_NAMES,
  frequencyToMidi,
  midiToFrequency,
  frequencyToNote,
  frequencyToTargetCentOffset,
  formatCentOffset,
};
