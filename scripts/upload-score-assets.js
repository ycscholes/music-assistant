const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const GENERATED_ROOT = path.join(PROJECT_ROOT, 'generated/score-assets');
const SCORE_IMAGE_ROOT = path.join(GENERATED_ROOT, 'images');
const CLOUD_MANIFEST_PATH = path.join(GENERATED_ROOT, 'cloud-manifest.json');
const CLOUD_ASSET_VERSION = 'formal-score-v2';
const DEFAULT_ENV_ID = 'brain-game-6gtx0hei4de22731';
const LOCAL_ENV_PATH = path.join(PROJECT_ROOT, '.env.local');

function loadLocalEnv() {
  if (!fs.existsSync(LOCAL_ENV_PATH)) {
    return;
  }

  const content = fs.readFileSync(LOCAL_ENV_PATH, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadLocalEnv();

function parseArgs(argv) {
  const options = {
    dryRun: false,
    envId: process.env.TCB_ENV_ID || DEFAULT_ENV_ID,
  };

  for (const arg of argv) {
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg.startsWith('--env=')) {
      options.envId = arg.slice('--env='.length);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.envId) {
    throw new Error('TCB_ENV_ID is required.');
  }

  return options;
}

function toPosixPath(filePath) {
  return filePath.split(path.sep).join('/');
}

function toLocalManifestPath(absolutePath) {
  return toPosixPath(path.relative(PROJECT_ROOT, absolutePath));
}

async function pathExists(filePath) {
  try {
    await fsp.access(filePath);
    return true;
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function listScoreImageFiles(rootDir) {
  if (!(await pathExists(rootDir))) {
    throw new Error(`Score image directory not found: ${path.relative(PROJECT_ROOT, rootDir)}`);
  }

  const files = [];
  async function walk(dir) {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      if (entry.isFile() && /\.(?:png|jpe?g|webp)$/i.test(entry.name)) {
        files.push(absolutePath);
      }
    }
  }

  await walk(rootDir);
  return files.sort((a, b) => toLocalManifestPath(a).localeCompare(toLocalManifestPath(b)));
}

async function buildUploadEntries() {
  const files = await listScoreImageFiles(SCORE_IMAGE_ROOT);
  return Promise.all(files.map(async (absolutePath) => {
    const relativeToImages = toPosixPath(path.relative(SCORE_IMAGE_ROOT, absolutePath));
    const [pieceId, ...fileParts] = relativeToImages.split('/');
    if (!pieceId || fileParts.length !== 1) {
      throw new Error(`Unexpected score image path: ${relativeToImages}`);
    }

    const fileName = fileParts[0];
    const stat = await fsp.stat(absolutePath);
    return {
      pieceId,
      fileName,
      absolutePath,
      localPath: toLocalManifestPath(absolutePath),
      cloudPath: `score-assets/${CLOUD_ASSET_VERSION}/${pieceId}/${fileName}`,
      size: stat.size,
    };
  }));
}

async function uploadEntries(entries, envId) {
  const tcb = require('@cloudbase/node-sdk');
  const secretId = process.env.TENCENTCLOUD_SECRETID || process.env.TCB_SECRET_ID;
  const secretKey = process.env.TENCENTCLOUD_SECRETKEY || process.env.TCB_SECRET_KEY;
  const appConfig = { env: envId };
  if (secretId) {
    appConfig.secretId = secretId;
  }
  if (secretKey) {
    appConfig.secretKey = secretKey;
  }
  const app = tcb.init(appConfig);
  const uploaded = [];

  for (const entry of entries) {
    const result = await app.uploadFile({
      cloudPath: entry.cloudPath,
      fileContent: fs.createReadStream(entry.absolutePath),
    });

    if (!result || !result.fileID) {
      throw new Error(`Upload did not return fileID for ${entry.cloudPath}`);
    }

    uploaded.push({
      pieceId: entry.pieceId,
      fileName: entry.fileName,
      localPath: entry.localPath,
      cloudPath: entry.cloudPath,
      fileID: result.fileID,
      requestId: result.requestId || '',
      size: entry.size,
    });
    console.log(`Uploaded ${entry.localPath} -> ${result.fileID}`);
  }

  return uploaded;
}

async function writeManifest(manifest) {
  await fsp.mkdir(path.dirname(CLOUD_MANIFEST_PATH), { recursive: true });
  const tempPath = `${CLOUD_MANIFEST_PATH}.tmp`;
  await fsp.writeFile(tempPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await fsp.rename(tempPath, CLOUD_MANIFEST_PATH);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const entries = await buildUploadEntries();

  if (options.dryRun) {
    console.log(`Dry run: ${entries.length} score asset files will be uploaded to env ${options.envId}.`);
    entries.forEach((entry) => {
      console.log(`${entry.localPath} -> ${entry.cloudPath}`);
    });
    return;
  }

  const files = await uploadEntries(entries, options.envId);
  await writeManifest({
    envId: options.envId,
    version: CLOUD_ASSET_VERSION,
    generatedAt: new Date().toISOString(),
    assetRoot: toLocalManifestPath(SCORE_IMAGE_ROOT),
    files,
  });

  console.log(`Wrote ${files.length} uploaded score assets to ${toLocalManifestPath(CLOUD_MANIFEST_PATH)}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
