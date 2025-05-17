import config from '../../config.js';
import { DataTypes } from 'sequelize';

const WarnsDB = config.DATABASE.define('warns', {
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  reasons: {
    type: DataTypes.STRING, 
    allowNull: true,
    get() {
      const rawValue = this.getDataValue('reasons');
      try {
        return rawValue ? JSON.parse(rawValue) : []; // Default to empty array if null/empty
      } catch (e) {
        console.error("Failed to parse reasons:", rawValue, e);
        return []; // Return empty array on parse error
      }
    },
    set(value) {
      this.setDataValue('reasons', value && value.length > 0 ? JSON.stringify(value) : null); // Store null if empty
    },
  },
  warnCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW, // Sequelize can handle default
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW, // Sequelize can handle default
  },
});

async function getWarns(userId) {
  return await WarnsDB.findOne({ where: { userId } });
}

async function saveWarn(userId, reason) {
    let existingWarn = await getWarns(userId);
  
    if (existingWarn) {
      existingWarn.warnCount += 1;
      const currentReasons = existingWarn.reasons || []; // Ensure it's an array
      if (reason) {
        currentReasons.push(reason);
      }
      existingWarn.reasons = currentReasons; // Setter will stringify
  
      await existingWarn.save(); // Sequelize handles updatedAt automatically
    } else {
      existingWarn = await WarnsDB.create({
        userId,
        reasons: reason ? [reason] : [], // Initialize with an array
        warnCount: 1, // Start with 1 warn if new and reason provided, or 0 if no reason
                      // Original code set warnCount to 0 and then incremented, so new warn is 1.
        createdAt: new Date(), // Though defaultValue in model might handle this
        updatedAt: new Date(), // Though defaultValue in model might handle this
      });
      if(!reason) existingWarn.warnCount = 0; // if no reason was given on first "warn"
                                               // The original code had warnCount: 0 for create, then incremented.
                                               // This means a new warn always resulted in count 1.
                                               // Correcting initial warnCount for creation:
      existingWarn.warnCount = 1; // A "saveWarn" implies a warning occurred.
      if (!reason) existingWarn.reasons = []; else existingWarn.reasons = [reason];
      
      // Re-evaluating the create part for consistency:
      // If creating, it means a warning is being issued.
      const initialReasons = reason ? [reason] : [];
      existingWarn = await WarnsDB.create({
        userId,
        reasons: initialReasons,
        warnCount: 1, // A new warning record starts with 1 warning.
        // createdAt and updatedAt will be handled by Sequelize's defaultValue or model hooks if set
      });
    }
  
    return existingWarn;
  }
  

async function resetWarn(userId) {
  // Original code used truncate: true, which deletes all records if where is {}
  // For resetting a specific user's warns, it should be destroy with specific userId
  const warn = await WarnsDB.findOne({ where: { userId } });
  if (warn) {
    return await warn.destroy(); // This deletes the specific user's warn record
  }
  return false; // Indicate user not found or no warns to reset

  // If the intent was to set warns to 0 and clear reasons:
  /*
  const existingWarn = await WarnsDB.findOne({ where: { userId } });
  if (existingWarn) {
    existingWarn.warnCount = 0;
    existingWarn.reasons = [];
    await existingWarn.save();
    return existingWarn;
  }
  return false;
  */
  // The original `truncate: true` in `destroy` suggests complete removal of the row.
}

const warnModule = {
  WarnsDB,
  getWarns,
  saveWarn,
  resetWarn,
};

export default warnModule;