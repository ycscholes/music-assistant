const TARGET_NOTES = [
  {
    key: 'G3',
    label: 'G3',
    stringName: 'G 弦',
    frequency: 196.0,
    prompt: '请拉 G 弦空弦，保持 3-5 秒长弓',
  },
  {
    key: 'D4',
    label: 'D4',
    stringName: 'D 弦',
    frequency: 293.6647679174076,
    prompt: '请拉 D 弦空弦，保持 3-5 秒长弓',
  },
  {
    key: 'A4',
    label: 'A4',
    stringName: 'A 弦',
    frequency: 440.0,
    prompt: '请拉 A 弦空弦，保持 3-5 秒长弓',
  },
  {
    key: 'E5',
    label: 'E5',
    stringName: 'E 弦',
    frequency: 659.2551138257398,
    prompt: '请拉 E 弦空弦，保持 3-5 秒长弓',
  },
];

function getDefaultTargetNote() {
  return TARGET_NOTES.find((item) => item.key === 'A4') || TARGET_NOTES[0];
}

function getTargetNoteByKey(key) {
  return TARGET_NOTES.find((item) => item.key === key) || getDefaultTargetNote();
}

module.exports = {
  TARGET_NOTES,
  getDefaultTargetNote,
  getTargetNoteByKey,
};
