-- Echo is single-owner (ADMIN_PASSWORD sign-in): drop the multi-user account fields and tables.

-- DropForeignKey
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_user_id_fkey";

-- DropIndex
DROP INDEX "users_email_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "active",
DROP COLUMN "email",
DROP COLUMN "password",
DROP COLUMN "session_version";

-- DropTable
DROP TABLE "accounts";

-- DropTable
DROP TABLE "password_reset_tokens";


-- An instance that had exactly one account keeps its data: that row becomes the owner
-- (every user_id foreign key is ON UPDATE CASCADE). With several accounts, nothing is
-- renamed and the owner starts empty.
UPDATE "users" SET "id" = 'owner'
WHERE (SELECT count(*) FROM "users") = 1 AND NOT EXISTS (SELECT 1 FROM "users" WHERE "id" = 'owner');
