import config from "../../config.js";
import util from "util";
import { DataTypes } from "sequelize";

export const banBotDb = config.DATABASE.define("banbot", {
  chatid: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  ban: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
});

export const isBanned = async (chatid) => {
  return new Promise(async (resolve, reject) => {
    try {
      const ban = await banBotDb.findOne({ where: { chatid } });
      resolve(ban ? ban.ban : false);
    } catch (e) {
      console.log(util.format(e));
      reject(e); // Good practice to reject on error
    }
  });
};

export const banUser = async (chatid) => {
  return new Promise(async (resolve, reject) => {
    try {
      const ban = await banBotDb.findOne({ where: { chatid } });
      if (ban) {
        await ban.update({ ban: true });
      } else {
        await banBotDb.create({ chatid, ban: true });
      }
      resolve(true);
    } catch (e) {
      console.log(util.format(e));
      reject(e);
    }
  });
};

export const unbanUser = async (chatid) => {
  return new Promise(async (resolve, reject) => {
    try {
      const ban = await banBotDb.findOne({ where: { chatid } });
      if (ban) {
        await ban.update({ ban: false });
      } else {
        // If user not found, creating them as unbanned might be desired or not.
        // Original code created them with ban: false.
        await banBotDb.create({ chatid, ban: false });
      }
      resolve(true);
    } catch (e) {
      console.log(util.format(e));
      reject(e);
    }
  });
};

export const banModule = { isBanned, banUser, unbanUser, banBotDb }; // Added banBotDb to exports if needed

export default banModule;