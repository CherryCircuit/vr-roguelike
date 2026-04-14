// ============================================================
//  LAUNCHER COMMON
//  Shared page bootstrap for both live and dev launchers.
// ============================================================

const GAME_VERSION = 'v2026.04.14.1022';

function updateVersionText() {
  document.title = GAME_VERSION;
  const versionEl = document.getElementById('version-text');
  if (versionEl) versionEl.textContent = GAME_VERSION;
}

function installGlobalErrorOverlay() {
  window.showWebError = function showWebError(message, stack = '') {
    const overlay = document.getElementById('error-overlay');
    const msgEl = document.getElementById('error-message');
    const stackEl = document.getElementById('error-stack');
    if (!overlay || !msgEl || !stackEl) return;
    msgEl.textContent = message || 'Unknown error';
    stackEl.textContent = stack || 'No stack trace available';
    overlay.style.display = 'block';
    console.error('[GAME ERROR]', message, stack);
  };

  window.addEventListener('error', function onWindowError(e) {
    if (e.message && e.message.includes('Pointer lock')) return;
    const where = `${e.filename || 'unknown'}:${e.lineno || 0}:${e.colno || 0}`;
    window.showWebError(`${e.message} @ ${where}`, e.error?.stack || e.stack || '');
  });

  window.addEventListener('unhandledrejection', function onUnhandledRejection(e) {
    const reason = String(e.reason || '');
    if (reason.includes('Pointer lock') || reason.includes('SecurityError')) {
      console.debug('[game] Suppressed pointer lock error');
      return;
    }
    window.showWebError('Unhandled Promise Rejection: ' + e.reason, e.reason?.stack || '');
  });
}

updateVersionText();
installGlobalErrorOverlay();
