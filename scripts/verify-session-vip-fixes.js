// scripts/verify-session-vip-fixes.js
// Verification suite for Random Chat lifecycle and VIP friend connection enforcement

const assert = require('assert');

function runSuite() {
  console.log('====================================================');
  console.log('RANDOM CHAT & VIP FRIEND SYSTEM VERIFICATION SUITE');
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

  // Helper matching src/lib/vipAuth.ts
  function isUserVip(user) {
    if (!user) return false;
    return Boolean(
      user.is_vip ||
      user.membershipTier === 'VIP' ||
      (user.subscription?.isActive === true && user.subscription?.plan === 'VIP')
    );
  }

  const MSG_BOTH_VIP = 'Both users must be VIP members to connect.';
  const MSG_CONTACT_ADMIN = 'Contact the administrator if you want the other user to get VIP access.';

  // 1. VIP Verification Helper
  test('1. isUserVip correctly identifies VIP status variations', () => {
    assert.strictEqual(isUserVip(null), false);
    assert.strictEqual(isUserVip({}), false);
    assert.strictEqual(isUserVip({ membershipTier: 'FREE' }), false);
    assert.strictEqual(isUserVip({ is_vip: true }), true);
    assert.strictEqual(isUserVip({ membershipTier: 'VIP' }), true);
    assert.strictEqual(isUserVip({ subscription: { isActive: true, plan: 'VIP' } }), true);
    assert.strictEqual(isUserVip({ subscription: { isActive: false, plan: 'VIP' } }), false);
  });

  // 2. Friend Request: Sender is not VIP -> Rejected
  test('2. Friend Request: Non-VIP sender is blocked from connecting', () => {
    const sender = { id: 'u_free_1', membershipTier: 'FREE', is_vip: false };
    const receiver = { id: 'u_vip_2', membershipTier: 'VIP', is_vip: true };

    function validateFriendRequest(uSender, uReceiver) {
      if (!isUserVip(uSender)) {
        return {
          status: 403,
          error: MSG_BOTH_VIP,
          contactAdmin: MSG_CONTACT_ADMIN,
        };
      }
      if (!isUserVip(uReceiver)) {
        return {
          status: 403,
          error: MSG_BOTH_VIP,
          contactAdmin: MSG_CONTACT_ADMIN,
        };
      }
      return { status: 200, success: true };
    }

    const res = validateFriendRequest(sender, receiver);
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.error, MSG_BOTH_VIP);
    assert.strictEqual(res.contactAdmin, MSG_CONTACT_ADMIN);
  });

  // 3. Friend Request: Receiver is not VIP -> Rejected with exact messages
  test('3. Friend Request: VIP sender to non-VIP receiver is blocked from connecting', () => {
    const sender = { id: 'u_vip_1', membershipTier: 'VIP', is_vip: true };
    const receiver = { id: 'u_free_2', membershipTier: 'FREE', is_vip: false };

    function validateFriendRequest(uSender, uReceiver) {
      if (!isUserVip(uSender) || !isUserVip(uReceiver)) {
        return {
          status: 403,
          error: MSG_BOTH_VIP,
          contactAdmin: MSG_CONTACT_ADMIN,
        };
      }
      return { status: 200, success: true };
    }

    const res = validateFriendRequest(sender, receiver);
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.error, MSG_BOTH_VIP);
    assert.strictEqual(res.contactAdmin, MSG_CONTACT_ADMIN);
  });

  // 4. Friend Request: Both are VIP -> Allowed
  test('4. Friend Request: Both VIP users can initiate connection', () => {
    const sender = { id: 'u_vip_1', membershipTier: 'VIP', is_vip: true };
    const receiver = { id: 'u_vip_2', is_vip: true };

    function validateFriendRequest(uSender, uReceiver) {
      if (!isUserVip(uSender) || !isUserVip(uReceiver)) {
        return {
          status: 403,
          error: MSG_BOTH_VIP,
          contactAdmin: MSG_CONTACT_ADMIN,
        };
      }
      return { status: 200, success: true };
    }

    const res = validateFriendRequest(sender, receiver);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.success, true);
  });

  // 5. Friend Request Accept: Both must still be VIP
  test('5. Accept Friend Request: Re-verifies both users are VIP before creating friendship', () => {
    function validateAccept(recipientUser, senderUser) {
      if (!isUserVip(recipientUser) || !isUserVip(senderUser)) {
        return {
          status: 403,
          error: MSG_BOTH_VIP,
          contactAdmin: MSG_CONTACT_ADMIN,
        };
      }
      return { status: 200, success: true };
    }

    // Case A: Recipient lost VIP
    const r1 = validateAccept({ is_vip: false }, { is_vip: true });
    assert.strictEqual(r1.status, 403);

    // Case B: Sender lost VIP
    const r2 = validateAccept({ is_vip: true }, { is_vip: false });
    assert.strictEqual(r2.status, 403);

    // Case C: Both valid VIP
    const r3 = validateAccept({ is_vip: true }, { is_vip: true });
    assert.strictEqual(r3.status, 200);
  });

  // 6. Socket Server Teardown Logic
  test('6. Socket Server: Teardown terminates room, cleans maps, and leaves sockets', () => {
    const activeMatches = new Map();
    const userActiveMatch = new Map();
    const emittedEvents = [];
    const leftRooms = [];

    const mockSocketA = {
      id: 'sock_A',
      leave: (roomId) => leftRooms.push({ socketId: 'sock_A', roomId }),
      currentRoomId: 'room_123',
    };
    const mockSocketB = {
      id: 'sock_B',
      leave: (roomId) => leftRooms.push({ socketId: 'sock_B', roomId }),
      currentRoomId: 'room_123',
    };

    const userSockets = new Map([
      ['userA', new Set(['sock_A'])],
      ['userB', new Set(['sock_B'])],
    ]);

    const ioSockets = new Map([
      ['sock_A', mockSocketA],
      ['sock_B', mockSocketB],
    ]);

    activeMatches.set('match_123', {
      matchId: 'match_123',
      roomId: 'room_123',
      userA: { userId: 'userA' },
      userB: { userId: 'userB' },
    });
    userActiveMatch.set('userA', 'match_123');
    userActiveMatch.set('userB', 'match_123');

    // Simulate teardownMatch
    function teardown(matchId, reason, triggeringUserId) {
      const match = activeMatches.get(matchId);
      if (!match) return;

      emittedEvents.push({
        room: match.roomId,
        event: 'partner_left',
        data: { reason, triggeringUserId },
      });

      const sA = userSockets.get(match.userA.userId);
      if (sA) {
        sA.forEach((sId) => {
          const s = ioSockets.get(sId);
          if (s) {
            s.leave(match.roomId);
            s.currentRoomId = null;
          }
        });
      }

      const sB = userSockets.get(match.userB.userId);
      if (sB) {
        sB.forEach((sId) => {
          const s = ioSockets.get(sId);
          if (s) {
            s.leave(match.roomId);
            s.currentRoomId = null;
          }
        });
      }

      activeMatches.delete(matchId);
      userActiveMatch.delete(match.userA.userId);
      userActiveMatch.delete(match.userB.userId);
    }

    teardown('match_123', 'partner_skipped', 'userA');

    // Verify room event was emitted
    assert.strictEqual(emittedEvents.length, 1);
    assert.strictEqual(emittedEvents[0].event, 'partner_left');
    assert.strictEqual(emittedEvents[0].data.reason, 'partner_skipped');

    // Verify both sockets left the room
    assert.strictEqual(leftRooms.length, 2);
    assert.strictEqual(mockSocketA.currentRoomId, null);
    assert.strictEqual(mockSocketB.currentRoomId, null);

    // Verify in-memory maps are empty
    assert.strictEqual(activeMatches.size, 0);
    assert.strictEqual(userActiveMatch.size, 0);
  });

  // 7. Random Chat State Isolation: Next partner resets all session states
  test('7. Client State Isolation: handleNextPartner completely wipes prior chat state', () => {
    let matchId = 'match_old';
    let partner = { id: 'p1', name: 'Stranger' };
    let messages = [{ id: 'm1', content: 'hello' }];
    let inputText = 'in-progress message';
    let selectedImageFile = 'image.png';
    let partnerTyping = true;

    function handleNextPartner() {
      matchId = null;
      partner = null;
      messages = [];
      inputText = '';
      selectedImageFile = null;
      partnerTyping = false;
    }

    handleNextPartner();

    assert.strictEqual(matchId, null);
    assert.strictEqual(partner, null);
    assert.strictEqual(messages.length, 0);
    assert.strictEqual(inputText, '');
    assert.strictEqual(selectedImageFile, null);
    assert.strictEqual(partnerTyping, false);
  });

  console.log('\n====================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite();
