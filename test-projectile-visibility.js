// Test script to verify projectile visibility fixes + bloom glow
// Run: node test-projectile-visibility.js

const fs = require('fs');

console.log('=== Projectile Bloom Glow Verification ===\n');

const mainJs = fs.readFileSync('main.js', 'utf-8');

// Check 1: renderOrder set on projectile meshes (core=950, glow=951, halo=952)
const renderOrderChecks = [
  { name: 'laser core', pattern: /laserIM\.renderOrder\s*=\s*950/ },
  { name: 'glow layer', pattern: /renderOrder\s*=\s*951/ },
  { name: 'halo layer', pattern: /renderOrder\s*=\s*952/ },
  { name: 'buckshot core', pattern: /buckIM\.renderOrder\s*=\s*950/ },
  { name: 'seeker core', pattern: /seekerIM\.renderOrder\s*=\s*950/ },
  { name: 'plasma core', pattern: /plasmaIM\.renderOrder\s*=\s*950/ },
];

console.log('1. Checking renderOrder assignments:');
renderOrderChecks.forEach(check => {
  const found = check.pattern.test(mainJs);
  console.log(`  ${found ? 'PASS' : 'FAIL'} ${check.name}`);
});

// Check 2: DoubleSide for glow visibility
const doubleSideCheck = /side:\s*THREE\.DoubleSide/.test(mainJs);
console.log(`\n2. DoubleSide for all-angle visibility: ${doubleSideCheck ? 'PASS' : 'FAIL'}`);

// Check 3: Bloom glow constants
const glowConstants = {
  'PROJECTILE_GLOW.falloff': /falloff:\s*0\.15/.test(mainJs),
  'PROJECTILE_GLOW.opacity': /opacity:\s*0\.95/.test(mainJs),
  'PROJECTILE_HALO.opacity': /HALO.*opacity:\s*0\.55/s.test(mainJs),
};

console.log('\n3. Checking bloom glow constants:');
Object.entries(glowConstants).forEach(([key, found]) => {
  console.log(`  ${found ? 'PASS' : 'FAIL'} ${key}`);
});

// Check 4: Gaussian bloom shader
const gaussianCheck = /exp\(-dist\s*\*\s*dist\s*\*\s*3\.0\)/.test(mainJs);
console.log(`\n4. Gaussian bloom falloff in shader: ${gaussianCheck ? 'PASS' : 'FAIL'}`);

// Check 5: Triple-layer architecture
const hasHaloMesh = /haloMesh:/.test(mainJs);
const hasCreateHalo = /createProjectileHaloMaterial/.test(mainJs);
const hasHaloShader = /HALO_FRAGMENT_SHADER/.test(mainJs);
console.log(`\n5. Triple-layer bloom architecture:`);
console.log(`  ${hasHaloMesh ? 'PASS' : 'FAIL'} haloMesh in pool objects`);
console.log(`  ${hasCreateHalo ? 'PASS' : 'FAIL'} createProjectileHaloMaterial function`);
console.log(`  ${hasHaloShader ? 'PASS' : 'FAIL'} HALO_FRAGMENT_SHADER defined`);

// Check 6: Halo sync in commitProjectileInstance
const haloSync = /pool\.haloMesh/.test(mainJs);
console.log(`\n6. Halo mesh synced in commitProjectileInstance: ${haloSync ? 'PASS' : 'FAIL'}`);

// Check 7: Additive blending on all glow layers
const additiveCount = (mainJs.match(/THREE\.AdditiveBlending/g) || []).length;
console.log(`\n7. AdditiveBlending usage count: ${additiveCount} (expect >= 3)`);

console.log('\n=== Manual Testing Required ===');
console.log('1. Start game: python3 -m http.server 8000');
console.log('2. Open browser: http://localhost:8000');
console.log('3. Fire each weapon type (laser, buckshot, seeker, plasma)');
console.log('4. Verify:');
console.log('   - Bloom-like glow halo around projectiles');
console.log('   - Visible against all backgrounds');
console.log('   - Glow visible from all angles');
console.log('   - Outer halo creates bloom-spread effect');
console.log('   - No depth fighting with scene geometry');
console.log('\n=== Verification Complete ===');
