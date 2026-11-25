ALTER TYPE "RideStatus" ADD VALUE IF NOT EXISTS 'PickedUp';
CREATE TYPE "PlannerMode" AS ENUM ('Legacy', 'Choice');
CREATE TYPE "ChoiceOfferStatus" AS ENUM ('Quoted', 'Pending', 'Accepted', 'Declined', 'Expired', 'Cancelled', 'Invalidated');

ALTER TABLE "Driver"
  ADD COLUMN "lastLocationAt" TIMESTAMP(3),
  ADD COLUMN "locationVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "routeVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "remainingStops" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Route" ADD COLUMN "roadGeometry" JSONB, ADD COLUMN "roadGeometryAt" TIMESTAMP(3);
ALTER TABLE "Ride"
  ADD COLUMN "plannerMode" "PlannerMode" NOT NULL DEFAULT 'Legacy',
  ADD COLUMN "pickedUpAt" TIMESTAMP(3),
  ADD COLUMN "lockedFare" DOUBLE PRECISION,
  ADD COLUMN "quoteShared" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "addedDelaySeconds" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "rawPickupLat" DOUBLE PRECISION,
  ADD COLUMN "rawPickupLng" DOUBLE PRECISION,
  ADD COLUMN "rawDropLat" DOUBLE PRECISION,
  ADD COLUMN "rawDropLng" DOUBLE PRECISION;

CREATE TABLE "ChoiceOffer" (
  "id" TEXT NOT NULL,
  "passengerId" TEXT NOT NULL,
  "driverId" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "routeVersion" INTEGER NOT NULL,
  "locationVersion" INTEGER NOT NULL,
  "trip" JSONB NOT NULL,
  "proposal" JSONB,
  "quoteFare" DOUBLE PRECISION NOT NULL,
  "quoteDistanceKm" DOUBLE PRECISION NOT NULL,
  "quoteShared" BOOLEAN NOT NULL,
  "status" "ChoiceOfferStatus" NOT NULL DEFAULT 'Quoted',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rideId" TEXT,
  CONSTRAINT "ChoiceOffer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ChoiceOffer_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ChoiceOffer_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ChoiceOffer_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ChoiceOffer_rideId_key" ON "ChoiceOffer"("rideId");
CREATE INDEX "ChoiceOffer_driverId_status_expiresAt_idx" ON "ChoiceOffer"("driverId", "status", "expiresAt");
CREATE INDEX "ChoiceOffer_passengerId_status_expiresAt_idx" ON "ChoiceOffer"("passengerId", "status", "expiresAt");
-- Expiry is processed before a new hold. These persist across process restarts.
CREATE UNIQUE INDEX "ChoiceOffer_one_pending_driver" ON "ChoiceOffer"("driverId") WHERE "status" = 'Pending';
CREATE UNIQUE INDEX "ChoiceOffer_one_pending_passenger" ON "ChoiceOffer"("passengerId") WHERE "status" = 'Pending';
