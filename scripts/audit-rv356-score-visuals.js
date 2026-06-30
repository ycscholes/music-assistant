#!/usr/bin/env node

const fs = require('node:fs/promises');
const path = require('node:path');
const { createCanvas, loadImage } = require('canvas');
const {
  buildRv356PdfReferenceCrops,
  getRv356PdfReferenceCrop,
  resolveRv356PdfReferencePath,
} = require('./rv356-visual-baseline');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_SYSTEMS = [0, 1, 3, 4, 17, 23, 24, 30, 62, 79];
const GENERATED_IMAGE_ROOT = path.join(PROJECT_ROOT, 'generated/score-assets/images/vivaldi_rv356_excerpt');
const DEFAULT_OUTPUT_DIR = path.join(PROJECT_ROOT, 'tmp/rv356-visual-audit');

function parseArgs(argv) {
  const options = {
    systems: DEFAULT_SYSTEMS,
    outputDir: DEFAULT_OUTPUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--all') {
      options.systems = buildRv356PdfReferenceCrops().map((crop) => crop.systemIndex);
      continue;
    }
    if (arg === '--systems' && argv[index + 1]) {
      options.systems = parseSystemList(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg.startsWith('--systems=')) {
      options.systems = parseSystemList(arg.slice('--systems='.length));
      continue;
    }
    if (arg === '--output' && argv[index + 1]) {
      options.outputDir = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg.startsWith('--output=')) {
      options.outputDir = path.resolve(arg.slice('--output='.length));
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  options.systems = Array.from(new Set(options.systems)).sort((a, b) => a - b);
  return options;
}

function parseSystemList(value) {
  return String(value)
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((systemIndex) => Number.isInteger(systemIndex) && systemIndex >= 0 && systemIndex < 80);
}

function drawImageContained(ctx, image, box, background = '#ffffff') {
  ctx.fillStyle = background;
  ctx.fillRect(box.x, box.y, box.width, box.height);
  const scale = Math.min(box.width / image.width, box.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const x = box.x + (box.width - width) / 2;
  const y = box.y + (box.height - height) / 2;
  ctx.drawImage(image, x, y, width, height);
  return { x, y, width, height };
}

function findInkBounds(image, options = {}) {
  const threshold = Number(options.threshold || 242);
  const padding = Number(options.padding || 18);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, image.width, image.height).data;
  let minX = image.width;
  let minY = image.height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const index = (y * image.width + x) * 4;
      const luma = (data[index] + data[index + 1] + data[index + 2]) / 3;
      if (luma < threshold) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (minX > maxX || minY > maxY) {
    return { x: 0, y: 0, width: image.width, height: image.height };
  }

  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(image.width - 1, maxX + padding);
  maxY = Math.min(image.height - 1, maxY + padding);
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function drawImageCropContained(ctx, image, crop, box) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(box.x, box.y, box.width, box.height);
  const scale = Math.min(box.width / crop.width, box.height / crop.height);
  const width = crop.width * scale;
  const height = crop.height * scale;
  const x = box.x + (box.width - width) / 2;
  const y = box.y + (box.height - height) / 2;
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, x, y, width, height);
  return { x, y, width, height };
}

function drawCropContained(ctx, image, crop, box) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(box.x, box.y, box.width, box.height);
  const scale = Math.min(box.width / crop.width, box.height / crop.height);
  const width = crop.width * scale;
  const height = crop.height * scale;
  const x = box.x + (box.width - width) / 2;
  const y = box.y + (box.height - height) / 2;
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, x, y, width, height);
  return { x, y, width, height };
}

function makeNormalizedCanvasFromCrop(image, crop, width, height) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  drawCropContained(ctx, image, crop, { x: 0, y: 0, width, height });
  return canvas;
}

function makeNormalizedCanvasFromImage(image, width, height) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  drawImageCropContained(ctx, image, findInkBounds(image), { x: 0, y: 0, width, height });
  return canvas;
}

