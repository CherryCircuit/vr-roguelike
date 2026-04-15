import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function isValidKillerType(type) {
  return typeof type === 'string' && ['enemy', 'boss', 'boss_projectile', 'explosion', 'environment'].includes(type);
}

function sanitize(str) {
  return typeof str === 'string' ? str.slice(0, 50) : '';
}

export default async function handler(req, res) {
  // POST: Record a death
  if (req.method === 'POST') {
    try {
      const { killerType, killerName, killerEnemyType, levelReached } = req.body ?? {};

      if (!isValidKillerType(killerType)) {
        return res.status(400).json({ error: 'Invalid killerType' });
      }

      const { error } = await supabase
        .from('death_stats')
        .insert([{
          killer_type: killerType,
          killer_name: sanitize(killerName || 'Unknown'),
          killer_enemy_type: sanitize(killerEnemyType || ''),
          level_reached: Number.isInteger(levelReached) && levelReached >= 0 ? levelReached : 0,
        }]);

      if (error) {
        console.error('[death-stats] Insert error:', error);
        return res.status(500).json({ error: 'Insert failed' });
      }

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('[death-stats] Server error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // GET: Fetch death count by enemy type (for "Don't feel bad" message)
  if (req.method === 'GET') {
    try {
      const { enemyType } = req.query;

      if (!enemyType || typeof enemyType !== 'string') {
        return res.status(400).json({ error: 'Missing enemyType query param' });
      }

      const { count, error } = await supabase
        .from('death_stats')
        .select('*', { count: 'exact', head: true })
        .eq('killer_enemy_type', enemyType);

      if (error) {
        console.error('[death-stats] Count error:', error);
        return res.status(500).json({ error: 'Count failed' });
      }

      return res.status(200).json({ enemyType, count: count || 0 });
    } catch (err) {
      console.error('[death-stats] Server error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
