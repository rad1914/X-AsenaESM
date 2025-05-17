import config from '../../config.js';
import { DataTypes } from 'sequelize';

const PausedChatsDB = config.DATABASE.define('pausedChats', { // Renamed to PausedChatsDB for clarity if needed
  chatId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  }
});

async function getPausedChats() {
  return await PausedChatsDB.findAll();
}

async function savePausedChat(chatId) {
  return await PausedChatsDB.create({ chatId });
}

async function deleteAllPausedChats() {
  return await PausedChatsDB.destroy({
    where: {},
    truncate: true
  });
}

const pausedChatModule = {
  PausedChats: PausedChatsDB, // Exporting the DB model as PausedChats as per original index.js
  getPausedChats,
  savePausedChat,
  deleteAllPausedChats
};

export default pausedChatModule;