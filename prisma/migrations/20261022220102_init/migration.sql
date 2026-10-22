-- CreateTable
CREATE TABLE "Donor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "firstDonationDate" TEXT NOT NULL,
    "referredBy" TEXT
);

-- CreateTable
CREATE TABLE "Donation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "donorId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "amountUsd" REAL NOT NULL,
    "method" TEXT NOT NULL,
    "program" TEXT NOT NULL,
    "campaign" TEXT,
    "status" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "referredBy" TEXT,
    CONSTRAINT "Donation_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "donorId" TEXT NOT NULL,
    "amountUsd" REAL NOT NULL,
    "frequency" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT,
    "status" TEXT NOT NULL,
    CONSTRAINT "Subscription_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "donorId" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'es',
    "alias" TEXT,
    "gamificationOptOut" BOOLEAN NOT NULL DEFAULT false,
    "firstLoginAt" TEXT,
    "referralCode" TEXT,
    CONSTRAINT "User_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BadgeDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "nameEs" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "descEs" TEXT NOT NULL,
    "descEn" TEXT NOT NULL,
    "rule" JSONB NOT NULL,
    "icon" TEXT NOT NULL,
    "tier" TEXT,
    "repeatable" BOOLEAN NOT NULL DEFAULT false,
    "manualOnly" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "BadgeAward" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "donorId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "awardedAt" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'auto',
    CONSTRAINT "BadgeAward_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BadgeAward_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "BadgeDefinition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RankSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "donorId" TEXT NOT NULL,
    "ranking" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "asOfDate" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "totalRanked" INTEGER NOT NULL,
    "points" REAL NOT NULL,
    CONSTRAINT "RankSnapshot_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "createdAt" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "readAt" TEXT,
    "dedupeKey" TEXT NOT NULL,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SocialClaim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TEXT NOT NULL,
    "reviewedAt" TEXT,
    CONSTRAINT "SocialClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShareEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    CONSTRAINT "ShareEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "titleEs" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "bodyEs" TEXT NOT NULL,
    "bodyEn" TEXT NOT NULL,
    "campaign" TEXT,
    "goalAmount" REAL,
    "startDate" TEXT,
    "endDate" TEXT,
    "publishedAt" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" JSONB NOT NULL
);

-- CreateIndex
CREATE INDEX "Donor_email_idx" ON "Donor"("email");

-- CreateIndex
CREATE INDEX "Donation_donorId_date_idx" ON "Donation"("donorId", "date");

-- CreateIndex
CREATE INDEX "Donation_date_idx" ON "Donation"("date");

-- CreateIndex
CREATE INDEX "Donation_subscriptionId_idx" ON "Donation"("subscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_donorId_idx" ON "Subscription"("donorId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_donorId_key" ON "User"("donorId");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- CreateIndex
CREATE INDEX "BadgeAward_badgeId_idx" ON "BadgeAward"("badgeId");

-- CreateIndex
CREATE UNIQUE INDEX "BadgeAward_donorId_badgeId_periodKey_key" ON "BadgeAward"("donorId", "badgeId", "periodKey");

-- CreateIndex
CREATE INDEX "RankSnapshot_ranking_periodKey_idx" ON "RankSnapshot"("ranking", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "RankSnapshot_donorId_ranking_periodKey_key" ON "RankSnapshot"("donorId", "ranking", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SocialClaim_status_idx" ON "SocialClaim"("status");
