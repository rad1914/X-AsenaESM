import config from '../../config.js';
import { DataTypes } from 'sequelize';

const WarnsDB = config.DATABASE.define('warns', {
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  reasons: {
    type: DataTypes.STRING, // Use STRING to store serialized array as a string
    allowNull: true,
    get() {
      const rawValue = this.getDataValue('reasons');
      return rawValue ? JSON.parse(rawValue) : null;
    },
    set(value) {
      this.setDataValue('reasons', value ? JSON.stringify(value) : null);
    },
  },
  warnCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
});

export async function getWarns(userId) {
  return await WarnsDB.findOne({ where: { userId } });
}

export async function saveWarn(userId, reason) {
  let existingWarn = await getWarns(userId);

  if (existingWarn) {
    existingWarn.warnCount += 1;

    if (reason) {
      existingWarn.reasons = existingWarn.reasons || [];
      existingWarn.reasons.push(reason);
    }

    await existingWarn.save();
  } else {
    existingWarn = await WarnsDB.create({
      userId,
      reasons: reason ? [reason] : null,
      warnCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  return existingWarn;
}

export async function resetWarn(userId) {
  return await WarnsDB.destroy({
    where: { userId },
    truncate: true,
  });
}

export { WarnsDB };
