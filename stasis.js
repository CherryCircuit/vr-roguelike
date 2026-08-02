// ============================================================
//  STASIS FIELD UTILITY
//  Shared module for stasis field effects
// ============================================================

// Active stasis fields (managed by main.js, accessed by other modules)
let activeStasisFields = [];

// Set the active stasis fields array reference
export function setActiveStasisFields(fields) {
  activeStasisFields = fields;
}

// Get slow factor for a position (1.0 = no slow, 0.2 = 80% slower)
// Perf: called per enemy + per projectile per frame — early-out when no
// fields exist and use distanceToSquared to skip sqrt
export function getStasisSlowFactor(position) {
  if (activeStasisFields.length === 0) return 1.0; // No slow effect
  for (const field of activeStasisFields) {
    const distSq = position.distanceToSquared(field.position);
    if (distSq < field.radius * field.radius) {
      return field.slowFactor;
    }
  }
  return 1.0; // No slow effect
}
