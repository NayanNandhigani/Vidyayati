-- CreateEnum
CREATE TYPE "MutationAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateTable
CREATE TABLE "mutation_audit_logs" (
    "id" TEXT NOT NULL,
    "school_id" TEXT,
    "actor_user_id" TEXT,
    "action" "MutationAction" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "changes" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mutation_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mutation_audit_logs_school_id_entity_type_entity_id_idx" ON "mutation_audit_logs"("school_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "mutation_audit_logs_actor_user_id_idx" ON "mutation_audit_logs"("actor_user_id");

-- AddForeignKey
ALTER TABLE "mutation_audit_logs" ADD CONSTRAINT "mutation_audit_logs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mutation_audit_logs" ADD CONSTRAINT "mutation_audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
