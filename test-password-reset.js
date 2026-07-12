/**
 * Password Reset API Test Script
 *
 * This script tests the complete password reset flow:
 * 1. Request password reset (forgot-password)
 * 2. Verify token (verify-reset-token)
 * 3. Update password (update-password)
 *
 * Prerequisites:
 * - Dev server running: npm run dev
 * - Supabase migration applied
 * - Test user exists in Supabase
 *
 * Usage:
 *   node test-password-reset.js <test-email>
 */

const TEST_EMAIL = process.argv[2] || 'test@example.com';
const API_BASE = 'http://localhost:3000';

async function testForgotPassword() {
  console.log('\n=== Test 1: Forgot Password ===');
  console.log(`Email: ${TEST_EMAIL}`);

  const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL })
  });

  const result = await response.json();
  console.log('Status:', response.status);
  console.log('Response:', result);

  if (response.ok) {
    console.log('✅ Forgot password request successful');
    console.log('📧 Check your email for the reset link');
    console.log('\n⚠️  For testing, you need to extract the token from the database:');
    console.log('   Run in Supabase SQL Editor:');
    console.log(`   SELECT token, expires_at FROM public.password_reset_tokens WHERE email = '${TEST_EMAIL}' ORDER BY created_at DESC LIMIT 1;`);
    return true;
  } else {
    console.log('❌ Forgot password request failed:', result.error);
    return false;
  }
}

async function testVerifyToken(token) {
  console.log('\n=== Test 2: Verify Token ===');
  console.log(`Token: ${token.substring(0, 10)}...`);

  const response = await fetch(`${API_BASE}/api/auth/verify-reset-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  });

  const result = await response.json();
  console.log('Status:', response.status);
  console.log('Response:', result);

  if (response.ok && result.valid) {
    console.log('✅ Token verification successful');
    console.log(`Email associated: ${result.email}`);
    return result.email;
  } else {
    console.log('❌ Token verification failed:', result.error);
    return null;
  }
}

async function testUpdatePassword(token, newPassword) {
  console.log('\n=== Test 3: Update Password ===');
  console.log(`New Password: ${newPassword}`);

  const response = await fetch(`${API_BASE}/api/auth/update-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password: newPassword })
  });

  const result = await response.json();
  console.log('Status:', response.status);
  console.log('Response:', result);

  if (response.ok) {
    console.log('✅ Password update successful');
    console.log('🔐 You can now sign in with your new password');
    return true;
  } else {
    console.log('❌ Password update failed:', result.error);
    return false;
  }
}

// Interactive test mode
async function runInteractiveTest() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         Password Reset Flow - Interactive Test            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Test 1: Request password reset
  const test1Passed = await testForgotPassword();
  if (!test1Passed) {
    console.log('\n⚠️  Cannot continue without a valid token');
    return;
  }

  console.log('\n⏸️  PAUSED: Get the token from Supabase (see SQL above)');
  console.log('Press Enter to continue after obtaining the token...');
  await new Promise(resolve => process.stdin.once('data', resolve));

  // Get token from user
  const token = await new Promise(resolve => {
    process.stdout.write('\nEnter the reset token: ');
    process.stdin.once('data', data => resolve(data.toString().trim()));
  });

  if (!token) {
    console.log('❌ No token provided. Test aborted.');
    return;
  }

  // Test 2: Verify token
  const email = await testVerifyToken(token);
  if (!email) {
    console.log('\n⚠️  Cannot continue with invalid token');
    return;
  }

  // Test 3: Update password
  const newPassword = 'TestPassword123!';
  const test3Passed = await testUpdatePassword(token, newPassword);

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    Test Summary                          ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║ Forgot Password: ${test1Passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`║ Token Verified:  ✅ PASS`);
  console.log(`║ Password Update: ${test3Passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log('╚════════════════════════════════════════════════════════════╝');
}

// Quick test with provided token
async function runQuickTest(token, newPassword) {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         Password Reset Flow - Quick Test                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Test 1: Request password reset
  const test1Passed = await testForgotPassword();
  if (!test1Passed) return;

  // Test 2 & 3: Verify and update with provided token
  const email = await testVerifyToken(token);
  if (!email) return;

  await testUpdatePassword(token, newPassword || 'TestPassword123!');
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === '--help') {
    console.log('Usage:');
    console.log('  node test-password-reset.js <email>              # Interactive mode');
    console.log('  node test-password-reset.js <email> <token>       # Quick test');
    console.log('  node test-password-reset.js <email> <token> <pass> # With custom password');
  } else if (args[1]) {
    // Quick test mode with token
    runQuickTest(args[1], args[2]);
  } else {
    // Interactive mode
    runInteractiveTest();
  }
}

module.exports = { testForgotPassword, testVerifyToken, testUpdatePassword };
