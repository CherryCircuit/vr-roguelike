# Scoreboard Setup - Quick Start

## TL;DR - Fix the Scoreboard in 3 Steps

### Step 1: Test Current Setup
1. Open the game in your browser
2. Open developer console (F12)
3. Run: `window.testSupabaseConnection()`
4. Note which tests fail (read/write/both)

### Step 2: Configure Supabase
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Open SQL Editor
4. Copy-paste this:

```sql
-- Create the scores table
CREATE TABLE IF NOT EXISTS scores (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  level_reached INTEGER NOT NULL,
  country TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read scores
CREATE POLICY "Allow anonymous read access"
ON scores FOR SELECT
TO anon, authenticated
USING (true);

-- Allow anyone to submit scores
CREATE POLICY "Allow anonymous insert access"
ON scores FOR INSERT
TO anon, authenticated
WITH CHECK (true);
```

### Step 3: Verify It Works
1. Refresh the game
2. Run: `window.testSupabaseConnection()`
3. All tests should show ✅
4. Play a game and submit a score
5. Check the leaderboard - your score should appear!

## What Was Done

### Documentation Created
1. **SUPABASE_SETUP.md** - Detailed step-by-step guide with:
   - Table structure
   - RLS policy requirements
   - Dashboard instructions
   - SQL commands
   - Testing procedures
   - Troubleshooting tips

2. **SCOREBOARD_TROUBLESHOOTING.md** - Quick reference for:
   - Common errors and fixes
   - Diagnostic steps
   - Copy-paste solutions

3. **supabase-test.js** - Automated test script for:
   - Connection testing
   - Read/write verification
   - Table structure validation

### Code Changes
- Added `testConnection()` function to scoreboard.js
- Exposed as `window.testSupabaseConnection()` for easy testing
- Comprehensive error reporting

## Current Status

### What's Working
✅ Supabase client initialized
✅ Code structure is correct
✅ Profanity filter implemented
✅ Country data configured
✅ Local storage helpers ready

### What Needs Configuration
⚠️ Scores table must exist in Supabase
⚠️ RLS policies must allow anon read/write
⚠️ Indexes should be created for performance

## Testing Instructions

### For Developers
1. Open browser console on game page
2. Run: `window.testSupabaseConnection()`
3. Check which tests pass/fail
4. Follow SUPABASE_SETUP.md to fix issues
5. Test again until all pass

### For QA
1. Play through a level
2. When game ends, enter your name
3. Submit score
4. Verify it appears on leaderboard
5. Try in VR headset as well

### For Production
1. Complete Supabase setup (one-time)
2. Run diagnostic test
3. Test score submission
4. Verify leaderboard updates
5. Monitor for errors in Supabase logs

## Security Considerations

### Current Implementation
- **Anonymous access**: Anyone can submit scores
- **Client-side validation**: Profanity filter only
- **No rate limiting**: Potential for spam

### Recommendations for Future
1. **Add rate limiting** - Limit submissions per IP/hour
2. **Server-side validation** - Move profanity filter to database
3. **Score verification** - Detect impossible scores
4. **Optional auth** - Require login for top 100

## Files Modified

- `scoreboard.js` - Added diagnostic function
- `SUPABASE_SETUP.md` - Created setup guide
- `SCOREBOARD_TROUBLESHOOTING.md` - Created troubleshooting guide
- `supabase-test.js` - Created test script
- `SCOREBOARD_README.md` - This file

## Next Steps

1. **Test in browser** - Run diagnostic function
2. **Configure Supabase** - Run SQL commands
3. **Verify** - Test score submission
4. **Document** - Note any issues found
5. **Deploy** - Works in VR headset

## Questions?

- **Setup issues**: See SUPABASE_SETUP.md
- **Errors**: See SCOREBOARD_TROUBLESHOOTING.md
- **Testing**: Run `window.testSupabaseConnection()`
- **Logs**: Check Supabase Dashboard > Logs > Postgres
