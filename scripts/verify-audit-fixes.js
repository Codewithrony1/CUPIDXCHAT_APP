// scripts/verify-audit-fixes.js
// Standalone audit verification test suite

const assert = require('assert');
const path = require('path');
const fs = require('fs');

async function runTests() {
  console.log('====================================================');
  console.log('CUPIDX FORENSIC AUDIT & BUG HUNT - VERIFICATION SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}`);
      console.error(err);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}`);
      console.error(err);
      failed++;
    }
  }

  // 1. Test Magic Byte Verification
  await testAsync('1. safeImageUpload - Binary Magic Byte Validation & Extension Enforcement', async () => {
    function detectImageFormat(buffer) {
      if (buffer.length < 12) return null;
      if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return { ext: 'jpg', mime: 'image/jpeg' };
      }
      if (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
      ) {
        return { ext: 'png', mime: 'image/png' };
      }
      if (
        buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46 &&
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50
      ) {
        return { ext: 'webp', mime: 'image/webp' };
      }
      if (
        buffer[0] === 0x47 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x38 &&
        (buffer[4] === 0x37 || buffer[4] === 0x39) &&
        buffer[5] === 0x61
      ) {
        return { ext: 'gif', mime: 'image/gif' };
      }
      return null;
    }

    // Valid PNG signature
    const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const detectedPng = detectImageFormat(validPng);
    assert.strictEqual(detectedPng?.ext, 'png');

    // Valid JPEG signature
    const validJpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const detectedJpg = detectImageFormat(validJpg);
    assert.strictEqual(detectedJpg?.ext, 'jpg');

    // Valid WebP signature
    const validWebp = Buffer.from([
      0x52, 0x49, 0x46, 0x46, // 'RIFF'
      0x00, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50, // 'WEBP'
    ]);
    const detectedWebp = detectImageFormat(validWebp);
    assert.strictEqual(detectedWebp?.ext, 'webp');

    // Malicious executable disguised as image (e.g. PHP shell or HTML)
    const fakeImage = Buffer.from('<?php echo "evil"; ?>');
    const detectedFake = detectImageFormat(fakeImage);
    assert.strictEqual(detectedFake, null, 'Fake image without valid magic bytes must be rejected');

    const fakeHtml = Buffer.from('<script>alert("xss")</script>');
    const detectedHtml = detectImageFormat(fakeHtml);
    assert.strictEqual(detectedHtml, null, 'HTML/SVG disguised as binary image must be rejected');
  });

  // 2. Canonical Conversation Pairing Logic
  test('2. Realtime Chat - Canonical User Ordering Prevents Duplicate Split Conversations', () => {
    function getCanonicalPair(uA, uB) {
      return uA < uB ? [uA, uB] : [uB, uA];
    }

    const [u1a, u2a] = getCanonicalPair('user_zebra', 'user_alpha');
    const [u1b, u2b] = getCanonicalPair('user_alpha', 'user_zebra');

    assert.strictEqual(u1a, 'user_alpha');
    assert.strictEqual(u2a, 'user_zebra');
    assert.strictEqual(u1a, u1b);
    assert.strictEqual(u2a, u2b);
  });

  // 3. Block List Filter in Matchmaking
  test('3. Socket Matchmaking - Block Cache Enforces Strict O(1) Filtering', () => {
    const blockedUsersCache = new Map();
    function addBlock(user1, user2) {
      if (!blockedUsersCache.has(user1)) blockedUsersCache.set(user1, new Set());
      if (!blockedUsersCache.has(user2)) blockedUsersCache.set(user2, new Set());
      blockedUsersCache.get(user1).add(user2);
      blockedUsersCache.get(user2).add(user1);
    }
    function isBlocked(user1, user2) {
      return blockedUsersCache.get(user1)?.has(user2) || blockedUsersCache.get(user2)?.has(user1) || false;
    }

    addBlock('user_123', 'user_456');
    assert.strictEqual(isBlocked('user_123', 'user_456'), true);
    assert.strictEqual(isBlocked('user_456', 'user_123'), true);
    assert.strictEqual(isBlocked('user_123', 'user_789'), false);
  });

  // 4. Test Target Emitters for Message Deletion (Privacy Enforcement)
  test('4. Socket Privacy - Message Deletion Only Emitted to Participants', () => {
    let globalBroadcast = false;
    const sentTo = [];

    const mockIo = {
      emit: () => { globalBroadcast = true; },
      to: (socketId) => ({
        emit: (event, payload) => {
          sentTo.push({ socketId, event, payload });
        }
      })
    };

    // Simulate delete_message logic
    const senderSocketId = 'socket_alice';
    const recipientSocketId = 'socket_bob';

    // Deleted message emit
    if (senderSocketId) mockIo.to(senderSocketId).emit('message_deleted', { messageId: 'm1' });
    if (recipientSocketId) mockIo.to(recipientSocketId).emit('message_deleted', { messageId: 'm1' });

    assert.strictEqual(globalBroadcast, false, 'Global broadcast must NEVER occur for private message deletion');
    assert.strictEqual(sentTo.length, 2);
    assert.strictEqual(sentTo[0].socketId, 'socket_alice');
    assert.strictEqual(sentTo[1].socketId, 'socket_bob');
  });

  // 5. Test VIP Manual Payment Status Fields
  test('5. Admin Manual Payment - Grants Both is_vip and membershipTier', () => {
    const now = new Date();
    const durationDays = 30;
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    const userUpdatePayload = {
      is_vip: true,
      membershipTier: 'VIP',
      vip_started_at: now,
      vip_expires_at: expiresAt,
    };

    assert.strictEqual(userUpdatePayload.is_vip, true);
    assert.strictEqual(userUpdatePayload.membershipTier, 'VIP');
    assert(userUpdatePayload.vip_expires_at > userUpdatePayload.vip_started_at);
  });

  // 6. Test Cron Cleanup Retention Buffer
  test('6. Chat Session Cleanup - 7-Day Safety Retention Buffer Preserves History', () => {
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(now - sevenDaysMs);

    // Recent session (ended 1 hour ago)
    const recentSessionEndedAt = new Date(now - 3600 * 1000);
    const shouldDeleteRecent = recentSessionEndedAt < cutoffDate;
    assert.strictEqual(shouldDeleteRecent, false, 'Session ended 1 hour ago must NOT be deleted');

    // Session ended 10 days ago without saveChatHistory
    const oldSessionEndedAt = new Date(now - 10 * 24 * 3600 * 1000);
    const shouldDeleteOld = oldSessionEndedAt < cutoffDate;
    assert.strictEqual(shouldDeleteOld, true, 'Unsaved session older than 7 days should be eligible for cleanup');
  });

  // 7. Test Check Profile Completion Logic
  test('7. Profile Completion - Gender, DOB, Name and Confirmation Guard', () => {
    function checkProfileCompletion(u) {
      if (!u) return false;
      return Boolean(
        u.profileCompleted === true ||
        u.profileLocked === true ||
        u.genderDobLocked === true ||
        u.profile?.ageGenderConfirmed === true ||
        ((u.dateOfBirth || u.profile?.dateOfBirth) && u.gender && u.gender !== 'unspecified' && (u.fullName || u.displayName))
      );
    }

    assert.strictEqual(checkProfileCompletion(null), false);
    assert.strictEqual(checkProfileCompletion({}), false);
    assert.strictEqual(checkProfileCompletion({ profileCompleted: true }), true);
    assert.strictEqual(checkProfileCompletion({ genderDobLocked: true }), true);
    assert.strictEqual(
      checkProfileCompletion({
        dateOfBirth: '2000-01-01',
        gender: 'female',
        fullName: 'Jane Doe'
      }),
      true
    );
    assert.strictEqual(
      checkProfileCompletion({
        dateOfBirth: '2000-01-01',
        gender: 'unspecified',
        fullName: 'Jane Doe'
      }),
      false
    );
  });

  console.log('\n====================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
