# Supabase Scoreboard Setup Guide

## Problem
The scoreboard is not saving scores. This is likely due to Row Level Security (RLS) policies blocking anonymous writes to the `scores` table.

## Current Configuration
- **Supabase URL**: `https://yqmbizcfjfibqbpwaiun.supabase.co`
- **Auth Mode**: Anonymous (anon key)
- **Table**: `scores`

## Required Table Structure

The `scores` table needs the following columns:

```sql
CREATE TABLE scores (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  level_reached INTEGER NOT NULL,
  country TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_scores_score ON scores(score DESC);
CREATE INDEX idx_scores_country ON scores(country);
CREATE INDEX idx_scores_created_at ON scores(created_at DESC);
```

## Required RLS Policies

### Step 1: Enable RLS on the scores table
```sql
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
```

### Step 2: Create policy for anonymous reads
```sql
CREATE POLICY "Allow anonymous read access"
ON scores
FOR SELECT
TO anon, authenticated
USING (true);
```

### Step 3: Create policy for anonymous writes
```sql
CREATE POLICY "Allow anonymous insert access"
ON scores
FOR INSERT
TO anon, authenticated
WITH CHECK (true);
```

### Step 4: (Optional) Prevent updates and deletes
```sql
-- No UPDATE policy = no updates allowed
-- No DELETE policy = no deletes allowed
-- This preserves score history
```

## Step-by-Step Setup in Supabase Dashboard

### 1. Access Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Log in to your account
3. Select your project: `yqmbizcfjfibqbpwaiun`

### 2. Create the scores table (if it doesn't exist)
1. Click **Table Editor** in the left sidebar
2. Click **Create a new table**
3. Enter table name: `scores`
4. Add columns:
   - `id` (uuid, primary key, default: `uuid_generate_v4()`)
   - `name` (text, not null)
   - `score` (integer, not null)
   - `level_reached` (integer, not null)
   - `country` (text, nullable)
   - `created_at` (timestamptz, default: `now()`)
5. Click **Save**

### 3. Enable Row Level Security
1. Click **Authentication** > **Policies** in the left sidebar
2. Find the `scores` table
3. Click **Enable RLS** if not already enabled

### 4. Create Read Policy
1. Click **Create Policy** on the `scores` table
2. Choose **Create policy from scratch**
3. Configure:
   - Policy name: `Allow anonymous read access`
   - Allowed operations: `SELECT`
   - Target roles: `anon`, `authenticated`
   - USING expression: `true`
4. Click **Save**

### 5. Create Write Policy
1. Click **Create Policy** again
2. Choose **Create policy from scratch**
3. Configure:
   - Policy name: `Allow anonymous insert access`
   - Allowed operations: `INSERT`
   - Target roles: `anon`, `authenticated`
   - WITH CHECK expression: `true`
4. Click **Save**

### 6. Verify Configuration
1. Go to **SQL Editor** in the left sidebar
2. Run this test query:
```sql
-- Test insert
INSERT INTO scores (name, score, level_reached, country)
VALUES ('TEST_PLAYER', 1000, 5, 'US');

-- Test read
SELECT * FROM scores WHERE name = 'TEST_PLAYER';

-- Clean up test
DELETE FROM scores WHERE name = 'TEST_PLAYER';
```

## Alternative: Quick SQL Setup

If you prefer, you can run all the SQL commands at once:

1. Go to **SQL Editor** in Supabase Dashboard
2. Paste and run:

```sql
-- Create table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS scores (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  level_reached INTEGER NOT NULL,
  country TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_scores_score ON scores(score DESC);
CREATE INDEX IF NOT EXISTS idx_scores_country ON scores(country);
CREATE INDEX IF NOT EXISTS idx_scores_created_at ON scores(created_at DESC);

-- Enable RLS
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- Create read policy (allows anonymous reads)
CREATE POLICY "Allow anonymous read access"
ON scores
FOR SELECT
TO anon, authenticated
USING (true);

-- Create write policy (allows anonymous inserts)
CREATE POLICY "Allow anonymous insert access"
ON scores
FOR INSERT
TO anon, authenticated
WITH CHECK (true);
```

## Testing the Configuration

### Method 1: Browser Console Test
1. Open the game in a browser
2. Open developer console (F12)
3. Run:
```javascript
// Test score submission
submitScore('TEST', 9999, 10, 'US').then(result => {
  console.log('Submit result:', result);
});

// Test score fetch
fetchTopScores(10).then(scores => {
  console.log('Fetched scores:', scores);
});
```

### Method 2: In-Game Test
1. Play through a level
2. When prompted for name entry after game over
3. Enter a name and submit
4. Check the scoreboard to verify your score appears

### Method 3: VR Headset Test
1. Open the game in VR
2. Play through a level
3. Submit a score
4. Verify it appears on the scoreboard

## Troubleshooting

### Error: "permission denied for table scores"
**Cause**: RLS policies not configured correctly
**Fix**: Ensure both read and insert policies are created for `anon` role

### Error: "relation scores does not exist"
**Cause**: Table doesn't exist
**Fix**: Create the table using the SQL commands above

### Scores not appearing
**Cause**: Write policy missing or incorrect
**Fix**: Verify the INSERT policy exists with `WITH CHECK (true)`

### Scores appearing but can't read them
**Cause**: Read policy missing or incorrect
**Fix**: Verify the SELECT policy exists with `USING (true)`

### CORS errors in browser
**Cause**: Supabase project URL configuration
**Fix**: Add your domain to allowed origins in Supabase settings

## Security Considerations

### Current Security Model
- **Anonymous writes**: Anyone can submit scores (no authentication required)
- **No rate limiting**: Consider adding rate limiting in future
- **No data validation**: Name profanity filter is client-side only

### Future Improvements
1. **Rate limiting**: Limit submissions per IP/hour
2. **Server-side validation**: Move profanity filter to database trigger
3. **Score validation**: Detect impossible scores on server
4. **Authentication**: Require sign-in for high scores

## Verification Checklist

After completing setup, verify:

- [ ] Table `scores` exists with correct columns
- [ ] RLS is enabled on `scores` table
- [ ] Policy "Allow anonymous read access" exists for SELECT
- [ ] Policy "Allow anonymous insert access" exists for INSERT
- [ ] Test INSERT query succeeds
- [ ] Test SELECT query succeeds
- [ ] Browser console test succeeds
- [ ] In-game submission succeeds
- [ ] Scores appear on leaderboard
- [ ] VR headset test succeeds

## Support

If you encounter issues:
1. Check Supabase dashboard logs: **Logs** > **Postgres**
2. Check browser console for error messages
3. Verify the anon key is correct in `scoreboard.js`
4. Contact: [your contact info]
