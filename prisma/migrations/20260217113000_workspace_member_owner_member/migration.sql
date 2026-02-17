-- Normalize workspace member roles to OWNER/MEMBER.
CREATE TYPE "WorkspaceMemberRole" AS ENUM ('OWNER', 'MEMBER');

UPDATE "WorkspaceMember"
SET "role" = CASE
  WHEN "role" IN ('ASSIGNER', 'OWNER') THEN 'OWNER'
  ELSE 'MEMBER'
END;

ALTER TABLE "WorkspaceMember"
ALTER COLUMN "role" TYPE "WorkspaceMemberRole"
USING "role"::"WorkspaceMemberRole";
