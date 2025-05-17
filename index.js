import { readdir } from 'fs/promises';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname } from 'path';

import config from './config.js';
import connect from './lib/connection.js'; // Assuming lib/connection.js exists and uses ESM
import { loadSession } from 'baileys';
import ioClient from 'socket.io-client';
import { getandRequirePlugins } from './assets/database/plugins.js'; // Assuming this file is or will be ESM

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
global.__basedir = __dirname; // Set the base directory for the project

const readAndRequireFiles = async (directory) => {
  try {
    const files = await readdir(directory);
    return Promise.all(
      files
        .filter((file) => path.extname(file).toLowerCase() === ".js")
        .map((file) => {
          const modulePath = path.join(directory, file);
          const moduleURL = pathToFileURL(modulePath).href;
          return import(moduleURL); // Dynamically import modules (primarily for side-effects)
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
    if (config.SESSION_ID && !existsSync("./session")) {
      console.log("loading session from session id...");
      mkdirSync("./session");
      const credsData = await loadSession(config.SESSION_ID);
      writeFileSync(
        "./session/creds.json",
        JSON.stringify(credsData.creds, null, 2)
      );
    }
    await readAndRequireFiles(path.join(__dirname, "/assets/database/"));
    console.log("Syncing Database");

    await config.DATABASE.sync();

    console.log("⬇  Installing Plugins...");
    await readAndRequireFiles(path.join(__dirname, "/assets/plugins/"));
    await getandRequirePlugins();
    console.log("✅ Plugins Installed!");
    const ws = ioClient("https://socket.xasena.me/", { reconnection: true });
    ws.on("connect", () => console.log("Connected to server"));
    ws.on("disconnect", () => console.log("Disconnected from server"));
    return await connect();
  } catch (error) {
    console.error("Initialization error:", error);
    return process.exit(1); // Exit with error status
  }
}

initialize();