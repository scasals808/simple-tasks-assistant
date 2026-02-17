import type { WorkspaceMemberRepo } from "../ports/workspace-member.repo.port.js";

export async function requireActiveMembership(
  workspaceMemberRepo: WorkspaceMemberRepo,
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const membership = await workspaceMemberRepo.findActiveMember(workspaceId, userId);
  return membership !== null;
}
