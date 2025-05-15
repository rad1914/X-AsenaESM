import config from "../../config.js";
import util from "util";
import { DataTypes } from "sequelize";

const GeminiDB = config.DATABASE.define("Geminis", {
  chatid: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  history: {
    type: DataTypes.ARRAY(DataTypes.JSON),
    allowNull: false,
  },
});

const SaveGemini = async (chatid, parts) => {
  try {
    const gemini = await GeminiDB.findOne({ where: { chatid } });
    if (!gemini) {
      await GeminiDB.create({ chatid, history: parts });
      return;
    }
    let part = gemini.history;
    part.push(parts);
    await gemini.update({ chatid, history: part });
  } catch (e) {
    console.log(util.format(e));
  }
};

const GetGemini = async (chatid) => {
  try {
    const gemini = await GeminiDB.findOne({ where: { chatid } });
    if (!gemini) return [];
    return gemini;
  } catch (e) {
    console.log(util.format(e));
    return [];
  }
};

export { SaveGemini, GetGemini };
