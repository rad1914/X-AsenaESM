import { isJidGroup } from "baileys";
import config from "../../config.js";
import { DataTypes } from "sequelize";

export const chatDb = config.DATABASE.define("Chat", {
  id: {
    type: DataTypes.STRING,
    allowNull: false,
    primaryKey: true,
  },
  conversationTimestamp: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  isGroup: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
});

export const messageDb = config.DATABASE.define("message", {
  jid: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  message: {
    type: DataTypes.JSON,
    allowNull: false,
  },
  id: {
    type: DataTypes.STRING,
    allowNull: false,
    primaryKey: true,
  },
});

export const contactDb = config.DATABASE.define("contact", {
  jid: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true, // JID should be unique for contacts
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

export const saveContact = async (jid, name) => {
  try {
    if (!jid || !name) return;
    if (isJidGroup(jid)) return;
    const exists = await contactDb.findOne({ where: { jid } });
    if (exists) {
      if (exists.name === name) {
        return;
      }
      return await contactDb.update({ name }, { where: { jid } });
    } else {
      return await contactDb.create({ jid, name });
    }
  } catch (e) {
    console.log("Error saving contact:", e);
  }
};

export const saveMessage = async (message, user) => {
  try {
    const jid = message.key.remoteJid;
    const id = message.key.id;
    const msg = message; // The whole message object
    if (!id || !jid || !msg) return;
    await saveContact(user, message.pushName); // user is likely message.key.fromMe ? client.user.id : message.key.participant || message.key.remoteJid
                                          // The 'user' parameter needs clarification for its source, assuming it's the sender's JID.
    let exists = await messageDb.findOne({ where: { id, jid } });
    if (exists) {
      return await messageDb.update({ message: msg }, { where: { id, jid } });
    } else {
      return await messageDb.create({ id, jid, message: msg });
    }
  } catch (e) {
    console.log("Error saving message:", e);
  }
};

export const loadMessage = async (id) => {
  if (!id) return;
  const message = await messageDb.findOne({
    where: { id },
  });
  if (message) return message.dataValues;
  return false;
};

export const saveChat = async (chat) => {
  if (chat.id === "status@broadcast" || chat.id === "broadcast") return; // Simplified condition
  let isGroup = isJidGroup(chat.id);
  if (!chat.id || typeof chat.conversationTimestamp === 'undefined') return; // Check for existence of timestamp
  let chatexists = await chatDb.findOne({ where: { id: chat.id } });
  if (chatexists) {
    return await chatDb.update(
      { conversationTimestamp: chat.conversationTimestamp },
      { where: { id: chat.id } }
    );
  } else {
    return await chatDb.create({
      id: chat.id,
      conversationTimestamp: chat.conversationTimestamp,
      isGroup,
    });
  }
};

export const getName = async (jid) => {
  if (!jid) return "Unknown"; // Handle null/undefined jid
  const contact = await contactDb.findOne({ where: { jid } });
  if (!contact) return jid.split("@")[0].replace(/_/g, " ");
  return contact.name;
};

export const storeDbModule = {
  saveMessage,
  loadMessage,
  saveChat,
  getName,
  // Exporting DB models and saveContact if they are intended to be used externally
  chatDb,
  messageDb,
  contactDb,
  saveContact,
};

export default storeDbModule;