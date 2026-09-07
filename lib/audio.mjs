// Input level from an AnalyserNode time-domain buffer.
// Bytes are centred on 128; RMS of the deviation is the loudness.

/**
 * @param {Uint8Array|number[]} buf getByteTimeDomainData output
 * @param {number} gain speech RMS sits near 0.05-0.25, so it needs lifting
 * @returns {number} 0..1
 */
export function levelFromWaveform(buf, gain = 4.5) {
  if (!buf || buf.length === 0) return 0;
  let sum = 0;
  for (const v of buf) {
    const d = (v - 128) / 128;
    sum += d * d;
  }
  const rms = Math.sqrt(sum / buf.length);
  return Math.min(1, Math.max(0, rms * gain));
}
