import pino from "pino";
import path, { dirname } from "path";
import fs from "fs";
import util from "util";
import * as plugins from "./plugins.js";
import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, Browsers, makeCacheableSignalKeyStore, DisconnectReason, delay } from "baileys";

import { PausedChats } from "../assets/database/index.js";
import config from "../config.js";
import { serialize, Greetings } from "./index.js";
import { Image, Message, Sticker, Video, AllMessage } from "./Messages/index.js";
import {
  loadMessage,
  saveMessage,
  saveChat,
  getName,
} from "../assets/database/StoreDb.js";
import { fileURLToPath } from 'url';


import packageJson from "../package.json" with { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Assuming connection.js is in a subdirectory (e.g., 'lib') of the project root
const projectRoot = path.resolve(__dirname, '..'); 

const logger = pino({ level: "silent" });
const sessionDirName = "./session"; // Relative to project root

if (!fs.existsSync(path.join(projectRoot, sessionDirName))) {
  fs.mkdirSync(path.join(projectRoot, sessionDirName), { recursive: true });
}

const handleError = async (err, conn, type) => {
  const error = util.format(err);
  const text = `\`\`\`X-asena ${type}: \n${error}\`\`\``;
  if (conn && conn.user && conn.user.id) { // Ensure conn and conn.user are defined
    await conn.sendMessage(conn.user.id, { text });
  }
  console.error(err);
};

const connect = async () => {
  const absoluteSessionPath = path.join(projectRoot, sessionDirName);
  const { state, saveCreds } = await useMultiFileAuthState(absoluteSessionPath);
  const { version } = await fetchLatestBaileysVersion();

  const conn = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    printQRInTerminal: true,
    logger,
    browser: Browsers.macOS("Desktop"),
    downloadHistory: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
    emitOwnEvents: true,
    version,
    getMessage: async (key) =>
      (loadMessage(key.id) || {}).message || { conversation: null },
  });

  conn.ev.on("connection.update", handleConnectionUpdate(conn));
  conn.ev.on("creds.update", saveCreds);
  conn.ev.on("group-participants.update", async (data) =>
    Greetings(data, conn)
  );
  conn.ev.on("chats.update", async (chats) => chats.forEach(saveChat));
  conn.ev.on("messages.upsert", handleMessages(conn));

  process.on("unhandledRejection", (err) =>
    handleError(err, conn, "unhandledRejection")
  );
  process.on("uncaughtException", (err) =>
    handleError(err, conn, "uncaughtException")
  );

  return conn;
};

const handleConnectionUpdate = (conn) => async (s) => {
  const { connection, lastDisconnect } = s;

  switch (connection) {
    case "connecting":
      console.log("Connecting to WhatsApp... Please Wait.");
      break;
    case "open":
      console.log("Login Successful!");
      const packageVersion = packageJson.version;
      const totalPlugins = plugins.commands.length;
      const workType = config.WORK_TYPE;
      const statusMessage = `\`\`\`X-asena connected\nVersion: ${packageVersion}\nTotal Plugins: ${totalPlugins}\nWorktype: ${workType}\`\`\``;
      if (conn.user && conn.user.id) {
         await conn.sendMessage(conn.user.id, { text: statusMessage });
      }
      break;
    case "close":
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        console.log("Connection closed, reconnecting...", lastDisconnect?.error);
        reconnect(conn); // conn might be stale here, direct call to connect() might be better
      } else {
        exitApp();
      }
      break;
    default:
      break;
  }
};

const handleMessages = (conn) => async (m) => {
  if (m.type !== "notify") return;

  const msg = await serialize(JSON.parse(JSON.stringify(m.messages[0])), conn);
  if (!msg) return; // serialize might return undefined/null
  
  await saveMessage(m.messages[0], msg.sender);
  if (config.AUTO_READ) await conn.readMessages([msg.key]); // readMessages expects an array of keys
  if (config.AUTO_STATUS_READ && msg.from === "status@broadcast")
    await conn.readMessages([msg.key]); // readMessages expects an array of keys

  processMessage(msg, conn, m);
};

const reconnect = (conn) => { // Passing conn here might be problematic if it's truly closed/stale
  console.log("Reconnecting...");
  connect(); // Calling connect() directly to establish a new connection
};

const exitApp = async () => {
  console.log("Connection closed. Device logged out.");
  await delay(3000);
  process.exit(0);
};

const processMessage = async (msg, conn, m) => {
  if (!msg || !msg.body) return;

  const chatId = msg.from;
  const pausedChats = await PausedChats.getPausedChats();
  const regex = new RegExp(`${config.HANDLERS}( ?resume)`, "is");
  if (
    pausedChats.some(
      (pausedChat) => pausedChat.chatId === chatId && !regex.test(msg.body)
    )
  )
    return;

  if (config.LOGS) logMessage(msg, conn);

  executeCommand(msg, conn, m);
};

const logMessage = async (msg, conn) => {
  const name = await getName(msg.sender);
  const groupName = msg.isGroup // use msg.isGroup instead of endsWith
    ? (await conn.groupMetadata(msg.from)).subject
    : msg.from; // Or handle non-group name appropriately
  console.log(`At : ${groupName}\nFrom : ${name}\nMessage:${msg.body || msg.type}`); // msg without body could be media
};

const executeCommand = (msg, conn, m) => {
  plugins.commands.forEach(async (command) => {
    if (!msg.sudo && (command.fromMe || (config.WORK_TYPE === 'private' && !command.fromMe))) return; // Adjusted logic for private work type

    const handleCommand = (Instance, args) => {
      const whats = new Instance(conn, msg);
      command.function(whats, ...args, msg, conn, m);
    };

    const text_msg = msg.body;

    if (text_msg && command.pattern) {
      const iscommand = text_msg.match(command.pattern);
      if (iscommand) {
        msg.prefix = iscommand[1]; // Ensure pattern captures this group
        msg.command = `${iscommand[1]}${iscommand[2]}`; // Ensure pattern captures these groups
        handleCommand(Message, [iscommand[3] || false]); // Ensure pattern captures this group
      }
    } else {
      handleMediaCommand(command, msg, text_msg, handleCommand);
    }
  });
};

const handleMediaCommand = (command, msg, text_msg, handleCommand) => {
  switch (command.on) {
    case "text":
      if (text_msg) handleCommand(Message, [text_msg]);
      break;
    case "image":
      if (msg.type === "imageMessage") handleCommand(Image, [text_msg]); // text_msg as caption
      break;
    case "sticker":
      if (msg.type === "stickerMessage") handleCommand(Sticker, []);
      break;
    case "video":
      if (msg.type === "videoMessage") handleCommand(Video, [text_msg]); // text_msg as caption
      break;
    case "delete":
      if (msg.type === "protocolMessage" && msg.message.protocolMessage.type === 'REVOKE') { // Check for REVOKE type
        const whats = new Message(conn, msg); // msg already contains necessary info for revoke
        whats.messageId = msg.message.protocolMessage.key?.id;
        command.function(whats, msg, conn); // msg might be redundant if whats has all
      }
      break;
    case "message":
      handleCommand(AllMessage, []);
      break;
    default:
      break;
  }
};

export default connect;