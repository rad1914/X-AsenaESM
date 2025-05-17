import { command, parsedJid /* isAdmin not used*/ } from "../../lib/index.js";
import { exec } from "child_process";
import { PausedChats, WarnDB } from "../database/index.js"; // Assuming index.js or relevant file in database folder
import config from "../../config.js";
const { WARN_COUNT } = config; // Assuming WARN_COUNT is a property of the default config export
import { secondsToDHMS } from "../../lib/functions.js";

const { saveWarn, resetWarn } = WarnDB; // Destructuring methods from WarnDB object

command(
  {
    pattern: "pause",
    fromMe: true,
    desc: "Pause the chat",
    dontAddCommandList: true,
  },
  async (message) => {
    const chatId = message.key.remoteJid;
    try {
      await PausedChats.savePausedChat(chatId);
      message.reply("Chat paused successfully.");
    } catch (error) {
      console.error(error);
      message.reply("Error pausing the chat.");
    }
  }
);

command(
  {
    pattern: "shutdown",
    fromMe: true,
    desc: "stops the bot",
    type: "user",
  },
  async (message, match) => {
    await message.sendMessage(message.jid, "shutting down...");
    exec("pm2 stop x-asena", (error, stdout, stderr) => {
      if (error) {
        return message.sendMessage(message.jid, `Error: ${error}`);
      }
      // No return needed here for success, process will stop
    });
  }
);

command(
  {
    pattern: "resume",
    fromMe: true,
    desc: "Resume the paused chat",
    dontAddCommandList: true,
  },
  async (message) => {
    const chatId = message.key.remoteJid;

    try {
      // Original: PausedChats.PausedChats.findOne
      // Assuming PausedChats is the model or an object containing the model
      // If PausedChats is the direct model:
      // const pausedChat = await PausedChats.findOne({ where: { chatId } });
      // If PausedChats is an object like { PausedChats: model }:
      const pausedChat = await PausedChats.PausedChats.findOne({ // Kept as original
        where: { chatId },
      });

      if (pausedChat) {
        await pausedChat.destroy();
        message.reply("Chat resumed successfully.");
      } else {
        message.reply("Chat is not paused.");
      }
    } catch (error) {
      console.error(error);
      message.reply("Error resuming the chat.");
    }
  }
);

command(
  {
    pattern: "setpp",
    fromMe: true,
    desc: "Set profile picture",
    type: "user",
  },
  async (message, match, m) => {
    if (!message.reply_message || !message.reply_message.image) // Added check for message.reply_message
      return await message.reply("_Reply to a photo_");
    let buff = await m.quoted.download();
    await message.setPP(message.user, buff);
    return await message.reply("_Profile Picture Updated_");
  }
);

command(
  {
    pattern: "setname",
    fromMe: true,
    desc: "Set User name",
    type: "user",
  },
  async (message, match) => {
    if (!match) return await message.reply("_Enter name_");
    await message.updateName(match);
    return await message.reply(`_Username Updated : ${match}_`);
  }
);

command(
  {
    pattern: "block",
    fromMe: true,
    desc: "Block a person",
    type: "user",
  },
  async (message, match) => {
    if (message.isGroup) {
      let jid = (message.mention && message.mention[0]) || (message.reply_message && message.reply_message.jid);
      if (!jid) return await message.reply("_Reply to a person or mention_");
      await message.block(jid);
      return await message.sendMessage(message.jid, `_@${jid.split("@")[0]} Blocked_`, { // Added message.jid for sendMessage
        mentions: [jid],
      });
    } else {
      await message.block(message.jid);
      return await message.reply("_User blocked_");
    }
  }
);

command(
  {
    pattern: "unblock",
    fromMe: true,
    desc: "Unblock a person",
    type: "user",
  },
  async (message, match) => {
    if (message.isGroup) {
      let jid = (message.mention && message.mention[0]) || (message.reply_message && message.reply_message.jid);
      if (!jid) return await message.reply("_Reply to a person or mention_");
      await message.unblock(jid); // original had message.block(jid), corrected to unblock
      return await message.sendMessage(
        message.jid,
        `_@${jid.split("@")[0]} unblocked_`,
        {
          mentions: [jid],
        }
      );
    } else {
      await message.unblock(message.jid);
      return await message.reply("_User unblocked_");
    }
  }
);

