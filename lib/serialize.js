import { downloadContentFromMessage, getContentType } from "baileys";
import fs from "fs/promises";
import nodeFetch from "node-fetch"; // Renamed to avoid conflict with global fetch

import pkg from 'file-type';
const { fromBuffer } = pkg;
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import {
  writeExifImg,
  writeExifVid,
  imageToWebp,
  videoToWebp,
} from "./sticker.js";
import { parsedJid } from "./functions.js";
import config from "../config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function downloadMedia(message, pathFile) {
  const mimeMap = {
    imageMessage: "image",
    videoMessage: "video",
    stickerMessage: "sticker",
    documentMessage: "document",
    audioMessage: "audio",
  };

  try {
    let type = Object.keys(message)[0];
    let mes = message;

    // Simplify message extraction
    const messageTypes = [
        "templateMessage.hydratedFourRowTemplate",
        "interactiveResponseMessage",
        "buttonsMessage"
    ];
    for (const keyPath of messageTypes) {
        const keys = keyPath.split('.');
        let tempMes = message;
        let validPath = true;
        for (const key of keys) {
            if (tempMes && tempMes[key]) {
                tempMes = tempMes[key];
            } else {
                validPath = false;
                break;
            }
        }
        if (validPath && tempMes && Object.keys(tempMes)[0]) {
            mes = tempMes;
            type = Object.keys(mes)[0];
            break; 
        }
    }
    
    if (!mes[type]) {
        console.error("Error in downloadMedia: Could not find media message type for", type, mes);
        throw new Error(`Media not found for type: ${type}`);
    }

    const stream = await downloadContentFromMessage(mes[type], mimeMap[type]);
    const buffer = [];

    for await (const chunk of stream) {
      buffer.push(chunk);
    }
    const finalBuffer = Buffer.concat(buffer);

    if (pathFile) {
      await fs.writeFile(pathFile, finalBuffer);
      return pathFile;
    } else {
      return finalBuffer;
    }
  } catch (error) {
    console.error("Error in downloadMedia:", error, "Original message:", message);
    throw error;
  }
}

