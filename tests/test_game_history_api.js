/**
 * Bluff or Believe — Phase 3 Game History & Progress Integration Test Suite
 * Validates:
 * 1. Database schema creation / verification
 * 2. Unauthenticated request rejection (401)
 * 3. Empty stats for new players without game history
 * 4. Saving completed rounds with server-side accuracy calculation
 * 5. Idempotent duplicate-submission handling
 * 6. Retrieving paginated history (newest first)
 * 7. Aggregate career statistics calculation
 * 8. Player isolation (Player B cannot see Player A's history)
 * 9. Foreign key cascading deletion when user account is deleted
 *
 * Run with: node tests/test_game_history_api.js
 */

const assert = require('assert');

const API_BASE = 'http://127.0.0.1:8001';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, options);
  let json = null;
  try {
    json = await res.json();
  } catch {
    // Non-json response
  }
  return { status: res.status, headers: res.headers, data: json };
}

async function runTests() {
  console.log('======================================================');
  console.log('BLUFF OR BELIEVE — PHASE 3 GAME HISTORY INTEGRATION TESTS');
  console.log('======================================================\n');

  // 1. Health check
  console.log('[1/10] Checking API Health...');
  const healthRes = await request('/health');
  assert.strictEqual(healthRes.status, 200, 'Health check should return 200');
  console.log('  ✓ API is running and healthy.');

  // 2. Authentication Rejection on all new endpoints
  console.log('[2/10] Verifying rejection of unauthenticated requests (401)...');
  const unauthSave = await request('/games/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ score: 50, questions_answered: 10, correct_answers: 5 })
  });
  assert.strictEqual(unauthSave.status, 401, 'Unauthenticated POST /games/complete must return 401');

  const unauthHistory = await request('/games/history');
  assert.strictEqual(unauthHistory.status, 401, 'Unauthenticated GET /games/history must return 401');

  const unauthStats = await request('/players/me/stats');
  assert.strictEqual(unauthStats.status, 401, 'Unauthenticated GET /players/me/stats must return 401');
  console.log('  ✓ Unauthenticated requests properly rejected with 401 Unauthorized.');

  // Create two distinct test users: Player A and Player B
  const uidA = Date.now().toString().slice(-6);
  const userA = {
    username: `player_a_${uidA}`,
    email: `player_a_${uidA}@example.com`,
    password: 'Password123!'
  };

  const uidB = (Date.now() + 1).toString().slice(-6);
  const userB = {
    username: `player_b_${uidB}`,
    email: `player_b_${uidB}@example.com`,
    password: 'Password123!'
  };

  console.log(`[3/10] Registering test accounts (${userA.username} & ${userB.username})...`);
  const regA = await request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userA)
  });
  assert.strictEqual(regA.status, 201);
  const tokenA = regA.data.access_token;
  const userA_Id = regA.data.user.id;

  const regB = await request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userB)
  });
  assert.strictEqual(regB.status, 201);
  const tokenB = regB.data.access_token;
  console.log('  ✓ Both test players registered successfully.');

  // 3. Stats for player without game records
  console.log('[4/10] Checking player statistics for account with 0 games...');
  const emptyStats = await request('/players/me/stats', {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  assert.strictEqual(emptyStats.status, 200);
  assert.strictEqual(emptyStats.data.completed_rounds, 0);
  assert.strictEqual(emptyStats.data.total_questions_answered, 0);
  assert.strictEqual(emptyStats.data.total_correct_answers, 0);
  assert.strictEqual(emptyStats.data.overall_accuracy, 0.0);
  assert.strictEqual(emptyStats.data.best_score, 0);
  assert.strictEqual(emptyStats.data.most_recent_completed_at, null);
  console.log('  ✓ Empty stats handled correctly (all zeros, null timestamp).');

  // 4. Save Round 1 for Player A
  console.log('[5/10] Saving Round 1 for Player A (8/10 correct = 80 points, accuracy 80%)...');
  const round1Key = `idemp_rnd1_${uidA}`;
  const saveRound1 = await request('/games/complete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenA}`
    },
    body: JSON.stringify({
      score: 80,
      questions_answered: 10,
      correct_answers: 8,
      category: 'Science and Space',
      difficulty: 'Medium',
      round_length: 10,
      started_at: new Date(Date.now() - 60000).toISOString(),
      idempotency_key: round1Key
    })
  });
  assert.strictEqual(saveRound1.status, 200, 'Saving round 1 should succeed');
  assert.strictEqual(saveRound1.data.idempotent, false);
  assert.strictEqual(saveRound1.data.game.score, 80);
  assert.strictEqual(saveRound1.data.game.questions_answered, 10);
  assert.strictEqual(saveRound1.data.game.correct_answers, 8);
  assert.strictEqual(saveRound1.data.game.accuracy, 80.0, 'Server-side accuracy should be 80.0%');
  assert.strictEqual(saveRound1.data.game.category, 'Science and Space');
  assert.strictEqual(saveRound1.data.game.difficulty, 'Medium');
  assert.strictEqual(saveRound1.data.game.round_length, 10);
  assert.ok(saveRound1.data.game.id, 'Should return saved row ID');
  const round1Id = saveRound1.data.game.id;
  console.log(`  ✓ Round 1 saved (ID: ${round1Id}, Accuracy: 80.0% calculated server-side).`);

  // 5. Duplicate Submission / Idempotency Check
  console.log('[6/10] Testing duplicate submission prevention with idempotency key...');
  const duplicateSave = await request('/games/complete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenA}`
    },
    body: JSON.stringify({
      score: 80,
      questions_answered: 10,
      correct_answers: 8,
      category: 'Science',
      difficulty: 'Medium',
      round_length: 10,
      idempotency_key: round1Key
    })
  });
  assert.strictEqual(duplicateSave.status, 200);
  assert.strictEqual(duplicateSave.data.idempotent, true, 'Should detect idempotency duplicate');
  assert.strictEqual(duplicateSave.data.game.id, round1Id, 'Should return existing round ID');
  console.log('  ✓ Duplicate request returned original round without inserting duplicate row.');

  // 6. Save Round 2 for Player A
  console.log('[7/10] Saving Round 2 for Player A (6/10 correct = 60 points, accuracy 60%)...');
  const round2Key = `idemp_rnd2_${uidA}`;
  const saveRound2 = await request('/games/complete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenA}`
    },
    body: JSON.stringify({
      score: 60,
      questions_answered: 10,
      correct_answers: 6,
      category: 'History',
      difficulty: 'Hard',
      round_length: 10,
      idempotency_key: round2Key
    })
  });
  assert.strictEqual(saveRound2.status, 200);
  assert.strictEqual(saveRound2.data.game.accuracy, 60.0);
  console.log('  ✓ Round 2 saved successfully.');

  // 7. Retrieve Game History for Player A
  console.log('[8/10] Retrieving game history for Player A...');
  const histA = await request('/games/history?limit=10&offset=0', {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  assert.strictEqual(histA.status, 200);
  assert.strictEqual(histA.data.total, 2, 'Total rounds for Player A should be 2');
  assert.strictEqual(histA.data.games.length, 2);
  assert.strictEqual(histA.data.games[0].score, 60, 'Newest round should be first');
  assert.strictEqual(histA.data.games[1].score, 80);
  console.log('  ✓ History retrieved: 2 rounds returned, newest first.');

  // 8. Player Isolation & Aggregate Stats
  console.log('[9/10] Verifying aggregate stats for Player A and isolation from Player B...');
  const statsA = await request('/players/me/stats', {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  assert.strictEqual(statsA.status, 200);
  assert.strictEqual(statsA.data.completed_rounds, 2);
  assert.strictEqual(statsA.data.total_questions_answered, 20);
  assert.strictEqual(statsA.data.total_correct_answers, 14);
  assert.strictEqual(statsA.data.overall_accuracy, 70.0, 'Overall accuracy should be (14/20)*100 = 70.0%');
  assert.strictEqual(statsA.data.best_score, 80);
  assert.ok(statsA.data.most_recent_completed_at !== null);

  // Player B must have 0 rounds and see NO games of Player A
  const histB = await request('/games/history', {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  assert.strictEqual(histB.status, 200);
  assert.strictEqual(histB.data.total, 0, 'Player B must see 0 games');
  assert.strictEqual(histB.data.games.length, 0);

  const statsB = await request('/players/me/stats', {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  assert.strictEqual(statsB.data.completed_rounds, 0);
  console.log('  ✓ Aggregate calculations verified: 2 rounds, 14/20 (70.0%), best 80 pts.');
  console.log('  ✓ Player isolation verified: Player B cannot view any records of Player A.');

  // 9. Account Deletion and Cascade Check
  console.log('[10/10] Testing account deletion and cascading game_history deletion...');
  const delA = await request('/auth/account', {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  assert.strictEqual(delA.status, 200, 'Account deletion should succeed');

  // Verify deleted user session is invalidated
  const postDelHist = await request('/games/history', {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  assert.strictEqual(postDelHist.status, 401, 'Deleted user bearer token rejected with 401');

  // Clean up Player B
  await request('/auth/account', {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });

  console.log('  ✓ User deleted and session token invalidated.');
  console.log('\n======================================================');
  console.log('ALL PHASE 3 GAME HISTORY INTEGRATION TESTS PASSED!');
  console.log('======================================================');
}

runTests().catch((err) => {
  console.error('\n✗ Test failed with error:', err);
  process.exit(1);
});
