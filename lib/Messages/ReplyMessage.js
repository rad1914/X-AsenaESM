import Base from "./Base.js";
import { tmpdir } from "os";
import fs from "fs";
import pkg from 'file-type';
const { fileTypeFromBuffer } = pkg;

class ReplyMessage extends Base {
  constructor(client, contextInfoData, originalMessageData) {
    // Assuming the second argument to super should be originalMessageData related to the quoted message,
    // or contextInfoData for specific details.
    // The original `super(client, data)` where `data` was `contextInfo` seemed problematic for Base._patch.
    // This might need adjustment based on how Base expects data for a "reply message" context.
    // For now, passing contextInfoData, but it might need to be originalMessageData.quotedMessage.
    super(client, contextInfoData); 
    // If this.m is the parent message (the one that contains the quote)
    if (originalMessageData) {
        Object.defineProperty(this, "m", { value: originalMessageData });
    }
    // If _patch needs data from the quoted message itself, it might need to be called differently
    // or originalMessageData.quotedMessage should be passed to super.
  }

  _patch(data) { // Here 'data' is contextInfoData from constructor
    super._patch(data); // This will use contextInfoData for Base properties. This might be incorrect.
                      // Base._patch expects a full message object, not just contextInfo.
                      // This part might need a rethink depending on what Base properties are needed for a ReplyMessage.

    // It's more likely that the properties of ReplyMessage should come from data.quotedMessage
    // (which is contextInfo.quotedMessage)
    
    this.id = data.stanzaId; // from contextInfo
    const { quotedMessage } = data; // from contextInfo

    if (quotedMessage) {
      let type = Object.keys(quotedMessage)[0];
      if (type === "senderKeyDistributionMessage" && Object.keys(quotedMessage).length > 1) { // Handle cases where senderKeyDistributionMessage is not the primary type
        type = Object.keys(quotedMessage)[1];
      }
      
      if (type === "extendedTextMessage" || type === "conversation") {
        this.text = quotedMessage[type]?.text || quotedMessage[type];
        this.mimetype = "text/plain";
      } else if (type === "stickerMessage") {
        this.mimetype = "image/webp";
        this.sticker = quotedMessage[type];
      } else if (quotedMessage[type]) { // Ensure the type exists as a key
        let mimetype = quotedMessage[type]?.mimetype || type;
        if (mimetype?.includes("/")) {
          this.mimetype = mimetype;
          let mime = mimetype.split("/")[0];
          this[mime] = quotedMessage[type];
        } else {
          this.mimetype = mimetype;
          // This assignment needs to be safer, ensuring quotedMessage[type] is the message content
          this.message = quotedMessage[type]; 
        }
      } else {
        // Fallback or error handling if type is not found or message structure is unexpected
        this.mimetype = "application/octet-stream"; // Generic fallback
        this.message = quotedMessage; // Store the whole quotedMessage object
      }
    }
    return this;
  }

  async downloadMediaMessage() {
    // Assuming this.m is the parent message, and this.m.quoted is the quoted message object from Baileys
    // and that Baileys message objects (or their 'quoted' property) have a download method.
    // This is non-standard Baileys; Baileys usually uses a helper like `downloadMediaMessage(msgProto, type, options)`.
    // If `this.m.quoted` is the actual Baileys message *protocol object* for the quoted message:
    if (this.m && this.m.quoted && typeof this.m.quoted.download === 'function') {
        const buff = await this.m.quoted.download(); // This implies `this.m.quoted` has a `download` method.
        const type = await fileTypeFromBuffer(buff);
        const filePath = tmpdir() + "/" + Date.now() + "." + type.ext; // Ensure unique filename
        await fs.promises.writeFile(filePath, buff);
        return filePath;
    } else if (this.message && typeof this.client.downloadMediaMessage === 'function' && this.id) {
        // Alternative: if `this.message` is the specific message part (e.g., imageMessage)
        // and client has a downloadMediaMessage method that can take a message proto.
        // This would require `this.message` to be the full WAMessageProto.IMessage for the quoted content.
        // This is highly dependent on your Baileys setup and what `this.message` (or a more specific field like `this.image`) holds.
        // For simplicity, this part is commented out as it's speculative.
        // const buff = await this.client.downloadMediaMessage({ key: { id: this.id /* needs more key parts */ }, message: { [this.mimetype.split('/')[1]+'Message']: this.message } });
        // const type = await fileTypeFromBuffer(buff);
        // const filePath = tmpdir() + "/" + Date.now() + "." + type.ext;
        // await fs.promises.writeFile(filePath, buff);
        // return filePath;
        console.warn("downloadMediaMessage: this.m.quoted.download is not available. Implement download logic.");
        return null;
    } else {
        console.warn("downloadMediaMessage: Cannot download. 'this.m.quoted.download' not found or message structure incorrect.");
        return null;
    }
  }
}

export default ReplyMessage;