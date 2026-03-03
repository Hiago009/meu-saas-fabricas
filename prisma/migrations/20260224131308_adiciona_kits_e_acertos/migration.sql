-- CreateTable
CREATE TABLE "Kit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nomeDoKit" TEXT NOT NULL,
    "nomeVendedora" TEXT,
    "dataMontagem" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statusAcerto" TEXT NOT NULL DEFAULT 'PENDENTE',
    "sacoleiroId" INTEGER NOT NULL,
    CONSTRAINT "Kit_sacoleiroId_fkey" FOREIGN KEY ("sacoleiroId") REFERENCES "Cliente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemKit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "quantidadeEnviada" INTEGER NOT NULL,
    "quantidadeDevolvida" INTEGER NOT NULL DEFAULT 0,
    "quantidadeVendida" INTEGER NOT NULL DEFAULT 0,
    "kitId" INTEGER NOT NULL,
    "produtoId" INTEGER NOT NULL,
    CONSTRAINT "ItemKit_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "Kit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ItemKit_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
