const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const RV356_PDF_PAGE_PATHS = [
  'docs/sources/sheet-music/vivaldi-rv356-pdf-clean-page-001.png',
  'docs/sources/sheet-music/vivaldi-rv356-pdf-clean-page-002.png',
  'docs/sources/sheet-music/vivaldi-rv356-pdf-clean-page-003.png',
];

const PAGE_WIDTH = 1147;
const PAGE_HEIGHT = 1620;

function buildEqualMeasureCrops({ pageIndex, systemStart, rowY, rowHeight, count, xStops }) {
  const crops = [];
  for (let offset = 0; offset < count; offset += 1) {
    const left = xStops[offset];
    const right = xStops[offset + 1];
    crops.push({
      systemIndex: systemStart + offset,
      measureNumber: systemStart + offset + 1,
      pageIndex,
      sourcePath: RV356_PDF_PAGE_PATHS[pageIndex],
      x: Math.max(0, Math.round(left)),
      y: Math.max(0, Math.round(rowY)),
      width: Math.min(PAGE_WIDTH - left, Math.round(right - left)),
      height: Math.min(PAGE_HEIGHT - rowY, Math.round(rowHeight)),
    });
  }
  return crops;
}

function buildRv356PdfReferenceCrops() {
  const crops = [];
  const pageOneRows = [
    { systemStart: 0, rowY: 260, rowHeight: 124, xStops: [74, 536, 852, 1110] },
    { systemStart: 3, rowY: 398, rowHeight: 124, xStops: [34, 426, 762, 1110] },
    { systemStart: 6, rowY: 532, rowHeight: 124, xStops: [34, 406, 762, 1110] },
    { systemStart: 9, rowY: 666, rowHeight: 126, xStops: [34, 426, 762, 1110] },
    { systemStart: 12, rowY: 802, rowHeight: 126, xStops: [34, 426, 762, 1110] },
    { systemStart: 15, rowY: 900, rowHeight: 126, xStops: [34, 426, 762, 1110] },
    { systemStart: 18, rowY: 1032, rowHeight: 130, xStops: [34, 426, 762, 1110] },
    { systemStart: 21, rowY: 1176, rowHeight: 130, xStops: [34, 426, 664, 1110] },
    { systemStart: 24, rowY: 1320, rowHeight: 118, xStops: [34, 426, 762, 1110] },
    { systemStart: 27, rowY: 1456, rowHeight: 156, xStops: [34, 426, 762, 1110] },
  ];

  const pageTwoRows = [
    { systemStart: 30, rowY: 128, rowHeight: 132, xStops: [34, 407, 773, 1110] },
    { systemStart: 33, rowY: 278, rowHeight: 122, xStops: [34, 407, 773, 1110] },
    { systemStart: 36, rowY: 420, rowHeight: 132, xStops: [34, 407, 773, 1110] },
    { systemStart: 39, rowY: 570, rowHeight: 132, xStops: [34, 407, 773, 1110] },
    { systemStart: 42, rowY: 722, rowHeight: 132, xStops: [34, 407, 773, 1110] },
    { systemStart: 45, rowY: 870, rowHeight: 132, xStops: [34, 407, 773, 1110] },
    { systemStart: 48, rowY: 1018, rowHeight: 132, xStops: [34, 407, 773, 1110] },
    { systemStart: 51, rowY: 1168, rowHeight: 132, xStops: [34, 407, 773, 1110] },
    { systemStart: 54, rowY: 1316, rowHeight: 132, xStops: [34, 407, 773, 1110] },
    { systemStart: 57, rowY: 1462, rowHeight: 116, xStops: [34, 407, 773, 1110] },
    { systemStart: 60, rowY: 1560, rowHeight: 60, xStops: [34, 573, 1110] },
  ];

  const pageThreeRows = [
    { systemStart: 62, rowY: 134, rowHeight: 132, xStops: [34, 1110] },
    { systemStart: 63, rowY: 322, rowHeight: 126, xStops: [34, 593, 1110] },
    { systemStart: 65, rowY: 524, rowHeight: 134, xStops: [34, 407, 773, 1110] },
    { systemStart: 68, rowY: 706, rowHeight: 134, xStops: [34, 407, 773, 1110] },
    { systemStart: 71, rowY: 850, rowHeight: 134, xStops: [34, 407, 773, 1110] },
    { systemStart: 74, rowY: 1000, rowHeight: 134, xStops: [34, 407, 773, 1110] },
    { systemStart: 77, rowY: 1150, rowHeight: 146, xStops: [34, 407, 773, 1110] },
  ];

  for (const row of pageOneRows) {
    crops.push(...buildEqualMeasureCrops({ pageIndex: 0, count: row.xStops.length - 1, ...row }));
  }
  for (const row of pageTwoRows) {
    crops.push(...buildEqualMeasureCrops({ pageIndex: 1, count: row.xStops.length - 1, ...row }));
  }
  for (const row of pageThreeRows) {
    crops.push(...buildEqualMeasureCrops({ pageIndex: 2, count: row.xStops.length - 1, ...row }));
  }

  return crops.sort((a, b) => a.systemIndex - b.systemIndex);
}

function getRv356PdfReferenceCrop(systemIndex) {
  return buildRv356PdfReferenceCrops().find((crop) => crop.systemIndex === Number(systemIndex));
}

function resolveRv356PdfReferencePath(crop) {
  return path.join(PROJECT_ROOT, crop.sourcePath);
}

module.exports = {
  RV356_PDF_PAGE_PATHS,
  buildRv356PdfReferenceCrops,
  getRv356PdfReferenceCrop,
  resolveRv356PdfReferencePath,
};
