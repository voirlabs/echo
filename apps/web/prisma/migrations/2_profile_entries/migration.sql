-- One generic list of profile entries replaces experience, projects and skills.
-- Existing rows are carried over: an experience becomes "Role, Company", a
-- project keeps its title, and the skills become one entry titled "Skills".

CREATE TABLE "profile_entries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "profile_entries_user_id_idx" ON "profile_entries"("user_id");

ALTER TABLE "profile_entries" ADD CONSTRAINT "profile_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "profile_entries" ("id", "user_id", "title", "details", "created_at")
SELECT 'exp-' || "id", "user_id",
       CASE WHEN "role" <> '' THEN "role" || ', ' || "company" ELSE "company" END,
       "description", "created_at"
FROM "user_experiences";

INSERT INTO "profile_entries" ("id", "user_id", "title", "details", "created_at")
SELECT 'prj-' || "id", "user_id", "title", "description", "created_at"
FROM "user_projects";

INSERT INTO "profile_entries" ("id", "user_id", "title", "details", "created_at")
SELECT 'skills-' || "id", "id", 'Skills', array_to_string("skills", ', '), "created_at"
FROM "users"
WHERE cardinality("skills") > 0;

DROP TABLE "user_experiences";
DROP TABLE "user_projects";
ALTER TABLE "users" DROP COLUMN "skills";
