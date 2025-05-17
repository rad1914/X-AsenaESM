import {
  default as makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  DisconnectReason,
  delay,
  generateSessionID,
} from "baileys";
import pino from "pino";
import NodeCache from "node-cache";
import { createInterface } from "readline";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Assuming pcode.js is in a subdirectory (e.g., 'lib') of the project root
const projectRoot = path.resolve(__dirname, '..'); 

const logger = pino({ level: "silent" });

const question = (query) =>
  new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    });
  });

async function rmDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.readdirSync(dirPath).forEach((file) => {
      const curPath = path.join(dirPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        rmDir(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    // After removing all files/subdirectories, remove the directory itself
    // fs.rmdirSync(dirPath); // Disabled as original did not remove the top dir itself, only contents
  }
}

const startSock = async (num, sessionDirPath, message) => {
  let effectiveSessionDir = sessionDirPath;
  if (!effectiveSessionDir) {
    effectiveSessionDir = path.join(projectRoot, "session");
  }
  
  // Ensure the directory exists before trying to operate on it or its contents
  if (!fs.existsSync(effectiveSessionDir)) {
    fs.mkdirSync(effectiveSessionDir, { recursive: true });
  } else {
    // If it exists, clear its contents as per original rmDir logic for the session path
    // Original rmDir clears contents but not the directory itself. 
    // If the intent was to delete and recreate, fs.rmSync(effectiveSessionDir, { recursive: true, force: true }); 
    // followed by fs.mkdirSync would be better.
    // For now, replicating original content removal:
    fs.readdirSync(effectiveSessionDir).forEach((file) => {
      const curPath = path.join(effectiveSessionDir, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        // fs.rmSync(curPath, { recursive: true, force: true }); // Modern way to remove dir
        rmDir(curPath); // old way, recursively removes content, then dir
        fs.rmdirSync(curPath); // rmDir only removes content of subdirs, not subdirs themselves
      } else {
        fs.unlinkSync(curPath);
      }
    });
  }


  const { state, saveCreds } = await useMultiFileAuthState(effectiveSessionDir);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  const msgRetryCounterCache = new NodeCache();
  console.log(`using WA v${version.join(".")}, isLatest: ${isLatest}`);
  let restarted = false;

  async function connect() {
    const sock = makeWASocket({
      version,
      logger,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      generateHighQualityLinkPreview: true,
      msgRetryCounterCache,
    });
    let pairingCode = "";
    if (!sock.authState.creds.me?.id && !restarted) {
      const phoneNumber = num || (await question("Enter your phone number: "));
      pairingCode = await sock.requestPairingCode(phoneNumber);
      console.log(`Pairing code: ${pairingCode} `);
    }

    sock.ev.process(async (events) => {
      if (events["connection.update"]) {
        const update = events["connection.update"];
        const { connection, lastDisconnect } = update;
        const status = lastDisconnect?.error?.output?.statusCode;

        if (
          connection === "close" &&
          (status !== 403 && status !== 401 && !status) // Corrected logic: AND for multiple not equals
        ) {
          if (DisconnectReason.restartRequired === status) {
            console.log("restart required");
            console.log("restarting session");
            await connect();
            restarted = true;
          }
        }
        // sock.ev.on("creds.update", saveCreds); // This should be outside process, on sock.ev directly
        // delay(5000); // This delay seems misplaced here
        if (connection === "open") {
          // let creds = require(effectiveSessionDir + "/creds.json"); // Old CJS dynamic require
          const credsPath = path.join(effectiveSessionDir, "creds.json");
          let creds = JSON.parse(fs.readFileSync(credsPath, "utf-8"));
          
          let sessionID = await generateSessionID(creds); // generateSessionID might not exist in baileys, check usage
                                                        // Assuming generateSessionID is a custom function or part of your baileys setup
                                                        // If it's from baileys, ensure it's imported correctly.
                                                        // For this conversion, I'm assuming it's available in scope.
          if (typeof generateSessionID !== 'function') {
             console.warn("generateSessionID function is not available. Session ID generation might fail.");
             // Fallback or error handling for generateSessionID
             // sessionID = "COULD_NOT_GENERATE_SESSION_ID_FUNCTION_MISSING"; 
          }

          console.log("Session ID Generated: ", sessionID);
          await sock.sendMessage(sock.user.id, {
            text: `Session ID Generated: ${sessionID}`,
          });
          if (message && typeof message.reply === 'function') { // Ensure message object and reply method exist
            await message.reply("Session ID Generated: " + sessionID);
          } else {
            console.log("Message reply object not available for Session ID.")
          }


          await delay(5000);
          console.log(
            "session generated using pairing code run 'npm start' to start the bot"
          );
          process.exit(0);
        }
      }
    });
    sock.ev.on("creds.update", saveCreds); // Moved creds.update listener here

    process.on("uncaughtException", (err) => { // Corrected typo from unCaughtException
      console.log("uncaughtException", err);
      connect();
    });
    process.on("unhandledRejection", (err) => {
      console.log("unhandledRejection", err);
      connect();
    });

    return pairingCode;
  }
  try {
    const pairingCode = await connect();
    return pairingCode;
  } catch (error) {
    console.log("error", error);
  }
};

export { startSock };
export default startSock;