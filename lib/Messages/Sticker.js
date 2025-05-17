import Base from "./Base.js";
import fs from "fs"; // For fs.promises.writeFile
// No file-type needed here if not determining type, but download typically gives buffer.

class Sticker extends Base {
  constructor(client, data) {
    super(client, data);
    // If this.m is needed for downloadMediaMessage, it should be set here or in Base
    // Object.defineProperty(this, "m", { value: data });
  }

  _patch(data) {
    super._patch(data);
    this.message = data.message.stickerMessage;
    this.sticker = true;
    return this;
  }

  async downloadMediaMessage() {
    // Assuming this.m is the Baileys message object and has a .download() method
    // This is non-standard Baileys; usually, you'd use a helper like:
    // const buff = await this.client.downloadMediaMessage(this.message);
    // Or if `this` itself is the message: await this.client.downloadMediaMessage(this);
    // Or if `this.m` is set to the original `data` object from constructor/patch:
    if (this.m && typeof this.m.download === 'function') {
        let buff = await this.m.download(); // Assumes `this.m` is the message object with a download method
        let name = new Date().getTime().toString() + ".webp"; // Stickers are usually webp
        await fs.promises.writeFile(name, buff); // Writes to current working directory
        return name;
    } else if (this.client && typeof this.client.downloadMediaMessage === 'function' && this.message) {
        // More standard Baileys approach if `this.message` is the proto part
        const buff = await this.client.downloadAndSaveMediaMessage(this.message, new Date().getTime().toString()); // downloadAndSaveMediaMessage saves and returns path
        return buff; // or adjust to return path as string
    } else {
        console.warn("downloadMediaMessage: Cannot download. 'this.m.download' or compatible client method not found.");
        return null;
    }
  }

}

export default Sticker;