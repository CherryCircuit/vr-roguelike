// ============================================================
//  SUPABASE CONFIGURATION TEST
//  Run this in browser console to verify setup
// ============================================================

// Test 1: Verify Supabase client is initialized
console.log('=== Supabase Configuration Test ===');
console.log('Supabase client exists:', typeof supabase !== 'undefined');

// Test 2: Test anonymous read access
async function testRead() {
  console.log('\n--- Test 1: Read Access ---');
  try {
    const { data, error } = await supabase
      .from('scores')
      .select('name, score, level_reached, country, created_at')
      .limit(5);

    if (error) {
      console.error('❌ Read failed:', error.message);
      console.error('Details:', error);
      return false;
    }

    console.log('✅ Read successful!');
    console.log(`Found ${data?.length || 0} scores`);
    return true;
  } catch (err) {
    console.error('❌ Read exception:', err);
    return false;
  }
}

// Test 3: Test anonymous write access
async function testWrite() {
  console.log('\n--- Test 2: Write Access ---');
  const testName = 'TEST_' + Date.now();

  try {
    const { data, error } = await supabase
      .from('scores')
      .insert([{
        name: testName,
        score: 99999,
        level_reached: 20,
        country: 'US'
      }])
      .select();

    if (error) {
      console.error('❌ Write failed:', error.message);
      console.error('Details:', error);
      return false;
    }

    console.log('✅ Write successful!');
    console.log('Inserted record:', data);

    // Clean up test record
    await supabase.from('scores').delete().eq('name', testName);
    console.log('✅ Test record cleaned up');

    return true;
  } catch (err) {
    console.error('❌ Write exception:', err);
    return false;
  }
}

// Test 4: Test table structure
async function testTableStructure() {
  console.log('\n--- Test 3: Table Structure ---');

  try {
    const { data, error } = await supabase
      .from('scores')
      .select('id, name, score, level_reached, country, created_at')
      .limit(1);

    if (error) {
      if (error.message.includes('does not exist')) {
        console.error('❌ Table "scores" does not exist');
        console.log('→ Run the CREATE TABLE command from SUPABASE_SETUP.md');
      } else if (error.message.includes('permission denied')) {
        console.error('❌ Permission denied - RLS policies not configured');
        console.log('→ Run the RLS policy commands from SUPABASE_SETUP.md');
      } else {
        console.error('❌ Unknown error:', error.message);
      }
      return false;
    }

    console.log('✅ Table structure looks good');
    console.log('Columns: id, name, score, level_reached, country, created_at');
    return true;
  } catch (err) {
    console.error('❌ Table structure test exception:', err);
    return false;
  }
}

// Test 5: Test RLS policies
async function testRLSPolicies() {
  console.log('\n--- Test 4: RLS Policies ---');

  // Try to read without authentication
  const readSuccess = await testRead();

  // Try to write without authentication
  const writeSuccess = await testWrite();

  if (readSuccess && writeSuccess) {
    console.log('✅ RLS policies are correctly configured');
    return true;
  } else {
    console.error('❌ RLS policies need to be configured');
    console.log('→ Follow the steps in SUPABASE_SETUP.md');
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('Starting Supabase configuration tests...\n');

  const results = {
    tableStructure: await testTableStructure(),
    readAccess: await testRead(),
    writeAccess: await testWrite(),
    rlsPolicies: false
  };

  results.rlsPolicies = results.readAccess && results.writeAccess;

  console.log('\n=== Test Results ===');
  console.table(results);

  const allPassed = Object.values(results).every(v => v === true);

  if (allPassed) {
    console.log('\n✅ All tests passed! Scoreboard is ready.');
  } else {
    console.log('\n❌ Some tests failed. Check SUPABASE_SETUP.md for instructions.');
  }

  return allPassed;
}

// Auto-run if supabase client exists
if (typeof supabase !== 'undefined') {
  runAllTests();
} else {
  console.error('❌ Supabase client not found. Make sure scoreboard.js is loaded.');
}

// Export for manual use
window.supabaseTest = {
  runAll: runAllTests,
  testRead,
  testWrite,
  testTableStructure,
  testRLSPolicies
};

console.log('\n💡 Tip: Run window.supabaseTest.runAll() to test again');
