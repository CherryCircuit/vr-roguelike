#!/usr/bin/env node
// ============================================================
// LOCAL TEST SERVER
// Simple Express server for testing VR game
// ============================================================

const express = require('express');
const path = require('path');

const app = express();
const PORT = 8000;

// Serve static files from current directory
app.use(express.static(path.join(__dirname)));

// Add CORS headers to help with testing
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  next();
});

// Start server
app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`🚀 LOCAL TEST SERVER`);
  console.log(`========================================\n`);
  console.log(`Server running at: http://localhost:${PORT}`);
  console.log(`\n📋 TESTING CHECKLIST:\n`);
  console.log(`1. Open: http://localhost:${PORT}`);
  console.log(`2. Check console for errors (F12)`);
  console.log(`3. Click START to begin`);
  console.log(`4. Test: Walk around, shoot enemies`);
  console.log(`5. Test: Kill chains trigger`);
  console.log(`6. Test: Slow-mo death on last enemy`);
  console.log(`7. Test: Debug menu opens`);
  console.log(`8. Complete a full level`);
  console.log(`\n🎮 Press Ctrl+C to stop\n`);
  console.log(`========================================\n`);
});
