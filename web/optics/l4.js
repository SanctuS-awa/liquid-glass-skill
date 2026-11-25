"use strict";
// All glass shapes use one continuous material, with no component-specific presets.
window.L4Material = (() => {
  const cap = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const mix = (a, b, t) => a + (b-a)*t;
  const smooth = x => { const t=cap(x,0,1); return t*t*(3-2*t); };
  function resolve(shape, frame) {
    const s = Math.min(shape.width, shape.height);
    const legacy = Boolean(frame.legacyL4);
    const previous = Boolean(frame.previousL4);
    if (legacy || previous) {
      const base = legacy ? cap(1.65+s*.006,2.35,3.7) : 2.55 + 2.45*s/(s+115);
      return {fine:base,wide:base*(legacy?2.5:2.76),halo:legacy?cap(s*.061,9,21):9+13*s/(s+148),
        wideMix:frame.wideMix ?? (legacy?.43:.48),edgeWide:legacy?.56:.52,
        edgeSoft:legacy?.66:.62,faceSoft:legacy?.93:.98,glow:legacy?1.03:1.24};
    }
    const size = s/(s+114);
    const fine = 1.28 + 1.10*size;
    return {
      fine, wide:fine*2.55, halo:8+13*s/(s+152),
      wideMix:frame.wideMix ?? (.21+.08*size), edgeWide:.65,
      edgeSoft:.72, faceSoft:.94, glow:.58,
    };
  }
  function energy(peak, legacy, previous = false) {
    return legacy ? peak ** 1.4 : peak * smooth(previous ? (peak-.055)/.525 : (peak-.035)/.252);
  }
  function glow(blurredLight, raw, fine, wide, power, gain, legacy, previous = false) {
    if (legacy) return Math.max(0,blurredLight-raw*power*.74)*gain;
    const lifted = Math.max(0, blurredLight - raw*power);
    if (previous) return lifted * smooth((lifted-.00065)/.0032) *
      (1-.52*smooth(Math.abs(fine-wide)/.080))*gain;
    // Suppress the barely visible lower tail continuously and preserve bright shape edges.
    return lifted * smooth((lifted-.00025)/.00200)*gain;
  }
  return {resolve, energy, glow, mix};
})();
