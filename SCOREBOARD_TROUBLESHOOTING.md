# Quick Troubleshooting Guide

## Scoreboard Not Working? Follow These Steps

### 1. Test the Connection
Open the game in your browser and run in the console:
```javascript
window.testSupabaseConnection()
```

This will tell you exactly what's wrong.

### 2. Common Issues

#### "Table does not exist"
**Fix**: Create the table in Supabase
- Go to SQL Editor in Supabase Dashboard
- Run the CREATE TABLE command from SUPABASE_SETUP.md

#### "Permission denied" (Read)
**Fix**: Add read policy
- Go to Authentication > Policies in Supabase Dashboard
- Create SELECT policy for `anon` role
- See SUPABASE_SETUP.md for exact policy

#### "Permission denied" (Write)
**Fix**: Add write policy
- Go to Authentication > Policies in Supabase Dashboard
- Create INSERT policy for `anon` role
- See SUPABASE_SETUP.md for exact policy

#### "Connection failed"
**Fix**: Check credentials
- Verify SUPABASE_URL in scoreboard.js
- Verify SUPABASE_ANON_KEY in scoreboard.js
- Check browser console for network errors

### 3. Still Not Working?

1. **Check Supabase Dashboard Logs**
   - Go to Logs > Postgres
   - Look for error messages

2. **Check Browser Console**
   - Open developer tools (F12)
   - Look for red error messages
   - Network tab shows API calls

3. **Verify RLS is Enabled**
   - Go to Authentication > Policies
   - Ensure RLS is ON for scores table
   - Ensure both policies exist

4. **Test in Supabase SQL Editor**
   ```sql
   -- Should return results
   SELECT * FROM scores LIMIT 5;

   -- Should succeed
   INSERT INTO scores (name, score, level_reached, country)
   VALUES ('TEST', 1000, 5, 'US');
   ```

### 4. Quick Setup (Copy-Paste)

Run this in Supabase SQL Editor:

```sql
-- Create table
CREATE TABLE IF NOT EXISTS scores (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  level_reached INTEGER NOT NULL,
  country TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- Allow reads
CREATE POLICY "Allow anonymous read access"
ON scores FOR SELECT
TO anon, authenticated
USING (true);

-- Allow writes
CREATE POLICY "Allow anonymous insert access"
ON scores FOR INSERT
TO anon, authenticated
WITH CHECK (true);
```

Then test: `window.testSupabaseConnection()`

### 5. Verification Checklist

- [ ] `window.testSupabaseConnection()` shows all ✅
- [ ] Can submit score after game over
- [ ] Score appears on leaderboard
- [ ] No errors in browser console
- [ ] Works in VR headset

## Need More Help?
See SUPABASE_SETUP.md for detailed instructions.
