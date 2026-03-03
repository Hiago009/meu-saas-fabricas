/*
  Warnings:

  - You are about to drop the column `statusAcerto` on the `Kit` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Kit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nomeDoKit" TEXT NOT NULL,
    "nomeVendedora" TEXT,
    "dataMontagem" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataPrevistaCobranca" DATETIME,
    "statusCobranca" TEXT NOT NULL DEFAULT 'PENDENTE',
    "sacoleiroId" INTEGER NOT NULL,
    CONSTRAINT "Kit_sacoleiroId_fkey" FOREIGN KEY ("sacoleiroId") REFERENCES "Cliente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Kit" ("dataMontagem", "id", "nomeDoKit", "nomeVendedora", "sacoleiroId") SELECT "dataMontagem", "id", "nomeDoKit", "nomeVendedora", "sacoleiroId" FROM "Kit";
DROP TABLE "Kit";
ALTER TABLE "new_Kit" RENAME TO "Kit";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
