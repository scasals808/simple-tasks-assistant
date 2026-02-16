import { Telegraf } from "telegraf";

export function createBot(token: string): Telegraf {
  const bot = new Telegraf(token);

  bot.start(async (ctx) => {
    if (ctx.chat.type !== "private") {
      return;
    }

    await ctx.reply("OK");
  });

  return bot;
}
