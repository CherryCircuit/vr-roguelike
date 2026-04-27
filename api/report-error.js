import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MAX_FIELD_LENGTH = 2000;
const MAX_STACK_LENGTH = 8000;
const MAX_METADATA_LENGTH = 4000;

function truncate(str, max) {
  if (typeof str !== 'string') return '';
  return str.length > max ? str.slice(0, max) : str;
}

function sanitize(str) {
  if (typeof str !== 'string') return '';
  // Strip anything that looks like an HTML/script tag
  return str.replace(/<[^>]*>/g, '').slice(0, MAX_FIELD_LENGTH);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body ?? {};
    const {
      errorType,
      errorMessage,
      stackTrace,
      url,
      level,
      bossName,
      bossPhase,
      weapon,
      health,
      score,
      kills,
      fps,
      memory,
      rendererInfo,
      userAgent,
      timestamp,
      sessionPlaythrough,
    } = body;

    // Validate required fields
    if (!errorMessage || typeof errorMessage !== 'string') {
      return res.status(400).json({ error: 'errorMessage is required' });
    }

    const row = {
      error_type: sanitize(errorType || 'Error'),
      error_message: truncate(errorMessage, MAX_FIELD_LENGTH),
      stack_trace: truncate(stackTrace || '', MAX_STACK_LENGTH),
      url: sanitize(url || ''),
      level: Number.isInteger(level) && level >= 0 ? level : null,
      boss_name: sanitize(bossName || ''),
      boss_phase: Number.isInteger(bossPhase) && bossPhase >= 0 ? bossPhase : null,
      weapon: sanitize(weapon || ''),
      health: Number.isInteger(health) ? health : null,
      score: Number.isInteger(score) && score >= 0 ? score : null,
      kills: Number.isInteger(kills) && kills >= 0 ? kills : null,
      fps: typeof fps === 'number' ? Math.round(fps * 10) / 10 : null,
      memory_mb: typeof memory === 'number' ? Math.round(memory * 10) / 10 : null,
      renderer_info: truncate(JSON.stringify(rendererInfo), MAX_METADATA_LENGTH),
      user_agent: truncate(userAgent || (req.headers['user-agent'] || ''), 500),
      session_playthrough: Number.isInteger(sessionPlaythrough) && sessionPlaythrough >= 1 ? sessionPlaythrough : null,
    };

    // Parse timestamp if provided
    if (timestamp && typeof timestamp === 'string') {
      row.timestamp = timestamp;
    }

    const { error } = await supabase
      .from('crash_reports')
      .insert([row]);

    if (error) {
      console.error('[report-error] Supabase insert error:', error);
      return res.status(500).json({ error: 'Insert failed' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[report-error] Server error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
