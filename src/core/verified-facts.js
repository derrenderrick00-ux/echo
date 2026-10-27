export function verifiedFact(input) {
  const text = String(input).trim().replace(/^(?:hey[, ]+)?echo[,!: ]+/i, '').toLowerCase();
  if (/\bplanck'?s? constant\b|\bplank'?s? constant\b/.test(text)) {
    return 'Planck constant h = 6.62607015 × 10⁻³⁴ J·s (exact SI value). The speed of light in vacuum is c = 299,792,458 m/s, approximately 3.0 × 10⁸ m/s. They are different physical constants. E = hf.';
  }
  if (/^(?:is windows (?:a )?single[- ]user|windows is not single[- ]user|can windows (?:have|support) multiple users|is windows (?:a )?multi[- ]user)\??[.!]?$/i.test(text)) {
    return 'Modern Windows supports multiple user accounts, permissions, and sessions. Classifying all Windows editions as strictly single-user is misleading; simultaneous interactive-session support varies by edition and configuration.';
  }
  return null;
}