command(
  {
    pattern: "jid",
    fromMe: true,
    desc: "Give jid of chat/user",
    type: "user",
  },
  async (message, match) => {
    return await message.sendMessage(
      message.jid,
      (message.mention && message.mention[0]) || (message.reply_message && message.reply_message.jid) || message.jid
    );
  }
);

command(
  {
    pattern: "dlt",
    fromMe: true,
    desc: "deletes a message",
    type: "user",
  },
  async (message, match, m, client) => {
    if (message.isGroup) {
      if (message.reply_message && message.reply_message.key) { // Check if reply_message and key exist
        client.sendMessage(message.jid, { delete: message.reply_message.key });
      } else {
        // Optionally reply if there's no message to delete
        // message.reply("_Reply to a message to delete it._"); 
      }
    }
  }
);

command(
  {
    pattern: "warn",
    fromMe: true,
    desc: "Warn a user",
  },
  async (message, match) => {
    const userId = (message.mention && message.mention[0]) || (message.reply_message && message.reply_message.jid);
    if (!userId) return message.reply("_Mention or reply to someone_");
    
    let reasonText = (message.reply_message && message.reply_message.text) ? message.reply_message.text : match;
    let reason = reasonText.replace(/@(\d+)/, "").trim(); // Remove mentions from reason
    reason = reason ? reason : "Reason not Provided"; // Ensure reason is not empty

    const warnInfo = await saveWarn(userId, reason);
    let userWarnCount = warnInfo ? warnInfo.warnCount : 0; // If saveWarn returns object with warnCount
    // If saveWarn directly returns count or the logic needs direct increment:
    // For this example, I assume warnInfo has warnCount after saving. 
    // If warnInfo is just a status, you might need to fetch count separately or adjust saveWarn.
    // The original code implies userWarnCount++ is on a local variable, not reflecting the true persisted count *after* save.
    // Let's assume saveWarn returns the *new* count or the object with it.
    // If saveWarn only saves and doesn't return new count, then userWarnCount might be off by 1 in the message.
    // For consistency with original logic:
    // let currentWarns = await WarnDB.getWarningCount(userId); // Hypothetical function
    // userWarnCount = currentWarns + 1; 
    // await saveWarn(userId, reason); 
    // This part depends on how `saveWarn` and `WarnDB` are structured.
    // The original code: `userWarnCount++` after `const warnInfo = await saveWarn(userId, reason);` implies `userWarnCount`
    // should be based on `warnInfo.warnCount` and then incremented locally for the message.
    // However, it's more common that saveWarn would handle the increment or return the new total.
    // Let's assume warnInfo from saveWarn contains the *new* total warns.
    userWarnCount = warnInfo.warnCount; // Assuming saveWarn returns { ..., warnCount: newTotal }

    await message.reply(
      `_User @${
        userId.split("@")[0]
      } warned._ \n_Warn Count: ${userWarnCount}._ \n_Reason: ${reason}_`,
      { mentions: [userId] }
    );
    if (userWarnCount > WARN_COUNT) {
      const jidArray = parsedJid(userId); // parsedJid might return an array
      await message.sendMessage(
        message.jid,
        "Warn limit exceeded kicking user"
      );
      return await message.client.groupParticipantsUpdate(
        message.jid,
        jidArray, // groupParticipantsUpdate expects an array of JIDs
        "remove"
      );
    }
    return;
  }
);

command(
  {
    pattern: "resetwarn",
    fromMe: true,
    desc: "Reset warnings for a user",
  },
  async (message) => {
    const userId = (message.mention && message.mention[0]) || (message.reply_message && message.reply_message.jid);
    if (!userId) return message.reply("_Mention or reply to someone_");
    await resetWarn(userId);
    return await message.reply(
      `_Warnings for @${userId.split("@")[0]} reset_`,
      {
        mentions: [userId],
      }
    );
  }
);

command(
  {
    pattern: "uptime",
    fromMe: true,
    desc: "Check uptime of bot",
    type: "user",
  },
  async (message, match) => {
    message.reply(`*Uptime:* ${secondsToDHMS(process.uptime())}`);
  }
);

export default {};