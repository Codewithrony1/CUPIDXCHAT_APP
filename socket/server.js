require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { analyzeMessage, recordModerationEvent } = require('./moderation');
const path = require('path');
const fs = require('fs');
const os = require('os');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET is required in production.');
const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'cupidx-development-only-secret';
const PORT = process.env.PORT || process.env.SOCKET_PORT || 3001;
const CLIENT_URL = process.env.NEXT_PUBLIC_CLIENT_URL || 'http://localhost:3000';

// ── Database Setup: PostgreSQL (production) or SQLite (local dev) ─────────────
// DEPLOY-001 FIX: When DATABASE_URL is a PostgreSQL connection string (as used on
// Render/Fly.io), use the @prisma/adapter-pg adapter instead of SQLite. This
// allows the socket server to connect to the same PostgreSQL database as the
// Next.js app, ensuring matchmaking state and chat records are shared.
let prisma;

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || '';
const isPostgres = databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://');

if (isPostgres) {
  // Production: PostgreSQL via @prisma/adapter-pg
  const { PrismaPg } = require('@prisma/adapter-pg');
  const { Pool } = require('pg');
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  process.env.PGSSLMODE = 'no-verify';
  let cleanUrl = databaseUrl;
  if (/sslmode=/i.test(cleanUrl)) {
    cleanUrl = cleanUrl.replace(/sslmode=[^&]+/i, 'sslmode=no-verify');
  } else {
    cleanUrl += (cleanUrl.includes('?') ? '&' : '?') + 'sslmode=no-verify';
  }
  const pool = new Pool({
    connectionString: cleanUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter });
  console.log('[DB] Connected to PostgreSQL (production mode)');
} else {
  // Local dev: SQLite via @prisma/adapter-better-sqlite3
  const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
  const Database = require('better-sqlite3');

  const defaultDbPath = path.join(__dirname, '..', 'prisma', 'dev.db');
  let dbPath = defaultDbPath;

  // Handle read-only filesystems (lambda-like environments)
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tmpPath = path.join(os.tmpdir(), 'dev.db');
    try {
      if (!fs.existsSync(tmpPath)) {
        if (fs.existsSync(defaultDbPath)) {
          fs.copyFileSync(defaultDbPath, tmpPath);
        } else {
          fs.writeFileSync(tmpPath, '');
        }
      }
      dbPath = tmpPath;
    } catch (e) {
      console.warn('Failed to copy SQLite database:', e);
    }
  }

  try {
    const sqliteDb = new Database(dbPath);
    sqliteDb.pragma('journal_mode = WAL');
    sqliteDb.pragma('busy_timeout = 5000');
    sqliteDb.pragma('synchronous = NORMAL');
    sqliteDb.close();
  } catch (e) {
    console.warn('Could not set WAL pragma on SQLite:', e.message);
  }

  const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
  prisma = new PrismaClient({ adapter });
  console.log(`[DB] Connected to SQLite (local dev): ${dbPath}`);
}




// ── In-Memory Realtime Architecture ──────────────────────────────────────────
// userSockets: userId -> Set<socketId>
const userSockets = new Map();
// socketToUser: socketId -> { userId, username, fullName, avatarUrl, isVIP, plan, gender, preferredGender }
const socketToUser = new Map();
// activeMatches: matchId -> { matchId, roomId, userA, userB, createdAt }
const activeMatches = new Map();
// userActiveMatch: userId -> matchId
const userActiveMatch = new Map();
// reconnectGraceTimers: userId -> timeoutId (10-second grace period for transport reconnect)
const reconnectGraceTimers = new Map();
// 60-second Anti-Rematch Exclusions: pairHash -> expiresAt (timestamp in ms)
const rematchExclusions = new Map();
const matchmakingTokens = new Map();
const matchmakingStates = new Map();
const recentMatchMessageCounts = new Map();

function nextMatchmakingToken(userId) {
  const next = (matchmakingTokens.get(userId) || 0) + 1;
  matchmakingTokens.set(userId, next);
  return next;
}

function isCurrentQueueCandidate(candidate) {
  return Boolean(candidate && userSockets.has(candidate.userId) && matchmakingTokens.get(candidate.userId) === candidate.searchToken && matchmakingStates.get(candidate.userId) === 'SEARCHING' && !userActiveMatch.has(candidate.userId));
}

function getRematchPairHash(u1, u2) {
  const [first, second] = [String(u1), String(u2)].sort();
  return `rematch:${first}::${second}`;
}

function addRematchExclusion(u1, u2, durationMs = 60000) {
  if (!u1 || !u2 || u1 === u2) return;
  const hash = getRematchPairHash(u1, u2);
  const expiresAt = Date.now() + durationMs;
  rematchExclusions.set(hash, expiresAt);
  console.log(`[ANTI_REMATCH] Added 60s exclusion for pair: ${hash}`);

  // Persist to database for cross-instance / serverless consistency
  setImmediate(async () => {
    try {
      const [first, second] = [String(u1), String(u2)].sort();
      await prisma.antiRematchExclusion.upsert({
        where: { pairHash: hash },
        update: { expiresAt: new Date(expiresAt) },
        create: {
          pairHash: hash,
          user1Id: first,
          user2Id: second,
          expiresAt: new Date(expiresAt),
        },
      });
    } catch {}
  });
}

function isRematchExcluded(u1, u2) {
  if (!u1 || !u2 || u1 === u2) return true;
  const hash = getRematchPairHash(u1, u2);
  const exp = rematchExclusions.get(hash);
  if (exp) {
    if (exp > Date.now()) return true;
    rematchExclusions.delete(hash);
  }
  return false;
}

// Clean up expired exclusions every 30 seconds
setInterval(() => {
  const now = Date.now();
  rematchExclusions.forEach((exp, hash) => {
    if (exp <= now) rematchExclusions.delete(hash);
  });
}, 30000);

// Country Flag helper
function getCountryFlag(code) {
  if (!code || code.length !== 2) return '🌐';
  const clean = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(clean)) return '🌐';
  const codePoints = clean.split('').map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

