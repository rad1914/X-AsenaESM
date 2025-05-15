

// File: lib/index.js
import { command, commands } from "./plugins.js";
import config from "../config.js";
import {
  getBuffer,
  decodeJid,
  parseJid,
  parsedJid,
  getJson,
  isIgUrl,
  isUrl,
  getUrl,
  qrcode,
  secondsToDHMS,
  igdl,
  formatBytes,
  sleep,
  clockString,
  validateQuality,
  runtime,
  AddMp3Meta,
  Bitly,
  isNumber,
  getRandom,
  toAudio,
  readQr,
  getLyrics,
  isAdmin,
} from "./functions.js";
import { serialize, downloadMedia } from "./serialize.js";
import Greetings from "./Greetings.js";

export {
  command,
  commands,
  toAudio,
  Greetings,
  isAdmin,
  serialize,
  downloadMedia,
  getRandom,
  getBuffer,
  decodeJid,
  parseJid,
  parsedJid,
  getJson,
  isIgUrl,
  isUrl,
  getUrl,
  qrcode,
  secondsToDHMS,
  formatBytes,
  igdl,
  sleep,
  clockString,
  runtime,
  AddMp3Meta,
  Bitly,
  isNumber,
  getLyrics,
  readQr,
};

export const isPrivate = config.WORK_TYPE.toLowerCase() === "private";
