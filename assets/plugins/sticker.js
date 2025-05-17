import config from "../../config.js";
import { command, isPrivate, toAudio } from "../../lib/index.js";
import { webp2mp4, textToImg } from "../../lib/functions.js";

command(
  {
    pattern: "sticker",
    fromMe: isPrivate,
    desc: "Converts Photo/video/text to sticker",
    type: "converter",
  },
  async (message, match, m) => {
    if (!message.reply_message) {
      return await message.reply("_Reply to photo/video/text_");
    }
    
    var buff;
    if (message.reply_message.text) {
      buff = await textToImg(message.reply_message.text);
    } else if (message.reply_message.image || message.reply_message.video || message.reply_message.sticker) {
      buff = await m.quoted.download();
    } else {
      return await message.reply("_Reply to a valid photo, video, sticker, or text message to convert to a sticker._");
    }

    message.sendMessage(
      message.jid,
      buff,
      { packname: config.PACKNAME, author: config.AUTHOR },
      "sticker"
    );
  }
);

command(
  {
    pattern: "take",
    fromMe: isPrivate,
    desc: "Converts Photo or video to sticker",
    type: "converter",
  },
  async (message, match, m) => {
    if (!message.reply_message || !message.reply_message.sticker) {
      return await message.reply("_Reply to a sticker_");
    }
    const packname = match.split(";")[0] || config.PACKNAME;
    const author = match.split(";")[1] || config.AUTHOR;
    let buff = await m.quoted.download();
    message.sendMessage(message.jid, buff, { packname, author }, "sticker");
  }
);

command(
  {
    pattern: "photo",
    fromMe: isPrivate,
    desc: "Changes sticker to Photo",
    type: "converter",
  },
  async (message, match, m) => {
    if (!message.reply_message || !message.reply_message.sticker) {
      return await message.reply("_Not a sticker_");
    }
    let buff = await m.quoted.download();
    return await message.sendMessage(message.jid, buff, {}, "image");
  }
);

command(
  {
    pattern: "mp3",
    fromMe: isPrivate,
    desc: "converts video/voice to mp3",
    type: "downloader",
  },
  async (message, match, m) => {
    if (!message.reply_message || (!message.reply_message.video && !message.reply_message.audio)) {
        return await message.reply("_Reply to a video or audio message_");
    }
    let buff = await m.quoted.download();
    console.log(typeof buff);
    buff = await toAudio(buff, "mp3");
    console.log(typeof buff);
    return await message.sendMessage(
      message.jid,
      buff,
      { mimetype: "audio/mpeg" },
      "audio"
    );
  }
);

command(
  {
    pattern: "mp4",
    fromMe: isPrivate,
    desc: "converts video/voice to mp4",
    type: "downloader",
  },
  async (message, match, m) => {
    if (!message.reply_message) {
      return await message.reply("_Reply to a sticker/audio/video_");
    }
    if (
      !message.reply_message.video &&
      !message.reply_message.sticker &&
      !message.reply_message.audio
    ) {
      return await message.reply("_Reply to a sticker/audio/video_");
    }
    
    let buff = await m.quoted.download();
    if (message.reply_message.sticker) {
      buff = await webp2mp4(buff);
    } else if (message.reply_message.video || message.reply_message.audio) {
      // Assuming toAudio can handle video to mp4 (identity or format conversion)
      // or audio to mp4 (as a video with black screen or similar)
      // If toAudio is strictly for audio manipulation, this might need adjustment
      // For now, let's assume toAudio(buff, "mp4") can make an mp4 from video/audio buff.
      buff = await toAudio(buff, "mp4"); 
    } else {
        return await message.reply("_Unsupported reply type for mp4 conversion._");
    }
    return await message.sendMessage(
      message.jid,
      buff,
      { mimetype: "video/mp4" },
      "video"
    );
  }
);

command(
  {
    pattern: "img",
    fromMe: isPrivate,
    desc: "Converts Sticker to image",
    type: "converter",
  },
  async (message, match, m) => {
    if (!message.reply_message || !message.reply_message.sticker) {
      return await message.reply("_Reply to a sticker_");
    }
    let buff = await m.quoted.download();
    return await message.sendMessage(message.jid, buff, {}, "image");
  }
);

export default {};