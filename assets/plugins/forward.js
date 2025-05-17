import { command, parsedJid, isPrivate } from "../../lib/index.js";

command(
  {
    pattern: "fd",
    fromMe: isPrivate,
    desc: "Forwards the replied Message",
    type: "Util", // Corrected from "Util" to "util" for consistency if types are lowercased elsewhere
  },
  async (message, match, m) => {
    if(!m.quoted) return message.reply('Reply to something');
    let jids = parsedJid(match);
    if (!jids || jids.length === 0) {
        return message.reply('Please provide valid JID(s) to forward to. Example: .fd jid1 jid2@s.whatsapp.net');
    }
    for (let i of jids) {
      await message.forward(i, message.reply_message.message);
    }   
  }
);

export default {};