function drawDifference(ctx, pdfCanvas, generatedCanvas, box) {
  const width = box.width;
  const height = box.height;
  const pdf = pdfCanvas.getContext('2d').getImageData(0, 0, width, height);
  const generated = generatedCanvas.getContext('2d').getImageData(0, 0, width, height);
  const diff = ctx.createImageData(width, height);
  let changed = 0;

  for (let index = 0; index < pdf.data.length; index += 4) {
    const pdfLuma = (pdf.data[index] + pdf.data[index + 1] + pdf.data[index + 2]) / 3;
    const generatedLuma = (generated.data[index] + generated.data[index + 1] + generated.data[index + 2]) / 3;
    const delta = Math.abs(pdfLuma - generatedLuma);
    const out = index;
    if (delta > 32) {
      changed += 1;
      diff.data[out] = 216;
      diff.data[out + 1] = 38;
      diff.data[out + 2] = 28;
      diff.data[out + 3] = Math.min(255, 90 + delta);
    } else {
      diff.data[out] = generated.data[index];
      diff.data[out + 1] = generated.data[index + 1];
      diff.data[out + 2] = generated.data[index + 2];
      diff.data[out + 3] = 88;
    }
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(box.x, box.y, box.width, box.height);
  ctx.putImageData(diff, box.x, box.y);
  return changed / (width * height);
}

function drawLabel(ctx, label, x, y) {
  ctx.fillStyle = '#111111';
  ctx.font = '20px Arial';
  ctx.textBaseline = 'top';
  ctx.fillText(label, x, y);
}

async function renderSystemAudit(systemIndex, outputDir) {
  const crop = getRv356PdfReferenceCrop(systemIndex);
  if (!crop) {
    throw new Error(`Missing PDF reference crop for system ${systemIndex}.`);
  }

  const pdfImage = await loadImage(resolveRv356PdfReferencePath(crop));
  const generatedImagePath = path.join(GENERATED_IMAGE_ROOT, `system-${String(systemIndex).padStart(3, '0')}.png`);
  const generatedImage = await loadImage(generatedImagePath);
  const generatedCrop = findInkBounds(generatedImage);
  const cellWidth = 520;
  const cellHeight = 190;
  const labelHeight = 34;
  const gap = 18;
  const width = cellWidth * 3 + gap * 4;
  const height = labelHeight + cellHeight + 28;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f4f0e9';
  ctx.fillRect(0, 0, width, height);

  const boxes = [
    { x: gap, y: labelHeight, width: cellWidth, height: cellHeight },
    { x: gap * 2 + cellWidth, y: labelHeight, width: cellWidth, height: cellHeight },
    { x: gap * 3 + cellWidth * 2, y: labelHeight, width: cellWidth, height: cellHeight },
  ];

  drawLabel(ctx, `system ${String(systemIndex).padStart(3, '0')} / PDF m.${crop.measureNumber}`, boxes[0].x, 8);
  drawLabel(ctx, 'VexFlow PNG content crop', boxes[1].x, 8);
  drawLabel(ctx, 'difference overlay', boxes[2].x, 8);

  drawCropContained(ctx, pdfImage, crop, boxes[0]);
  drawImageCropContained(ctx, generatedImage, generatedCrop, boxes[1]);
  const normalizedPdf = makeNormalizedCanvasFromCrop(pdfImage, crop, cellWidth, cellHeight);
  const normalizedGenerated = makeNormalizedCanvasFromImage(generatedImage, cellWidth, cellHeight);
  const mismatchRatio = drawDifference(ctx, normalizedPdf, normalizedGenerated, boxes[2]);

  ctx.strokeStyle = '#c9bfb1';
  ctx.lineWidth = 1;
  boxes.forEach((box) => ctx.strokeRect(box.x, box.y, box.width, box.height));
  ctx.fillStyle = '#333333';
  ctx.font = '16px Arial';
  ctx.fillText(`visual mismatch guide: ${(mismatchRatio * 100).toFixed(1)}%`, boxes[2].x, height - 22);

  const fileName = `rv356-system-${String(systemIndex).padStart(3, '0')}-audit.png`;
  const filePath = path.join(outputDir, fileName);
  await fs.writeFile(filePath, canvas.toBuffer('image/png'));
  return { systemIndex, fileName, mismatchRatio };
}

async function renderContactSheet(results, outputDir) {
  const thumbnails = [];
  for (const result of results) {
    thumbnails.push({
      result,
      image: await loadImage(path.join(outputDir, result.fileName)),
    });
  }

  const columns = 1;
  const thumbWidth = 840;
  const thumbHeight = 150;
  const gap = 18;
  const width = thumbWidth + gap * 2;
  const height = thumbnails.length * (thumbHeight + gap) + gap;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f4f0e9';
  ctx.fillRect(0, 0, width, height);

  thumbnails.forEach((thumb, index) => {
    const x = gap + (index % columns) * (thumbWidth + gap);
    const y = gap + Math.floor(index / columns) * (thumbHeight + gap);
    drawImageContained(ctx, thumb.image, { x, y, width: thumbWidth, height: thumbHeight }, '#ffffff');
  });

  const filePath = path.join(outputDir, 'rv356-contact-sheet.png');
  await fs.writeFile(filePath, canvas.toBuffer('image/png'));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await fs.mkdir(options.outputDir, { recursive: true });
  const results = [];

  for (const systemIndex of options.systems) {
    results.push(await renderSystemAudit(systemIndex, options.outputDir));
  }

  await renderContactSheet(results, options.outputDir);
  await fs.writeFile(
    path.join(options.outputDir, 'rv356-visual-audit.json'),
    `${JSON.stringify(results, null, 2)}\n`,
    'utf8'
  );
  console.log(`Generated RV356 visual audit for ${results.length} systems at ${path.relative(PROJECT_ROOT, options.outputDir)}.`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  parseArgs,
  renderSystemAudit,
};
