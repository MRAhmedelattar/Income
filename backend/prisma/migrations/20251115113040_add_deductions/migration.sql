-- CreateTable
CREATE TABLE "Config" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "universityName" TEXT,
    "universityLogo" TEXT,
    "facultyName" TEXT,
    "facultyLogo" TEXT
);

-- CreateTable
CREATE TABLE "Fund" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "defaultValue" REAL NOT NULL DEFAULT 0,
    "isEditable" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT NOT NULL DEFAULT 'budget',
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "fundId" TEXT,
    CONSTRAINT "Item_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "Fund" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Revenue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'general',
    "date" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "RevenueItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "revenueId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "amount" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "RevenueItem_revenueId_fkey" FOREIGN KEY ("revenueId") REFERENCES "Revenue" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RevenueItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "registrationDate" TEXT,
    "paymentDate" TEXT,
    "receiptNumber" TEXT,
    "name" TEXT,
    "total" REAL NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "CollectionDistribution" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "collectionId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "amount" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "CollectionDistribution_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CollectionDistribution_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "permissions" TEXT,
    "createdAt" TEXT
);

-- CreateTable
CREATE TABLE "Deduction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "percentage" REAL NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Signature" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "name" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE UNIQUE INDEX "RevenueItem_revenueId_itemId_key" ON "RevenueItem"("revenueId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionDistribution_collectionId_itemId_key" ON "CollectionDistribution"("collectionId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
