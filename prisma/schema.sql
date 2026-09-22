-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT,
    "username" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "displayName" TEXT,
    "email" TEXT,
    "gender" TEXT NOT NULL DEFAULT 'unspecified',
    "dob" TIMESTAMP(3),
    "genderDobLocked" BOOLEAN NOT NULL DEFAULT false,
    "profileCompleted" BOOLEAN NOT NULL DEFAULT false,
    "profileLocked" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT DEFAULT '',
    "role" TEXT NOT NULL DEFAULT 'USER',
    "membershipTier" TEXT NOT NULL DEFAULT 'FREE',
    "is_vip" BOOLEAN NOT NULL DEFAULT false,
    "vip_started_at" TIMESTAMP(3),
    "vip_expires_at" TIMESTAMP(3),
    "vipUsername" TEXT,
    "vipUsernameClaimedAt" TIMESTAMP(3),
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT NOT NULL DEFAULT '',
    "showBio" BOOLEAN NOT NULL DEFAULT true,
    "age" INTEGER NOT NULL DEFAULT 18,
    "gender" TEXT NOT NULL DEFAULT 'unspecified',
    "dob" TIMESTAMP(3),
    "ageGenderConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "profileCompleted" BOOLEAN NOT NULL DEFAULT false,
    "profileLocked" BOOLEAN NOT NULL DEFAULT false,
    "ageGenderChangesCount" INTEGER NOT NULL DEFAULT 0,
    "showGender" BOOLEAN NOT NULL DEFAULT true,
    "preferredGender" TEXT NOT NULL DEFAULT 'auto',
    "personalityPreferences" TEXT NOT NULL DEFAULT '',
    "mood" TEXT NOT NULL DEFAULT '',
    "showMood" BOOLEAN NOT NULL DEFAULT true,
    "moodExpiresAt" TIMESTAMP(3),
    "language" TEXT NOT NULL DEFAULT 'english',
    "saveChatHistory" BOOLEAN NOT NULL DEFAULT false,
    "interests" TEXT NOT NULL DEFAULT '',
    "avatarType" TEXT NOT NULL DEFAULT 'EMOJI',
    "avatarEmoji" TEXT NOT NULL DEFAULT '😊',
    "avatarUrl" TEXT,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "themePreference" TEXT NOT NULL DEFAULT 'system',
    "randomChatIntroSeen" BOOLEAN NOT NULL DEFAULT false,
    "nameChangesCount" INTEGER NOT NULL DEFAULT 0,
    "nameChangesDate" TIMESTAMP(3),
    "aiGenderEstimate" TEXT NOT NULL DEFAULT 'unknown',
    "aiGenderConfidence" DOUBLE PRECISION,
    "aiGenderEstimatedAt" TIMESTAMP(3),
    "aiGenderConsent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchmakingQueue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "socketId" TEXT,
    "gender" TEXT NOT NULL DEFAULT 'unspecified',
    "preferredGender" TEXT NOT NULL DEFAULT 'auto',
    "language" TEXT NOT NULL DEFAULT 'english',
    "countryCode" TEXT,
    "countryName" TEXT,
    "countryFlag" TEXT,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "chatSessionId" TEXT,
    "partnerUserId" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchmakingQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "clientMessageId" TEXT,
    "chatSessionId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AntiRematchExclusion" (
    "id" TEXT NOT NULL,
    "pairHash" TEXT NOT NULL,
    "user1Id" TEXT NOT NULL,
    "user2Id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AntiRematchExclusion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBan" (
    "id" TEXT NOT NULL,
    "bannedByUserId" TEXT NOT NULL,
    "bannedUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "snapshotMessages" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matchId" TEXT,
    "messageId" TEXT,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "risk" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "razorpayOrderId" TEXT NOT NULL,
    "razorpayPaymentId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "plan" TEXT NOT NULL DEFAULT 'VIP',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "qrImageUrl" TEXT,
    "qrCodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'VIP',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'INACTIVE',
    "subscriptionId" TEXT,
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SYSTEM',
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualUpiPayment" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "merchantName" TEXT NOT NULL DEFAULT 'Lexino Enterprises',
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 99.0,
    "planName" TEXT NOT NULL DEFAULT 'VIP Membership',
    "utrNumber" TEXT,
    "screenshotUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNDER_REVIEW',
    "rejectionReason" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualUpiPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VipRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "proofUrl" TEXT,
    "txHash" TEXT,
    "utrNumber" TEXT,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 99.0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rejectionReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VipRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminLog" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "adminClerkId" TEXT,
    "action" TEXT NOT NULL,
    "targetUserId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "details" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRequest" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clerkUserId" TEXT,
    "userEmail" TEXT,
    "userFullName" TEXT,
    "username" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'monthly',
    "planId" TEXT NOT NULL DEFAULT 'pro_monthly',
    "region" TEXT NOT NULL DEFAULT 'india',
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 29.0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "paymentId" TEXT,
    "screenshotUrl" TEXT,
    "screenshotKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNDER_REVIEW',
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,

    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FriendRequest" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FriendRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Friendship" (
    "id" TEXT NOT NULL,
    "user1Id" TEXT NOT NULL,
    "user2Id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "user1Id" TEXT NOT NULL,
    "user2Id" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivateMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "content" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "clientMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivateMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallSession" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "callerId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "callType" TEXT NOT NULL DEFAULT 'VOICE',
    "status" TEXT NOT NULL DEFAULT 'CALLING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "offerSdp" TEXT,
    "answerSdp" TEXT,
    "iceCandidates" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "termsAccepted" BOOLEAN NOT NULL DEFAULT false,
    "termsAcceptedAt" TIMESTAMP(3),
    "privacyAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "privacyAcknowledgedAt" TIMESTAMP(3),
    "ageConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "ageConfirmedAt" TIMESTAMP(3),
    "randomChatAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "randomChatAcknowledgedAt" TIMESTAMP(3),
    "locationProcessingAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "locationProcessingAcknowledgedAt" TIMESTAMP(3),
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "marketingConsentUpdatedAt" TIMESTAMP(3),
    "termsVersion" TEXT NOT NULL DEFAULT '2026-09-01',
    "privacyVersion" TEXT NOT NULL DEFAULT '2026-09-01',
    "consentTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeletedAccountLock" (
    "id" TEXT NOT NULL,
    "emailHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL DEFAULT 'ACCOUNT_DELETION_COOLDOWN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeletedAccountLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialAuditRecord" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'MANUAL_UPI',
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialAuditRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_vipUsername_key" ON "User"("vipUsername");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchmakingQueue_userId_key" ON "MatchmakingQueue"("userId");

-- CreateIndex
CREATE INDEX "MatchmakingQueue_status_gender_preferredGender_idx" ON "MatchmakingQueue"("status", "gender", "preferredGender");

-- CreateIndex
CREATE INDEX "MatchmakingQueue_status_updatedAt_idx" ON "MatchmakingQueue"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "MatchmakingQueue_userId_status_idx" ON "MatchmakingQueue"("userId", "status");

-- CreateIndex
CREATE INDEX "ChatSession_userAId_status_idx" ON "ChatSession"("userAId", "status");

-- CreateIndex
CREATE INDEX "ChatSession_userBId_status_idx" ON "ChatSession"("userBId", "status");

-- CreateIndex
CREATE INDEX "ChatSession_status_startedAt_idx" ON "ChatSession"("status", "startedAt");

-- CreateIndex
CREATE INDEX "Message_chatSessionId_createdAt_idx" ON "Message"("chatSessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Message_clientMessageId_key" ON "Message"("clientMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "AntiRematchExclusion_pairHash_key" ON "AntiRematchExclusion"("pairHash");

-- CreateIndex
CREATE INDEX "AntiRematchExclusion_expiresAt_idx" ON "AntiRematchExclusion"("expiresAt");

-- CreateIndex
CREATE INDEX "AntiRematchExclusion_user1Id_user2Id_idx" ON "AntiRematchExclusion"("user1Id", "user2Id");

-- CreateIndex
CREATE UNIQUE INDEX "Block_blockerId_blockedId_key" ON "Block"("blockerId", "blockedId");

-- CreateIndex
CREATE INDEX "UserBan_bannedByUserId_idx" ON "UserBan"("bannedByUserId");

-- CreateIndex
CREATE INDEX "UserBan_bannedUserId_idx" ON "UserBan"("bannedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBan_bannedByUserId_bannedUserId_key" ON "UserBan"("bannedByUserId", "bannedUserId");

-- CreateIndex
CREATE INDEX "ModerationEvent_userId_createdAt_idx" ON "ModerationEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationEvent_matchId_createdAt_idx" ON "ModerationEvent"("matchId", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationEvent_risk_createdAt_idx" ON "ModerationEvent"("risk", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationEvent_category_createdAt_idx" ON "ModerationEvent"("category", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_razorpayOrderId_key" ON "Payment"("razorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_razorpayPaymentId_key" ON "Payment"("razorpayPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_eventId_key" ON "WebhookEvent"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "ManualUpiPayment_paymentId_key" ON "ManualUpiPayment"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "ManualUpiPayment_utrNumber_key" ON "ManualUpiPayment"("utrNumber");

-- CreateIndex
CREATE INDEX "ManualUpiPayment_status_idx" ON "ManualUpiPayment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "VipRequest_utrNumber_key" ON "VipRequest"("utrNumber");

-- CreateIndex
CREATE INDEX "VipRequest_status_idx" ON "VipRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AppSetting_key_key" ON "AppSetting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRequest_requestId_key" ON "PaymentRequest"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRequest_paymentId_key" ON "PaymentRequest"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentRequest_status_idx" ON "PaymentRequest"("status");

-- CreateIndex
CREATE INDEX "PaymentRequest_userId_idx" ON "PaymentRequest"("userId");

-- CreateIndex
CREATE INDEX "PaymentRequest_clerkUserId_idx" ON "PaymentRequest"("clerkUserId");

-- CreateIndex
CREATE INDEX "FriendRequest_receiverId_status_idx" ON "FriendRequest"("receiverId", "status");

-- CreateIndex
CREATE INDEX "FriendRequest_senderId_status_idx" ON "FriendRequest"("senderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FriendRequest_senderId_receiverId_key" ON "FriendRequest"("senderId", "receiverId");

-- CreateIndex
CREATE INDEX "Friendship_user1Id_idx" ON "Friendship"("user1Id");

-- CreateIndex
CREATE INDEX "Friendship_user2Id_idx" ON "Friendship"("user2Id");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_user1Id_user2Id_key" ON "Friendship"("user1Id", "user2Id");

-- CreateIndex
CREATE INDEX "Conversation_user1Id_idx" ON "Conversation"("user1Id");

-- CreateIndex
CREATE INDEX "Conversation_user2Id_idx" ON "Conversation"("user2Id");

-- CreateIndex
CREATE INDEX "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_user1Id_lastMessageAt_idx" ON "Conversation"("user1Id", "lastMessageAt" DESC);

-- CreateIndex
CREATE INDEX "Conversation_user2Id_lastMessageAt_idx" ON "Conversation"("user2Id", "lastMessageAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_user1Id_user2Id_key" ON "Conversation"("user1Id", "user2Id");

-- CreateIndex
CREATE INDEX "PrivateMessage_conversationId_createdAt_idx" ON "PrivateMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PrivateMessage_clientMessageId_key" ON "PrivateMessage"("clientMessageId");

-- CreateIndex
CREATE INDEX "CallSession_receiverId_status_idx" ON "CallSession"("receiverId", "status");

-- CreateIndex
CREATE INDEX "CallSession_callerId_status_idx" ON "CallSession"("callerId", "status");

-- CreateIndex
CREATE INDEX "CallSession_conversationId_idx" ON "CallSession"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "UserConsent_userId_key" ON "UserConsent"("userId");

-- CreateIndex
CREATE INDEX "UserConsent_userId_idx" ON "UserConsent"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DeletedAccountLock_emailHash_key" ON "DeletedAccountLock"("emailHash");

-- CreateIndex
CREATE INDEX "DeletedAccountLock_emailHash_idx" ON "DeletedAccountLock"("emailHash");

-- CreateIndex
CREATE INDEX "DeletedAccountLock_expiresAt_idx" ON "DeletedAccountLock"("expiresAt");

-- CreateIndex
CREATE INDEX "FinancialAuditRecord_orderId_idx" ON "FinancialAuditRecord"("orderId");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_chatSessionId_fkey" FOREIGN KEY ("chatSessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBan" ADD CONSTRAINT "UserBan_bannedByUserId_fkey" FOREIGN KEY ("bannedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBan" ADD CONSTRAINT "UserBan_bannedUserId_fkey" FOREIGN KEY ("bannedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualUpiPayment" ADD CONSTRAINT "ManualUpiPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VipRequest" ADD CONSTRAINT "VipRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminLog" ADD CONSTRAINT "AdminLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendRequest" ADD CONSTRAINT "FriendRequest_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendRequest" ADD CONSTRAINT "FriendRequest_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_user1Id_fkey" FOREIGN KEY ("user1Id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_user2Id_fkey" FOREIGN KEY ("user2Id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_user1Id_fkey" FOREIGN KEY ("user1Id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_user2Id_fkey" FOREIGN KEY ("user2Id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateMessage" ADD CONSTRAINT "PrivateMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateMessage" ADD CONSTRAINT "PrivateMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_callerId_fkey" FOREIGN KEY ("callerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserConsent" ADD CONSTRAINT "UserConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

