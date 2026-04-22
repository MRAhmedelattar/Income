-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "defaultValue" REAL NOT NULL DEFAULT 0,
    "isEditable" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT NOT NULL DEFAULT 'budget',
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "fundId" TEXT,
    "revenueId" TEXT,
    "budgetItemId" TEXT,
    CONSTRAINT "Item_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "Fund" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Item_revenueId_fkey" FOREIGN KEY ("revenueId") REFERENCES "Revenue" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Item_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "BudgetItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Item" ("defaultValue", "fundId", "id", "isEditable", "name", "orderIndex", "revenueId", "type") SELECT "defaultValue", "fundId", "id", "isEditable", "name", "orderIndex", "revenueId", "type" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
