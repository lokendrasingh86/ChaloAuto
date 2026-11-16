-- AlterTable
ALTER TABLE "Driver" ADD COLUMN     "capacity" INTEGER NOT NULL DEFAULT 4;

-- AlterTable
ALTER TABLE "Ride" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "distanceKm" DOUBLE PRECISION,
ADD COLUMN     "dropLat" DOUBLE PRECISION,
ADD COLUMN     "dropLng" DOUBLE PRECISION,
ADD COLUMN     "dropSequence" INTEGER,
ADD COLUMN     "fare" DOUBLE PRECISION,
ADD COLUMN     "matchedAt" TIMESTAMP(3),
ADD COLUMN     "pickupSequence" INTEGER,
ADD COLUMN     "poolId" TEXT,
ADD COLUMN     "rating" INTEGER,
ADD COLUMN     "ratingComment" TEXT;

-- CreateIndex
CREATE INDEX "Ride_poolId_idx" ON "Ride"("poolId");

-- CreateIndex
CREATE INDEX "Ride_status_idx" ON "Ride"("status");
