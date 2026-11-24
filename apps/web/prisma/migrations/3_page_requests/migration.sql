-- A draft can start as a request from the extension: the page's text and fields,
-- waiting for the user's assistant to draft a value for each field.
ALTER TABLE "drafts" ALTER COLUMN "text" SET DEFAULT '';
ALTER TABLE "drafts" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ready';
ALTER TABLE "drafts" ADD COLUMN "fields" JSONB NOT NULL DEFAULT '[]';
