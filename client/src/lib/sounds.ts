// Tiny synthesized UI sounds via Web Audio — no audio assets to ship.
let ctx: AudioContext | undefined;

const NOTES: Record<string, [number, number][]> = {
  message: [[660, 0], [880, 0.07]],
  mention: [[880, 0], [1175, 0.08], [1320, 0.16]],
  send: [[520, 0]],
  friend: [[523, 0], [659, 0.08], [784, 0.16]],
  level: [[523, 0], [659, 0.1], [784, 0.2], [1047, 0.3]],
  join: [[392, 0], [587, 0.1]],
  leave: [[587, 0], [392, 0.1]],
};

export function playSound(kind: keyof typeof NOTES) {
  try {
    ctx ??= new AudioContext();
    const t0 = ctx.currentTime;
    for (const [freq, at] of NOTES[kind]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + at);
      gain.gain.exponentialRampToValueAtTime(0.08, t0 + at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + at);
      osc.stop(t0 + at + 0.2);
    }
  } catch {
    /* autoplay blocked — ignore */
  }
}
