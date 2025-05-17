import { command, isPrivate } from "../../lib/index.js";
import { parsedJid } from "../../lib/functions.js";
import { banUser, unbanUser, isBanned } from "../database/ban.js";

command(
  {
    on: "message",
    fromMe: true, // This handler is fromMe: true, meaning it only acts on messages sent by the bot itself.
                  // If the intention is to make the bot leave if it's banned and *receives* a message, fromMe should be false or not set.
                  // I'm keeping it as per original, but this might be a logical flaw depending on intent.
    dontAddCommandList: true,
  },
  async (message, match) => {
    if (!message.isBaileys) return; // This check is usually for messages *from* Baileys, not generally any message.
                                  // If this is meant to check if the bot *is* Baileys, it's always true.
                                  // If it's to check if the message *event* is a Baileys object, that's also usually true.
                                  // This condition might need review based on its actual purpose.
    const isban = await isBanned(message.jid);
    if (!isban) return;

    // The bot is trying to remove a user (potentially the sender of the message that triggered this)
    // from the group if the bot is banned in that chat.
    // This logic seems to be: if bot is banned and it sends a message (fromMe: true), then try to remove someone.
    // This is a bit unusual. Usually, a ban means the bot stops processing commands or leaves.
    // If the bot itself sent a message in a banned chat, and then tries to remove someone,
    // it implies the bot is still active despite the ban.

    await message.reply("_Bot is banned in this chat_"); // Bot replies that it's banned.
    
    // If message.participant is present (group messages), it refers to the original sender.
    // If fromMe is true, message.participant might be the bot's JID or undefined in PM.
    // This seems like it's intended to kick the user who sent a message if the bot is banned.
    // However, the `on: "message", fromMe: true` means this only triggers for the bot's *own* messages.
    // This specific command handler's logic seems self-contradictory or needs clarification on its goal.
    // For now, converting as-is.
    const jid = parsedJid(message.participant); // message.participant is the sender in a group. If fromMe is true, this is the bot itself.
    if (jid && message.isGroup) { // Only attempt removal if jid is valid and it's a group
        try {
            await message.client.groupParticipantsUpdate(
              message.jid,
              [jid], // groupParticipantsUpdate expects an array of JIDs
              "remove"
            );
        } catch (e) {
            console.error("Failed to remove participant in banned chat:", e);
            // Potentially bot lacks admin rights or user is group creator.
        }
    }
  }
);

command(
  {
    pattern: "banbot",
    fromMe: true,
    desc: "ban bot from a chat",
    type: "owner", // Changed type to 'owner' or similar, as this is a sensitive command
  },
  async (message, match) => {
    const chatid = message.jid;
    const isban = await isBanned(chatid);
    if (isban) {
      return await message.sendMessage(message.jid, "Bot is already banned in this chat");
    }
    await banUser(chatid);
    return await message.sendMessage(message.jid, "Bot has been banned from this chat. It will ignore commands and may auto-leave on next message.");
  }
);

command(
  {
    pattern: "unbanbot",
    fromMe: true,
    desc: "Unban bot from a chat",
    type: "owner", // Changed type to 'owner' or similar
  },
  async (message, match) => {
    const chatid = message.jid;
    const isban = await isBanned(chatid);
    if (!isban) {
      return await message.sendMessage(message.jid, "Bot is not currently banned in this chat");
    }
    await unbanUser(chatid);
    return await message.sendMessage(message.jid, "Bot has been unbanned from this chat.");
  }
);

export default {};