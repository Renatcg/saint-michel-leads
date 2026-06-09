CREATE TABLE "LeadFavorite" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadFavorite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeadFavorite_leadId_userId_key" ON "LeadFavorite"("leadId", "userId");
CREATE INDEX "LeadFavorite_userId_idx" ON "LeadFavorite"("userId");

ALTER TABLE "LeadFavorite" ADD CONSTRAINT "LeadFavorite_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadFavorite" ADD CONSTRAINT "LeadFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
