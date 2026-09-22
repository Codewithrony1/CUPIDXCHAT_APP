/**
 * CupidX Production Concurrency Load Testing Harness
 * 
 * Simulates up to 1,000 concurrent users performing real-time:
 * - Connection & JWT authentication
 * - In-memory queue matching with VIP & mood compatibility
 * - Active match room messaging & ephemeral typing status
 * - Skipping to next partner & re-queueing
 * - Disconnect & transport resilience measurement
 * - P50, P95, P99 round-trip latency measurement
 * 
 * Usage:
 *   node scripts/load-test.js --users=100 --duration=15
 *   node scripts/load-test.js --users=250 --duration=20
 *   node scripts/load-test.js --users=500 --duration=25
 *   node scripts/load-test.js --users=1000 --duration=30
 */

const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');
const http = require('http');

const JWT_SECRET = process.env.JWT_SECRET || 'cupidx_jwt_ultra_secret_key_2026_change_in_production';
const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:3001';

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, val] = arg.split('=');
  acc[key.replace(/^--/, '')] = val;
  return acc;
}, {});

const TARGET_USERS = parseInt(args.users || '100', 10);
const TEST_DURATION_SEC = parseInt(args.duration || '20', 10);
const RAMP_UP_MS = parseInt(args.ramp || '5000', 10); // gradual ramp-up to simulate organic traffic surge

console.log('='.repeat(70));
console.log(`🚀 CupidX Production Load Test Harness`);
console.log(`   Target Concurrency: ${TARGET_USERS} concurrent users`);
console.log(`   Test Duration:      ${TEST_DURATION_SEC} seconds`);
console.log(`   Ramp-up Window:     ${RAMP_UP_MS / 1000} seconds`);
console.log(`   Target Server:      ${SOCKET_URL}`);
console.log('='.repeat(70));

const stats = {
  connected: 0,
  peakConnected: 0,
  connectionErrors: 0,
  disconnects: 0,
  matchesFormed: 0,
  messagesSent: 0,
  messagesReceived: 0,
  typingEmits: 0,
  skipsToNext: 0,
  latencies: [],
};

const clients = [];
const messageTimestamps = new Map();

function createToken(userId, username, role = 'USER') {
  return jwt.sign({ userId, username, role }, JWT_SECRET, { expiresIn: '1h' });
}

function calculatePercentiles(latencies) {
  if (latencies.length === 0) return { min: 0, p50: 0, p90: 0, p95: 0, p99: 0, max: 0, avg: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const getP = (p) => sorted[Math.min(Math.floor((p / 100) * sorted.length), sorted.length - 1)];
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    min: sorted[0],
    p50: getP(50),
    p90: getP(90),
    p95: getP(95),
    p99: getP(99),
    max: sorted[sorted.length - 1],
    avg: Math.round(sum / sorted.length),
  };
}

