-- Rename workspace role holder field without data loss.
ALTER TABLE "Workspace"
RENAME COLUMN "assignerUserId" TO "ownerUserId";
