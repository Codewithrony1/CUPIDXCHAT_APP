-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firebaseUid" TEXT,
    "clerkUserId" TEXT,
    "username" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "displayName" TEXT,
    "email" TEXT,
    "gender" TEXT NOT NULL DEFAULT 'unspecified',
    "dob" DATETIME,
    "genderDobLocked" BOOLEAN NOT NULL DEFAULT false,
    "profileCompleted" BOOLEAN NOT NULL DEFAULT false,
    "profileLocked" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT DEFAULT '',
    "role" TEXT NOT NULL DEFAULT 'USER',
    "membershipTier" TEXT NOT NULL DEFAULT 'FREE',
    "is_vip" BOOLEAN NOT NULL DEFAULT false,
    "vip_started_at" DATETIME,
    "vip_expires_at" DATETIME,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bio" TEXT NOT NULL DEFAULT '',
    "showBio" BOOLEAN NOT NULL DEFAULT true,
    "age" INTEGER NOT NULL DEFAULT 18,
    "gender" TEXT NOT NULL DEFAULT 'unspecified',
    "dob" DATETIME,
    "ageGenderConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "profileCompleted" BOOLEAN NOT NULL DEFAULT false,
    "profileLocked" BOOLEAN NOT NULL DEFAULT false,
    "ageGenderChangesCount" INTEGER NOT NULL DEFAULT 0,
    "showGender" BOOLEAN NOT NULL DEFAULT true,
    "preferredGender" TEXT NOT NULL DEFAULT 'auto',
    "personalityPreferences" TEXT NOT NULL DEFAULT '',
    "mood" TEXT NOT NULL DEFAULT '',
    "showMood" BOOLEAN NOT NULL DEFAULT true,
    "moodExpiresAt" DATETIME,
    "language" TEXT NOT NULL DEFAULT 'english',
    "saveChatHistory" BOOLEAN NOT NULL DEFAULT false,
    "interests" TEXT NOT NULL DEFAULT '',
    "avatarType" TEXT NOT NULL DEFAULT 'EMOJI',
    "avatarEmoji" TEXT NOT NULL DEFAULT '😊',
    "avatarUrl" TEXT,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "themePreference" TEXT NOT NULL DEFAULT 'system',
    "randomChatIntroSeen" BOOLEAN NOT NULL DEFAULT false,
    "nameChangesCount" INTEGER NOT NULL DEFAULT 0,
    "nameChangesDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MatchmakingQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "socketId" TEXT,
    "gender" TEXT NOT NULL DEFAULT 'unspecified',
    "preferredGender" TEXT NOT NULL DEFAULT 'auto',
    "language" TEXT NOT NULL DEFAULT 'english',
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "chatSessionId" TEXT,
    "partnerUserId" TEXT,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    CONSTRAINT "ChatSession_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatSession_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientMessageId" TEXT,
    "chatSessionId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_chatSessionId_fkey" FOREIGN KEY ("chatSessionId") REFERENCES "ChatSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Block_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Block_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserBan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bannedByUserId" TEXT NOT NULL,
    "bannedUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserBan_bannedByUserId_fkey" FOREIGN KEY ("bannedByUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserBan_bannedUserId_fkey" FOREIGN KEY ("bannedUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reporterId" TEXT NOT NULL,
    "reportedUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "snapshotMessages" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Report_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "razorpayOrderId" TEXT NOT NULL,
    "razorpayPaymentId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "plan" TEXT NOT NULL DEFAULT 'VIP',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "qrImageUrl" TEXT,
    "qrCodeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'VIP',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'INACTIVE',
    "subscriptionId" TEXT,
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" DATETIME,
    "currentPeriodStart" DATETIME,
    "currentPeriodEnd" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SYSTEM',
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ManualUpiPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "merchantName" TEXT NOT NULL DEFAULT 'Lexino Enterprises',
    "amount" REAL NOT NULL DEFAULT 99.0,
    "planName" TEXT NOT NULL DEFAULT 'VIP Membership',
    "utrNumber" TEXT,
    "screenshotUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNDER_REVIEW',
    "rejectionReason" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ManualUpiPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VipRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "proofUrl" TEXT,
    "txHash" TEXT,
    "utrNumber" TEXT,
    "amount" REAL NOT NULL DEFAULT 99.0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rejectionReason" TEXT,
    "reviewedAt" DATETIME,
    "reviewedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VipRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminUserId" TEXT NOT NULL,
    "adminFirebaseUid" TEXT,
    "adminClerkId" TEXT,
    "action" TEXT NOT NULL,
    "targetUserId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "details" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PaymentRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clerkUserId" TEXT,
    "userEmail" TEXT,
    "userFullName" TEXT,
    "username" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'monthly',
    "planId" TEXT NOT NULL DEFAULT 'pro_monthly',
    "region" TEXT NOT NULL DEFAULT 'india',
    "amount" REAL NOT NULL DEFAULT 29.0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "paymentId" TEXT,
    "screenshotUrl" TEXT,
    "screenshotKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNDER_REVIEW',
    "rejectionReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "reviewedAt" DATETIME,
    "reviewedBy" TEXT,
    CONSTRAINT "PaymentRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchmakingQueue_userId_key" ON "MatchmakingQueue"("userId");

-- CreateIndex
CREATE INDEX "MatchmakingQueue_status_gender_preferredGender_idx" ON "MatchmakingQueue"("status", "gender", "preferredGender");

-- CreateIndex
CREATE INDEX "ChatSession_userAId_status_idx" ON "ChatSession"("userAId", "status");

-- CreateIndex
CREATE INDEX "ChatSession_userBId_status_idx" ON "ChatSession"("userBId", "status");

-- CreateIndex
CREATE INDEX "Message_chatSessionId_createdAt_idx" ON "Message"("chatSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_clientMessageId_idx" ON "Message"("clientMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "Block_blockerId_blockedId_key" ON "Block"("blockerId", "blockedId");

-- CreateIndex
CREATE INDEX "UserBan_bannedByUserId_idx" ON "UserBan"("bannedByUserId");

-- CreateIndex
CREATE INDEX "UserBan_bannedUserId_idx" ON "UserBan"("bannedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBan_bannedByUserId_bannedUserId_key" ON "UserBan"("bannedByUserId", "bannedUserId");

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
CREATE UNIQUE INDEX "AppSetting_key_key" ON "AppSetting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRequest_requestId_key" ON "PaymentRequest"("requestId");

-- CreateIndex
CREATE INDEX "PaymentRequest_status_idx" ON "PaymentRequest"("status");

-- CreateIndex
CREATE INDEX "PaymentRequest_userId_idx" ON "PaymentRequest"("userId");

-- CreateIndex
CREATE INDEX "PaymentRequest_clerkUserId_idx" ON "PaymentRequest"("clerkUserId");
