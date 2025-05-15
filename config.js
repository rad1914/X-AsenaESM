import { Sequelize } from "sequelize";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

const toBool = (x) => x === "true";
const DATABASE_URL = process.env.DATABASE_URL || "./assets/database.db";

export const ANTILINK = toBool(process.env.ANTI_LINK) || false;
export const LOGS = toBool(process.env.LOGS) || true;
export const ANTILINK_ACTION = process.env.ANTI_LINK || "kick";
export const SESSION_ID = process.env.SESSION_ID || null;
export const LANG = process.env.LANG || "EN";
export const AUTH_TOKEN = "";
export const HANDLERS =
  process.env.HANDLER === "false" || process.env.HANDLER === "null"
    ? "^"
    : "[#]";
export const RMBG_KEY = process.env.RMBG_KEY || false;
export const BRANCH = "main";
export const WARN_COUNT = 3;
export const PACKNAME = process.env.PACKNAME || "X-Asena";
export const WELCOME_MSG =
  process.env.WELCOME_MSG || "Hi @user Welcome to @gname";
export const GOODBYE_MSG =
  process.env.GOODBYE_MSG || "Hi @user It was Nice Seeing you";
export const AUTHOR = process.env.AUTHOR || "X-Electra";
export const SUDO =
  process.env.SUDO ||
  "918113921898,919598157259,918590508376,919383400679";
export const HEROKU_APP_NAME = process.env.HEROKU_APP_NAME || "";
export const HEROKU_API_KEY = process.env.HEROKU_API_KEY || "";
export const OWNER_NAME = process.env.OWNER_NAME || "Neeraj-X0";
export const HEROKU = toBool(process.env.HEROKU) || false;
export const BOT_NAME = process.env.BOT_NAME || "X-Asena";
export const AUTO_READ = toBool(process.env.AUTO_READ) || false;
export const AUTO_STATUS_READ = toBool(process.env.AUTO_STATUS_READ) || false;
export const PROCESSNAME = process.env.PROCESSNAME || "x-asena";
export const WORK_TYPE = process.env.WORK_TYPE || "private";
export const SESSION_URL = process.env.SESSION_URL || "";
export const DELETED_LOG = toBool(process.env.DELETED_LOG) || false;
export const DELETED_LOG_CHAT = process.env.DELETED_LOG_CHAT || false;
export const REMOVEBG = process.env.REMOVEBG || false;
export const DATABASE_URL_CONST = DATABASE_URL;
export const STATUS_SAVER = toBool(process.env.STATUS_SAVER) || true;

export const DATABASE =
  DATABASE_URL === "./assets/database.db"
    ? new Sequelize({
        dialect: "sqlite",
        storage: DATABASE_URL,
        logging: false,
      })
    : new Sequelize(DATABASE_URL, {
        dialect: "postgres",
        ssl: true,
        protocol: "postgres",
        dialectOptions: {
          native: true,
          ssl: { require: true, rejectUnauthorized: false },
        },
        logging: false,
      });

export default {
  ANTILINK,
  LOGS,
  ANTILINK_ACTION,
  SESSION_ID,
  LANG,
  AUTH_TOKEN,
  HANDLERS,
  RMBG_KEY,
  BRANCH,
  WARN_COUNT,
  PACKNAME,
  WELCOME_MSG,
  GOODBYE_MSG,
  AUTHOR,
  SUDO,
  HEROKU_APP_NAME,
  HEROKU_API_KEY,
  OWNER_NAME,
  HEROKU,
  BOT_NAME,
  AUTO_READ,
  AUTO_STATUS_READ,
  PROCESSNAME,
  WORK_TYPE,
  SESSION_URL,
  DELETED_LOG,
  DELETED_LOG_CHAT,
  REMOVEBG,
  DATABASE_URL_CONST,
  STATUS_SAVER,
  DATABASE
};
