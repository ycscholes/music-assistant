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

// P5: Ring buffer for efficient sliding-window audio access.
// Replaces the pattern of pushing chunks into an array and merging each time.
function createRingBuffer(capacity) {
  const buffer = new Float32Array(capacity);
  let writePos = 0;
  let count = 0;

  function append(chunk) {
    if (!chunk || !chunk.length) {
      return;
    }
    for (let i = 0; i < chunk.length; i += 1) {
      buffer[writePos] = chunk[i];
      writePos = (writePos + 1) % capacity;
    }
    count = Math.min(count + chunk.length, capacity);
  }

  function getCapacity() {
    return capacity;
  }

  function getRecent(numSamples) {
    const len = Math.min(numSamples, count);
    const output = new Float32Array(len);
    if (len === 0) {
      return output;
    }
    // The most recent sample is at (writePos - 1 + capacity) % capacity.
    // We want the last `len` samples in chronological order.
    const start = (writePos - len + capacity) % capacity;
    if (start + len <= capacity) {
      output.set(buffer.subarray(start, start + len));
    } else {
      const firstPart = capacity - start;
      output.set(buffer.subarray(start, capacity), 0);
      output.set(buffer.subarray(0, len - firstPart), firstPart);
    }
    return output;
  }

  function length() {
    return count;
  }

  function clear() {
    writePos = 0;
    count = 0;
  }

  return { append, getRecent, length, clear };
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
  createRingBuffer,
  createWavFileBuffer,
  int16PcmToFloat32,
  mergeFloat32Chunks,
};
