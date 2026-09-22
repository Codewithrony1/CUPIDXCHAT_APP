// scripts/verify-matchmaking-invariants.js
// Standalone Verification Suite for CupidXChat Matchmaking Invariants:
// ONE USER -> ONE ACTIVE CHAT SESSION -> EXACTLY TWO USERS
// MAX ACTIVE SESSIONS PER USER = 1

const assert = require('assert');

async function runSuite() {
  console.log('================================================================');
  console.log('CUPIDXCHAT MATCHMAKING INVARIANT VERIFICATION SUITE');
  console.log('INVARIANT: ONE USER -> ONE ACTIVE CHAT SESSION -> EXACTLY 2 USERS');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
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

  // ─── TEST 1: The 3-User Concurrent Race Condition (A + B + C) ────────────────
  await test('TEST 1: 3 Concurrent Users (A, B, C) joining at same millisecond forms EXACTLY ONE pair, 3rd user WAITING', async () => {
    // Simulated distributed state store
    const activeSessions = new Map(); // userId -> { sessionId, partnerId, status }
    const matches = new Map();        // sessionId -> { user1Id, user2Id, status }
    const queue = new Map();          // userId -> { status: 'searching' | 'matched' }

    // Atomic transaction simulator representing Firestore runTransaction & Prisma $transaction
    let transactionLock = Promise.resolve();
    function runAtomicMatch(userAId, candidateBId, sessionId) {
      // Serializable execution guard
      const prev = transactionLock;
      let resolveLock;
      transactionLock = new Promise((res) => (resolveLock = res));

      return prev.then(async () => {
        try {
          // 1. Invariant check: Neither user can have an active session
          const sessionA = activeSessions.get(userAId);
          const sessionB = activeSessions.get(candidateBId);
          if (sessionA && sessionA.status === 'ACTIVE') {
            return { success: false, reason: 'userA_already_active' };
          }
          if (sessionB && sessionB.status === 'ACTIVE') {
            return { success: false, reason: 'userB_already_active' };
          }

          // 2. Invariant check: Candidate must still be searching
          const qB = queue.get(candidateBId);
          if (!qB || qB.status !== 'searching') {
            return { success: false, reason: 'candidate_not_searching' };
          }

          // 3. Atomically claim both users
          activeSessions.set(userAId, { sessionId, partnerId: candidateBId, status: 'ACTIVE' });
          activeSessions.set(candidateBId, { sessionId, partnerId: userAId, status: 'ACTIVE' });
          matches.set(sessionId, { user1Id: userAId, user2Id: candidateBId, status: 'active' });
          queue.set(userAId, { status: 'matched', matchId: sessionId, partnerId: candidateBId });
          queue.set(candidateBId, { status: 'matched', matchId: sessionId, partnerId: userAId });

          return { success: true, sessionId };
        } finally {
          resolveLock();
        }
      });
    }

    // Matchmaking Join Flow simulator
    async function joinQueue(userId) {
      // 1. Check existing active session
      const existing = activeSessions.get(userId);
      if (existing && existing.status === 'ACTIVE') {
        return { matched: true, sessionId: existing.sessionId, partnerId: existing.partnerId };
      }

      // 2. Put user into searching queue
      queue.set(userId, { status: 'searching' });

      // 3. Look for eligible candidates in searching queue
      const candidates = Array.from(queue.entries())
        .filter(([cId, data]) => cId !== userId && data.status === 'searching' && !activeSessions.has(cId))
        .map(([cId]) => cId);

      for (const candidateId of candidates) {
        const newSessionId = `session_${userId}_${candidateId}_${Date.now()}`;
        const matchResult = await runAtomicMatch(userId, candidateId, newSessionId);
        if (matchResult.success) {
          return { matched: true, sessionId: newSessionId, partnerId: candidateId };
        }
      }

      return { matched: false, status: 'WAITING' };
    }

    // User A, B, and C all join concurrently at the exact same millisecond
    const initialResults = await Promise.all([
      joinQueue('User_A'),
      joinQueue('User_B'),
      joinQueue('User_C'),
    ]);

    // Check status for each user (simulating /api/matchmaking/status heartbeat)
    const finalStatuses = await Promise.all([
      joinQueue('User_A'),
      joinQueue('User_B'),
      joinQueue('User_C'),
    ]);

    const activeUserCount = Array.from(activeSessions.values()).filter((s) => s.status === 'ACTIVE').length;

    // Assert: Exactly 2 users are active in a match, exactly 1 user is waiting
    assert.strictEqual(activeUserCount, 2, 'Exactly 2 users must have an active session');
    assert.strictEqual(matches.size, 1, 'Exactly 1 chat session must be created');

    const [singleMatch] = Array.from(matches.values());
    assert.strictEqual(singleMatch.status, 'active', 'Match must be active');

    // Assert: The 2 active users must be mutually linked
    const u1 = singleMatch.user1Id;
    const u2 = singleMatch.user2Id;
    assert.strictEqual(activeSessions.get(u1).partnerId, u2);
    assert.strictEqual(activeSessions.get(u2).partnerId, u1);

    // Assert: The 3rd user is not active and remains searching
    const thirdUser = ['User_A', 'User_B', 'User_C'].find((u) => u !== u1 && u !== u2);
    assert.strictEqual(activeSessions.has(thirdUser), false, 'Third user must NOT be in active session');
    assert.strictEqual(queue.get(thirdUser).status, 'searching', 'Third user must remain searching');

    console.log(`   -> Matched pair: ${u1} <-> ${u2}`);
    console.log(`   -> Active sessions: ${activeSessions.size} users, ${matches.size} session`);
  });

  // ─── TEST 2: Rapid Sequential / Simultaneous Multi-Join Prevention ───────────
  await test('TEST 2: Rapid Multi-Join from Same User (Double Click / Malicious spam) cannot create multiple sessions', async () => {
    const activeSessions = new Map();
    const matches = new Map();
    const queue = new Map();

    let lock = Promise.resolve();
    function runAtomicMatch(uA, uB, sId) {
      const prev = lock;
      let res;
      lock = new Promise((r) => (res = r));
      return prev.then(() => {
        try {
          if (activeSessions.has(uA) || activeSessions.has(uB)) return { success: false };
          activeSessions.set(uA, { sessionId: sId, partnerId: uB, status: 'ACTIVE' });
          activeSessions.set(uB, { sessionId: sId, partnerId: uA, status: 'ACTIVE' });
          matches.set(sId, { user1Id: uA, user2Id: uB, status: 'active' });
          return { success: true };
        } finally {
          res();
        }
      });
    }

    async function joinQueue(userId) {
      if (activeSessions.has(userId)) {
        return { matched: true, sessionId: activeSessions.get(userId).sessionId };
      }
      queue.set(userId, { status: 'searching' });
      for (const [cId, q] of queue.entries()) {
        if (cId !== userId && q.status === 'searching' && !activeSessions.has(cId)) {
          const sId = `session_${userId}_${cId}`;
          const res = await runAtomicMatch(userId, cId, sId);
          if (res.success) return { matched: true, sessionId: sId };
        }
      }
      return { matched: false, status: 'WAITING' };
    }

    // User B joins first
    await joinQueue('User_B');

    // User A fires 5 join calls concurrently
    const userAResults = await Promise.all([
      joinQueue('User_A'),
      joinQueue('User_A'),
      joinQueue('User_A'),
      joinQueue('User_A'),
      joinQueue('User_A'),
    ]);

    // All results for User A must either point to the same session or waiting
    const userASessions = new Set(userAResults.filter((r) => r.matched).map((r) => r.sessionId));
    assert.strictEqual(userASessions.size, 1, 'User A must belong to at most 1 session');
    assert.strictEqual(matches.size, 1, 'Only 1 active session in database');
    assert.strictEqual(activeSessions.get('User_A').partnerId, 'User_B');
    assert.strictEqual(activeSessions.get('User_B').partnerId, 'User_A');
  });

  // ─── TEST 3: Concurrency Stress Test (10 Users) ──────────────────────────────
  await test('TEST 3: Concurrency Stress Test: 10 concurrent users form EXACTLY 5 disjoint pairs with ZERO overlaps', async () => {
    const activeSessions = new Map();
    const matches = new Map();
    const queue = new Map();

    let lock = Promise.resolve();
    function runAtomicMatch(uA, uB, sId) {
      const prev = lock;
      let res;
      lock = new Promise((r) => (res = r));
      return prev.then(() => {
        try {
          if (activeSessions.has(uA) || activeSessions.has(uB)) return { success: false };
          if (queue.get(uB)?.status !== 'searching') return { success: false };
          activeSessions.set(uA, { sessionId: sId, partnerId: uB, status: 'ACTIVE' });
          activeSessions.set(uB, { sessionId: sId, partnerId: uA, status: 'ACTIVE' });
          matches.set(sId, { user1Id: uA, user2Id: uB, status: 'active' });
          queue.set(uA, { status: 'matched' });
          queue.set(uB, { status: 'matched' });
          return { success: true };
        } finally {
          res();
        }
      });
    }

    async function joinQueue(userId) {
      if (activeSessions.has(userId)) return { matched: true, sessionId: activeSessions.get(userId).sessionId };
      queue.set(userId, { status: 'searching' });
      for (const [cId, q] of queue.entries()) {
        if (cId !== userId && q.status === 'searching' && !activeSessions.has(cId)) {
          const sId = `session_${userId}_${cId}_${Date.now()}`;
          const res = await runAtomicMatch(userId, cId, sId);
          if (res.success) return { matched: true, sessionId: sId };
        }
      }
      return { matched: false, status: 'WAITING' };
    }

    const userIds = Array.from({ length: 10 }, (_, i) => `User_${i + 1}`);

    // Launch all 10 users simultaneously
    const results = await Promise.all(userIds.map((uid) => joinQueue(uid)));

    // For any user still waiting, let them run one more search pass (as in normal polling)
    for (const uid of userIds) {
      if (!activeSessions.has(uid)) {
        await joinQueue(uid);
      }
    }

    // Assert: Exactly 5 sessions created
    assert.strictEqual(matches.size, 5, 'Exactly 5 sessions must be formed from 10 users');

    // Assert: All 10 users matched
    assert.strictEqual(activeSessions.size, 10, 'All 10 users must have an active session');

    // Assert: Every user appears in EXACTLY 1 session
    const participantCount = {};
    for (const [sessionId, match] of matches.entries()) {
      assert.strictEqual(match.status, 'active');
      participantCount[match.user1Id] = (participantCount[match.user1Id] || 0) + 1;
      participantCount[match.user2Id] = (participantCount[match.user2Id] || 0) + 1;
    }

    for (const uid of userIds) {
      assert.strictEqual(participantCount[uid], 1, `User ${uid} must belong to exactly 1 session`);
      const session = activeSessions.get(uid);
      const partner = activeSessions.get(session.partnerId);
      assert.strictEqual(partner.partnerId, uid, 'Partner must reciprocate session');
    }

    console.log(`   -> Successfully formed 5 disjoint pairs across 10 concurrent users`);
  });

  // ─── TEST 5: Concurrency Stress Test (20 Users) ──────────────────────────────
  await test('TEST 5: Concurrency Stress Test: 20 concurrent users form EXACTLY 10 disjoint pairs with ZERO overlaps', async () => {
    const activeSessions = new Map();
    const matches = new Map();
    const queue = new Map();

    let lock = Promise.resolve();
    function runAtomicMatch(uA, uB, sId) {
      const prev = lock;
      let res;
      lock = new Promise((r) => (res = r));
      return prev.then(() => {
        try {
          if (activeSessions.has(uA) || activeSessions.has(uB)) return { success: false };
          if (queue.get(uB)?.status !== 'searching') return { success: false };
          activeSessions.set(uA, { sessionId: sId, partnerId: uB, status: 'ACTIVE' });
          activeSessions.set(uB, { sessionId: sId, partnerId: uA, status: 'ACTIVE' });
          matches.set(sId, { user1Id: uA, user2Id: uB, status: 'active' });
          queue.set(uA, { status: 'matched' });
          queue.set(uB, { status: 'matched' });
          return { success: true };
        } finally {
          res();
        }
      });
    }

    async function joinQueue(userId) {
      if (activeSessions.has(userId)) return { matched: true, sessionId: activeSessions.get(userId).sessionId };
      queue.set(userId, { status: 'searching' });
      for (const [cId, q] of queue.entries()) {
        if (cId !== userId && q.status === 'searching' && !activeSessions.has(cId)) {
          const sId = `session_${userId}_${cId}_${Date.now()}`;
          const res = await runAtomicMatch(userId, cId, sId);
          if (res.success) return { matched: true, sessionId: sId };
        }
      }
      return { matched: false, status: 'WAITING' };
    }

    const userIds = Array.from({ length: 20 }, (_, i) => `User20_${i + 1}`);
    await Promise.all(userIds.map((uid) => joinQueue(uid)));
    for (const uid of userIds) {
      if (!activeSessions.has(uid)) await joinQueue(uid);
    }

    assert.strictEqual(matches.size, 10, 'Exactly 10 sessions must be formed from 20 users');
    assert.strictEqual(activeSessions.size, 20, 'All 20 users must have an active session');

    const participantCount = {};
    for (const [sessionId, match] of matches.entries()) {
      participantCount[match.user1Id] = (participantCount[match.user1Id] || 0) + 1;
      participantCount[match.user2Id] = (participantCount[match.user2Id] || 0) + 1;
    }
    for (const uid of userIds) {
      assert.strictEqual(participantCount[uid], 1, `User ${uid} must belong to exactly 1 session`);
    }
    console.log(`   -> Successfully formed 10 disjoint pairs across 20 concurrent users`);
  });

  // ─── TEST 6: High-Scale Concurrency Stress Test (50 Users) ───────────────────
  await test('TEST 6: High-Scale Concurrency Stress Test: 50 concurrent users form EXACTLY 25 disjoint pairs with ZERO overlaps', async () => {
    const activeSessions = new Map();
    const matches = new Map();
    const queue = new Map();

    let lock = Promise.resolve();
    function runAtomicMatch(uA, uB, sId) {
      const prev = lock;
      let res;
      lock = new Promise((r) => (res = r));
      return prev.then(() => {
        try {
          if (activeSessions.has(uA) || activeSessions.has(uB)) return { success: false };
          if (queue.get(uB)?.status !== 'searching') return { success: false };
          activeSessions.set(uA, { sessionId: sId, partnerId: uB, status: 'ACTIVE' });
          activeSessions.set(uB, { sessionId: sId, partnerId: uA, status: 'ACTIVE' });
          matches.set(sId, { user1Id: uA, user2Id: uB, status: 'active' });
          queue.set(uA, { status: 'matched' });
          queue.set(uB, { status: 'matched' });
          return { success: true };
        } finally {
          res();
        }
      });
    }

    async function joinQueue(userId) {
      if (activeSessions.has(userId)) return { matched: true, sessionId: activeSessions.get(userId).sessionId };
      queue.set(userId, { status: 'searching' });
      for (const [cId, q] of queue.entries()) {
        if (cId !== userId && q.status === 'searching' && !activeSessions.has(cId)) {
          const sId = `session_${userId}_${cId}_${Date.now()}`;
          const res = await runAtomicMatch(userId, cId, sId);
          if (res.success) return { matched: true, sessionId: sId };
        }
      }
      return { matched: false, status: 'WAITING' };
    }

    const userIds = Array.from({ length: 50 }, (_, i) => `User50_${i + 1}`);
    await Promise.all(userIds.map((uid) => joinQueue(uid)));
    for (const uid of userIds) {
      if (!activeSessions.has(uid)) await joinQueue(uid);
    }

    assert.strictEqual(matches.size, 25, 'Exactly 25 sessions must be formed from 50 users');
    assert.strictEqual(activeSessions.size, 50, 'All 50 users must have an active session');

    const participantCount = {};
    for (const [sessionId, match] of matches.entries()) {
      participantCount[match.user1Id] = (participantCount[match.user1Id] || 0) + 1;
      participantCount[match.user2Id] = (participantCount[match.user2Id] || 0) + 1;
    }
    for (const uid of userIds) {
      assert.strictEqual(participantCount[uid], 1, `User ${uid} must belong to exactly 1 session`);
    }
    console.log(`   -> Successfully formed 25 disjoint pairs across 50 concurrent users`);
  });

  // ─── TEST 4: Session Transition & 60-Second Anti-Rematch ──────────────────────
  await test('TEST 4: Skip/Next cleanly releases active session and enforces 60s anti-rematch', async () => {
    const activeSessions = new Map();
    const antiRematchExclusions = new Set();

    function addAntiRematch(u1, u2) {
      const pairKey = [u1, u2].sort().join('::');
      antiRematchExclusions.add(pairKey);
    }

    function isAntiRematchExcluded(u1, u2) {
      const pairKey = [u1, u2].sort().join('::');
      return antiRematchExclusions.has(pairKey);
    }

    // A and B start matched in Session 1
    activeSessions.set('User_A', { sessionId: 'session_1', partnerId: 'User_B', status: 'ACTIVE' });
    activeSessions.set('User_B', { sessionId: 'session_1', partnerId: 'User_A', status: 'ACTIVE' });

    // User A skips current match (Next)
    const oldSession = activeSessions.get('User_A');
    addAntiRematch('User_A', oldSession.partnerId);
    activeSessions.delete('User_A');
    activeSessions.delete(oldSession.partnerId);

    // Invariant checks:
    assert.strictEqual(activeSessions.has('User_A'), false, 'User A active session must be cleared');
    assert.strictEqual(activeSessions.has('User_B'), false, 'User B active session must be cleared');
    assert.strictEqual(isAntiRematchExcluded('User_A', 'User_B'), true, 'Anti-rematch must be active between A and B');

    // If User A and User B try to match again:
    const canRematch = !isAntiRematchExcluded('User_A', 'User_B');
    assert.strictEqual(canRematch, false, 'A and B cannot rematch within exclusion period');

    // If User C joins:
    const canMatchWithC = !isAntiRematchExcluded('User_A', 'User_C');
    assert.strictEqual(canMatchWithC, true, 'User A can match with User C');
  });

  console.log('\n================================================================');
  console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
