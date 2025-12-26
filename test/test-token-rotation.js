import tokenManager from '../src/auth/token_manager.js';

async function testTokenRotation() {
  console.log('=== Starting Token Rotation Test ===\n');

  const totalTests = 10;
  const usedTokens = new Map();

  console.log(`Initial state: ${tokenManager.tokens.length} available accounts\n`);

  for (let i = 1; i <= totalTests; i++) {
    console.log(`--- Request ${i} ---`);

    const token = await tokenManager.getToken();

    if (!token) {
      console.log('❌ No available token\n');
      break;
    }

    const tokenId = token.refresh_token.slice(-8);
    console.log(`✓ Got token: ...${tokenId}`);
    console.log(`  Current index: ${tokenManager.currentIndex}`);
    console.log(`  Remaining accounts: ${tokenManager.tokens.length}\n`);

    usedTokens.set(tokenId, (usedTokens.get(tokenId) || 0) + 1);
  }

  console.log('=== Rotation Statistics ===');
  console.log(`Total requests: ${totalTests}`);
  console.log(`Different accounts used: ${usedTokens.size}`);
  console.log('\nUsage count per account:');
  usedTokens.forEach((count, tokenId) => {
    console.log(`  ...${tokenId}: ${count} times`);
  });

  if (usedTokens.size === tokenManager.tokens.length) {
    console.log('\n✅ All accounts were correctly rotated');
  } else {
    console.log('\n⚠️ Some accounts were not used');
  }
}

testTokenRotation().catch(console.error);
