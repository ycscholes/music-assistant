const { buildStaffScore } = require('../../utils/score-practice/staff-layout');

Component({
  properties: {
    piece: {
      type: Object,
      value: null,
      observer() {
        this.refreshScore();
      },
    },
    activeNoteIndex: {
      type: Number,
      value: 0,
      observer() {
        this.refreshScore();
      },
    },
    layoutMode: {
      type: String,
      value: 'scroll',
      observer() {
        this.refreshScore();
      },
    },
    measuresPerLine: {
      type: Number,
      value: 2,
      observer() {
        this.refreshScore();
      },
    },
    beatsPerLine: {
      type: Number,
      value: 0,
      observer() {
        this.refreshScore();
      },
    },
    beatWidth: {
      type: Number,
      value: 54,
      observer() {
        this.refreshScore();
      },
    },
    staffScale: {
      type: Number,
      value: 1,
      observer() {
        this.refreshScore();
      },
    },
    fullscreen: {
      type: Boolean,
      value: false,
    },
    compact: {
      type: Boolean,
      value: false,
    },
    selectionMode: {
      type: Boolean,
      value: false,
    },
    rangeStartNoteIndex: {
      type: Number,
      value: 0,
      observer() {
        this.refreshScore();
      },
    },
    rangeEndNoteIndex: {
      type: Number,
      value: -1,
      observer() {
        this.refreshScore();
      },
    },
    rangeVisible: {
      type: Boolean,
      value: false,
      observer() {
        this.refreshScore();
      },
    },
  },

  data: {
    score: buildStaffScore(null),
  },

  lifetimes: {
    attached() {
      this.refreshScore();
    },
  },

  methods: {
    refreshScore() {
      this.setData({
        score: buildStaffScore(this.data.piece, {
          activeNoteIndex: this.data.activeNoteIndex,
          layoutMode: this.data.layoutMode,
          measuresPerLine: this.data.measuresPerLine,
          beatsPerLine: this.data.beatsPerLine,
          beatWidth: this.data.beatWidth,
          staffScale: this.data.staffScale,
          rangeStartNoteIndex: this.data.rangeVisible ? this.data.rangeStartNoteIndex : 0,
          rangeEndNoteIndex: this.data.rangeVisible ? this.data.rangeEndNoteIndex : -1,
        }),
      });
    },

    selectNote(event) {
      if (!this.data.selectionMode) {
        return;
      }
      const noteIndex = Number(event.currentTarget.dataset.noteIndex);
      if (!Number.isFinite(noteIndex)) {
        return;
      }
      this.triggerEvent('selectnote', { noteIndex });
    },
  },
});
