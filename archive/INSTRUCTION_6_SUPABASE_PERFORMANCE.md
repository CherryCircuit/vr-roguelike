# INSTRUCTION SET 6: Supabase Scoreboard Performance

## Overview
Optimize the Supabase scoreboard to fix performance drops when loading scores. Implement pagination, caching, and lazy loading.

## Current Issues

- Loading all scores at once causes lag
- No pagination on large datasets
- Queries not optimized
- No caching of results

## Implementation Steps

### Step 1: Add Pagination to Queries

In `scoreboard.js`, modify fetch functions to use pagination:

```javascript
const SCORES_PER_PAGE = 50;  // Load 50 scores at a time
const MAX_SCORES_DISPLAY = 100;  // Show top 100 only

// Global leaderboard with pagination
export async function fetchGlobalScores(page = 0, limit = SCORES_PER_PAGE) {
  try {
    const { data, error } = await supabase
      .from('scores')
      .select('*')
      .order('score', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);  // Pagination

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching global scores:', err);
    return [];
  }
}

// Country leaderboard with pagination
export async function fetchCountryScores(country, page = 0, limit = SCORES_PER_PAGE) {
  try {
    const { data, error } = await supabase
      .from('scores')
      .select('*')
      .eq('country', country)
      .order('score', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching country scores:', err);
    return [];
  }
}
```

### Step 2: Implement Caching

Add a simple cache layer:

```javascript
const scoreCache = {
  global: { data: null, timestamp: 0 },
  country: {},  // { 'US': { data: [...], timestamp: 123 }, ... }
  continent: {}
};

const CACHE_DURATION = 60000;  // 1 minute cache

function isCacheValid(cacheEntry) {
  if (!cacheEntry || !cacheEntry.data) return false;
  return (Date.now() - cacheEntry.timestamp) < CACHE_DURATION;
}

// Modified fetch with caching
export async function fetchGlobalScores(page = 0, limit = SCORES_PER_PAGE, useCache = true) {
  const cacheKey = `${page}_${limit}`;

  // Check cache
  if (useCache && isCacheValid(scoreCache.global[cacheKey])) {
    console.log('Using cached global scores');
    return scoreCache.global[cacheKey].data;
  }

  try {
    const { data, error } = await supabase
      .from('scores')
      .select('*')
      .order('score', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);

    if (error) throw error;

    // Update cache
    if (!scoreCache.global[cacheKey]) {
      scoreCache.global[cacheKey] = {};
    }
    scoreCache.global[cacheKey].data = data || [];
    scoreCache.global[cacheKey].timestamp = Date.now();

    return data || [];
  } catch (err) {
    console.error('Error fetching global scores:', err);
    // Return cached data if available, even if expired
    return scoreCache.global[cacheKey]?.data || [];
  }
}
```

### Step 3: Lazy Loading for Scoreboard Display

Only load scores when user scrolls:

```javascript
let currentPage = 0;
let isLoadingScores = false;
let hasMoreScores = true;

export async function loadNextScorePage(scoreboardType = 'global', country = null) {
  if (isLoadingScores || !hasMoreScores) {
    console.log('Already loading or no more scores');
    return;
  }

  isLoadingScores = true;
  console.log(`Loading page ${currentPage} of ${scoreboardType} scores`);

  let scores;
  if (scoreboardType === 'global') {
    scores = await fetchGlobalScores(currentPage);
  } else if (scoreboardType === 'country' && country) {
    scores = await fetchCountryScores(country, currentPage);
  } else if (scoreboardType === 'continent' && country) {
    scores = await fetchContinentScores(country, currentPage);
  }

  if (scores.length < SCORES_PER_PAGE) {
    hasMoreScores = false;  // Last page
  }

  currentPage++;
  isLoadingScores = false;

  return scores;
}

// Reset when switching leaderboards
export function resetScorePagination() {
  currentPage = 0;
  hasMoreScores = true;
  isLoadingScores = false;
}
```

### Step 4: Optimize Score Submission

Batch score submissions if needed:

```javascript
// Existing submitScore function, but with retry logic
export async function submitScore(name, score, level, country) {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const { data, error } = await supabase
        .from('scores')
        .insert([{ name, score, level_reached: level, country }])
        .select();

      if (error) throw error;

      console.log('Score submitted successfully');

      // Invalidate cache so new score shows up
      scoreCache.global = {};
      if (country) {
        scoreCache.country[country] = null;
      }

      return data;
    } catch (err) {
      attempt++;
      console.error(`Score submission failed (attempt ${attempt}/${maxRetries}):`, err);

      if (attempt >= maxRetries) {
        console.error('Failed to submit score after', maxRetries, 'attempts');
        return null;
      }

      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}
```

### Step 5: Add Loading Indicators

Show user that scores are loading:

```javascript
// In hud.js or main.js
let scoreLoadingSprite = null;

function showScoreLoadingIndicator() {
  if (scoreLoadingSprite) {
    scoreLoadingSprite.visible = true;
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#00ffff';
  ctx.font = '24px monospace';
  ctx.fillText('LOADING...', 50, 40);

  const texture = new THREE.CanvasTexture(canvas);
  scoreLoadingSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true })
  );
  scoreLoadingSprite.scale.set(2, 0.5, 1);
  scoreLoadingSprite.position.set(0, 1.5, -3);

  scene.add(scoreLoadingSprite);
}

function hideScoreLoadingIndicator() {
  if (scoreLoadingSprite) {
    scoreLoadingSprite.visible = false;
  }
}

// Usage:
async function displayScoreboard() {
  showScoreLoadingIndicator();

  const scores = await fetchGlobalScores();

  hideScoreLoadingIndicator();

  // Render scores...
}
```