async function fetchServerHealth() {
  return new Promise((resolve) => {
    http.get(`${SOCKET_URL}/health`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

function runUser(i) {
  const userId = `load_usr_${i}`;
  const username = `bot_${i}`;
  const isVIP = i % 5 === 0; // 20% simulated VIPs
  const token = createToken(userId, username);

  const socket = io(SOCKET_URL, {
    auth: {
      token,
      isLoadTest: true,
      userId,
      username,
    },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    timeout: 8000,
  });

  clients.push(socket);

  let activeMatchId = null;
  let activePartner = null;
  let msgInterval = null;
  let typingInterval = null;

  socket.on('connect', () => {
    stats.connected++;
    stats.peakConnected = Math.max(stats.peakConnected, stats.connected);

    // Join random queue immediately
    socket.emit('join_random_queue', {
      gender: i % 2 === 0 ? 'male' : 'female',
      preferredGender: 'auto',
      mood: ['romantic', 'friendly', 'chill', 'funny'][i % 4],
      isVIP,
    });
  });

  socket.on('connect_error', () => {
    stats.connectionErrors++;
  });

  socket.on('disconnect', () => {
    stats.connected = Math.max(0, stats.connected - 1);
    stats.disconnects++;
    if (msgInterval) clearInterval(msgInterval);
    if (typingInterval) clearInterval(typingInterval);
  });

  socket.on('random_match_found', (data) => {
    stats.matchesFormed++;
    activeMatchId = data.matchId;
    activePartner = data.partner;

    // Simulate realistic chatting behavior: typing indicator + message loop
    if (msgInterval) clearInterval(msgInterval);
    if (typingInterval) clearInterval(typingInterval);

    // Typing activity every 2-3 seconds
    typingInterval = setInterval(() => {
      if (socket.connected && activeMatchId) {
        stats.typingEmits++;
        socket.emit('random_typing_status', { isTyping: true });
        setTimeout(() => {
          if (socket.connected) socket.emit('random_typing_status', { isTyping: false });
        }, 800);
      }
    }, 2500 + Math.random() * 1000);

    // Messages sent every 1.5 - 3.5 seconds
    msgInterval = setInterval(() => {
      if (socket.connected && activeMatchId) {
        const clientMsgId = `m_${userId}_${Date.now()}`;
        messageTimestamps.set(clientMsgId, Date.now());

        stats.messagesSent++;
        socket.emit('send_random_message', {
          content: `Test msg from @${username} at ${Date.now()}`,
          clientMessageId: clientMsgId,
        });

        // 10% chance to test "Next Partner" skip & re-queueing
        if (Math.random() < 0.08) {
          stats.skipsToNext++;
          clearInterval(msgInterval);
          clearInterval(typingInterval);
          activeMatchId = null;
          socket.emit('next_partner');
        }
      }
    }, 1500 + Math.random() * 2000);
  });

  socket.on('receive_random_message', (msg) => {
    stats.messagesReceived++;
    if (msg.clientMessageId && messageTimestamps.has(msg.clientMessageId)) {
      const sendTime = messageTimestamps.get(msg.clientMessageId);
      const rtt = Date.now() - sendTime;
      stats.latencies.push(rtt);
      messageTimestamps.delete(msg.clientMessageId);
    }
  });

  socket.on('partner_left', () => {
    activeMatchId = null;
    if (msgInterval) clearInterval(msgInterval);
    if (typingInterval) clearInterval(typingInterval);
    // Automatically re-queue after partner leaves
    setTimeout(() => {
      if (socket.connected) {
        socket.emit('join_random_queue');
      }
    }, 500);
  });
}

// Staggered launch to prevent unnatural instant burst
const delayPerClient = RAMP_UP_MS / TARGET_USERS;
console.log(`Connecting ${TARGET_USERS} synthetic clients (interval: ${delayPerClient.toFixed(1)}ms)...`);

for (let i = 0; i < TARGET_USERS; i++) {
  setTimeout(() => {
    runUser(i);
  }, i * delayPerClient);
}

// Progress reporting interval
const progressInterval = setInterval(async () => {
  const health = await fetchServerHealth();
  const memMb = health ? health.memory.rssMb : 'N/A';
  const serverSockets = health ? health.connections.activeSockets : 'N/A';
  const serverMatches = health ? health.connections.activeMatches : 'N/A';

  process.stdout.write(
    `\r[Progress] Connected: ${stats.connected}/${TARGET_USERS} | Matches: ${stats.matchesFormed} | Msgs Sent: ${stats.messagesSent} | Rcvd: ${stats.messagesReceived} | Svr RSS: ${memMb}MB | Svr Sockets: ${serverSockets}`
  );
}, 1000);

// Conclude test after TEST_DURATION_SEC + RAMP_UP_MS
setTimeout(async () => {
  clearInterval(progressInterval);
  console.log('\n\n' + '='.repeat(70));
  console.log(`⏱  Load Test Execution Completed. Draining clients...`);

  clients.forEach((c) => c.disconnect());

  const serverHealth = await fetchServerHealth();
  const percentiles = calculatePercentiles(stats.latencies);
  const testDurationEff = TEST_DURATION_SEC;
  const msgRate = Math.round(stats.messagesSent / testDurationEff);

  console.log('='.repeat(70));
  console.log(`📊 LOAD TEST REPORT: ${TARGET_USERS} CONCURRENT USERS`);
  console.log('='.repeat(70));
  console.log(`  • Peak Connected Clients:   ${stats.peakConnected} / ${TARGET_USERS} (${((stats.peakConnected / TARGET_USERS) * 100).toFixed(1)}%)`);
  console.log(`  • Matches Formed:           ${stats.matchesFormed}`);
  console.log(`  • Messages Sent:            ${stats.messagesSent}`);
  console.log(`  • Messages Received:        ${stats.messagesReceived}`);
  console.log(`  • Ephemeral Typing Emits:   ${stats.typingEmits}`);
  console.log(`  • Partner Skips Tested:     ${stats.skipsToNext}`);
  console.log(`  • Connection Errors:        ${stats.connectionErrors}`);
  console.log(`  • Disconnects:              ${stats.disconnects}`);
  console.log(`  • Throughput:               ~${msgRate} msgs/sec`);
  console.log('-'.repeat(70));
  console.log(`📈 LATENCY METRICS (Round-trip time):`);
  console.log(`  • Minimum Latency:          ${percentiles.min} ms`);
  console.log(`  • P50 (Median) Latency:     ${percentiles.p50} ms`);
  console.log(`  • P90 Latency:              ${percentiles.p90} ms`);
  console.log(`  • P95 Latency:              ${percentiles.p95} ms`);
  console.log(`  • P99 Latency:              ${percentiles.p99} ms`);
  console.log(`  • Maximum Latency:          ${percentiles.max} ms`);
  console.log(`  • Average Latency:          ${percentiles.avg} ms`);
  console.log('-'.repeat(70));
  if (serverHealth) {
    console.log(`💻 SERVER HEALTH & SYSTEM RESOURCES:`);
    console.log(`  • Server Memory (RSS):      ${serverHealth.memory.rssMb} MB`);
    console.log(`  • Heap Used:                ${serverHealth.memory.heapUsedMb} MB`);
    console.log(`  • Server Active Matches:    ${serverHealth.connections.activeMatches}`);
    console.log(`  • Active Sockets in Engine: ${serverHealth.connections.activeSockets}`);
  }
  console.log('='.repeat(70));

  process.exit(0);
}, (TEST_DURATION_SEC * 1000) + RAMP_UP_MS);
