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
export function getStasisSlowFactor(position) {
  for (const field of activeStasisFields) {
    const dist = position.distanceTo(field.position);
    if (dist < field.radius) {
      return field.slowFactor;
    }
  }
  return 1.0; // No slow effect
}
