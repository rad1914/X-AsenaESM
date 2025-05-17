import { DELETED_LOG_CHAT, DELETED_LOG } from "../../config.js";
import { command, isPrivate, serialize } from "../../lib/index.js"; // isPrivate is imported but not used
import { loadMessage, getName } from "../database/StoreDb.js";

command(
  {
    on: "delete",
    fromMe: false, // As per original
    desc: "Logs the recent deleted message",
  },
  async (message, match) => { // match is not used in the original function
    if (!DELETED_LOG) return;
    if (!DELETED_LOG_CHAT)
      return await message.sendMessage(
        message.user, // Sending to message.user (the one who triggered 'on delete', likely self)
        "Please set DELETED_LOG_CHAT in ENV to use log delete message"
      );
      
    // The 'message' object in 'on: "delete"' event might be different.
    // It usually contains information about the deleted message key.
    // message.messageId might be message.key.id
    let loadedMsgData = await loadMessage(message.message?.id || message.key?.id); // Adjust based on actual 'message' structure for delete event
    if (!loadedMsgData) return;

    // Re-serializing a loaded message. Ensure serialize can handle this.
    let msgToForward = await serialize(
      JSON.parse(JSON.stringify(loadedMsgData.message)), // Assuming loadedMsgData.message is the actual Baileys message object
      message.client
    );
    if (!msgToForward) return await message.reply("No deleted message found or could not be processed."); // Changed reply to avoid error

    let deletedForwardedMsg = await message.forward(DELETED_LOG_CHAT, msgToForward.message);
    
    let nameInfo;
    // msgToForward.from might be undefined if serialize doesn't add it or if original message structure differs
    const fromJid = msgToForward.from || (msgToForward.key ? msgToForward.key.remoteJid : null);
    const senderJid = msgToForward.sender || (msgToForward.key ? (msgToForward.key.fromMe ? message.client.user.id : msgToForward.participant || msgToForward.key.remoteJid) : null);

    if (!fromJid) {
        nameInfo = "_Could not determine message origin._";
    } else if (!fromJid.endsWith("@g.us")) {
      let userName = await getName(fromJid); // This should be senderJid if it's not a group
      nameInfo = `_Name : ${userName}_`;
    } else {
      let groupMeta = await message.client.groupMetadata(fromJid);
      let groupName = groupMeta ? groupMeta.subject : "Unknown Group";
      let senderName = senderJid ? await getName(senderJid) : "Unknown Sender";
      nameInfo = `_Group : ${groupName}_\n_Name : ${senderName}_`;
    }

    return await message.sendMessage(
      DELETED_LOG_CHAT,
      `_Message Deleted_\n_From : ${fromJid || 'Unknown' }_\n${nameInfo}\n_SenderJid : ${senderJid || 'Unknown'}_`,
      { quoted: deletedForwardedMsg }
    );
  }
);

export default {};