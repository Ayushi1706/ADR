-- CreateEnum
CREATE TYPE "MatterType" AS ENUM ('ARBITRATION', 'MEDIATION', 'CONCILIATION', 'OTHER');

-- CreateEnum
CREATE TYPE "OnboardingMode" AS ENUM ('COMMENCEMENT', 'ONGOING');

-- CreateEnum
CREATE TYPE "MatterStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('COMPLETED', 'PENDING', 'NOT_APPLICABLE', 'NOT_RECORDED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('INVOCATION', 'APPOINTMENT', 'PLEADING', 'CLAIM', 'DEFENCE', 'COUNTERCLAIM', 'REJOINDER', 'DOCUMENT_ADMISSION_DENIAL', 'INTERIM_APPLICATION', 'INTERIM_ORDER', 'EVIDENCE', 'AFFIDAVIT', 'EXAMINATION_IN_CHIEF', 'CROSS_EXAMINATION', 'RE_EXAMINATION', 'HEARING', 'MINUTES', 'ORDER', 'PROCEDURAL_DIRECTION', 'FINAL_ARGUMENTS', 'AWARD', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Matter" (
    "id" TEXT NOT NULL,
    "matterCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "matterType" "MatterType" NOT NULL DEFAULT 'ARBITRATION',
    "onboardingMode" "OnboardingMode" NOT NULL,
    "status" "MatterStatus" NOT NULL DEFAULT 'ACTIVE',
    "appointmentDate" TIMESTAMP(3),
    "registrationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentStage" TEXT NOT NULL,
    "institution" TEXT,
    "referenceNumber" TEXT,
    "seat" TEXT,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Matter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProceduralEvent" (
    "id" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "eventType" "EventType" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "status" "EventStatus" NOT NULL DEFAULT 'COMPLETED',
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProceduralEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingDirection" (
    "id" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingDirection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matterId" TEXT,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Matter_matterCode_key" ON "Matter"("matterCode");

-- CreateIndex
CREATE INDEX "Matter_createdById_idx" ON "Matter"("createdById");

-- CreateIndex
CREATE INDEX "ProceduralEvent_matterId_eventDate_idx" ON "ProceduralEvent"("matterId", "eventDate");

-- CreateIndex
CREATE INDEX "AuditEvent_matterId_createdAt_idx" ON "AuditEvent"("matterId", "createdAt");

-- AddForeignKey
ALTER TABLE "Matter" ADD CONSTRAINT "Matter_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProceduralEvent" ADD CONSTRAINT "ProceduralEvent_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingDirection" ADD CONSTRAINT "PendingDirection_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
