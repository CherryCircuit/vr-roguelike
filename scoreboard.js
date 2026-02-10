// ============================================================
//  SCOREBOARD — Supabase backend, profanity filter, country data
// ============================================================

import { createClient } from '@supabase/supabase-js';

// ── Supabase client ─────────────────────────────────────────
const SUPABASE_URL = 'https://yqmbizcfjfibqbpwaiun.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxbWJpemNmamZpYnFicHdhaXVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg5NzEyNTcsImV4cCI6MjA1NDU0NzI1N30.JpTSPMEMcSKMfJfpGEiPJGaaS4JTT_cEhP0RnsJf1tY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('[scoreboard] Supabase client initialized:', !!supabase);

// ── Score CRUD ──────────────────────────────────────────────

export async function submitScore(name, score, levelReached, country) {
  console.log(`[scoreboard] Submitting score for ${name}: ${score} (Level ${levelReached}, Country: ${country})`);
  const { data, error } = await supabase
    .from('scores')
    .insert([{ name, score, level_reached: levelReached, country }])
    .select();

  if (error) {
    console.error('[scoreboard] Submit error:', error.message, error.details, error.hint);
    return null;
  }
  console.log('[scoreboard] Submit successful:', data);
  return data;
}

export async function fetchTopScores(limit = 100) {
  console.log('[scoreboard] Fetching top scores...');
  const { data, error } = await supabase
    .from('scores')
    .select('name, score, level_reached, country, created_at')
    .order('score', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[scoreboard] Fetch error:', error.message, error.details, error.hint);
    return [];
  }
  console.log(`[scoreboard] Fetch successful: ${data ? data.length : 0} scores found`);
  return data || [];
}

export async function fetchScoresByCountry(country, limit = 100) {
  const { data, error } = await supabase
    .from('scores')
    .select('name, score, level_reached, country, created_at')
    .eq('country', country)
    .order('score', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[scoreboard] Fetch by country error:', error.message);
    return [];
  }
  return data || [];
}

export async function fetchScoresByContinent(continent, limit = 100) {
  const countryCodes = COUNTRIES
    .filter(c => c.continent === continent)
    .map(c => c.code);
  if (countryCodes.length === 0) return [];

  const { data, error } = await supabase
    .from('scores')
    .select('name, score, level_reached, country, created_at')
    .in('country', countryCodes)
    .order('score', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[scoreboard] Fetch by continent error:', error.message);
    return [];
  }
  return data || [];
}

// ── Profanity Filter ────────────────────────────────────────

const BLOCKED_WORDS = [
  'fuck', 'shit', 'ass', 'dick', 'cock', 'cunt', 'bitch', 'damn',
  'piss', 'tits', 'slut', 'whore', 'fag', 'nigger', 'nigga', 'kike',
  'spic', 'chink', 'gook', 'twat', 'wank', 'porn', 'rape', 'nazi',
  'penis', 'vagina',
];

const LEET_MAP = { '1': 'i', '3': 'e', '0': 'o', '4': 'a', '5': 's', '7': 't', '@': 'a' };

function deLeet(str) {
  return str.split('').map(c => LEET_MAP[c] || c).join('');
}

export function isNameClean(name) {
  const normalized = deLeet(name.toLowerCase().trim());
  for (const word of BLOCKED_WORDS) {
    if (normalized.includes(word)) return false;
  }
  return true;
}

// ── Country Data ────────────────────────────────────────────

function flagEmoji(code) {
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}

export const CONTINENTS = [
  'North America', 'South America', 'Europe', 'Asia', 'Africa', 'Oceania',
];

export const COUNTRIES = [
  // North America
  { code: 'US', name: 'United States', continent: 'North America' },
  { code: 'CA', name: 'Canada', continent: 'North America' },
  { code: 'MX', name: 'Mexico', continent: 'North America' },

  // South America
  { code: 'BR', name: 'Brazil', continent: 'South America' },
  { code: 'AR', name: 'Argentina', continent: 'South America' },
  { code: 'CL', name: 'Chile', continent: 'South America' },
  { code: 'CO', name: 'Colombia', continent: 'South America' },

  // Europe
  { code: 'GB', name: 'United Kingdom', continent: 'Europe' },
  { code: 'DE', name: 'Germany', continent: 'Europe' },
  { code: 'FR', name: 'France', continent: 'Europe' },
  { code: 'ES', name: 'Spain', continent: 'Europe' },
  { code: 'IT', name: 'Italy', continent: 'Europe' },
  { code: 'NL', name: 'Netherlands', continent: 'Europe' },
  { code: 'SE', name: 'Sweden', continent: 'Europe' },
  { code: 'NO', name: 'Norway', continent: 'Europe' },
  { code: 'FI', name: 'Finland', continent: 'Europe' },
  { code: 'PL', name: 'Poland', continent: 'Europe' },
  { code: 'PT', name: 'Portugal', continent: 'Europe' },
  { code: 'IE', name: 'Ireland', continent: 'Europe' },
  { code: 'CH', name: 'Switzerland', continent: 'Europe' },
  { code: 'AT', name: 'Austria', continent: 'Europe' },
  { code: 'DK', name: 'Denmark', continent: 'Europe' },
  { code: 'BE', name: 'Belgium', continent: 'Europe' },
  { code: 'CZ', name: 'Czech Republic', continent: 'Europe' },
  { code: 'RO', name: 'Romania', continent: 'Europe' },
  { code: 'UA', name: 'Ukraine', continent: 'Europe' },
  { code: 'RU', name: 'Russia', continent: 'Europe' },

  // Asia
  { code: 'JP', name: 'Japan', continent: 'Asia' },
  { code: 'KR', name: 'South Korea', continent: 'Asia' },
  { code: 'CN', name: 'China', continent: 'Asia' },
  { code: 'IN', name: 'India', continent: 'Asia' },
  { code: 'TW', name: 'Taiwan', continent: 'Asia' },
  { code: 'TH', name: 'Thailand', continent: 'Asia' },
  { code: 'PH', name: 'Philippines', continent: 'Asia' },
  { code: 'SG', name: 'Singapore', continent: 'Asia' },
  { code: 'MY', name: 'Malaysia', continent: 'Asia' },
  { code: 'ID', name: 'Indonesia', continent: 'Asia' },
  { code: 'IL', name: 'Israel', continent: 'Asia' },
  { code: 'TR', name: 'Turkey', continent: 'Asia' },
  { code: 'AE', name: 'UAE', continent: 'Asia' },
  { code: 'SA', name: 'Saudi Arabia', continent: 'Asia' },

  // Africa
  { code: 'ZA', name: 'South Africa', continent: 'Africa' },
  { code: 'NG', name: 'Nigeria', continent: 'Africa' },
  { code: 'EG', name: 'Egypt', continent: 'Africa' },
  { code: 'KE', name: 'Kenya', continent: 'Africa' },

  // Oceania
  { code: 'AU', name: 'Australia', continent: 'Oceania' },
  { code: 'NZ', name: 'New Zealand', continent: 'Oceania' },
].map(c => ({ ...c, flag: flagEmoji(c.code) }));

// ── localStorage helpers ────────────────────────────────────

export function getStoredCountry() {
  return localStorage.getItem('spaceomicide_country') || null;
}

export function setStoredCountry(code) {
  localStorage.setItem('spaceomicide_country', code);
}

export function getStoredName() {
  return localStorage.getItem('spaceomicide_name') || '';
}

export function setStoredName(name) {
  localStorage.setItem('spaceomicide_name', name);
}
