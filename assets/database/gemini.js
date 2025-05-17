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
  return new Promise(async (resolve, reject) => {
    try {
      const gemini = await GeminiDB.findOne({ where: { chatid } });
      if (!gemini) {
        await GeminiDB.create({ chatid, history: parts });
        // Resolve after creation if new
        resolve(); // Or resolve with the created instance if needed
        return;
      }
      let part = gemini.history || []; // Ensure part is an array
      part.push(parts); // parts should be an object {role, parts: [{text}]}
                       // if 'parts' itself is the array of such objects, then history should be parts.concat(gemini.history) or similar
                       // Assuming 'parts' is a new history entry {role, parts: [{text}]}
      await gemini.update({ history: part });
      resolve();
    } catch (e) {
      console.log(util.format(e));
      reject(e); // It's good practice to reject promises on error
    }
  });
};

const GetGemini = async (chatid) => {
  return new Promise(async (resolve, reject) => {
    try {
      const gemini = await GeminiDB.findOne({ where: { chatid } });
      if (!gemini) return resolve([]);
      resolve(gemini.history); // Resolve with the actual history
    } catch (e) {
      console.log(util.format(e));
      resolve([]); // Or reject(e)
    }
  });
};

const geminiModule = { SaveGemini, GetGemini, GeminiDB }; // Added GeminiDB to exports if needed elsewhere

export default geminiModule;