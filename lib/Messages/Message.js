import Base from "./Base.js";
import ReplyMessage from "./ReplyMessage.js";

class Message extends Base {
  constructor(client, data) {
    super(client, data);
  }

  _patch(data) {
    super._patch(data);
    this.prefix = data.prefix;
    this.message = { key: data.key, message: data.message };
    this.text = data.body;
    const contextInfo = data.message?.extendedTextMessage?.contextInfo; // Safely access contextInfo
    this.mention = contextInfo?.mentionedJid || false;
    if (data.quoted && contextInfo) { // Ensure contextInfo is present for ReplyMessage
      this.reply_message = new ReplyMessage(this.client, contextInfo, data);
    } else {
      this.reply_message = false;
    }
    return this;
  }

  async edit(text, opt = {}) {
    await this.client.sendMessage(this.jid, { text, edit: this.key, ...opt });
  }

}

export default Message;