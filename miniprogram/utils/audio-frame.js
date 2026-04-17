function int16PcmToFloat32(arrayBuffer) {
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    return new Float32Array(0);
  }

  const view = new DataView(arrayBuffer);
  const length = Math.floor(arrayBuffer.byteLength / 2);
  const output = new Float32Array(length);

  for (let i = 0; i < length; i += 1) {
    const sample = view.getInt16(i * 2, true);
    output[i] = sample / 32768;
  }

  return output;
}

function mergeFloat32Chunks(chunks, maxSamples) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const targetLength = Math.min(totalLength, maxSamples || totalLength);
  const output = new Float32Array(targetLength);

  let offset = targetLength;
  for (let i = chunks.length - 1; i >= 0 && offset > 0; i -= 1) {
    const chunk = chunks[i];
    const copyLength = Math.min(chunk.length, offset);
    offset -= copyLength;
    output.set(chunk.subarray(chunk.length - copyLength), offset);
  }

  return output;
}

function copyArrayBuffer(arrayBuffer) {
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    return new ArrayBuffer(0);
  }

  if (typeof arrayBuffer.slice === 'function') {
    return arrayBuffer.slice(0);
  }

  const source = new Uint8Array(arrayBuffer);
  const output = new Uint8Array(source.byteLength);
  output.set(source);
  return output.buffer;
}

function concatArrayBuffers(buffers) {
  const validBuffers = (buffers || []).filter((buffer) => buffer && buffer.byteLength);
  const totalLength = validBuffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);
  const output = new Uint8Array(totalLength);

  let offset = 0;
  validBuffers.forEach((buffer) => {
    const chunk = new Uint8Array(buffer);
    output.set(chunk, offset);
    offset += chunk.byteLength;
  });

  return output.buffer;
}

function writeAscii(view, offset, text) {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

function createWavFileBuffer(pcmBuffer, sampleRate, channels, bitsPerSample) {
  const pcmBytes = pcmBuffer ? new Uint8Array(pcmBuffer) : new Uint8Array(0);
  const headerBytes = 44;
  const wavBuffer = new ArrayBuffer(headerBytes + pcmBytes.byteLength);
  const view = new DataView(wavBuffer);
  const outputBytes = new Uint8Array(wavBuffer);
  const blockAlign = channels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcmBytes.byteLength, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, pcmBytes.byteLength, true);
  outputBytes.set(pcmBytes, headerBytes);

  return wavBuffer;
}

module.exports = {
  concatArrayBuffers,
  copyArrayBuffer,
  createWavFileBuffer,
  int16PcmToFloat32,
  mergeFloat32Chunks,
};