const COUNTRY_NAMES = {
  IN: 'India', US: 'United States', GB: 'United Kingdom', CA: 'Canada',
  AU: 'Australia', DE: 'Germany', FR: 'France', IT: 'Italy', ES: 'Spain',
  BR: 'Brazil', RU: 'Russia', JP: 'Japan', KR: 'South Korea', CN: 'China',
  ID: 'Indonesia', PK: 'Pakistan', BD: 'Bangladesh', NG: 'Nigeria',
  ZA: 'South Africa', AE: 'United Arab Emirates', SA: 'Saudi Arabia',
  SG: 'Singapore', MY: 'Malaysia', TH: 'Thailand', VN: 'Vietnam',
  PH: 'Philippines', NL: 'Netherlands', SE: 'Sweden', NO: 'Norway',
  DK: 'Denmark', FI: 'Finland', PL: 'Poland', TR: 'Turkey', MX: 'Mexico',
};

function detectCountryFromSocket(socket) {
  if (socket.user?.countryCode && socket.user?.countryName) {
    return {
      countryCode: socket.user.countryCode,
      countryName: socket.user.countryName,
      countryFlag: socket.user.countryFlag || getCountryFlag(socket.user.countryCode),
    };
  }
  const h = socket.handshake?.headers || {};
  const rawCode = (h['x-vercel-ip-country'] || h['cf-ipcountry'] || h['x-country-code'] || '').trim().toUpperCase();
  if (rawCode && rawCode.length === 2 && rawCode !== 'XX') {
    return {
      countryCode: rawCode,
      countryName: COUNTRY_NAMES[rawCode] || rawCode,
      countryFlag: getCountryFlag(rawCode),
    };
  }
  return {
    countryCode: 'IN',
    countryName: 'India',
    countryFlag: '🇮🇳',
  };
}

// In-memory candidate queue
let randomMatchQueue = [];
// User profile cache (TTL 60 seconds) to avoid database hits in tight loops
const userCache = new Map();
// Blocked users cache (TTL 30 seconds) to prevent blocked pairs from chatting/matching
const blockedUsersCache = new Map();
const blocksCacheTimestamps = new Map();
const BLOCKS_CACHE_TTL_MS = 30 * 1000;

// Active friendship cache (TTL 60 seconds) to avoid database hits on every private message
const friendshipCache = new Map();
const FRIENDSHIP_CACHE_TTL_MS = 60 * 1000;

async function checkCachedFriendship(u1, u2) {
  const key = `${u1}:${u2}`;
  const cached = friendshipCache.get(key);
  if (cached && Date.now() - cached.timestamp < FRIENDSHIP_CACHE_TTL_MS) {
    return cached.isFriend;
  }
  try {
    const friendship = await prisma.friendship.findUnique({
      where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
    });
    const isFriend = Boolean(friendship);
    friendshipCache.set(key, { isFriend, timestamp: Date.now() });
    return isFriend;
  } catch {
    return false;
  }
}

async function getCachedBlockedUsers(uid) {
  const lastTime = blocksCacheTimestamps.get(uid);
  if (lastTime && Date.now() - lastTime < BLOCKS_CACHE_TTL_MS) {
    return blockedUsersCache.get(uid) || new Set();
  }
  try {
    const blocks = await prisma.block.findMany({
      where: { OR: [{ blockerId: uid }, { blockedId: uid }] },
      select: { blockerId: true, blockedId: true },
    });
    const set = new Set();
    blocks.forEach((b) => {
      if (b.blockerId === uid) set.add(b.blockedId);
      if (b.blockedId === uid) set.add(b.blockerId);
    });
    blockedUsersCache.set(uid, set);
    blocksCacheTimestamps.set(uid, Date.now());
    return set;
  } catch {
    return blockedUsersCache.get(uid) || new Set();
  }
}

const CACHE_TTL_MS = 60 * 1000;

async function getCachedUserData(userId) {
  const cached = userCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const userDb = await prisma.user.findFirst({
      where: { OR: [{ id: userId }, { clerkUserId: userId }] },
      include: { profile: true, subscription: true },
    });

    const now = new Date();
    let isVIP = false;

    if (userDb) {
      if (userDb.vip_expires_at && new Date(userDb.vip_expires_at).getTime() <= now.getTime()) {
        isVIP = false;
      } else if (userDb.subscription) {
        const subEnd = userDb.subscription.endDate || userDb.subscription.currentPeriodEnd;
        if (subEnd && new Date(subEnd).getTime() <= now.getTime()) {
          isVIP = false;
        } else if (userDb.subscription.isActive === true && userDb.subscription.plan === 'VIP') {
          isVIP = true;
        }
      }

      if (!isVIP && (userDb.is_vip || userDb.membershipTier === 'VIP')) {
        if (!userDb.vip_expires_at || new Date(userDb.vip_expires_at).getTime() > now.getTime()) {
          isVIP = true;
        }
      }
    }

    const userInterests = userDb?.profile?.interests
      ? userDb.profile.interests.split(',').map((s) => s.trim().toLowerCase())
      : [];

    const data = {
      userId: userDb?.id || userId,
      username: userDb?.username || `user_${userId.slice(0, 6)}`,
      vipUsername: userDb?.vipUsername || null,
      fullName: userDb?.fullName || userDb?.displayName || userDb?.username || 'Stranger',
      avatarUrl: userDb?.profile?.avatarUrl || null,
      avatarEmoji: userDb?.profile?.avatarEmoji || '😊',
      gender: userDb?.profile?.gender || 'unspecified',
      preferredGender: userDb?.profile?.preferredGender || 'auto',
      mood: userDb?.profile?.mood || 'chill',
      bio: userDb?.profile?.bio || '',
      personalityPreferences: userDb?.profile?.interests || '',
      tags: userInterests,
      language: userDb?.profile?.language || 'english',
      plan: isVIP ? 'vip' : 'free',
      isVIP,
      isSuspended: Boolean(userDb?.isSuspended),
    };

    userCache.set(userId, { data, timestamp: Date.now() });
    return data;
  } catch (err) {
    return {
      userId,
      username: `user_${userId.slice(0, 6)}`,
      vipUsername: null,
      fullName: 'Stranger',
      avatarUrl: null,
      avatarEmoji: '😊',
      gender: 'unspecified',
      preferredGender: 'auto',
      mood: 'chill',
      bio: '',
      personalityPreferences: '',
      tags: [],
      language: 'english',
      plan: 'free',
      isVIP: false,
    };
  }
}

