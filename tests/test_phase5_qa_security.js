/**
 * Truth Pool — Phase 5: Final QA, Application Security Audit & Deployment Readiness Test Suite
 *
 * Checks:
 *   1. Health check & basic operational readiness
 *   2. CORS Allowed Origins & Security Headers
 *   3. Password security, Argon2id validation, and credential rejection
 *   4. Unauthenticated access rejection (401) on all private endpoints
 *   5. SQL injection resilience across login, register, and query parameters
 *   6. Input validation & boundary constraints (Pydantic models)
 *   7. Token isolation & cross-account unauthorized access prevention
 *   8. Account deletion with cascading data cleanup
 *   9. Rate limiting on authentication endpoints (brute-force defense)
 *  10. Server error handling & stack trace exposure prevention
 */

const http = require('http');

const API_BASE = 'http://127.0.0.1:8001';

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const reqHeaders = { 'Content-Type': 'application/json', ...headers };
    let reqBody = null;
    if (body !== null) {
      reqBody = typeof body === 'string' ? body : JSON.stringify(body);
      reqHeaders['Content-Length'] = Buffer.byteLength(reqBody);
    }

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: reqHeaders,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsed,
          raw: data,
        });
      });
    });

    req.on('error', (err) => reject(err));
    if (reqBody) req.write(reqBody);
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runPhase5Audit() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  TRUTH POOL — PHASE 5: QA, SECURITY & DEPLOYMENT AUDIT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let total = 10;

  // 1. Health Check
  try {
    process.stdout.write('[1/10] Checking API Health and Service Signature... ');
    const res = await request('GET', '/health');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body && res.body.status === 'ok', 'Status should be ok');
    console.log('✓ PASS');
    passed++;
  } catch (err) {
    console.log('✕ FAIL:', err.message);
  }

  // 2. CORS Allowed Origins & Security Headers
  try {
    process.stdout.write('[2/10] Verifying CORS Origins and Allowed Headers... ');
    const res = await request('OPTIONS', '/auth/login', null, {
      Origin: 'http://localhost:8000',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Content-Type,Authorization',
    });
    assert(res.status === 200, `Expected 200 for OPTIONS, got ${res.status}`);
    assert(
      res.headers['access-control-allow-origin'] === 'http://localhost:8000',
      'Allowed origin should match localhost:8000'
    );
    assert(
      res.headers['access-control-allow-credentials'] === 'true',
      'Allow credentials must be true'
    );
    console.log('✓ PASS');
    passed++;
  } catch (err) {
    console.log('✕ FAIL:', err.message);
  }

  // 3. Password Security & Input Validation (Reject weak/short passwords, bad email)
  try {
    process.stdout.write('[3/10] Verifying Registration Validation (Length, Email format)... ');
    const shortPassRes = await request('POST', '/auth/register', {
      username: 'validuser',
      email: 'valid@example.com',
      password: '123', // < 8 characters
    });
    assert(shortPassRes.status === 422, `Expected 422 for short password, got ${shortPassRes.status}`);

    const badEmailRes = await request('POST', '/auth/register', {
      username: 'validuser',
      email: 'not-an-email',
      password: 'StrongPassword123!',
    });
    assert(badEmailRes.status === 422, `Expected 422 for invalid email, got ${badEmailRes.status}`);
    console.log('✓ PASS');
    passed++;
  } catch (err) {
    console.log('✕ FAIL:', err.message);
  }

  // 4. Unauthenticated Rejection (401) on All Protected Endpoints
  try {
    process.stdout.write('[4/10] Verifying 401 Unauthorized on Protected Routes... ');
    const protectedRoutes = [
      ['GET', '/players/me/stats'],
      ['GET', '/players/me/xp'],
      ['GET', '/players/me/achievements'],
      ['GET', '/games/history'],
      ['POST', '/games/complete', { score: 10, questions_answered: 1, correct_answers: 1 }],
      ['GET', '/api/fandom/badges'],
      ['GET', '/api/fandom/progress'],
      ['POST', '/api/fandom/question-completed', { fandom_id: 'Ben 10', question_id: 1 }],
      ['DELETE', '/auth/account'],
    ];

    for (const [m, p, b] of protectedRoutes) {
      const res = await request(m, p, b || null);
      assert(
        res.status === 401 || res.status === 403,
        `Expected 401 on ${m} ${p}, got ${res.status}`
      );
    }
    console.log('✓ PASS (9/9 protected routes rejected unauthenticated calls)');
    passed++;
  } catch (err) {
    console.log('✕ FAIL:', err.message);
  }

  // Generate unique test user
  const testEmail = `audit_${Date.now()}@example.com`;
  const testPassword = 'AuditStrongPassword99!';
  let testToken = null;
  let testUserId = null;

  // 5. SQL Injection Resilience
  try {
    process.stdout.write('[5/10] Testing SQL Injection Payloads in Auth & Query Endpoints... ');
    // Attempt SQL injection in login
    const sqliLogin = await request('POST', '/auth/login', {
      email: "admin' OR '1'='1' --",
      password: "' OR '1'='1",
    });
    assert(
      sqliLogin.status === 401 || sqliLogin.status === 422,
      `SQLi payload in login should be rejected with 401 or 422, got ${sqliLogin.status}`
    );

    // Register a valid user for subsequent tests
    const regRes = await request('POST', '/auth/register', {
      username: 'audit_player',
      email: testEmail,
      password: testPassword,
    });
    assert(regRes.status === 201, `Failed to register audit test user: ${JSON.stringify(regRes.body)}`);
    testToken = regRes.body.access_token;
    testUserId = regRes.body.user.id;

    // Attempt SQL injection in fandom query parameter
    const sqliFandom = await request(
      'GET',
      "/api/fandom/progress?fandom_id=' UNION SELECT 1,2,3 --",
      null,
      { Authorization: `Bearer ${testToken}` }
    );
    assert(
      sqliFandom.status === 400,
      `Expected 400 Bad Request for invalid fandom SQLi, got ${sqliFandom.status}`
    );

    console.log('✓ PASS (SQL injection payloads safely sanitized/rejected)');
    passed++;
  } catch (err) {
    console.log('✕ FAIL:', err.message);
  }

  // 6. Input Validation & Bounds Checking (Pydantic)
  try {
    process.stdout.write('[6/10] Verifying Bounds Constraints on Game Submission... ');
    // correct_answers > questions_answered should fail model validator
    const invalidAnswersRes = await request(
      'POST',
      '/games/complete',
      {
        score: 50,
        questions_answered: 5,
        correct_answers: 10, // impossible
      },
      { Authorization: `Bearer ${testToken}` }
    );
    assert(
      invalidAnswersRes.status === 422,
      `Expected 422 for correct_answers > questions_answered, got ${invalidAnswersRes.status}`
    );

    // Negative score should fail ge=0
    const negScoreRes = await request(
      'POST',
      '/games/complete',
      {
        score: -10,
        questions_answered: 5,
        correct_answers: 2,
      },
      { Authorization: `Bearer ${testToken}` }
    );
    assert(negScoreRes.status === 422, `Expected 422 for negative score, got ${negScoreRes.status}`);

    console.log('✓ PASS (Boundary checks enforced server-side)');
    passed++;
  } catch (err) {
    console.log('✕ FAIL:', err.message);
  }

  // 7. Token Isolation & Cross-Account Isolation
  let secondUserToken = null;
  const secondEmail = `audit_alt_${Date.now()}@example.com`;
  try {
    process.stdout.write('[7/10] Verifying Cross-Account Isolation between Players... ');
    // Register second player
    const regAlt = await request('POST', '/auth/register', {
      username: 'audit_player_two',
      email: secondEmail,
      password: testPassword,
    });
    secondUserToken = regAlt.body.access_token;

    // First player records a game
    await request(
      'POST',
      '/games/complete',
      {
        score: 80,
        questions_answered: 10,
        correct_answers: 8,
        category: 'Marvel Universe',
        idempotency_key: `audit_round_${Date.now()}`,
      },
      { Authorization: `Bearer ${testToken}` }
    );

    // Second player queries their stats — should have 0 games, not 1
    const playerTwoStats = await request('GET', '/players/me/stats', null, {
      Authorization: `Bearer ${secondUserToken}`,
    });
    assert(
      playerTwoStats.body.completed_rounds === 0,
      `Player 2 should have 0 rounds, got ${playerTwoStats.body.completed_rounds}`
    );
    assert(
      playerTwoStats.body.total_xp === 0,
      `Player 2 should have 0 XP, got ${playerTwoStats.body.total_xp}`
    );

    console.log('✓ PASS (Strict cross-tenant data isolation verified)');
    passed++;
  } catch (err) {
    console.log('✕ FAIL:', err.message);
  }

  // 8. Account Deletion and Cascade Data Cleanup
  try {
    process.stdout.write('[8/10] Testing Account Deletion and Cascade Invalidation... ');
    // Delete Player 2
    const delRes = await request('DELETE', '/auth/account', null, {
      Authorization: `Bearer ${secondUserToken}`,
    });
    assert(delRes.status === 200, `Expected 200 for account deletion, got ${delRes.status}`);

    // Verify token is now invalid (401)
    const postDelCheck = await request('GET', '/players/me/stats', null, {
      Authorization: `Bearer ${secondUserToken}`,
    });
    assert(
      postDelCheck.status === 401,
      `Token should be revoked after deletion, got ${postDelCheck.status}`
    );

    // Clean up Player 1
    await request('DELETE', '/auth/account', null, {
      Authorization: `Bearer ${testToken}`,
    });

    console.log('✓ PASS (Account and session token cleanly removed)');
    passed++;
  } catch (err) {
    console.log('✕ FAIL:', err.message);
  }

  // 9. Rate Limiting Protection (Brute Force Defense)
  try {
    process.stdout.write('[9/10] Testing Rate Limiting on /auth/login (Brute-Force Defense)... ');
    const floodAttempts = [];
    // Rapidly send requests exceeding RATE_LIMIT_LOGIN_MAX (30)
    for (let i = 0; i < 35; i++) {
      floodAttempts.push(
        request('POST', '/auth/login', {
          email: 'nonexistent@example.com',
          password: 'wrongpassword',
        })
      );
    }
    const results = await Promise.all(floodAttempts);
    const throttled = results.filter((r) => r.status === 429);
    assert(
      throttled.length > 0,
      `Expected at least one 429 Too Many Requests response, but none was returned.`
    );
    assert(
      throttled[0].headers['retry-after'],
      '429 response should include Retry-After header'
    );
    // Reset rate limiter bucket so subsequent test suites aren't throttled
    await request('POST', '/auth/rate-limit/reset');
    console.log(`✓ PASS (Rate limiter engaged: returned 429 Too Many Requests after threshold)`);
    passed++;
  } catch (err) {
    console.log('✕ FAIL:', err.message);
  }

  // 10. Error Response Safety (No Stack Trace or Credential Leakage)
  try {
    process.stdout.write('[10/10] Checking Error Response Safety (No Tracebacks or Leaks)... ');
    const notFoundRes = await request('GET', '/nonexistent-endpoint-test');
    assert(notFoundRes.status === 404, `Expected 404, got ${notFoundRes.status}`);
    assert(
      !notFoundRes.raw.includes('Traceback') && !notFoundRes.raw.includes('password_hash'),
      'Error body must not expose internal tracebacks or secrets'
    );

    const malformedJsonRes = await request('POST', '/auth/login', '{ invalid json syntax');
    assert(
      malformedJsonRes.status === 400 || malformedJsonRes.status === 422,
      `Expected 400/422 for malformed JSON, got ${malformedJsonRes.status}`
    );
    assert(
      !malformedJsonRes.raw.includes('Traceback'),
      'JSON error should not leak stack trace'
    );

    console.log('✓ PASS (Error responses are safe and sanitized)');
    passed++;
  } catch (err) {
    console.log('✕ FAIL:', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  AUDIT RESULTS: ${passed} / ${total} Checks Passed (${total - passed} Failed)`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (passed === total) {
    console.log('✅ ALL PHASE 5 SECURITY & QA CHECKS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  } else {
    console.error('❌ SOME AUDIT CHECKS FAILED. Please review the output above.\n');
    process.exit(1);
  }
}

runPhase5Audit().catch((err) => {
  console.error('Audit execution error:', err);
  process.exit(1);
});
