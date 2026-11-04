-- CreateTable
CREATE TABLE "Request" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'New',
    "recordVersion" INTEGER NOT NULL DEFAULT 0,
    "reviewRevision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'inbound',
    "senderLabel" TEXT,
    "occurredAt" DATETIME,
    "body" TEXT NOT NULL,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RequestField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'unknown',
    "value" JSONB,
    "confirmedBy" TEXT,
    "confirmedAt" DATETIME,
    "notApplicableReason" TEXT,
    CONSTRAINT "RequestField_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FieldEvidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestFieldId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "exactQuote" TEXT NOT NULL,
    CONSTRAINT "FieldEvidence_requestFieldId_fkey" FOREIGN KEY ("requestFieldId") REFERENCES "RequestField" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FieldEvidence_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "baseRecordVersion" INTEGER NOT NULL,
    "safeErrorCode" TEXT,
    "output" JSONB,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    CONSTRAINT "AgentRun_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProposedChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentRunId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "previousValue" JSONB,
    "proposedValue" JSONB NOT NULL,
    "baseRecordVersion" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decidedBy" TEXT,
    "decidedAt" DATETIME,
    "decisionNote" TEXT,
    CONSTRAINT "ProposedChange_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "AgentRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProposalEvidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "proposedChangeId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "exactQuote" TEXT NOT NULL,
    CONSTRAINT "ProposalEvidence_proposedChangeId_fkey" FOREIGN KEY ("proposedChangeId") REFERENCES "ProposedChange" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProposalEvidence_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkflowIssue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "agentRunId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "fieldKeys" JSONB NOT NULL,
    "question" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolvedBy" TEXT,
    "resolvedAt" DATETIME,
    CONSTRAINT "WorkflowIssue_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkflowIssue_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "AgentRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewerDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "reviewerName" TEXT NOT NULL,
    "reviewerRole" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "notes" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "basedOnRevision" INTEGER NOT NULL DEFAULT 0,
    "recordedBy" TEXT,
    "decidedAt" DATETIME,
    CONSTRAINT "ReviewerDecision_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RequestEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorName" TEXT,
    "idempotencyKey" TEXT,
    "payload" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RequestEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Request_status_updatedAt_idx" ON "Request"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "Message_requestId_recordedAt_idx" ON "Message"("requestId", "recordedAt");

-- CreateIndex
CREATE INDEX "RequestField_requestId_state_idx" ON "RequestField"("requestId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "RequestField_requestId_fieldKey_key" ON "RequestField"("requestId", "fieldKey");

-- CreateIndex
CREATE INDEX "FieldEvidence_requestFieldId_idx" ON "FieldEvidence"("requestFieldId");

-- CreateIndex
CREATE INDEX "AgentRun_requestId_startedAt_idx" ON "AgentRun"("requestId", "startedAt");

-- CreateIndex
CREATE INDEX "ProposedChange_agentRunId_status_idx" ON "ProposedChange"("agentRunId", "status");

-- CreateIndex
CREATE INDEX "ProposalEvidence_proposedChangeId_idx" ON "ProposalEvidence"("proposedChangeId");

-- CreateIndex
CREATE INDEX "WorkflowIssue_requestId_status_severity_idx" ON "WorkflowIssue"("requestId", "status", "severity");

-- CreateIndex
CREATE INDEX "ReviewerDecision_requestId_required_status_idx" ON "ReviewerDecision"("requestId", "required", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RequestEvent_idempotencyKey_key" ON "RequestEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "RequestEvent_requestId_createdAt_idx" ON "RequestEvent"("requestId", "createdAt");
