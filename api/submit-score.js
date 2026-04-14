import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function isValidName(name) {
  return typeof name === 'string' && /^[A-Za-z ]{1,6}$/.test(name.trim());
}

function isValidCountry(country) {
  return country == null || /^[A-Z]{2}$/.test(country);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, score, levelReached, country } = req.body ?? {};

    if (!isValidName(name)) {
      return res.status(400).json({ error: 'Invalid name' });
    }

    if (!Number.isInteger(score) || score < 0) {
      return res.status(400).json({ error: 'Invalid score' });
    }

    if (!Number.isInteger(levelReached) || levelReached < 0) {
      return res.status(400).json({ error: 'Invalid levelReached' });
    }

    if (!isValidCountry(country)) {
      return res.status(400).json({ error: 'Invalid country' });
    }

    const { data, error } = await supabase
      .from('scores')
      .insert([{
        name: name.trim(),
        score,
        level_reached: levelReached,
        country: country || null,
      }])
      .select('name, score, level_reached, country, created_at');

    if (error) {
      console.error('[submit-score] Supabase error:', error);
      return res.status(500).json({ error: 'Database insert failed' });
    }

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error('[submit-score] Server error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