async function serialize(msg, conn) {
  if (!msg) return msg; // Guard clause for null/undefined msg
  conn.logger = conn.logger || { info() {}, error() {}, warn() {} }; // Ensure logger exists

  if (msg.key) {
    msg.id = msg.key.id;
    msg.isSelf = msg.key.fromMe;
    msg.from = msg.key.remoteJid;
    msg.isGroup = msg.from ? msg.from.endsWith("@g.us") : false;

    msg.sender = msg.isGroup
      ? msg.key.participant || msg.participant // participant sometimes at root of key for group messages
      : msg.isSelf
      ? conn.user?.id // conn.user might be undefined initially
      : msg.from;
    
    // Ensure sender is defined
    if (!msg.sender && msg.key.participant) msg.sender = msg.key.participant;
    if (!msg.sender && msg.key.remoteJid && !msg.isGroup) msg.sender = msg.key.remoteJid;


    try {
      msg.sudo =
        config.SUDO.split(",").includes(
          (msg.sender ? parsedJid(msg.sender)[0].split("@")[0] : "") // handle undefined sender
        ) || msg.isSelf;
    } catch {
      msg.sudo = msg.isSelf || false; // Fallback for sudo logic
    }
  }

  if (msg.message) {
    msg.type = getContentType(msg.message);
    if (!msg.type && msg.message.viewOnceMessageV2?.message) { // Handle viewOnceMessageV2 explicitly if getContentType fails
        msg.type = getContentType(msg.message.viewOnceMessageV2.message);
    }
    if (!msg.type && msg.message.ephemeralMessage?.message) {
        msg.type = getContentType(msg.message.ephemeralMessage.message);
    }


    try {
      msg.mentions = msg.message[msg.type]?.contextInfo?.mentionedJid || [];
    } catch {
      msg.mentions = []; // Default to empty array
    }

    try {
      const contextInfo = msg.message[msg.type]?.contextInfo;
      if (contextInfo && contextInfo.quotedMessage) {
        let quotedMsgObj = contextInfo.quotedMessage;
        let quotedType = "normal";

        if (quotedMsgObj.ephemeralMessage) {
          quotedMsgObj = quotedMsgObj.ephemeralMessage.message;
          quotedType = Object.keys(quotedMsgObj)[0] === "viewOnceMessageV2" ? "view_once" : "ephemeral";
          if (quotedType === "view_once") {
            quotedMsgObj = quotedMsgObj.viewOnceMessageV2.message;
          }
        } else if (quotedMsgObj.viewOnceMessageV2) {
          quotedMsgObj = quotedMsgObj.viewOnceMessageV2.message;
          quotedType = "view_once";
        } else if (quotedMsgObj.viewOnceMessageV2Extension) {
          quotedMsgObj = quotedMsgObj.viewOnceMessageV2Extension.message;
          quotedType = "view_once_audio";
        }
        
        const mtype = Object.keys(quotedMsgObj)[0];
        msg.quoted = {
          type: quotedType,
          stanzaId: contextInfo.stanzaId,
          sender: contextInfo.participant,
          message: quotedMsgObj,
          isSelf: contextInfo.participant === conn.user?.id,
          mtype: mtype,
          text: quotedMsgObj[mtype]?.text ||
                quotedMsgObj[mtype]?.caption ||
                quotedMsgObj[mtype]?.description ||
                (mtype === "templateButtonReplyMessage" && quotedMsgObj[mtype].hydratedTemplate?.hydratedContentText) ||
                (typeof quotedMsgObj[mtype] === 'string' ? quotedMsgObj[mtype] : "") || // Handle cases where message part is a string directly
                 "",
          key: {
            id: contextInfo.stanzaId,
            fromMe: contextInfo.participant === conn.user?.id,
            remoteJid: msg.from,
            participant: contextInfo.participant, // Add participant to quoted key
          },
          download: (pathFile) => downloadMedia(quotedMsgObj, pathFile),
        };
      }
    } catch (error) {
      console.error("Error in processing quoted message:", error, msg.message[msg.type]?.contextInfo);
      msg.quoted = null;
    }

    try {
      msg.body =
        msg.message.conversation ||
        msg.message[msg.type]?.text ||
        msg.message[msg.type]?.caption ||
        (msg.type === "listResponseMessage" &&
          msg.message[msg.type].singleSelectReply?.selectedRowId) ||
        (msg.type === "buttonsResponseMessage" &&
          msg.message[msg.type].selectedButtonId) || // No selectedButtonId directly, check contextInfo or selectedDisplayText
        (msg.type === "templateButtonReplyMessage" &&
          msg.message[msg.type].selectedId) ||
        false;
      
      // Fallback for buttonsResponseMessage from selectedDisplayText
      if (msg.type === "buttonsResponseMessage" && !msg.body && msg.message[msg.type]?.selectedDisplayText) {
          msg.body = msg.message[msg.type]?.selectedDisplayText;
      }

    } catch (error) {
      console.error("Error in extracting message body:", error);
      msg.body = false;
    }

    msg.download = (pathFile) => downloadMedia(msg.message, pathFile);
    
    // conn.client = msg; // This might overwrite client property if conn is shared. Be cautious.

    conn.getFile = async (PATH, returnAsFilename) => {
      let res, filename;
      let data = Buffer.isBuffer(PATH)
        ? PATH
        : /^data:.*?\/.*?;base64,/i.test(PATH)
        ? Buffer.from(PATH.split(',')[1], "base64")
        : /^https?:\/\//.test(PATH)
        ? await (res = await nodeFetch(PATH)).buffer()
        : fs.existsSync(PATH) // This was fs.existsSync, not fs.promises.existsSync
        ? ((filename = PATH), await fs.readFile(PATH)) // Use await fs.readFile
        : typeof PATH === "string"
        ? Buffer.from(PATH) // Assuming string is content, not path
        : Buffer.alloc(0);
        
      if (!Buffer.isBuffer(data)) throw new TypeError("Result is not a buffer");
      
      let type = (await fromBuffer(data)) || {
        mime: "application/octet-stream",
        ext: ".bin",
      };
      
      if (data && returnAsFilename && !filename) {
        filename = path.join(
          __dirname, // Or a dedicated temp directory
          "../tmp", // Ensure 'tmp' directory exists at project root or adjust path
          new Date() * 1 + "." + type.ext 
        );
        // Ensure directory for filename exists
        const fileDir = dirname(filename);
        try {
            await fs.access(fileDir);
        } catch {
            await fs.mkdir(fileDir, { recursive: true });
        }
        await fs.writeFile(filename, data);
      }
      return {
        res,
        filename,
        ...type,
        data,
      };
    };

    conn.sendImageAsSticker = async (jid, buff, options = {}) => {
      let stickerBuffer;
      if (options && (options.packname || options.author)) {
        const exifPath = await writeExifImg(buff, options); // writeExifImg returns a path
        stickerBuffer = await fs.readFile(exifPath);
        await fs.unlink(exifPath); // Clean up temp file
      } else {
        stickerBuffer = await imageToWebp(buff);
      }
      await conn.sendMessage(
        jid,
        { sticker: stickerBuffer, ...options }, // Send buffer directly
        options
      );
    };

    conn.sendVideoAsSticker = async (jid, buff, options = {}) => {
      let stickerBuffer;
      if (options && (options.packname || options.author)) {
        const exifPath = await writeExifVid(buff, options); // writeExifVid returns a path
        stickerBuffer = await fs.readFile(exifPath);
        await fs.unlink(exifPath); // Clean up temp file
      } else {
        stickerBuffer = await videoToWebp(buff);
      }
      await conn.sendMessage(
        jid,
        { sticker: stickerBuffer, ...options }, // Send buffer directly
        options
      );
    };
  }
  return msg;
}

export { serialize, downloadMedia };