import config from "../../config.js";
import util from "util";
import { DataTypes } from "sequelize";

const banBotDb = config.DATABASE.define("banbot", {
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

const isBanned = async (chatid) => {
  try {
    const ban = await banBotDb.findOne({ where: { chatid } });
    return ban ? ban.ban : false;
  } catch (e) {
    console.log(util.format(e));
    return false;
  }
};

const banUser = async (chatid) => {
  try {
    const ban = await banBotDb.findOne({ where: { chatid } });
    if (ban) {
      await ban.update({ ban: true });
    } else {
      await banBotDb.create({ chatid, ban: true });
    }
    return true;
  } catch (e) {
    console.log(util.format(e));
    return false;
  }
};

const unbanUser = async (chatid) => {
  try {
    const ban = await banBotDb.findOne({ where: { chatid } });
    if (ban) {
      await ban.update({ ban: false });
    } else {
      await banBotDb.create({ chatid, ban: false });
    }
    return true;
  } catch (e) {
    console.log(util.format(e));
    return false;
  }
};

export { isBanned, banUser, unbanUser };
