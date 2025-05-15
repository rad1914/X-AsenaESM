import got from "got";
import config from "../../config.js";
import { DataTypes } from "sequelize";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function installPlugin(adres, file) {
  const existingPlugin = await PluginDB.findOne({ where: { url: adres } });

  if (existingPlugin) {
    return false;
  } else {
    return await PluginDB.create({ url: adres, name: file });
  }
}

async function removePlugin(name) {
  const existingPlugin = await PluginDB.findOne({ where: { name: name } });

  if (existingPlugin) {
    await existingPlugin.destroy();
    return true;
  } else {
    return false;
  }
}

async function getandRequirePlugins() {
  let plugins = await PluginDB.findAll();
  plugins = plugins.map((plugin) => plugin.dataValues);
  for (const plugin of plugins) {
    try {
      const res = await got(plugin.url);
      const pluginPath = path.resolve(__dirname, "../../assets/plugins/", `${plugin.name}.js`);
      fs.writeFileSync(pluginPath, res.body);
      // Dynamically import the plugin after saving
      await import(`file://${pluginPath}`);
      console.log("Installed plugin:", plugin.name);
    } catch (e) {
      console.error(e);
    }
  }
}

export { PluginDB, installPlugin, getandRequirePlugins };
