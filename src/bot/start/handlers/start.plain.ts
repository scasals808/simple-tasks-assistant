export async function handleStartPlain(
  ctx: {
    reply(text: string, extra?: unknown): Promise<unknown>;
  },
  mainMenuKeyboard: unknown
): Promise<void> {
  await ctx.reply(
    "Привет! Я помогу быстро создавать задачи из сообщений.",
    mainMenuKeyboard
  );
}
