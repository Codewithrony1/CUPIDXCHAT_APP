-- ============================================================================
-- Migration: 20260922013920_audit_integrity_perf_fixes
-- Security & Performance fixes from forensic audit
-- ============================================================================

-- DB-001: Replace the non-unique index on Message.clientMessageId with a
-- proper UNIQUE constraint to prevent duplicate message inserts from race
-- conditions during network retries.
--
-- NOTE: clientMessageId is nullable. In PostgreSQL, UNIQUE constraints allow
-- multiple NULLs (NULLs are not considered equal), so this is safe and
-- preserves backward compatibility for messages without an idempotency key.
DROP INDEX IF EXISTS "Message_clientMessageId_idx";
CREATE UNIQUE INDEX "Message_clientMessageId_key" ON "Message"("clientMessageId");

-- DB-001: Same fix for PrivateMessage.clientMessageId
DROP INDEX IF EXISTS "PrivateMessage_clientMessageId_idx";
CREATE UNIQUE INDEX "PrivateMessage_clientMessageId_key" ON "PrivateMessage"("clientMessageId");

-- PERF-001: Add composite indexes on Conversation for efficient lookup by
-- userId ordered by lastMessageAt (descending). Without these, the database
-- must merge index scans on user1Id and user2Id separately, then sort
-- the merged result in memory.
CREATE INDEX IF NOT EXISTS "Conversation_user1Id_lastMessageAt_idx"
  ON "Conversation"("user1Id", "lastMessageAt" DESC);

CREATE INDEX IF NOT EXISTS "Conversation_user2Id_lastMessageAt_idx"
  ON "Conversation"("user2Id", "lastMessageAt" DESC);