// ── HTTP Server & Health Endpoints ───────────────────────────────────────────
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/api/health') {
    const mem = process.memoryUsage();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'healthy',
        uptime: process.uptime(),
        memory: {
          rssMb: Math.round(mem.rss / 1024 / 1024),
          heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
          heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
        },
        connections: {
          activeSockets: io.engine ? io.engine.clientsCount : 0,
          activeUsers: userSockets.size,
          activeMatches: activeMatches.size,
          queueLength: randomMatchQueue.length,
        },
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('CupidX Realtime Chat Production Socket.IO Server is running.\n');
});

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // DEPLOY-001: CORS origins are now env-driven.
      // Set ALLOWED_ORIGINS as a comma-separated list, e.g.:
      //   ALLOWED_ORIGINS=https://cupidxchat.in,https://your-app.vercel.app
      // Defaults include the hardcoded production domains for zero-config deploys.
      const extraOrigins = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);
      const allowedOrigins = new Set([
        'https://cupidxchat.in',
        'https://www.cupidxchat.in',
        CLIENT_URL,
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        ...extraOrigins,
      ]);
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error('Origin not allowed'));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingInterval: 25000,
  pingTimeout: 20000,
  maxHttpBufferSize: 1e6,
  transports: ['websocket', 'polling'],
});

// ── Authentication Middleware ────────────────────────────────────────────────
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    // WS-001 SECURITY FIX: The previous load-test bypass allowed any client
    // to impersonate an arbitrary userId in non-production environments by
    // setting isLoadTest=true with no token. This is removed. Load tests MUST
    // use real JWT tokens issued by the authentication system.
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    jwt.verify(token, EFFECTIVE_JWT_SECRET, (err, decoded) => {
      if (err) {
        return next(new Error('Invalid token'));
      }
      socket.user = decoded;
      next();
    });
  } catch (error) {
    next(new Error('Internal Authentication Error'));
  }
});

// ── Smart Compatibility Scoring ──────────────────────────────────────────────
const MOOD_COMPATIBILITY = {
  romantic: ['romantic', 'flirty', 'deep'],
  flirty: ['flirty', 'romantic', 'funny'],
  friendly: ['friendly', 'chill', 'funny'],
  chill: ['chill', 'friendly', 'deep', 'music'],
  deep: ['deep', 'romantic', 'chill'],
  funny: ['funny', 'friendly', 'flirty'],
};

function areMoodsCompatible(moodA, moodB) {
  if (!moodA || !moodB) return true;
  const mA = moodA.toLowerCase();
  const mB = moodB.toLowerCase();
  if (mA === mB) return true;
  const list = MOOD_COMPATIBILITY[mA];
  return Boolean(list && list.includes(mB));
}

function calculateMatchScore(candidateA, candidateB, now) {
  if (candidateA.userId === candidateB.userId) {
    return { canMatch: false, score: -1 };
  }

  // Invariant: MAX ACTIVE SESSIONS PER USER = 1
  if (userActiveMatch.has(candidateA.userId) || userActiveMatch.has(candidateB.userId)) {
    return { canMatch: false, score: -1 };
  }

  // 60-Second Anti-Rematch Exclusion Guard
  if (isRematchExcluded(candidateA.userId, candidateB.userId)) {
    return { canMatch: false, score: -1 };
  }

  const blockedA = blockedUsersCache.get(candidateA.userId);
  if (blockedA && blockedA.has(candidateB.userId)) {
    return { canMatch: false, score: -1 };
  }
  const blockedB = blockedUsersCache.get(candidateB.userId);
  if (blockedB && blockedB.has(candidateA.userId)) {
    return { canMatch: false, score: -1 };
  }

  let score = 0;
  const waitTimeA = now - candidateA.joinTime;
  const waitTimeB = now - candidateB.joinTime;

  const prefA = candidateA.isVIP ? (candidateA.genderPref || 'auto') : 'auto';
  const prefB = candidateB.isVIP ? (candidateB.genderPref || 'auto') : 'auto';

  if (candidateA.isVIP && prefA !== 'auto' && prefA !== 'any') {
    const isGenderMatch = prefA.toLowerCase() === (candidateB.gender || '').toLowerCase();
    if (isGenderMatch) {
      score += 3;
    } else if (waitTimeA < 8000) {
      return { canMatch: false, score: -1 };
    }
  }

  if (candidateB.isVIP && prefB !== 'auto' && prefB !== 'any') {
    const isGenderMatch = prefB.toLowerCase() === (candidateA.gender || '').toLowerCase();
    if (isGenderMatch) {
      score += 3;
    } else if (waitTimeB < 8000) {
      return { canMatch: false, score: -1 };
    }
  }

  const tagsA = candidateA.tags || [];
  const tagsB = candidateB.tags || [];
  if (tagsA.length > 0 && tagsB.length > 0) {
    const shared = tagsA.filter((t) => tagsB.includes(t));
    score += shared.length * 2;
  }

  if (areMoodsCompatible(candidateA.mood, candidateB.mood)) {
    score += 1;
  }

  if (candidateA.isVIP || candidateB.isVIP) {
    score += 1;
  }

  score += Math.max(waitTimeA, waitTimeB) / 10000;
  // Requirement 4: Genuine randomness tie-breaker for equal scores
  score += Math.random() * 0.4;

  return { canMatch: true, score };
}

