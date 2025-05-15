import config from '../../config.js';
import { DataTypes } from 'sequelize';

const NotesDB = config.DATABASE.define('notes', {
  note: {
    type: DataTypes.TEXT,
    allowNull: false
  }
});

export async function getNotes() {
  return await NotesDB.findAll();
}

export async function saveNote(note) {
  return await NotesDB.create({ note });
}

export async function deleteAllNotes() {
  return await NotesDB.destroy({
    where: {},
    truncate: true
  });
}

export default {
NotesDB,
getNotes,
saveNote,
deleteAllNotes
};