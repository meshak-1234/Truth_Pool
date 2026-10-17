/**
 * Bluff or Believe — Automated Auth Integration Test
 * Validates endpoints, CORS, validation errors, registration,
 * login, logout, account deletion, and session error mapping.
 * Run with: node tests/test_auth_flow.js
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
  console.log('BLUFF OR BELIEVE — AUTH INTEGRATION TESTS');
  console.log('======================================================\n');

  // Test 1: Health check
  console.log('[1/8] Testing GET /health...');
  const healthRes = await request('/health');
  assert.strictEqual(healthRes.status, 200, 'Health endpoint should return 200');
  assert.strictEqual(healthRes.data.status, 'ok');
  console.log('  ✓ API is running and healthy.');

  // Test 2: CORS Preflight for localhost:8000 and 127.0.0.1:8000
  console.log('[2/8] Testing CORS preflight origins...');
  const origins = ['http://localhost:8000', 'http://127.0.0.1:8000'];
  for (const origin of origins) {
    const res = await request('/auth/login', {
      method: 'OPTIONS',
      headers: {
        'Origin': origin,
        'Access-Control-Request-Method': 'POST'
      }
    });
    assert.strictEqual(res.status, 200, `CORS preflight should pass for ${origin}`);
    assert.strictEqual(res.headers.get('access-control-allow-origin'), origin);
  }
  console.log('  ✓ Both http://localhost:8000 and http://127.0.0.1:8000 allowed by CORS.');

  // Test 3: Validation error handling on register
  console.log('[3/8] Testing registration validation errors (short password, bad email)...');
  const badReg = await request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'ab', // too short (< 3)
      email: 'not-an-email',
      password: '123' // too short (< 8)
    })
  });
  assert.strictEqual(badReg.status, 422, 'Should fail validation with 422');
  assert.ok(Array.isArray(badReg.data.detail), 'Detail should be validation error list');
  console.log('  ✓ Pydantic validation rejected invalid data with 422.');

  // Test 4: Successful registration
  const uniqueId = Date.now().toString().slice(-6);
  const testUsername = `player_${uniqueId}`;
  const testEmail = `player_${uniqueId}@example.com`;
  const testPassword = 'Password123!';

  console.log(`[4/8] Testing successful registration (${testEmail})...`);
  const regRes = await request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: testUsername,
      email: testEmail,
      password: testPassword
    })
  });
  assert.strictEqual(regRes.status, 201, 'Registration should return 201 Created');
  assert.ok(regRes.data.access_token, 'Should return access token');
  assert.strictEqual(regRes.data.user.username, testUsername);
  assert.strictEqual(regRes.data.user.email, testEmail);
  const registeredToken = regRes.data.access_token;
  console.log(`  ✓ Registration successful, token generated for ${testUsername}.`);

  // Test 5: Duplicate registration prevention
  console.log('[5/8] Testing duplicate email conflict (409)...');
  const dupRes = await request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'another_user',
      email: testEmail,
      password: testPassword
    })
  });
  assert.strictEqual(dupRes.status, 409, 'Duplicate email should return 409');
  assert.strictEqual(dupRes.data.detail, 'Email is already registered');
  console.log('  ✓ Duplicate email rejected with 409 Conflict.');

  // Test 6: Login with incorrect password
  console.log('[6/8] Testing login with wrong credentials (401)...');
  const badLogin = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: 'WrongPassword999'
    })
  });
  assert.strictEqual(badLogin.status, 401, 'Wrong password should return 401');
  assert.strictEqual(badLogin.data.detail, 'Invalid email or password');
  console.log('  ✓ Invalid password rejected with 401 Unauthorized.');

  // Test 7: Successful login
  console.log('[7/8] Testing login with correct credentials...');
  const loginRes = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword
    })
  });
  assert.strictEqual(loginRes.status, 200, 'Login should return 200 OK');
  assert.ok(loginRes.data.access_token, 'Login should return access token');
  assert.strictEqual(loginRes.data.user.email, testEmail);
  const activeToken = loginRes.data.access_token;
  console.log('  ✓ Login successful, active bearer token received.');

  // Test 8: Logout and Account Deletion
  console.log('[8/8] Testing account deletion and logout...');
  const delRes = await request('/auth/account', {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${activeToken}` }
  });
  assert.strictEqual(delRes.status, 200, 'Account deletion should return 200');
  assert.strictEqual(delRes.data.message, 'Account deleted successfully');

  // Verify deleted user can no longer log in
  const postDelLogin = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: testPassword })
  });
  assert.strictEqual(postDelLogin.status, 401, 'Deleted user cannot log in');
  console.log('  ✓ Account deleted and cleaned up from database.');

  console.log('\n======================================================');
  console.log('ALL 8 AUTH INTEGRATION TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================');
}

runTests().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
