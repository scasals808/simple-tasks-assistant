import type {
  WorkspaceResetCounts,
  WorkspaceResetRepo
} from "../../domain/ports/workspace-reset.repo.port.js";
import { prisma } from "./prisma.js";

export class WorkspaceResetRepoPrisma implements WorkspaceResetRepo {
  async resetAllWorkspaceData(): Promise<WorkspaceResetCounts> {
    return prisma.$transaction(async (tx) => {
      const workspaceMembers = await tx.workspaceMember.deleteMany();
      const workspaceInvites = await tx.workspaceInvite.deleteMany();
      const workspaces = await tx.workspace.deleteMany();
      return {
        workspaceMembers: workspaceMembers.count,
        workspaceInvites: workspaceInvites.count,
        workspaces: workspaces.count
      };
    });
  }
}
