const DEFAULT_OPTIONS = {
  threshold: 0.12,
  minFrequency: 160,
  maxFrequency: 3000,
  minRms: 0.01,
};

function calculateRms(buffer) {
  if (!buffer || buffer.length === 0) {
    return 0;
  }

  let sum = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}

function normalizeInput(input) {
  if (!input || input.length === 0) {
    return new Float32Array(0);
  }
  if (input instanceof Float32Array) {
    return input;
  }
  return Float32Array.from(input);
}

function removeDcAndHighPass(buffer) {
  const len = buffer.length;
  if (len < 2) {
    return buffer;
  }
  let sum = 0;
  for (let i = 0; i < len; i += 1) {
    sum += buffer[i];
  }
  const dc = sum / len;
  const out = new Float32Array(len);
  out[0] = buffer[0] - dc;
  for (let i = 1; i < len; i += 1) {
    out[i] = buffer[i] - buffer[i - 1] - dc;
  }
  return out;
}

function parabolicInterpolation(values, tau) {
  const left = values[tau - 1];
  const center = values[tau];
  const right = values[tau + 1];

  if (left === undefined || right === undefined) {
    return tau;
  }

  const divisor = left + right - 2 * center;
  if (Math.abs(divisor) < 1e-12) {
    return tau;
  }

  return tau + (left - right) / (2 * divisor);
}

function detectPitchYin(inputBuffer, sampleRate, options = {}) {
  const opts = Object.assign({}, DEFAULT_OPTIONS, options);
  const buffer = removeDcAndHighPass(normalizeInput(inputBuffer));

  if (!sampleRate || buffer.length < 32) {
    return { frequency: null, confidence: 0, rms: 0 };
  }

  const rms = calculateRms(buffer);
  if (rms < opts.minRms) {
    return { frequency: null, confidence: 0, rms };
  }

  const minTau = Math.max(2, Math.floor(sampleRate / opts.maxFrequency));
  const maxTau = Math.min(
    Math.floor(sampleRate / opts.minFrequency),
    Math.floor(buffer.length / 2) - 1
  );

  if (maxTau <= minTau) {
    return { frequency: null, confidence: 0, rms };
  }

  // Compute autocorrelation via cumulative sum-of-products, O(N * maxTau) but
  // with a tighter inner loop that avoids the subtraction+squaring per sample.
  // r[tau] = sum_{i=0}^{N-tau-1} x[i] * x[i+tau]
  // Then difference[tau] = energy[0] + energy[tau] - 2*r[tau]
  // where energy[tau] = sum_{i=0}^{N-tau-1} x[i]^2  (computed incrementally)
  const N = buffer.length;
  const energy = new Float32Array(maxTau + 1);
  const r = new Float32Array(maxTau + 1);

  // Pre-compute energy[0] = sum of all x[i]^2
  let e0 = 0;
  for (let i = 0; i < N; i += 1) {
    e0 += buffer[i] * buffer[i];
  }
  energy[0] = e0;

  // Compute r[tau] and energy[tau] incrementally
  for (let tau = 1; tau <= maxTau; tau += 1) {
    let sum = 0;
    const limit = N - tau;
    for (let i = 0; i < limit; i += 1) {
      sum += buffer[i] * buffer[i + tau];
    }
    r[tau] = sum;
    energy[tau] = energy[tau - 1] - buffer[tau - 1] * buffer[tau - 1];
  }

  const difference = new Float32Array(maxTau + 1);
  difference[0] = 0;
  for (let tau = 1; tau <= maxTau; tau += 1) {
    difference[tau] = energy[0] + energy[tau] - 2 * r[tau];
  }

  const cmnd = new Float32Array(maxTau + 1);
  cmnd[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau <= maxTau; tau += 1) {
    runningSum += difference[tau];
    cmnd[tau] = runningSum === 0 ? 1 : (difference[tau] * tau) / runningSum;
  }

  let tauEstimate = -1;
  for (let tau = minTau; tau <= maxTau; tau += 1) {
    if (cmnd[tau] < opts.threshold) {
      while (tau + 1 <= maxTau && cmnd[tau + 1] < cmnd[tau]) {
        tau += 1;
      }
      tauEstimate = tau;
      break;
    }
  }

  if (tauEstimate === -1) {
    let bestTau = minTau;
    for (let tau = minTau + 1; tau <= maxTau; tau += 1) {
      if (cmnd[tau] < cmnd[bestTau]) {
        bestTau = tau;
      }
    }
    tauEstimate = cmnd[bestTau] < 0.35 ? bestTau : -1;
  }

  if (tauEstimate === -1) {
    return { frequency: null, confidence: 0, rms };
  }

  const refinedTau = parabolicInterpolation(cmnd, tauEstimate);
  const frequency = sampleRate / refinedTau;

  if (frequency < opts.minFrequency || frequency > opts.maxFrequency) {
    return { frequency: null, confidence: 0, rms };
  }

  const confidence = Math.max(0, Math.min(1, 1 - cmnd[tauEstimate]));
  return { frequency, confidence, rms };
}

module.exports = {
  detectPitchYin,
  calculateRms,
};