### Step 6: Limit Query Results

Only fetch what's needed:

```javascript
// Only select necessary columns
export async function fetchGlobalScores(page = 0, limit = SCORES_PER_PAGE) {
  try {
    const { data, error } = await supabase
      .from('scores')
      .select('name, score, level_reached, country, created_at')  // Only needed columns
      .order('score', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1)
      .limit(MAX_SCORES_DISPLAY);  // Hard limit to prevent huge queries

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching global scores:', err);
    return [];
  }
}
```

### Step 7: Add Indexes in Supabase (Database Side)

**NOTE:** This requires database access. If you have access to Supabase dashboard:

1. Go to Database → Tables → scores
2. Add index on `score` column (descending)
3. Add index on `country` column (for country leaderboards)
4. Add composite index on `(country, score)` for country+score queries

SQL to create indexes:

```sql
-- Index for global leaderboard
CREATE INDEX idx_scores_score_desc ON scores(score DESC);

-- Index for country leaderboard
CREATE INDEX idx_scores_country ON scores(country);

-- Composite index for country + score
CREATE INDEX idx_scores_country_score ON scores(country, score DESC);

-- Index on created_at for time-based queries
CREATE INDEX idx_scores_created_at ON scores(created_at DESC);
```

### Step 8: Implement Score Preloading

Preload scores while player is finishing level:

```javascript
// In main.js, when level is almost complete
if (game.state === State.LEVEL_COMPLETE_SLOWMO) {
  // Start preloading scores in background
  if (!scoreCache.global.data) {
    console.log('Preloading scores...');
    fetchGlobalScores(0, 50, false);  // Don't wait for result
  }
}

// By the time player reaches scoreboard, scores are likely cached
```

### Step 9: Virtual Scrolling for Large Lists

Only render visible scores:

```javascript
const VISIBLE_SCORES = 10;  // Only show 10 at a time in VR
let scrollOffset = 0;

function displayScoreboard(scores) {
  // Clear existing score displays
  clearScoreboardSprites();

  // Only render visible range
  const visibleScores = scores.slice(scrollOffset, scrollOffset + VISIBLE_SCORES);

  visibleScores.forEach((score, index) => {
    const yPos = 2.0 - (index * 0.3);
    const sprite = createScoreEntry(score, yPos);
    scoreboardSprites.push(sprite);
  });

  // Show scroll indicators if needed
  if (scrollOffset > 0) {
    showUpArrow();
  }
  if (scrollOffset + VISIBLE_SCORES < scores.length) {
    showDownArrow();
  }
}

// Scroll with controller thumbstick
function handleScoreboardScroll(delta) {
  scrollOffset = Math.max(0, Math.min(scrollOffset + delta, totalScores - VISIBLE_SCORES));
  displayScoreboard(cachedScores);  // Re-render with new offset
}
```

### Step 10: Error Handling and Fallbacks

```javascript
export async function fetchGlobalScores(page = 0, limit = SCORES_PER_PAGE) {
  try {
    const { data, error } = await supabase
      .from('scores')
      .select('*')
      .order('score', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching global scores:', err);

    // Fallback: Return dummy data or cached data
    if (scoreCache.global[`${page}_${limit}`]?.data) {
      console.log('Using stale cache due to error');
      return scoreCache.global[`${page}_${limit}`].data;
    }

    // Ultimate fallback: Return empty array
    return [];
  }
}
```

## Performance Targets

**Before Optimization:**
- Loading time: 2-5 seconds
- Frame drops during load: 20-30 FPS

**After Optimization:**
- Loading time: < 500ms (with cache)
- Frame drops: None (async loading)
- Max query size: 50 scores per request
- Cache hit rate: > 80% for repeat views

## Testing Checklist

- [ ] Scoreboard loads in < 1 second
- [ ] No frame drops when loading scores
- [ ] Pagination works (can load next page)
- [ ] Cache works (second load is instant)
- [ ] Handles network errors gracefully
- [ ] Loading indicator shows during fetch
- [ ] Only fetches needed data (not entire table)
- [ ] Score submission invalidates cache
- [ ] Works with 10,000+ scores in database

## Monitoring

Add performance logging:

```javascript
async function fetchGlobalScores(page = 0, limit = SCORES_PER_PAGE) {
  const startTime = performance.now();

  try {
    // ... fetch logic ...

    const endTime = performance.now();
    console.log(`Fetched ${data.length} scores in ${(endTime - startTime).toFixed(0)}ms`);

    return data || [];
  } catch (err) {
    const endTime = performance.now();
    console.error(`Score fetch failed after ${(endTime - startTime).toFixed(0)}ms:`, err);
    return [];
  }
}
```

## Notes

- Supabase has rate limits (check your plan)
- Consider using Supabase's realtime subscriptions for live updates
- For very large datasets (100k+ scores), consider server-side aggregation
- Cache invalidation strategy: Clear cache on new score submission
- Consider adding "Refresh" button to manually invalidate cache
