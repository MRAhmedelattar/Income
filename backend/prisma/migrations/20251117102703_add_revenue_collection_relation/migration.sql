-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Collection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "registrationDate" TEXT,
    "paymentDate" TEXT,
    "receiptNumber" TEXT,
    "name" TEXT,
    "total" REAL NOT NULL DEFAULT 0,
    "selectedRevenueId" TEXT,
    CONSTRAINT "Collection_selectedRevenueId_fkey" FOREIGN KEY ("selectedRevenueId") REFERENCES "Revenue" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Collection" ("id", "name", "paymentDate", "receiptNumber", "registrationDate", "total") SELECT "id", "name", "paymentDate", "receiptNumber", "registrationDate", "total" FROM "Collection";
DROP TABLE "Collection";
ALTER TABLE "new_Collection" RENAME TO "Collection";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
