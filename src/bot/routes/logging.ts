function getTelegramError(error: unknown): { code?: number; description?: string } {
  const err = error as { response?: { error_code?: number; description?: string } };
  return {
    code: err.response?.error_code,
    description: err.response?.description
  };
}

function tokenShort(token: string): string {
  return token.slice(0, 8);
}

export function logStep(
  ctx: {
    update?: { update_id?: number };
    from?: { id?: number };
  },
  handler: string,
  token: string,
  step: string,
  chatId: number,
  messageId: number,
  error?: unknown
): void {
  const info = error ? getTelegramError(error) : undefined;
  const payload = {
    token: tokenShort(token),
    chat_id: chatId,
    message_id: messageId,
    user_id: ctx.from?.id,
    update_id: ctx.update?.update_id,
    handler,
    step,
    telegram_error_code: info?.code ?? null,
    telegram_description: info?.description ?? (error ? String(error) : null)
  };
  if (error) {
    console.warn("[bot.handler_step_failed]", payload);
    return;
  }
  console.log("[bot.handler_step_ok]", payload);
}

export function logAdminAction(input: {
  handler: string;
  adminUserId?: number;
  workspaceId?: string | null;
  isOwner?: boolean | null;
  targetUserId?: string | null;
  result: "OK" | "ERROR";
  errorCode?: string | null;
}): void {
  const payload = {
    handler: input.handler,
    admin_user_id: input.adminUserId ?? null,
    workspaceId: input.workspaceId ?? null,
    is_owner: input.isOwner ?? null,
    target_userId: input.targetUserId ?? null,
    result: input.result,
    error_code: input.errorCode ?? null
  };
  if (input.result === "ERROR") {
    console.warn("[bot.admin_action]", payload);
    return;
  }
  console.log("[bot.admin_action]", payload);
}

export function logAdminReset(input: {
  adminUserId?: number;
  chatId?: number;
  enabled: boolean;
  confirmed: boolean;
  deletedCounts?: {
    workspaceMembers: number;
    workspaceInvites: number;
    workspaces: number;
  } | null;
  errorCode?: string | null;
  errorDescription?: string | null;
}): void {
  const payload = {
    handler: "admin_reset",
    admin_user_id: input.adminUserId ?? null,
    chat_id: input.chatId ?? null,
    enabled: input.enabled,
    confirmed: input.confirmed,
    deleted_counts: input.deletedCounts ?? null,
    error_code: input.errorCode ?? null,
    description: input.errorDescription ?? null
  };
  if (input.errorCode) {
    console.warn("[bot.admin_reset]", payload);
    return;
  }
  console.log("[bot.admin_reset]", payload);
}

export function logAdminCreateTeam(input: {
  adminUserId?: number;
  chatId?: string | null;
  title?: string | null;
  result: "created" | "existing" | "error";
  workspaceId?: string | null;
  errorCode?: string | null;
}): void {
  const payload = {
    handler: "admin_create_team",
    admin_user_id: input.adminUserId ?? null,
    chatId: input.chatId ?? null,
    title: input.title ?? null,
    result: input.result,
    workspaceId: input.workspaceId ?? null,
    error_code: input.errorCode ?? null
  };
  if (input.result === "error") {
    console.warn("[bot.admin_create_team]", payload);
    return;
  }
  console.log("[bot.admin_create_team]", payload);
}

export function logAdminCreateTeamReject(input: {
  adminUserId?: number;
  chatIdInput?: string | null;
  rejectReason: "chatId_must_be_negative";
}): void {
  console.warn("[bot.admin_create_team]", {
    handler: "admin_create_team",
    admin_user_id: input.adminUserId ?? null,
    chatId_input: input.chatIdInput ?? null,
    reject_reason: input.rejectReason
  });
}

export function logMenuRender(input: {
  userId?: number;
  isAdminUser: boolean;
  buttonsRenderedCount: number;
}): void {
  console.log("[bot.menu_render]", {
    handler: "menu_render",
    user_id: input.userId ?? null,
    is_admin: input.isAdminUser,
    buttons_rendered_count: input.buttonsRenderedCount
  });
}

export function logTaskList(input: {
  handler: "list_assigned_tasks" | "list_created_tasks" | "list_on_review_tasks";
  userId: string;
  workspaceId: string | null;
  count: number;
  queryMs: number;
  errorCode?: string | null;
}): void {
  const payload = {
    handler: input.handler,
    user_id: input.userId,
    workspaceId: input.workspaceId,
    count: input.count,
    query_ms: input.queryMs,
    error_code: input.errorCode ?? null
  };
  if (input.errorCode) {
    console.warn("[bot.task_list]", payload);
    return;
  }
  console.log("[bot.task_list]", payload);
}

export function logDmCreateTask(input: {
  userId: string;
  workspaceId: string | null;
  draftToken: string | null;
  step: string;
  errorCode?: string | null;
}): void {
  const payload = {
    handler: "dm_create_task",
    user_id: input.userId,
    workspaceId: input.workspaceId,
    draft_token: input.draftToken,
    step: input.step,
    error_code: input.errorCode ?? null
  };
  if (input.errorCode) {
    console.warn("[bot.dm_create_task]", payload);
    return;
  }
  console.log("[bot.dm_create_task]", payload);
}

export function logGroupTask(input: {
  event: "received" | "draft_created" | "draft_found" | "error";
  chatId: string | null;
  messageId: string | null;
  userId: string | null;
  draftId?: string | null;
  token?: string | null;
  errorCode?: string | null;
}): void {
  const payload = {
    handler: "group_task",
    event: input.event,
    chat_id: input.chatId,
    message_id: input.messageId,
    user_id: input.userId,
    draft_id: input.draftId ?? null,
    token: input.token ? tokenShort(input.token) : null,
    error_code: input.errorCode ?? null
  };
  if (input.event === "error") {
    console.warn("[bot.group_task]", payload);
    return;
  }
  console.log("[bot.group_task]", payload);
}
