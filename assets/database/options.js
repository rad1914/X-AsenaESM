import config from "../../config.js";
import { DataTypes } from "sequelize";

const optionsDB = config.DATABASE.define("Options", { // Renamed model for clarity
  chat: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  type: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  status: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
});

async function toggle(jid = null, type = null) {
    const existingMessage = await optionsDB.findOne({
      where: {
        chat: jid,
        type,
      },
    });
  
    if (!existingMessage) {
        return await optionsDB.create({
            chat: jid,
            type,
            status: true,
          });
    } else {
      const newStatus = !existingMessage.dataValues.status;
      return await existingMessage.update({ status: newStatus }); // Only update status
    }
  }

export default toggle; // Default export for the single function