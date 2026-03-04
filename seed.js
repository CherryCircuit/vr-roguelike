// ============================================================
//  SEED DECK - Run Variety System
//  Deterministic seeded random for reproducible runs
// ============================================================

// ── Seeded Random Number Generator (LCG) ─────────────────
class SeededRandom {
  constructor(seed) {
    this.seed = seed;
    // LCG constants from Numerical Recipes (good enough for games)
    this.m = 2147483647;  // 2^31 - 1
    this.a = 16807;
    this.c = 0;
  }

  // Get next random float in [0, 1)
  next() {
    this.seed = (this.a * this.seed + this.c) % this.m;
    return (this.seed - 1) / this.m;
  }

  // Get next random integer in [0, max)
  nextInt(max) {
    return Math.floor(this.next() * max);
  }

  // Get next random integer in [min, max]
  nextRange(min, max) {
    return min + this.nextInt(max - min + 1);
  }

  // Shuffle an array in-place using this RNG
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.nextInt(i + 1);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}

// ── Seed Deck - Main class for run variety ───────────────
class SeedDeck {
  constructor(seed, tier = 'standard') {
    this.seed = seed;
    this.rng = new SeededRandom(seed);
    this.tier = tier;
    
    // Initialize decks with shuffled content
    this.deck = {
      biomes: [],
      enemies: [],
      weapons: [],
    };
    
    // Discard piles for reshuffling
    this.discards = {
      biomes: [],
      enemies: [],
      weapons: [],
    };
    
    this.initializeDecks();
  }

  // Initialize all decks with shuffled content
  initializeDecks() {
    // Shuffle biomes
    this.deck.biomes = this.rng.shuffle([...this.getAllBiomes()]);
    
    // Shuffle enemies
    this.deck.enemies = this.rng.shuffle([...this.getAllEnemies()]);
    
    // Shuffle weapons (main + alt combined)
    this.deck.weapons = this.rng.shuffle([...this.getAllWeapons()]);
  }

  // Draw items from a deck
  draw(type, count = 1) {
    const results = [];
    for (let i = 0; i < count; i++) {
      if (this.deck[type].length === 0) {
        // Reshuffle discards back into deck
        this.reshuffle(type);
      }
      if (this.deck[type].length > 0) {
        results.push(this.deck[type].shift());
      }
    }
    return results;
  }

  // Reshuffle discards back into a deck
  reshuffle(type) {
    if (this.discards[type].length > 0) {
      this.deck[type] = this.rng.shuffle([...this.discards[type]]);
      this.discards[type] = [];
    }
  }

  // Return items to discard pile
  discard(type, items) {
    this.discards[type].push(...items);
  }

  // Get all available biomes
  getAllBiomes() {
    return [
      'sunrise_highway',
      'vapor_sunset',
      'ocean_floor',
      'synthwave',
      'hellscape',
      'circuit_board',
      'frozen',
      'corruption',
      'the_stack',
      'digital_rain',
      'retro_arcade',
      'void_garden',
      'neon_rainforest',
      'kaleidoscope',
    ];
  }

  // Get all available enemies
  getAllEnemies() {
    return [
      // Basic enemies
      'basic',
      'fast',
      'tank',
      'swarm',
      
      // Advanced enemies (v2.0)
      'spiral_swimmer',
      'geometry_shifter',
      'pulse_bomber',
      'clone_mimic',
      'spider_walker',
      
      // Elite enemies (v3.0)
      'mirror_knight',
      'portal_mantis',
      'blackhole_totem',
      'phoenix_husk',
      'void_walker',
    ];
  }

  // Get all available weapons (main + alt)
  getAllWeapons() {
    return [
      // Main weapons
      'standard_blaster',
      'buckshot',
      'lightning_rod',
      'charge_cannon',
      'plasma_carbine',
      'seeker_burst',
      
      // Alt weapons
      'shield',
      'laser_mine',
      'stasis_field',
      'phase_dash',
      'plasma_orb',
      'black_hole',
      'proximity_mine',
      'tether_harpoon',
      'nanite_swarm',
      'reflector_drone',
    ];
  }

  // Get tier-based difficulty modifiers
  getDifficultyModifiers() {
    switch (this.tier) {
      case 'chill':
        return {
          hpMultiplier: 0.7,
          speedMultiplier: 0.8,
          spawnRateMultiplier: 0.7,
          damageMultiplier: 0.8,
        };
      case 'standard':
        return {
          hpMultiplier: 1.0,
          speedMultiplier: 1.0,
          spawnRateMultiplier: 1.0,
          damageMultiplier: 1.0,
        };
      case 'challenge':
        return {
          hpMultiplier: 1.4,
          speedMultiplier: 1.3,
          spawnRateMultiplier: 1.2,
          damageMultiplier: 1.3,
        };
      default:
        return this.getDifficultyModifiers('standard');
    }
  }
}

// ── Helper Functions ───────────────────────────────────────

// Generate a daily seed (same for everyone on the same day)
export function getDailySeed() {
  return Math.floor(Date.now() / 86400000);
}

// Generate a weekly seed (same for everyone in the same week)
export function getWeeklySeed() {
  return Math.floor(Date.now() / 604800000);
}

// Generate a random seed
export function getRandomSeed() {
  return Date.now();
}

// Parse seed from string (supports numbers and strings)
export function parseSeed(input) {
  if (typeof input === 'number') return input;
  
  // Hash string to number
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

export { SeedDeck, SeededRandom };
