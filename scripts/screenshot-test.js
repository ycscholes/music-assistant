#!/usr/bin/env node
/**
 * Screenshot test script for WeChat Mini Program pages.
 *
 * Usage:
 *   node scripts/screenshot-test.js
 *   node scripts/screenshot-test.js --pages index,detect
 *   node scripts/screenshot-test.js --output ./my-screenshots
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'screenshot-config.json');
const CLI_PATH = '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = { pages: null, output: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--pages' && args[i + 1]) {
      parsed.pages = args[i + 1].split(',').map((s) => s.trim());
      i++;
    }
    if (args[i] === '--output' && args[i + 1]) {
      parsed.output = args[i + 1];
      i++;
    }
  }
  return parsed;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function timestampDirName() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

async function run() {
  const args = parseArgs();

  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`Config not found: ${CONFIG_PATH}`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  const pagesToCapture = args.pages
    ? config.pages.filter((p) => args.pages.includes(p.name))
    : config.pages;

  if (pagesToCapture.length === 0) {
    console.error('No pages matched.');
    process.exit(1);
  }

  const outputBase = args.output
    ? path.resolve(args.output)
    : path.join(config.projectPath, config.outputDir);
  const outputDir = path.join(outputBase, timestampDirName());
  ensureDir(outputDir);

  console.log(`Screenshots will be saved to: ${outputDir}`);

  let automator;
  let miniProgram;
  try {
    automator = require('miniprogram-automator');
  } catch (e) {
    console.error('miniprogram-automator is not installed.');
    console.error('Run: npm install --save-dev miniprogram-automator');
    process.exit(1);
  }

  console.log('Launching WeChat DevTools...');
  miniProgram = await automator.launch({
    projectPath: config.projectPath,
    cliPath: CLI_PATH,
  });

  console.log(`Will capture ${pagesToCapture.length} page(s)`);

  for (const pageConfig of pagesToCapture) {
    const { name, path: pagePath, mock } = pageConfig;
    console.log(`  → ${name}: ${pagePath}`);

    try {
      // Inject mock data before navigating if needed
      if (mock && mock.storage) {
        const storageScript = Object.entries(mock.storage)
          .map(([key, value]) => {
            return `wx.setStorageSync('${key}', ${JSON.stringify(value)});`;
          })
          .join('\n');
        await miniProgram.evaluate(storageScript);
      }

      const page = await miniProgram.reLaunch('/' + pagePath);
      await page.waitFor(800);

      const screenshotPath = path.join(outputDir, `${name}.png`);
      await miniProgram.screenshot({ path: screenshotPath });
      console.log(`    ✓ ${screenshotPath}`);
    } catch (err) {
      console.error(`    ✗ Failed: ${err.message}`);
    }
  }

  console.log('Closing WeChat DevTools...');
  await miniProgram.close();
  console.log('Done.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
