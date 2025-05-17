import got from "got";
import config from "../../config.js";
import { DataTypes } from "sequelize";
import fs from "fs";
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

// For `require` in ESM and potentially __basedir if it's project root relative to this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// If __basedir is a global variable set externally, it might still work.
// If __basedir is intended to be the project root, it needs to be set up reliably.
// For this conversion, we assume __basedir is available or its usage implies an absolute path.

const PluginDB = config.DATABASE.define("Plugin", {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  url: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
});

export async function installPlugin(adres, file) {
  const existingPlugin = await PluginDB.findOne({ where: { url: adres } });

  if (existingPlugin) {
    return false;
  } else {
    return await PluginDB.create({ url: adres, name: file });
  }
}

export async function removePlugin(name) {
  const existingPlugin = await PluginDB.findOne({ where: { name: name } });

  if (existingPlugin) {
    await existingPlugin.destroy();
    return true;
  } else {
    return false;
  }
}

export async function getandRequirePlugins() {
  let plugins = await PluginDB.findAll();
  plugins = plugins.map((plugin) => plugin.dataValues);
  for (const plugin of plugins) { // Use for...of for async operations in loop
    try {
      const res = await got(plugin.url);
      const pluginPath = path.join(__basedir, "/assets/plugins/", plugin.name + ".js"); // Ensure path.join for robustness
      fs.writeFileSync(
        pluginPath,
        res.body
      );
      require(pluginPath); // Using the CJS require created via createRequire
      console.log("Installed plugin:", plugin.name);
    } catch (e) {
      console.error("Error processing plugin:", plugin.name, e);
    }
  }
}

const pluginsModule = { PluginDB, installPlugin, getandRequirePlugins, removePlugin }; // Added removePlugin to export

export default pluginsModule;