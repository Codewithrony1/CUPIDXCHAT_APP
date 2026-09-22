let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  // better-sqlite3 is optional in production environments (Vercel) using PostgreSQL/Supabase
}
const path = require('path');
const fs = require('fs');

function ensureDatabaseSchema(targetDbPath) {
  if (!Database || !targetDbPath || !fs.existsSync(targetDbPath)) {
    return;
  }

  let db;
  try {
    db = new Database(targetDbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    db.pragma('synchronous = NORMAL');

    try {
      db.exec(`
        CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");
        CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");
        CREATE INDEX IF NOT EXISTS "MatchmakingQueue_status_updatedAt_idx" ON "MatchmakingQueue"("status", "updatedAt");
        CREATE INDEX IF NOT EXISTS "MatchmakingQueue_userId_status_idx" ON "MatchmakingQueue"("userId", "status");
        CREATE INDEX IF NOT EXISTS "ChatSession_status_startedAt_idx" ON "ChatSession"("status", "startedAt");
        CREATE INDEX IF NOT EXISTS "ManualUpiPayment_status_idx" ON "ManualUpiPayment"("status");
        CREATE INDEX IF NOT EXISTS "VipRequest_status_idx" ON "VipRequest"("status");
      `);
    } catch (e) {
      // ignore if tables not yet created
    }

    // 1. Inspect and ensure User table columns
    const userTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='User'").get();
    if (userTable) {
      const userCols = db.pragma('table_info("User")').map((c) => c.name);
      
      if (!userCols.includes('profileCompleted')) {
        console.log(`[SCHEMA SYNC] Adding User.profileCompleted to ${targetDbPath}`);
        db.exec('ALTER TABLE "User" ADD COLUMN profileCompleted BOOLEAN NOT NULL DEFAULT 0;');
      }
      if (!userCols.includes('profileLocked')) {
        console.log(`[SCHEMA SYNC] Adding User.profileLocked to ${targetDbPath}`);
        db.exec('ALTER TABLE "User" ADD COLUMN profileLocked BOOLEAN NOT NULL DEFAULT 0;');
      }
      if (!userCols.includes('genderDobLocked')) {
        console.log(`[SCHEMA SYNC] Adding User.genderDobLocked to ${targetDbPath}`);
        db.exec('ALTER TABLE "User" ADD COLUMN genderDobLocked BOOLEAN NOT NULL DEFAULT 0;');
      }
      if (!userCols.includes('clerkUserId')) {
        console.log(`[SCHEMA SYNC] Adding User.clerkUserId to ${targetDbPath}`);
        db.exec('ALTER TABLE "User" ADD COLUMN clerkUserId TEXT;');
        db.exec('CREATE UNIQUE INDEX IF NOT EXISTS "User_clerkUserId_key" ON "User"("clerkUserId");');
      }

      if (!userCols.includes('vipUsername')) {
        console.log(`[SCHEMA SYNC] Adding User.vipUsername to ${targetDbPath}`);
        db.exec('ALTER TABLE "User" ADD COLUMN vipUsername TEXT;');
        db.exec('CREATE UNIQUE INDEX IF NOT EXISTS "User_vipUsername_key" ON "User"("vipUsername");');
      }
      if (!userCols.includes('vipUsernameClaimedAt')) {
        console.log(`[SCHEMA SYNC] Adding User.vipUsernameClaimedAt to ${targetDbPath}`);
        db.exec('ALTER TABLE "User" ADD COLUMN vipUsernameClaimedAt DATETIME;');
      }

      // Existing user preservation: if user already has DOB + Gender set, mark profileCompleted
      db.exec(`
        UPDATE "User"
        SET profileCompleted = 1, profileLocked = 1
        WHERE dob IS NOT NULL
          AND gender IS NOT NULL
          AND gender != 'unspecified'
          AND profileCompleted = 0;
      `);
    }

    // 2. Inspect and ensure Profile table columns
    const profileTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='Profile'").get();
    if (profileTable) {
      const profileCols = db.pragma('table_info("Profile")').map((c) => c.name);

      if (!profileCols.includes('profileCompleted')) {
        console.log(`[SCHEMA SYNC] Adding Profile.profileCompleted to ${targetDbPath}`);
        db.exec('ALTER TABLE "Profile" ADD COLUMN profileCompleted BOOLEAN NOT NULL DEFAULT 0;');
      }
      if (!profileCols.includes('profileLocked')) {
        console.log(`[SCHEMA SYNC] Adding Profile.profileLocked to ${targetDbPath}`);
        db.exec('ALTER TABLE "Profile" ADD COLUMN profileLocked BOOLEAN NOT NULL DEFAULT 0;');
      }
      if (!profileCols.includes('aiGenderEstimate')) {
        console.log(`[SCHEMA SYNC] Adding Profile.aiGenderEstimate to ${targetDbPath}`);
        db.exec("ALTER TABLE \"Profile\" ADD COLUMN aiGenderEstimate TEXT NOT NULL DEFAULT 'unknown';");
      }
      if (!profileCols.includes('aiGenderConfidence')) {
        console.log(`[SCHEMA SYNC] Adding Profile.aiGenderConfidence to ${targetDbPath}`);
        db.exec('ALTER TABLE "Profile" ADD COLUMN aiGenderConfidence REAL;');
      }
      if (!profileCols.includes('aiGenderEstimatedAt')) {
        console.log(`[SCHEMA SYNC] Adding Profile.aiGenderEstimatedAt to ${targetDbPath}`);
        db.exec('ALTER TABLE "Profile" ADD COLUMN aiGenderEstimatedAt DATETIME;');
      }
      if (!profileCols.includes('aiGenderConsent')) {
        console.log(`[SCHEMA SYNC] Adding Profile.aiGenderConsent to ${targetDbPath}`);
        db.exec('ALTER TABLE "Profile" ADD COLUMN aiGenderConsent BOOLEAN NOT NULL DEFAULT 0;');
      }

      db.exec(`
        UPDATE "Profile"
        SET profileCompleted = 1, profileLocked = 1
        WHERE dob IS NOT NULL
          AND gender IS NOT NULL
          AND gender != 'unspecified'
          AND profileCompleted = 0;
      `);
    }

    // 3. Inspect and ensure AppSetting table
    const appSettingTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='AppSetting'").get();
    if (!appSettingTable) {
      console.log(`[SCHEMA SYNC] Creating AppSetting table in ${targetDbPath}`);
      db.exec(`
        CREATE TABLE IF NOT EXISTS "AppSetting" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "key" TEXT NOT NULL,
          "value" TEXT NOT NULL,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "AppSetting_key_key" ON "AppSetting"("key");
      `);
    }

    // 4. Inspect and ensure FriendRequest table
    const friendRequestTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='FriendRequest'").get();
    if (!friendRequestTable) {
      console.log(`[SCHEMA SYNC] Creating FriendRequest table in ${targetDbPath}`);
      db.exec(`
        CREATE TABLE IF NOT EXISTS "FriendRequest" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "senderId" TEXT NOT NULL,
          "receiverId" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'PENDING',
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "FriendRequest_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "FriendRequest_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "FriendRequest_senderId_receiverId_key" ON "FriendRequest"("senderId", "receiverId");
        CREATE INDEX IF NOT EXISTS "FriendRequest_receiverId_status_idx" ON "FriendRequest"("receiverId", "status");
        CREATE INDEX IF NOT EXISTS "FriendRequest_senderId_status_idx" ON "FriendRequest"("senderId", "status");
      `);
    }

    // 5. Inspect and ensure Friendship table
    const friendshipTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='Friendship'").get();
    if (!friendshipTable) {
      console.log(`[SCHEMA SYNC] Creating Friendship table in ${targetDbPath}`);
      db.exec(`
        CREATE TABLE IF NOT EXISTS "Friendship" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "user1Id" TEXT NOT NULL,
          "user2Id" TEXT NOT NULL,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "Friendship_user1Id_fkey" FOREIGN KEY ("user1Id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "Friendship_user2Id_fkey" FOREIGN KEY ("user2Id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "Friendship_user1Id_user2Id_key" ON "Friendship"("user1Id", "user2Id");
        CREATE INDEX IF NOT EXISTS "Friendship_user1Id_idx" ON "Friendship"("user1Id");
        CREATE INDEX IF NOT EXISTS "Friendship_user2Id_idx" ON "Friendship"("user2Id");
      `);
    }

    // 6. Inspect and ensure Conversation table
    const conversationTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='Conversation'").get();
    if (!conversationTable) {
      console.log(`[SCHEMA SYNC] Creating Conversation table in ${targetDbPath}`);
      db.exec(`
        CREATE TABLE IF NOT EXISTS "Conversation" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "user1Id" TEXT NOT NULL,
          "user2Id" TEXT NOT NULL,
          "lastMessageAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "Conversation_user1Id_fkey" FOREIGN KEY ("user1Id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "Conversation_user2Id_fkey" FOREIGN KEY ("user2Id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "Conversation_user1Id_user2Id_key" ON "Conversation"("user1Id", "user2Id");
        CREATE INDEX IF NOT EXISTS "Conversation_user1Id_idx" ON "Conversation"("user1Id");
        CREATE INDEX IF NOT EXISTS "Conversation_user2Id_idx" ON "Conversation"("user2Id");
        CREATE INDEX IF NOT EXISTS "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");
      `);
    }

    // 7. Inspect and ensure PrivateMessage table
    const privateMessageTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='PrivateMessage'").get();
    if (!privateMessageTable) {
      console.log(`[SCHEMA SYNC] Creating PrivateMessage table in ${targetDbPath}`);
      db.exec(`
        CREATE TABLE IF NOT EXISTS "PrivateMessage" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "conversationId" TEXT NOT NULL,
          "senderId" TEXT NOT NULL,
          "type" TEXT NOT NULL DEFAULT 'TEXT',
          "content" TEXT NOT NULL DEFAULT '',
          "imageUrl" TEXT,
          "status" TEXT NOT NULL DEFAULT 'SENT',
          "clientMessageId" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "PrivateMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "PrivateMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "PrivateMessage_conversationId_createdAt_idx" ON "PrivateMessage"("conversationId", "createdAt");
        CREATE INDEX IF NOT EXISTS "PrivateMessage_clientMessageId_idx" ON "PrivateMessage"("clientMessageId");
      `);
    }

    // 8. Inspect and ensure CallSession table
    const callSessionTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='CallSession'").get();
    if (!callSessionTable) {
      console.log(`[SCHEMA SYNC] Creating CallSession table in ${targetDbPath}`);
      db.exec(`
        CREATE TABLE IF NOT EXISTS "CallSession" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "conversationId" TEXT NOT NULL,
          "callerId" TEXT NOT NULL,
          "receiverId" TEXT NOT NULL,
          "callType" TEXT NOT NULL DEFAULT 'VOICE',
          "status" TEXT NOT NULL DEFAULT 'CALLING',
          "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "endedAt" DATETIME,
          "durationSec" INTEGER NOT NULL DEFAULT 0,
          "offerSdp" TEXT,
          "answerSdp" TEXT,
          "iceCandidates" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "CallSession_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "CallSession_callerId_fkey" FOREIGN KEY ("callerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "CallSession_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "CallSession_receiverId_status_idx" ON "CallSession"("receiverId", "status");
        CREATE INDEX IF NOT EXISTS "CallSession_callerId_status_idx" ON "CallSession"("callerId", "status");
        CREATE INDEX IF NOT EXISTS "CallSession_conversationId_idx" ON "CallSession"("conversationId");
      `);
    }

    // 9. Inspect and ensure AntiRematchExclusion table
    const antiRematchTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='AntiRematchExclusion'").get();
    if (!antiRematchTable) {
      console.log(`[SCHEMA SYNC] Creating AntiRematchExclusion table in ${targetDbPath}`);
      db.exec(`
        CREATE TABLE IF NOT EXISTS "AntiRematchExclusion" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "pairHash" TEXT NOT NULL UNIQUE,
          "user1Id" TEXT NOT NULL,
          "user2Id" TEXT NOT NULL,
          "expiresAt" DATETIME NOT NULL,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "AntiRematchExclusion_pairHash_key" ON "AntiRematchExclusion"("pairHash");
        CREATE INDEX IF NOT EXISTS "AntiRematchExclusion_expiresAt_idx" ON "AntiRematchExclusion"("expiresAt");
        CREATE INDEX IF NOT EXISTS "AntiRematchExclusion_user1Id_user2Id_idx" ON "AntiRematchExclusion"("user1Id", "user2Id");
      `);
    }

    // 9b. Inspect and ensure ModerationEvent table
    const moderationEventTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ModerationEvent'").get();
    if (!moderationEventTable) {
      console.log(`[SCHEMA SYNC] Creating ModerationEvent table in ${targetDbPath}`);
      db.exec(`
        CREATE TABLE IF NOT EXISTS "ModerationEvent" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "userId" TEXT NOT NULL,
          "matchId" TEXT,
          "messageId" TEXT,
          "category" TEXT NOT NULL,
          "severity" TEXT NOT NULL,
          "risk" TEXT NOT NULL,
          "confidence" REAL NOT NULL DEFAULT 0,
          "recommendedAction" TEXT NOT NULL,
          "action" TEXT NOT NULL,
          "reason" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS "ModerationEvent_userId_createdAt_idx" ON "ModerationEvent"("userId", "createdAt");
        CREATE INDEX IF NOT EXISTS "ModerationEvent_matchId_createdAt_idx" ON "ModerationEvent"("matchId", "createdAt");
        CREATE INDEX IF NOT EXISTS "ModerationEvent_risk_createdAt_idx" ON "ModerationEvent"("risk", "createdAt");
        CREATE INDEX IF NOT EXISTS "ModerationEvent_category_createdAt_idx" ON "ModerationEvent"("category", "createdAt");
      `);
    }

    // 10. Inspect and ensure MatchmakingQueue country columns
    const queueTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='MatchmakingQueue'").get();
    if (queueTable) {
      const queueCols = db.pragma('table_info("MatchmakingQueue")').map((c) => c.name);
      if (!queueCols.includes('countryCode')) {
        db.exec('ALTER TABLE "MatchmakingQueue" ADD COLUMN countryCode TEXT;');
      }
      if (!queueCols.includes('countryName')) {
        db.exec('ALTER TABLE "MatchmakingQueue" ADD COLUMN countryName TEXT;');
      }
      if (!queueCols.includes('countryFlag')) {
        db.exec('ALTER TABLE "MatchmakingQueue" ADD COLUMN countryFlag TEXT;');
      }
    }

    // 11. Inspect and ensure Message deliveredAt column
    const messageTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='Message'").get();
    if (messageTable) {
      const msgCols = db.pragma('table_info("Message")').map((c) => c.name);
      if (!msgCols.includes('deliveredAt')) {
        db.exec('ALTER TABLE "Message" ADD COLUMN deliveredAt DATETIME;');
      }
    }

    // 12. Inspect and ensure UserConsent table
    const consentTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='UserConsent'").get();
    if (!consentTable) {
      console.log(`[SCHEMA SYNC] Creating UserConsent table in ${targetDbPath}`);
      db.exec(`
        CREATE TABLE IF NOT EXISTS "UserConsent" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "userId" TEXT NOT NULL UNIQUE,
          "termsAccepted" BOOLEAN NOT NULL DEFAULT 0,
          "termsAcceptedAt" DATETIME,
          "privacyAcknowledged" BOOLEAN NOT NULL DEFAULT 0,
          "privacyAcknowledgedAt" DATETIME,
          "ageConfirmed" BOOLEAN NOT NULL DEFAULT 0,
          "ageConfirmedAt" DATETIME,
          "randomChatAcknowledged" BOOLEAN NOT NULL DEFAULT 0,
          "randomChatAcknowledgedAt" DATETIME,
          "locationProcessingAcknowledged" BOOLEAN NOT NULL DEFAULT 0,
          "locationProcessingAcknowledgedAt" DATETIME,
          "marketingConsent" BOOLEAN NOT NULL DEFAULT 0,
          "marketingConsentUpdatedAt" DATETIME,
          "termsVersion" TEXT NOT NULL DEFAULT '2026-09-01',
          "privacyVersion" TEXT NOT NULL DEFAULT '2026-09-01',
          "consentTimestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "UserConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "UserConsent_userId_key" ON "UserConsent"("userId");
        CREATE INDEX IF NOT EXISTS "UserConsent_userId_idx" ON "UserConsent"("userId");
      `);
    }

    // 13. Inspect and ensure DeletedAccountLock table (48-hour re-registration protection)
    const lockTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='DeletedAccountLock'").get();
    if (!lockTable) {
      console.log(`[SCHEMA SYNC] Creating DeletedAccountLock table in ${targetDbPath}`);
      db.exec(`
        CREATE TABLE IF NOT EXISTS "DeletedAccountLock" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "emailHash" TEXT NOT NULL UNIQUE,
          "expiresAt" DATETIME NOT NULL,
          "reason" TEXT NOT NULL DEFAULT 'ACCOUNT_DELETION_COOLDOWN',
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "DeletedAccountLock_emailHash_key" ON "DeletedAccountLock"("emailHash");
        CREATE INDEX IF NOT EXISTS "DeletedAccountLock_emailHash_idx" ON "DeletedAccountLock"("emailHash");
        CREATE INDEX IF NOT EXISTS "DeletedAccountLock_expiresAt_idx" ON "DeletedAccountLock"("expiresAt");
      `);
    }

    // 14. Inspect and ensure FinancialAuditRecord table (Statutory payment retention)
    const auditTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='FinancialAuditRecord'").get();
    if (!auditTable) {
      console.log(`[SCHEMA SYNC] Creating FinancialAuditRecord table in ${targetDbPath}`);
      db.exec(`
        CREATE TABLE IF NOT EXISTS "FinancialAuditRecord" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "orderId" TEXT,
          "amount" REAL NOT NULL,
          "currency" TEXT NOT NULL DEFAULT 'INR',
          "plan" TEXT NOT NULL,
          "status" TEXT NOT NULL,
          "paymentMethod" TEXT NOT NULL DEFAULT 'MANUAL_UPI',
          "transactionDate" DATETIME NOT NULL,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS "FinancialAuditRecord_orderId_idx" ON "FinancialAuditRecord"("orderId");
      `);
    }
  } catch (err) {
    console.warn(`[SCHEMA SYNC WARNING] ${targetDbPath}:`, err.message);
  } finally {
    if (db) {
      try {
        db.close();
      } catch (e) {}
    }
  }
}

if (require.main === module) {
  const defaultPath = path.join(__dirname, 'dev.db');
  console.log(`Ensuring schema on ${defaultPath}...`);
  ensureDatabaseSchema(defaultPath);
  console.log('Schema check completed.');
}

module.exports = { ensureDatabaseSchema };