// ── In-Memory Queue Matcher (Atomic & Random Selection) ──────────────────────
function processMatchQueue() {
  // Prune any candidates already in an active match
  randomMatchQueue = randomMatchQueue.filter((c) => !userActiveMatch.has(c.userId));

  if (randomMatchQueue.length < 2) return;

  const now = Date.now();
  console.log(`[MATCH_ATTEMPT] Queue length: ${randomMatchQueue.length}`);

  // Randomize evaluation order so matching is genuinely unpredictable among eligible users
  const candidatesShuffled = [...randomMatchQueue].sort(() => Math.random() - 0.5);

  let bestPair = null;
  let highestScore = -1;

  for (let i = 0; i < candidatesShuffled.length; i++) {
    const candidateA = candidatesShuffled[i];
    if (userActiveMatch.has(candidateA.userId)) continue;

    for (let j = i + 1; j < candidatesShuffled.length; j++) {
      const candidateB = candidatesShuffled[j];
      if (userActiveMatch.has(candidateB.userId)) continue;

      const { canMatch, score } = calculateMatchScore(candidateA, candidateB, now);
      if (canMatch && score > highestScore) {
        highestScore = score;
        bestPair = [candidateA, candidateB];
      }
    }
  }

  if (bestPair) {
    const [candidateA, candidateB] = bestPair;

    // Concurrency guard: verify neither candidate was matched in the interim
    if (userActiveMatch.has(candidateA.userId) || userActiveMatch.has(candidateB.userId)) {
      randomMatchQueue = randomMatchQueue.filter((c) => !userActiveMatch.has(c.userId));
      if (randomMatchQueue.length >= 2) {
        setImmediate(processMatchQueue);
      }
      return;
    }

    // Invariant: Remove both users from waiting queue atomically
    randomMatchQueue = randomMatchQueue.filter(
      (c) => c.userId !== candidateA.userId && c.userId !== candidateB.userId
    );

    if (!isCurrentQueueCandidate(candidateA) || !isCurrentQueueCandidate(candidateB)) {
      randomMatchQueue = randomMatchQueue.filter((c) => isCurrentQueueCandidate(c));
      if (randomMatchQueue.length >= 2) setImmediate(processMatchQueue);
      return;
    }

    matchmakingStates.set(candidateA.userId, 'MATCHED');
    matchmakingStates.set(candidateB.userId, 'MATCHED');

    const matchId = `match_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const roomId = `room_${matchId}`;

    const matchRecord = {
      matchId,
      roomId,
      userA: candidateA,
      userB: candidateB,
      createdAt: Date.now(),
    };

    activeMatches.set(matchId, matchRecord);
    userActiveMatch.set(candidateA.userId, matchId);
    userActiveMatch.set(candidateB.userId, matchId);

    // Sync active match across database and distributed Firestore store
    setImmediate(async () => {
      try {
        await prisma.chatSession.upsert({
          where: { id: matchId },
          update: { status: 'ACTIVE' },
          create: {
            id: matchId,
            userAId: candidateA.userId,
            userBId: candidateB.userId,
            status: 'ACTIVE',
          },
        });
        await prisma.matchmakingQueue.updateMany({
          where: { userId: candidateA.userId },
          data: { status: 'MATCHED', chatSessionId: matchId, partnerUserId: candidateB.userId },
        });
        await prisma.matchmakingQueue.updateMany({
          where: { userId: candidateB.userId },
          data: { status: 'MATCHED', chatSessionId: matchId, partnerUserId: candidateA.userId },
        });
      } catch (e) {}

      // adminDb (Firebase) block removed — see WS-001 fix.
      // Prisma sync above is the canonical record of active sessions.


    console.log(`[MATCH_SUCCESS] Matched ${candidateA.userId} (${candidateA.username}) <-> ${candidateB.userId} (${candidateB.username})`);
    console.log(`[SESSION_CREATED] Room: ${roomId} for Match: ${matchId}`);

    // 60-second Anti-Rematch: Exclusion will be active upon session termination
    const socketsA = userSockets.get(candidateA.userId);
    if (socketsA) {
      socketsA.forEach((sId) => {
        const s = io.sockets.sockets.get(sId);
        if (s) {
          s.join(roomId);
          s.currentRoomId = roomId;
          console.log(`[ROOM_JOIN] User A socket ${sId} joined ${roomId}`);
        }
      });
    }

    const socketsB = userSockets.get(candidateB.userId);
    if (socketsB) {
      socketsB.forEach((sId) => {
        const s = io.sockets.sockets.get(sId);
        if (s) {
          s.join(roomId);
          s.currentRoomId = roomId;
          console.log(`[ROOM_JOIN] User B socket ${sId} joined ${roomId}`);
        }
      });
    }

    io.to(roomId).emit('match_established', { matchId, roomId });

    if (socketsA) {
      socketsA.forEach((sId) => {
        io.to(sId).emit('random_match_found', {
          matchId,
          roomId,
          partner: {
            id: candidateB.userId,
            username: candidateB.username,
            vipUsername: candidateB.vipUsername || null,
            fullName: candidateB.fullName,
            displayName: candidateB.fullName,
            avatarUrl: candidateB.avatarUrl,
            avatarEmoji: candidateB.avatarEmoji || '😊',
            gender: candidateB.gender,
            mood: candidateB.mood || 'chill',
            bio: candidateB.bio || '',
            personalityPreferences: candidateB.personalityPreferences || '',
            isVIP: candidateB.isVIP,
            plan: candidateB.plan,
            countryCode: candidateB.countryCode || 'IN',
            countryName: candidateB.countryName || 'India',
            countryFlag: candidateB.countryFlag || '🇮🇳',
          },
        });
      });
    }

    if (socketsB) {
      socketsB.forEach((sId) => {
        io.to(sId).emit('random_match_found', {
          matchId,
          roomId,
          partner: {
            id: candidateA.userId,
            username: candidateA.username,
            vipUsername: candidateA.vipUsername || null,
            fullName: candidateA.fullName,
            displayName: candidateA.fullName,
            avatarUrl: candidateA.avatarUrl,
            avatarEmoji: candidateA.avatarEmoji || '😊',
            gender: candidateA.gender,
            mood: candidateA.mood || 'chill',
            bio: candidateA.bio || '',
            personalityPreferences: candidateA.personalityPreferences || '',
            isVIP: candidateA.isVIP,
            plan: candidateA.plan,
            countryCode: candidateA.countryCode || 'IN',
            countryName: candidateA.countryName || 'India',
            countryFlag: candidateA.countryFlag || '🇮🇳',
          },
        });
      });
    }

    if (randomMatchQueue.length >= 2) {
      setImmediate(processMatchQueue);
    }
  }
}

// ── Clean Up Match ───────────────────────────────────────────────────────────
function teardownMatch(matchId, reason, triggeringUserId) {
  const match = activeMatches.get(matchId);
  if (!match) return;

  const { roomId, userA, userB } = match;

  // Enforce 60-Second Server-Side Anti-Rematch Exclusion
  addRematchExclusion(userA.userId, userB.userId, 60000);

  io.to(roomId).emit('partner_left', {
    reason: reason || 'chat_ended',
    triggeringUserId: triggeringUserId || null,
  });

  const sA = userSockets.get(userA.userId);
  if (sA) {
    sA.forEach((sId) => {
      const s = io.sockets.sockets.get(sId);
      if (s) {
        s.leave(roomId);
        s.currentRoomId = null;
        console.log(`[ROOM_LEAVE] User A socket ${sId} left ${roomId}`);
      }
    });
  }

  const sB = userSockets.get(userB.userId);
  if (sB) {
    sB.forEach((sId) => {
      const s = io.sockets.sockets.get(sId);
      if (s) {
        s.leave(roomId);
        s.currentRoomId = null;
        console.log(`[ROOM_LEAVE] User B socket ${sId} left ${roomId}`);
      }
    });
  }

  activeMatches.delete(matchId);
  recentMatchMessageCounts.delete(matchId);
  matchmakingStates.set(userA.userId, 'IDLE');
  matchmakingStates.set(userB.userId, 'IDLE');
  userActiveMatch.delete(userA.userId);
  userActiveMatch.delete(userB.userId);

  console.log(`[SESSION_CLEANUP] Match ${matchId} (Room: ${roomId}) ended: ${reason}. Ephemeral state cleared.`);

  // Asynchronously purge any DB/ephemeral records for this session
  setImmediate(async () => {
    try {
      await prisma.$transaction([
        prisma.chatSession.updateMany({
          where: { id: matchId },
          data: { status: 'ENDED', endedAt: new Date() },
        }),
        prisma.message.deleteMany({
          where: { chatSessionId: matchId },
        }),
        prisma.matchmakingQueue.updateMany({
          where: { chatSessionId: matchId },
          data: { status: 'CANCELLED', chatSessionId: null, partnerUserId: null },
        }),
      ]);
    } catch {}

    if (adminDb) {
      try {
        const batch = adminDb.batch();
        batch.delete(adminDb.collection('active_sessions').doc(userA.userId));
        batch.delete(adminDb.collection('active_sessions').doc(userB.userId));
        batch.set(
          adminDb.collection('matches').doc(matchId),
          { status: 'ended', endedAt: Date.now(), endedBy: triggeringUserId || null },
          { merge: true }
        );
        await batch.commit().catch(() => {});
      } catch (e) {}
    }
  });
}

// ── Connection Event Router ──────────────────────────────────────────────────
io.on('connection', async (socket) => {
  const { userId, username } = socket.user;

  // 1. Cancel reconnect grace timer if this user was temporarily disconnected
  if (reconnectGraceTimers.has(userId)) {
    clearTimeout(reconnectGraceTimers.get(userId));
    reconnectGraceTimers.delete(userId);
  }

  // 2. Track user socket mappings
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId).add(socket.id);

  socketToUser.set(socket.id, {
    userId,
    username,
    connectedAt: Date.now(),
  });

  // 3. Seamless Session Recovery on Reconnection
  const existingMatchId = userActiveMatch.get(userId);
  if (existingMatchId) {
    const match = activeMatches.get(existingMatchId);
    if (match) {
      socket.join(match.roomId);
      socket.currentRoomId = match.roomId;

      const isUserA = match.userA.userId === userId;
      const partner = isUserA ? match.userB : match.userA;

      socket.emit('random_match_found', {
        matchId: match.matchId,
        roomId: match.roomId,
        partner: {
          id: partner.userId,
          username: partner.username,
          fullName: partner.fullName,
          displayName: partner.fullName,
          avatarUrl: partner.avatarUrl,
          avatarEmoji: partner.avatarEmoji || '😊',
          gender: partner.gender,
          isVIP: partner.isVIP,
          plan: partner.plan,
          countryCode: partner.countryCode || 'IN',
          countryName: partner.countryName || 'India',
          countryFlag: partner.countryFlag || '🇮🇳',
        },
        reconnected: true,
      });

      socket.to(match.roomId).emit('partner_reconnected', { userId });
      console.log(`[ROOM_JOIN] Reconnected user ${userId} re-joined room ${match.roomId}`);
    }
  }

  // 4. Update presence in background asynchronously
  setImmediate(async () => {
    try {
      await prisma.profile.updateMany({
        where: { OR: [{ userId }, { user: { clerkUserId: userId } }] },
        data: { isOnline: true, lastSeen: new Date() },
      });
    } catch {}
  });

  // ── Event: Join Random Queue ───────────────────────────────────────────────
  socket.on('join_random_queue', async (preferences = {}) => {
    const currentMatchId = userActiveMatch.get(userId);
    if (currentMatchId) {
      teardownMatch(currentMatchId, 'partner_skipped', userId);
    }

    randomMatchQueue = randomMatchQueue.filter((c) => c.userId !== userId);

    const [userData] = await Promise.all([
      getCachedUserData(userId),
      getCachedBlockedUsers(userId),
    ]);

    if (!userSockets.has(userId)) return;
    if (userData.isSuspended) {
      matchmakingStates.set(userId, 'IDLE');
      socket.emit('matchmaking_blocked', { reason: 'ACCOUNT_RESTRICTED' });
      return;
    }
    if (userActiveMatch.has(userId)) return;

    const country = detectCountryFromSocket(socket);

    const candidate = {
      socketId: socket.id,
      userId,
      username: userData.username,
      fullName: userData.fullName,
      avatarUrl: userData.avatarUrl,
      avatarEmoji: userData.avatarEmoji,
      gender: preferences.gender || userData.gender || 'unspecified',
      genderPref: preferences.preferredGender || preferences.genderPref || userData.preferredGender || 'auto',
      mood: preferences.mood || userData.mood || 'chill',
      tags: preferences.tags && Array.isArray(preferences.tags) ? preferences.tags : userData.tags,
      language: preferences.language || userData.language || 'english',
      plan: userData.plan,
      isVIP: userData.isVIP,
      countryCode: country.countryCode,
      countryName: country.countryName,
      countryFlag: country.countryFlag,
      joinTime: Date.now(),
      searchToken: nextMatchmakingToken(userId),
    };

    matchmakingStates.set(userId, 'SEARCHING');
    const existingIdx = randomMatchQueue.findIndex((c) => c.userId === userId);
    if (existingIdx !== -1) {
      randomMatchQueue[existingIdx] = candidate;
    } else {
      randomMatchQueue.push(candidate);
    }
    console.log(`[QUEUE_JOIN] User ${userId} (${candidate.username}, ${candidate.countryFlag} ${candidate.countryName}) joined queue. Total in queue: ${randomMatchQueue.length}`);
    socket.emit('queue_joined', { status: 'searching', isVIP: candidate.isVIP, plan: candidate.plan });

    processMatchQueue();
  });

  // ── Event: Leave Random Queue ──────────────────────────────────────────────
  socket.on('leave_random_queue', () => {
    nextMatchmakingToken(userId);
    matchmakingStates.set(userId, 'IDLE');
    randomMatchQueue = randomMatchQueue.filter((c) => c.userId !== userId);
    console.log(`[QUEUE_LEAVE] User ${userId} left queue. Total in queue: ${randomMatchQueue.length}`);
    socket.emit('queue_left');
  });

  // ── Event: Send Random Message ─────────────────────────────────────────────
  socket.on('send_random_message', async (data, callback) => {
    const matchId = userActiveMatch.get(userId);
    if (!matchId) {
      if (typeof callback === 'function') callback({ error: 'No active chat session found.', code: 'SESSION_EXPIRED' });
      return;
    }

    // Strict Crossover Check: Reject late messages belonging to prior sessions
    if (data?.chatSessionId && data.chatSessionId !== matchId) {
      if (typeof callback === 'function') callback({ error: 'Message belongs to an inactive or expired session.', code: 'SESSION_MISMATCH' });
      return;
    }

    const match = activeMatches.get(matchId);
    if (!match) {
      if (typeof callback === 'function') callback({ error: 'Chat session has expired.', code: 'SESSION_EXPIRED' });
      return;
    }

    // Strict Server-Side Room Participant Authorization
    if (match.userA.userId !== userId && match.userB.userId !== userId) {
      if (typeof callback === 'function') callback({ error: 'Unauthorized to post in this room.', code: 'UNAUTHORIZED' });
      return;
    }

    const { content, imageUrl, clientMessageId } = data || {};
    const normalizedContent = typeof content === 'string' ? content.trim() : '';
    const normalizedImageUrl = typeof imageUrl === 'string' && imageUrl.trim() ? imageUrl.trim() : null;
    if (!normalizedContent && !normalizedImageUrl) {
      if (typeof callback === 'function') callback({ error: 'Content or image is required.' });
      return;
    }
    if (normalizedContent.length > 2000) {
      if (typeof callback === 'function') callback({ error: 'Message exceeds the 2000 character limit.', code: 'MESSAGE_TOO_LONG' });
      return;
    }

    const senderData = await getCachedUserData(userId);
    if (normalizedImageUrl && !senderData.isVIP) {
      if (typeof callback === 'function') callback({ error: 'Image sharing is a VIP feature.', code: 'VIP_REQUIRED' });
      return;
    }

    const partnerId = match.userA.userId === userId ? match.userB.userId : match.userA.userId;
    const recentCount = (recentMatchMessageCounts.get(matchId) || 0) + 1;
    let result = { risk: 'SAFE', category: 'SAFE', confidence: 0, recommendedAction: 'NONE', reason: null };

    try {
      const [reportCount, priorHighRiskCount] = await Promise.all([
        prisma.report.count({ where: { reportedUserId: userId } }).catch(() => 0),
        prisma.moderationEvent.count({
          where: { userId, risk: { in: ['HIGH_RISK', 'CRITICAL'] }, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        }).catch(() => 0),
      ]);
      result = await analyzeMessage(normalizedContent, { recentMessageCount: recentCount, reportCount, priorHighRiskCount, matchId });
    } catch (moderationError) {
      console.warn('[MODERATION] Pre-delivery analysis failed:', moderationError?.message || moderationError);
    }

    if (result.risk === 'HIGH_RISK' || result.risk === 'CRITICAL') {
      const action = result.risk === 'CRITICAL' ? 'MATCH_TERMINATED_PENDING_REVIEW' : 'FLAGGED_FOR_ADMIN_REVIEW';
      recordModerationEvent(prisma, {
        userId, matchId, messageId: clientMessageId || `blocked_${Date.now()}`,
        category: result.category, severity: result.risk, risk: result.risk,
        confidence: result.confidence, recommendedAction: result.recommendedAction,
        action, reason: result.reason || null,
      }).catch(() => {});
      if (result.risk === 'CRITICAL' && activeMatches.has(matchId)) teardownMatch(matchId, 'moderation_critical', userId);
      if (result.risk === 'CRITICAL' && process.env.CUPIDX_AUTO_SUSPEND_CRITICAL === 'true' && result.confidence >= 0.92) {
        await prisma.user.update({ where: { id: userId }, data: { isSuspended: true } }).catch(() => {});
        userCache.delete(userId);
      }
      if (typeof callback === 'function') callback({ error: 'Message blocked by CupidX safety moderation.', code: 'MESSAGE_BLOCKED', risk: result.risk, category: result.category });
      return;
    }

    const messageObj = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      clientMessageId: clientMessageId || null,
      chatSessionId: matchId, matchId, senderId: userId, recipientId: partnerId,
      senderUsername: username, content: normalizedContent, imageUrl: normalizedImageUrl,
      sequenceNumber: Date.now(), createdAt: new Date().toISOString(), status: 'SENT',
    };

    try {
      let persisted = null;
      if (clientMessageId) persisted = await prisma.message.findFirst({ where: { clientMessageId, chatSessionId: matchId, senderId: userId } });
      if (!persisted) {
        persisted = await prisma.message.create({
          data: { clientMessageId: clientMessageId || null, chatSessionId: matchId, senderId: userId, content: normalizedContent, imageUrl: normalizedImageUrl },
        });
      }
      messageObj.id = persisted.id;
    } catch (persistError) {
      console.warn('[MESSAGE_PERSIST] Socket message persistence failed:', persistError?.message || persistError);
    }

    recentMatchMessageCounts.set(matchId, recentCount);
    io.to(match.roomId).emit('receive_random_message', messageObj);
    recordModerationEvent(prisma, {
      userId, matchId, messageId: messageObj.id, category: result.category, severity: result.risk, risk: result.risk,
      confidence: result.confidence, recommendedAction: result.recommendedAction,
      action: result.risk === 'MEDIUM_RISK' ? 'MONITOR' : 'NONE', reason: result.reason || null,
    }).catch(() => {});
    console.log('[MESSAGE_SENT]', { userId, matchId, messageId: messageObj.id, risk: result.risk });

    if (typeof callback === 'function') {
      callback({ success: true, message: messageObj });
    }
  });

  // ── Event: Message Delivery Acknowledgement (Client B -> Server -> Client A) ─
  socket.on('ack_random_message_delivered', ({ messageId, clientMessageId, chatSessionId }) => {
    if (!chatSessionId || !messageId) return;
    const match = activeMatches.get(chatSessionId);
    if (!match) return;
    if (match.userA.userId !== userId && match.userB.userId !== userId) return;

    socket.to(match.roomId).emit('random_message_delivered', {
      messageId,
      clientMessageId,
      chatSessionId,
      deliveredAt: new Date().toISOString(),
    });
    console.log(`[MESSAGE_DELIVERED] ${messageId} confirmed by recipient ${userId}`);
  });

  // ── Event: Ephemeral Typing Indicator (Zero DB hit, zero reconnect) ────────
  socket.on('random_typing_status', ({ isTyping }) => {
    const matchId = userActiveMatch.get(userId);
    if (!matchId) return;

    const match = activeMatches.get(matchId);
    if (match && match.roomId) {
      socket.to(match.roomId).emit('partner_typing_status', {
        isTyping: Boolean(isTyping),
        userId,
      });
    }
  });

  // ── Event: Next Partner (Instant skip & re-queue with 60s anti-rematch) ────
  socket.on('next_partner', async (preferences = {}) => {
    nextMatchmakingToken(userId);
    matchmakingStates.set(userId, 'DISCONNECTING');
    const currentMatchId = userActiveMatch.get(userId);
    if (currentMatchId) {
      console.log(`[NEXT] User ${userId} skipped match ${currentMatchId}`);
      teardownMatch(currentMatchId, 'partner_skipped', userId);
    }

    randomMatchQueue = randomMatchQueue.filter((c) => c.userId !== userId);
    const [userData] = await Promise.all([
      getCachedUserData(userId),
      getCachedBlockedUsers(userId),
    ]);

    if (!userSockets.has(userId)) return;
    if (userData.isSuspended) {
      matchmakingStates.set(userId, 'IDLE');
      socket.emit('matchmaking_blocked', { reason: 'ACCOUNT_RESTRICTED' });
      return;
    }
    if (userActiveMatch.has(userId)) {
      teardownMatch(userActiveMatch.get(userId), 'partner_skipped', userId);
    }

    const country = detectCountryFromSocket(socket);

    const candidate = {
      socketId: socket.id,
      userId,
      username: userData.username,
      fullName: userData.fullName,
      avatarUrl: userData.avatarUrl,
      avatarEmoji: userData.avatarEmoji,
      gender: preferences.gender || userData.gender || 'unspecified',
      genderPref: preferences.preferredGender || preferences.genderPref || userData.preferredGender || 'auto',
      mood: preferences.mood || userData.mood || 'chill',
      tags: preferences.tags && Array.isArray(preferences.tags) ? preferences.tags : userData.tags,
      language: preferences.language || userData.language || 'english',
      plan: userData.plan,
      isVIP: userData.isVIP,
      countryCode: country.countryCode,
      countryName: country.countryName,
      countryFlag: country.countryFlag,
      joinTime: Date.now(),
      searchToken: nextMatchmakingToken(userId),
    };

    matchmakingStates.set(userId, 'SEARCHING');
    const existingIdx = randomMatchQueue.findIndex((c) => c.userId === userId);
    if (existingIdx !== -1) {
      randomMatchQueue[existingIdx] = candidate;
    } else {
      randomMatchQueue.push(candidate);
    }
    console.log(`[QUEUE_JOIN] [NEXT] User ${userId} re-queued for next partner. Total in queue: ${randomMatchQueue.length}`);
    socket.emit('queue_joined', { status: 'searching', isVIP: candidate.isVIP, plan: candidate.plan });

    processMatchQueue();
  });

  // ── Event: End Random Chat ─────────────────────────────────────────────────
  socket.on('end_random_chat', () => {
    nextMatchmakingToken(userId);
    matchmakingStates.set(userId, 'DISCONNECTING');
    const currentMatchId = userActiveMatch.get(userId);
    if (currentMatchId) {
      console.log(`[SESSION_CLEANUP] User ${userId} requested chat end for match ${currentMatchId}`);
      teardownMatch(currentMatchId, 'chat_ended', userId);
    }
    randomMatchQueue = randomMatchQueue.filter((c) => c.userId !== userId);
    matchmakingStates.set(userId, 'IDLE');
    socket.emit('chat_ended_confirm');
  });

  // ── Private Chat: 1-on-1 VIP Messaging ─────────────────────────────────────
  socket.on('send_message', async (payload, callback) => {
    try {
      const { receiverId, content, imageUrl, clientMessageId } = payload || {};
      if (!receiverId || (!content && !imageUrl)) {
        if (typeof callback === 'function') callback({ error: 'Receiver ID and content are required' });
        return;
      }

      // Check block relations before delivering message
      const blocked = await getCachedBlockedUsers(userId);
      if (blocked.has(receiverId)) {
        if (typeof callback === 'function') callback({ error: 'Communication with this member is unavailable.' });
        return;
      }

      // Asymmetric VIP enforcement: Only VIP members can send messages
      let senderData = await getCachedUserData(userId);
      let isSenderVip = senderData?.isVIP === true;
      if (!isSenderVip) {
        // Double-check database in case user recently purchased VIP
        const freshUser = await prisma.user.findFirst({
          where: { OR: [{ id: userId }, { clerkUserId: userId }] },
          include: { subscription: true },
        });
        const now = new Date();
        if (freshUser) {
          if (freshUser.vip_expires_at && new Date(freshUser.vip_expires_at).getTime() <= now.getTime()) {
            isSenderVip = false;
          } else if (freshUser.subscription) {
            const subEnd = freshUser.subscription.endDate || freshUser.subscription.currentPeriodEnd;
            if (subEnd && new Date(subEnd).getTime() <= now.getTime()) {
              isSenderVip = false;
            } else if (freshUser.subscription.isActive === true && freshUser.subscription.plan === 'VIP') {
              isSenderVip = true;
            }
          }
          if (!isSenderVip && (freshUser.is_vip || freshUser.membershipTier === 'VIP')) {
            if (!freshUser.vip_expires_at || new Date(freshUser.vip_expires_at).getTime() > now.getTime()) {
              isSenderVip = true;
            }
          }
        }
        if (isSenderVip) {
          userCache.delete(userId);
        }
      }

      if (!isSenderVip) {
        if (typeof callback === 'function') {
          callback({
            error: 'You cannot message this person. Get VIP to chat.',
            isVipRequired: true,
          });
        }
        return;
      }

      // Verify active friendship (using cached verification for sub-millisecond dispatch)
      const [u1, u2] = userId < receiverId ? [userId, receiverId] : [receiverId, userId];
      const isFriend = await checkCachedFriendship(u1, u2);
      if (!isFriend) {
        if (typeof callback === 'function') callback({ error: 'You must be friends to exchange messages.' });
        return;
      }

      const msgObj = {
        id: `pmsg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        clientMessageId: clientMessageId || null,
        senderId: userId,
        receiverId,
        content: (content || '').trim(),
        imageUrl: imageUrl || null,
        status: 'SENT',
        createdAt: new Date().toISOString(),
      };

      const recipientSockets = userSockets.get(receiverId);
      if (recipientSockets) {
        recipientSockets.forEach((sId) => {
          io.to(sId).emit('receive_message', msgObj);
        });
      }

      const mySockets = userSockets.get(userId);
      if (mySockets) {
        mySockets.forEach((sId) => {
          io.to(sId).emit('receive_message', msgObj);
        });
      }

      if (typeof callback === 'function') {
        callback({ success: true, message: msgObj });
      }

      setImmediate(async () => {
        try {
          // Canonical ordering u1 < u2
          const [u1, u2] = userId < receiverId ? [userId, receiverId] : [receiverId, userId];
          const conv = await prisma.conversation.upsert({
            where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
            update: { lastMessageAt: new Date() },
            create: { user1Id: u1, user2Id: u2, lastMessageAt: new Date() },
          });

          await prisma.privateMessage.create({
            data: {
              conversationId: conv.id,
              senderId: userId,
              content: msgObj.content,
              imageUrl: msgObj.imageUrl,
              clientMessageId: msgObj.clientMessageId,
            },
          });
        } catch (dbErr) {
          console.warn('Private message DB persistence notice:', dbErr.message);
        }
      });
    } catch (e) {
      if (typeof callback === 'function') callback({ error: 'Failed to send private message' });
    }
  });

  // ── Private Chat: Typing Status ────────────────────────────────────────────
  socket.on('typing_status', ({ receiverId, isTyping }) => {
    if (!receiverId) return;
    const recipientSockets = userSockets.get(receiverId);
    if (recipientSockets) {
      recipientSockets.forEach((sId) => {
        io.to(sId).emit('typing_status_changed', {
          senderId: userId,
          isTyping: Boolean(isTyping),
        });
      });
    }
  });

  // ── Private Chat: Read Receipts ───────────────────────────────────────────
  socket.on('mark_messages_read', ({ senderId }) => {
    if (!senderId) return;
    const senderSockets = userSockets.get(senderId);
    if (senderSockets) {
      senderSockets.forEach((sId) => {
        io.to(sId).emit('messages_read_receipt', { readerId: userId });
      });
    }

    setImmediate(async () => {
      try {
        const [u1, u2] = userId < senderId ? [userId, senderId] : [senderId, userId];
        const conv = await prisma.conversation.findUnique({
          where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
        });
        if (conv) {
          await prisma.privateMessage.updateMany({
            where: { conversationId: conv.id, senderId, status: 'SENT' },
            data: { status: 'READ' },
          });
        }
      } catch {}
    });
  });

  // ── Private Chat: Delete Message (Targeted Emit + DB Delete) ───────────────
  socket.on('delete_message', ({ messageId, receiverId }, callback) => {
    if (!messageId) return;

    // Targeted notification only to the sender and recipient sockets
    const mySockets = userSockets.get(userId);
    if (mySockets) {
      mySockets.forEach((sId) => io.to(sId).emit('message_deleted', { messageId, deletedBy: userId }));
    }
    if (receiverId) {
      const recipientSockets = userSockets.get(receiverId);
      if (recipientSockets) {
        recipientSockets.forEach((sId) => io.to(sId).emit('message_deleted', { messageId, deletedBy: userId }));
      }
    }

    if (typeof callback === 'function') callback({ success: true });

    setImmediate(async () => {
      try {
        await prisma.privateMessage.deleteMany({
          where: { id: messageId, senderId: userId },
        });
      } catch {}
    });
  });

  // ── Disconnect Handler with 10-Second Grace Period ─────────────────────────
  socket.on('disconnect', () => {
    nextMatchmakingToken(userId);
    matchmakingStates.set(userId, 'DISCONNECTING');
    socketToUser.delete(socket.id);

    const userSocketSet = userSockets.get(userId);
    if (userSocketSet) {
      userSocketSet.delete(socket.id);
      if (userSocketSet.size === 0) {
        userSockets.delete(userId);

        randomMatchQueue = randomMatchQueue.filter((c) => c.userId !== userId);

        const activeMId = userActiveMatch.get(userId);
        if (activeMId) {
          const timer = setTimeout(() => {
            reconnectGraceTimers.delete(userId);
            if (!userSockets.has(userId)) {
              teardownMatch(activeMId, 'disconnected', userId);
            }
          }, 10000);
          reconnectGraceTimers.set(userId, timer);
        }

        setTimeout(async () => {
          if (!userSockets.has(userId)) {
            try {
              await prisma.profile.updateMany({
                where: { OR: [{ userId }, { user: { clerkUserId: userId } }] },
                data: { isOnline: false, lastSeen: new Date() },
              });
              io.emit('user_status_changed', { userId, username, isOnline: false });
            } catch {}
          }
        }, 15000);
      }
    }
  });
});

// ── Global Queue Stats for Admin Dashboard ───────────────────────────────────
global.getQueueStats = () => ({
  queueLength: randomMatchQueue.length,
  activeRandomChatsCount: activeMatches.size,
  connectedUsersCount: userSockets.size,
});

// ── Graceful Shutdown ────────────────────────────────────────────────────────
const gracefulShutdown = () => {
  console.log('\nGracefully shutting down CupidX Realtime Socket Server...');
  io.close(() => {
    server.close(async () => {
      try {
        await prisma.$disconnect();
      } catch {}
      console.log('Server and database connections drained cleanly.');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

server.listen(PORT, () => {
  const dbMode = isPostgres ? 'PostgreSQL' : 'SQLite (local dev)';
  console.log(`⚡ CupidX Production Realtime Socket.IO Server running on port ${PORT}`);
  console.log(`   - HTTP Health Check: http://localhost:${PORT}/health`);
  console.log(`   - Database: ${dbMode}`);
  console.log(`   - Environment: ${process.env.NODE_ENV || 'development'}`);
});
