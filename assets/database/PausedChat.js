import config from '../../config.js';
import { DataTypes } from 'sequelize';

const PausedChats = config.DATABASE.define('pausedChats', {
  chatId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  }
});

export async function getPausedChats() {
  return await PausedChats.findAll();
}

export async function savePausedChat(chatId) {
  return await PausedChats.create({ chatId });
}

export async function deleteAllPausedChats() {
  return await PausedChats.destroy({
    where: {},
    truncate: true
  });
}

export { PausedChats };
