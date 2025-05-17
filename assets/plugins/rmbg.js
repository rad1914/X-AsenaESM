import { command, isPrivate } from "../../lib/index.js";
import { removeBg } from "../../lib/functions.js";
import config from "../../config.js";

command(
  {
    pattern: "rmbg",
    fromMe: isPrivate,
    desc: "Remove background of an image",
    type: "image",
  },
  async (message, match, m) => {
    if (!config.REMOVEBG) {
      return await message.sendMessage(
        message.jid,
        { text: "Set RemoveBg API Key in config.js \n Get it from https://www.remove.bg/api" }
      );
    }
    if (!message.reply_message || !message.reply_message.image) {
      return await message.reply("Reply to an image");
    }
      
    let buff = await m.quoted.download();
    try {
      let buffer = await removeBg(buff);
      if (!buffer) return await message.reply("An error occured or API returned no data.");
      await message.sendMessage(
        message.jid,
        buffer,
        {
          // quoted: message.reply_message.key, // Quoting might not be supported for document type directly
          mimetype: "image/png",
          fileName: "removebg.png",
          caption: "Background removed!"
        },
        "document" // Sending as document, can also be "image" if preferred
      );
    } catch (error) {
        console.error("RMBG Error:", error);
        await message.reply("Failed to remove background. " + error.message);
    }
  }
);

export default {};