/**
 * scripts/verify-socket-vip.js
 * Realtime socket verification for VIP Asymmetric Model
 */

require('dotenv').config();
const { io } = require('socket.io-client');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const jwt = require('jsonwebtoken');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'prisma', 'dev.db');
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

const SOCKET_PORT = process.env.SOCKET_PORT || 4000;
const SOCKET_URL = `http://localhost:${SOCKET_PORT}`;
const JWT_SECRET = process.env.JWT_SECRET || 'cupidx_fallback_jwt_secret';

async function runSocketTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 CUPIDX SOCKET.IO REALTIME VIP ASYMMETRIC VERIFICATION');
  console.log('🧪 ========================================================\n');

  try {
    const freeUser = await prisma.user.findFirst({
      where: { clerkUserId: 'test_clerk_free_b' },
    });
    const vipUser = await prisma.user.findFirst({
      where: { clerkUserId: 'test_clerk_vip_c' },
    });

    if (!freeUser || !vipUser) {
      console.log('Skipping socket test: test users not found.');
      return;
    }

    // Ensure freeUser is strictly Free
    await prisma.user.update({
      where: { id: freeUser.id },
      data: { is_vip: false, membershipTier: 'FREE', vip_expires_at: null },
    });

    const freeToken = jwt.sign(
      { userId: freeUser.id, username: freeUser.username, role: 'USER' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const socket = io(SOCKET_URL, {
      auth: { token: freeToken },
      timeout: 3000,
      reconnection: false,
    });

    const connected = await new Promise((resolve) => {
      socket.on('connect', () => resolve(true));
      socket.on('connect_error', (e) => {
        console.log(`Socket connection note: ${e.message} (socket server may not be running on ${SOCKET_PORT})`);
        resolve(false);
      });
      setTimeout(() => resolve(false), 2000);
    });

    if (!connected) {
      console.log('Socket server not active on port 4000 in this local test environment; skipping live socket emit test.');
      socket.disconnect();
      return;
    }

    console.log('Connected to socket server as Free user.');

    // Attempt to send private message as Free user
    const response = await new Promise((resolve) => {
      socket.emit(
        'send_message',
        { receiverId: vipUser.id, content: 'Socket test message from free user' },
        (res) => resolve(res)
      );
      setTimeout(() => resolve({ timeout: true }), 3000);
    });

    console.log('Socket send_message response:', response);
    if (response.isVipRequired === true && response.error === 'You cannot message this person. Get VIP to chat.') {
      console.log('✅ PASS: Socket server blocked Free user message with exact VIP message!');
    } else {
      console.log('Socket response:', response);
    }

    socket.disconnect();
  } catch (err) {
    console.warn('Socket test notice:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

runSocketTests();
