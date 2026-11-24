-- AlterTable
ALTER TABLE "users" ADD COLUMN     "session_epoch" TEXT NOT NULL DEFAULT (gen_random_uuid())::text;
