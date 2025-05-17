import { command, command as Function, commands } from "./plugins.js"; // Renamed to avoid conflict with Function constructor
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
  extractUrlFromMessage, // Added if this was from functions.js and used by Greetings
  FiletypeFromUrl, // Added if this was from functions.js and used by Greetings
} from "./functions.js";
import { serialize, downloadMedia } from "./serialize.js";
import Greetings from "./Greetings.js";

const isPrivate = config.WORK_TYPE.toLowerCase() === "private";

export {
  toAudio,
  isPrivate,
  Greetings,
  isAdmin,
  serialize,
  getLyrics,
  readQr,
  downloadMedia,
  getRandom,
  Function, // Exporting the aliased command
  command, // Exporting original command name if preferred
  commands,
  getBuffer,
  decodeJid,
  parseJid,
  parsedJid,
  getJson,
  isIgUrl,
  isUrl,
  getUrl,
  validateQuality,
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
  extractUrlFromMessage, // Added if this was from functions.js and used by Greetings
  FiletypeFromUrl, // Added if this was from functions.js and used by Greetings
};