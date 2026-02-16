import type { Clock } from "../ports/clock.port.js";
import type { WorkspaceMember, WorkspaceMemberRepo } from "../ports/workspace-member.repo.port.js";

export class WorkspaceMemberService {
  constructor(
    private readonly clock: Clock,
    private readonly workspaceMemberRepo: WorkspaceMemberRepo
  ) {}

  async upsertExecutorMembership(
    workspaceId: string,
    userId: string
  ): Promise<WorkspaceMember> {
    return this.workspaceMemberRepo.upsertMember(
      workspaceId,
      userId,
      "EXECUTOR",
      this.clock.now()
    );
  }
}
