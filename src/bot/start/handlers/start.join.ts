import {
  WORKSPACE_INVITE_ERROR_ALREADY_IN_TEAM,
  WorkspaceInviteError,
  type WorkspaceInviteService
} from "../../../domain/workspaces/workspace-invite.service.js";
import { ru } from "../../texts/ru.js";

function tokenShort(token: string): string {
  return token.slice(0, 8);
}

function getTelegramError(error: unknown): { code?: number; description?: string } {
  const err = error as { response?: { error_code?: number; description?: string } };
  return {
    code: err.response?.error_code,
    description: err.response?.description
  };
}

function logStartPayloadError(
  ctx: {
    update?: { update_id?: number };
    from?: { id?: number };
  },
  token: string,
  error: unknown
): void {
  const info = getTelegramError(error);
  console.warn("[bot.start_payload_failed]", {
    update_id: ctx.update?.update_id,
    handler: "start_join",
    user_id: ctx.from?.id,
    token: tokenShort(token),
    error_code: info.code ?? null,
    description: info.description ?? String(error)
  });
}

export async function handleStartJoin(
  ctx: {
    from: { id: number; first_name?: string; last_name?: string; username?: string };
    update?: { update_id?: number };
    reply(text: string): Promise<unknown>;
  },
  workspaceInviteService: WorkspaceInviteService,
  token: string
): Promise<void> {
  try {
    const accepted = await workspaceInviteService.acceptInvite(token, String(ctx.from.id), {
      tgFirstName: ctx.from.first_name ?? null,
      tgLastName: ctx.from.last_name ?? null,
      tgUsername: ctx.from.username ?? null
    });
    await ctx.reply(ru.startJoin.joinedTeam(accepted.workspace.title ?? accepted.workspace.id));
  } catch (error: unknown) {
    logStartPayloadError(ctx, token, error);
    if (error instanceof WorkspaceInviteError && error.message === WORKSPACE_INVITE_ERROR_ALREADY_IN_TEAM) {
      await ctx.reply(ru.startJoin.alreadyInTeam);
      return;
    }
    await ctx.reply(ru.startJoin.invalidInvite);
  }
}
