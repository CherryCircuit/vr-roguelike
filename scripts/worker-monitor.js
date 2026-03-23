#!/usr/bin/env node
// ============================================================
//  WORKER MONITOR - Quick zombie detection
// ============================================================

const { execSync } = require('child_process');
const path = require('path');
const REPO_ROOT = path.resolve(__dirname, '..');

console.log('\n🐵 WORKER MONITOR - Quick health check\n');

try {
  // Check git status
  const gitStatus = execSync('git status --short', { encoding: 'utf8', cwd: REPO_ROOT });
  console.log('📝 GIT STATUS:');
  console.log('  ' + gitStatus.trim() + '\n');

  // Show last 5 commits
  const gitLog = execSync('git log --oneline -5', { encoding: 'utf8', cwd: REPO_ROOT });
  console.log('📜 RECENT COMMITS:');
  const lines = gitLog.trim().split('\n');
  lines.forEach(line => console.log('  ' + line + '\n'));

  // Simple zombie check based on git history
  const lastCommitTime = execSync('git log -1 --format=%ct', { encoding: 'utf8', cwd: REPO_ROOT });
  const lastCommitSeconds = parseInt(lastCommitTime.trim());
  const now = Math.floor(Date.now() / 1000);
  const minutesSinceCommit = (now - lastCommitSeconds) / 60;

  if (minutesSinceCommit > 120) { // 2 hours since last commit
    console.log('\n⚠️  WARNING: No commits in ' + minutesSinceCommit + ' minutes');
    console.log('  Possible zombie worker or manual work in progress\n');
    console.log('  Check: openclaw subagents list');
    console.log('  Kill if needed: openclaw subagents kill <runId>\n');
  } else {
    console.log('\n✅ Recent activity detected - workers likely healthy\n');
  }

} catch (error) {
  console.log('❌ Error: ' + error.message);
  process.exit(1);
}
