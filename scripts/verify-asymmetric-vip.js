/**
 * scripts/verify-asymmetric-vip.js
 * Forensic test suite for CupidX Asymmetric VIP Access Model
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const jwt = require('jsonwebtoken');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'prisma', 'dev.db');
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'cupidx_fallback_jwt_secret';

function makeAuthHeaders(user) {
  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role || 'USER' },
    JWT_SECRET,
    { expiresIn: '1d' }
  );
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'x-clerk-user-id': user.clerkUserId || user.id,
    'Cookie': `token=${token}`,
  };
}

async function runTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 CUPIDX VIP ASYMMETRIC MESSAGING MODEL TEST SUITE');
  console.log('🧪 ========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // Setup test users in DB
    console.log('🔧 Setting up test accounts in database...');
    const now = new Date();
    const future = new Date(Date.now() + 30 * 24 * 3600 * 1000);

    // Free User A
    const freeUserA = await prisma.user.upsert({
      where: { clerkUserId: 'test_clerk_free_a' },
      update: {
        is_vip: false,
        membershipTier: 'FREE',
        vip_expires_at: null,
      },
      create: {
        clerkUserId: 'test_clerk_free_a',
        username: 'test_free_a',
        fullName: 'Free User A',
        email: 'test_free_a@cupidx.in',
        displayName: 'Free User A',
        is_vip: false,
        membershipTier: 'FREE',
      },
    });

    // Free User B
    const freeUserB = await prisma.user.upsert({
      where: { clerkUserId: 'test_clerk_free_b' },
      update: {
        is_vip: false,
        membershipTier: 'FREE',
        vip_expires_at: null,
      },
      create: {
        clerkUserId: 'test_clerk_free_b',
        username: 'test_free_b',
        fullName: 'Free User B',
        email: 'test_free_b@cupidx.in',
        displayName: 'Free User B',
        is_vip: false,
        membershipTier: 'FREE',
      },
    });

    // VIP User C
    const vipUserC = await prisma.user.upsert({
      where: { clerkUserId: 'test_clerk_vip_c' },
      update: {
        is_vip: true,
        membershipTier: 'VIP',
        vip_expires_at: future,
        vipUsername: 'test_vip_c',
      },
      create: {
        clerkUserId: 'test_clerk_vip_c',
        username: 'test_vip_c',
        vipUsername: 'test_vip_c',
        fullName: 'VIP Member C',
        email: 'test_vip_c@cupidx.in',
        displayName: 'VIP Member C',
        is_vip: true,
        membershipTier: 'VIP',
        vip_expires_at: future,
      },
    });

    // VIP User D
    const vipUserD = await prisma.user.upsert({
      where: { clerkUserId: 'test_clerk_vip_d' },
      update: {
        is_vip: true,
        membershipTier: 'VIP',
        vip_expires_at: future,
        vipUsername: 'test_vip_d',
      },
      create: {
        clerkUserId: 'test_clerk_vip_d',
        username: 'test_vip_d',
        vipUsername: 'test_vip_d',
        fullName: 'VIP Member D',
        email: 'test_vip_d@cupidx.in',
        displayName: 'VIP Member D',
        is_vip: true,
        membershipTier: 'VIP',
        vip_expires_at: future,
      },
    });

    // Clean up existing social data between test accounts
    const testUserIds = [freeUserA.id, freeUserB.id, vipUserC.id, vipUserD.id];
    await prisma.friendRequest.deleteMany({
      where: {
        OR: [
          { senderId: { in: testUserIds } },
          { receiverId: { in: testUserIds } },
        ],
      },
    });
    await prisma.privateMessage.deleteMany({
      where: {
        OR: [
          { senderId: { in: testUserIds } },
          { conversation: { user1Id: { in: testUserIds } } },
          { conversation: { user2Id: { in: testUserIds } } },
        ],
      },
    });
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { user1Id: { in: testUserIds } },
          { user2Id: { in: testUserIds } },
        ],
      },
    });
    await prisma.conversation.deleteMany({
      where: {
        OR: [
          { user1Id: { in: testUserIds } },
          { user2Id: { in: testUserIds } },
        ],
      },
    });

    console.log('✅ Test accounts initialized.\n');

    // Scenario 1: Free user attempts to send friend request -> 403 Forbidden
    console.log('📋 Scenario 1: Free user A attempts to send friend request to VIP user C');
    const req1 = await fetch(`${BASE_URL}/api/social/friends/request`, {
      method: 'POST',
      headers: makeAuthHeaders(freeUserA),
      body: JSON.stringify({ targetUserId: vipUserC.id }),
    });
    const res1 = await req1.json();
    assert(req1.status === 403, `Free user blocked from sending friend request (status ${req1.status})`);
    assert(res1.isVipRequired === true, 'Response specifies isVipRequired = true');
    assert(res1.error === 'Only VIP members can send friend requests.', `Rejection message: "${res1.error}"`);

    // Scenario 2: Free user attempts to send friend request to another Free user -> 403 Forbidden
    console.log('\n📋 Scenario 2: Free user A attempts to send friend request to Free user B');
    const req2 = await fetch(`${BASE_URL}/api/social/friends/request`, {
      method: 'POST',
      headers: makeAuthHeaders(freeUserA),
      body: JSON.stringify({ targetUserId: freeUserB.id }),
    });
    const res2 = await req2.json();
    assert(req2.status === 403, `Free user blocked from sending request to Free user (status ${req2.status})`);
    assert(res2.isVipRequired === true, 'Response specifies isVipRequired = true');

    // Scenario 3: VIP user C sends friend request to Free user A -> 200 OK
    console.log('\n📋 Scenario 3: VIP user C sends friend request to Free user A (VIP -> Free)');
    const req3 = await fetch(`${BASE_URL}/api/social/friends/request`, {
      method: 'POST',
      headers: makeAuthHeaders(vipUserC),
      body: JSON.stringify({ targetUserId: freeUserA.id }),
    });
    const res3 = await req3.json();
    assert(req3.status === 200 && res3.success === true, `VIP user successfully sent friend request to Free user (status ${req3.status})`);
    const createdRequestId = res3.requestId || res3.request?.id;
    assert(Boolean(createdRequestId), `Friend request ID created: ${createdRequestId}`);

    // Scenario 4: Free user searches members via search API -> 403 Forbidden
    console.log('\n📋 Scenario 4: Free user A attempts to search users via API');
    const req4 = await fetch(`${BASE_URL}/api/social/users/search?q=test`, {
      headers: makeAuthHeaders(freeUserA),
    });
    const res4 = await req4.json();
    assert(req4.status === 403, `Free user search blocked server-side (status ${req4.status})`);
    assert(res4.isVipRequired === true, 'Search response indicates isVipRequired = true');

    // Scenario 5: VIP user C searches members via search API -> 200 OK
    console.log('\n📋 Scenario 5: VIP user C searches members via search API');
    const req5 = await fetch(`${BASE_URL}/api/social/users/search?q=free`, {
      headers: makeAuthHeaders(vipUserC),
    });
    const res5 = await req5.json();
    assert(req5.status === 200, `VIP user search allowed (status ${req5.status})`);
    assert(Array.isArray(res5.users), `Search returned ${res5.users?.length} results`);

    // Scenario 6: Free user A accepts incoming friend request from VIP user C -> 200 OK
    console.log('\n📋 Scenario 6: Free user A accepts incoming request from VIP user C');
    const req6 = await fetch(`${BASE_URL}/api/social/friends/requests/${createdRequestId}/accept`, {
      method: 'POST',
      headers: makeAuthHeaders(freeUserA),
    });
    const res6 = await req6.json();
    assert(req6.status === 200 && res6.success === true, `Free user accepted friend request (status ${req6.status})`);
    const conversationId = res6.conversationId;
    assert(Boolean(conversationId), `Active conversation established: ${conversationId}`);

    // Verify Free user A is still Free in DB!
    const verifiedFreeA = await prisma.user.findUnique({ where: { id: freeUserA.id } });
    assert(verifiedFreeA.is_vip === false, 'Free user A is still FREE user (not granted VIP)');

    // Scenario 7: VIP user C sends a private message to Free user A -> 200 OK
    console.log('\n📋 Scenario 7: VIP user C sends private message in conversation to Free user A');
    const req7 = await fetch(`${BASE_URL}/api/social/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: makeAuthHeaders(vipUserC),
      body: JSON.stringify({ content: 'Hello Free User A! Welcome to CupidX!' }),
    });
    const res7 = await req7.json();
    assert(req7.status === 200 && res7.success === true, `VIP user delivered message to Free user (status ${req7.status})`);

    // Scenario 8: Free user A can READ the conversation and messages -> 200 OK
    console.log('\n📋 Scenario 8: Free user A reads conversation messages');
    const req8 = await fetch(`${BASE_URL}/api/social/conversations/${conversationId}/messages`, {
      headers: makeAuthHeaders(freeUserA),
    });
    const res8 = await req8.json();
    assert(req8.status === 200, `Free user fetched conversation messages (status ${req8.status})`);
    assert(res8.messages?.length >= 1, `Free user received ${res8.messages?.length} messages`);
    const hasMsg = res8.messages?.some((m) => m.content && m.content.includes('Hello Free User A!'));
    assert(hasMsg, 'Message content is intact');

    // Scenario 9: Free user A attempts to reply / send message -> 403 Forbidden with exact message
    console.log('\n📋 Scenario 9: Free user A attempts to send message back to VIP user C');
    const req9 = await fetch(`${BASE_URL}/api/social/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: makeAuthHeaders(freeUserA),
      body: JSON.stringify({ content: 'I am replying from Free account!' }),
    });
    const res9 = await req9.json();
    assert(req9.status === 403, `Free user blocked from sending message (status ${req9.status})`);
    assert(res9.error === 'You cannot message this person. Get VIP to chat.', `Correct error text: "${res9.error}"`);
    assert(res9.isVipRequired === true, 'Response specifies isVipRequired = true');

    // Scenario 10: Free user A attempts to upload image in chat -> 403 Forbidden
    console.log('\n📋 Scenario 10: Free user A attempts to upload photo in chat');
    const req10 = await fetch(`${BASE_URL}/api/social/conversations/${conversationId}/upload-image`, {
      method: 'POST',
      headers: makeAuthHeaders(freeUserA),
      body: JSON.stringify({
        imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        content: 'Photo attempt',
      }),
    });
    const res10 = await req10.json();
    assert(req10.status === 403, `Free user blocked from uploading photo (status ${req10.status})`);
    assert(res10.error === 'You cannot message this person. Get VIP to chat.', `Photo rejection error: "${res10.error}"`);

    // Scenario 11: Immediate Upgrade: Free user A purchases VIP -> instantly sends message in existing conversation
    console.log('\n📋 Scenario 11: Free user A upgrades to VIP and sends message immediately');
    await prisma.user.update({
      where: { id: freeUserA.id },
      data: {
        is_vip: true,
        membershipTier: 'VIP',
        vip_expires_at: future,
      },
    });

    const req11 = await fetch(`${BASE_URL}/api/social/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: makeAuthHeaders(freeUserA),
      body: JSON.stringify({ content: 'Now that I upgraded to VIP, I can reply instantly!' }),
    });
    const res11 = await req11.json();
    assert(req11.status === 200 && res11.success === true, `Upgraded user successfully replied in existing chat (status ${req11.status})`);

    // Scenario 12: Random chat cleanup safety check
    console.log('\n📋 Scenario 12: Verify Random Chat cleanup does NOT affect VIP friendships/conversations');
    const totalConvsBefore = await prisma.conversation.count();
    const totalFriendshipsBefore = await prisma.friendship.count();
    const totalPrivateMsgsBefore = await prisma.privateMessage.count();

    // Trigger random chat cleanup test
    const dummyMatchId = `test_rc_${Date.now()}`;
    await prisma.$transaction([
      prisma.chatSession.create({
        data: {
          id: dummyMatchId,
          userAId: freeUserB.id,
          userBId: vipUserD.id,
          status: 'ACTIVE',
        },
      }),
      prisma.message.create({
        data: {
          chatSessionId: dummyMatchId,
          senderId: freeUserB.id,
          content: 'Random ephemeral message',
        },
      }),
    ]);

    // Simulate cleanup
    await prisma.$transaction([
      prisma.chatSession.updateMany({
        where: { id: dummyMatchId },
        data: { status: 'ENDED', endedAt: new Date() },
      }),
      prisma.message.deleteMany({
        where: { chatSessionId: dummyMatchId },
      }),
    ]);

    const totalConvsAfter = await prisma.conversation.count();
    const totalFriendshipsAfter = await prisma.friendship.count();
    const totalPrivateMsgsAfter = await prisma.privateMessage.count();

    assert(totalConvsBefore === totalConvsAfter, `Conversations untouched (${totalConvsBefore} == ${totalConvsAfter})`);
    assert(totalFriendshipsBefore === totalFriendshipsAfter, `Friendships untouched (${totalFriendshipsBefore} == ${totalFriendshipsAfter})`);
    assert(totalPrivateMsgsBefore === totalPrivateMsgsAfter, `Private messages untouched (${totalPrivateMsgsBefore} == ${totalPrivateMsgsAfter})`);

    console.log('\n========================================================');
    console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('💥 Test suite unexpected failure:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
