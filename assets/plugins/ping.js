import pkg from 'file-type';
const { fromBuffer, mimeTypes } = pkg; // These seem unused in this specific file
import { command, isPrivate } from "../../lib/index.js";

command(
  {
    pattern: "ping",
    fromMe: isPrivate,
    desc: "To check if the bot is awake",
    type: "user",
  },
  async (message, match) => {
    const start = new Date().getTime();
    await message.sendMessage(message.jid, "```Is this thing on?```");
    const end = new Date().getTime();
    return await message.sendMessage(
      message.jid,
      "*Boing!*\n ```" + (end - start) + "``` *milliseconds of my life wasted*"
    );
  }
);

export default {};