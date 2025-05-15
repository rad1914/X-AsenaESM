import fs from "fs/promises";
import fsSync from "fs"; // For sync methods like existsSync, mkdirSync, writeFileSync
import path from "path";
import config from "./config.js";
import connect from "./lib/connection.js";
import { loadSession } from "baileys";
import io from "socket.io-client";
import { getandRequirePlugins } from "./assets/database/plugins.js";

global.__basedir = path.dirname(new URL(import.meta.url).pathname); // base directory

const readAndRequireFiles = async (directory) => {
  try {
    const files = await fs.readdir(directory);
    return Promise.all(
      files
        .filter((file) => path.extname(file).toLowerCase() === ".js")
        .map(async (file) => {
          const mod = await import(path.join(directory, file).replace(/\\/g, "/"));
          return mod;
        })
    );
  } catch (error) {
    console.error("Error reading and requiring files:", error);
    throw error;
  }
};

async function initialize() {
  console.log("X-Asena");
  try {
    if (config.SESSION_ID && !fsSync.existsSync("session")) {
      console.log("loading session from session id...");
      fsSync.mkdirSync("./session");
      const credsData = await loadSession(config.SESSION_ID);
      fsSync.writeFileSync(
        "./session/creds.json",
        JSON.stringify(credsData.creds, null, 2)
      );
    }
    await readAndRequireFiles(path.join(global.__basedir, "/assets/database/"));
    console.log("Syncing Database");

    await config.DATABASE.sync();

    console.log("⬇  Installing Plugins...");
    await readAndRequireFiles(path.join(global.__basedir, "/assets/plugins/"));
    await getandRequirePlugins();
    console.log("✅ Plugins Installed!");
    const ws = io("https://socket.xasena.me/", { reconnection: true });
    ws.on("connect", () => console.log("Connected to server"));
    ws.on("disconnect", () => console.log("Disconnected from server"));
    return await connect();
  } catch (error) {
    console.error("Initialization error:", error);
    return process.exit(1); // Exit with error status
  }
}

initialize();
