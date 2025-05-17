import { command } from "../../lib/index.js";
import axios from "axios";
import fs from "fs";
import { Plugins } from "../database/index.js"; // Assuming Plugins is a named export containing PluginDB and installPlugin
const { PluginDB, installPlugin } = Plugins; // Destructure after import

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

command(
  {
    pattern: "install",
    fromMe: true,
    desc: "Installs External plugins",
    type: "user",
  },
  async (message, match) => {
    if (!match)
      return await message.sendMessage(message.jid, "_Send a plugin url_");

    let url;
    try {
      url = new URL(match);
    } catch (e) {
      console.log(e);
      return await message.sendMessage(message.jid, "_Invalid Url_");
    }

    if (url.host === "gist.github.com") {
      url.host = "gist.githubusercontent.com";
      url = url.toString() + "/raw";
    } else {
      url = url.toString();
    }

    var plugin_name;
    try {
      const { data, status } = await axios.get(url);
      if (status === 200) {
        var comand = data.match(/(?<=pattern:) ["'](.*?)["']/);
        if (comand && comand[0]) {
          plugin_name = comand[0].replace(/["']/g, "").trim().split(" ")[0];
        }
        if (!plugin_name) {
          plugin_name = "__" + Math.random().toString(36).substring(8);
        }
        
        const pluginPath = join(__dirname, plugin_name + ".js");
        fs.writeFileSync(pluginPath, data);
        
        try {
          // Dynamic import needs a cache-busting mechanism if re-importing updated versions is desired without restart
          // Using file:// protocol for dynamic import of local files.
          await import(`file://${pluginPath}?v=${Date.now()}`);
        } catch (e) {
          fs.unlinkSync(pluginPath);
          return await message.sendMessage(
            message.jid,
            "Invalid Plugin\n ```" + e + "```"
          );
        }

        await installPlugin(url.toString(), plugin_name); // Save original URL

        await message.sendMessage(
          message.jid,
          `_New plugin installed : ${plugin_name}_`
        );
      }
    } catch (error) {
      console.error(error);
      // Attempt to clean up if plugin file was written but failed later
      if (plugin_name && fs.existsSync(join(__dirname, plugin_name + ".js"))) {
         // fs.unlinkSync(join(__dirname, plugin_name + ".js")); // Decide if cleanup is needed here
      }
      return await message.sendMessage(message.jid, "Failed to fetch or install plugin. " + (error.message || ""));
    }
  }
);

command(
  { pattern: "plugin", fromMe: true, desc: "plugin list", type: "user" },
  async (message, match) => {
    var mesaj = "";
    var plugins = await PluginDB.findAll();
    if (plugins.length < 1) {
      return await message.sendMessage(
        message.jid,
        "_No external plugins installed_"
      );
    } else {
      plugins.map((plugin) => {
        mesaj +=
          "```" +
          plugin.dataValues.name +
          "```: " +
          plugin.dataValues.url +
          "\n";
      });
      return await message.sendMessage(message.jid, mesaj);
    }
  }
);

command(
  {
    pattern: "remove",
    fromMe: true,
    desc: "Remove external plugins",
    type: "user",
  },
  async (message, match) => {
    if (!match)
      return await message.sendMessage(message.jid, "_Need a plugin name_");

    var plugin = await PluginDB.findAll({ where: { name: match } });

    if (plugin.length < 1) {
      return await message.sendMessage(message.jid, "_Plugin not found_");
    } else {
      await plugin[0].destroy();
      const pluginPath = join(__dirname, match + ".js");
      
      // delete require.cache[require.resolve("./" + match + ".js")]; // This is CJS specific and won't work in ESM.
      // Removing the module from cache in ESM is complex. The plugin's commands would need to be deregistered manually by your command system.
      // The file is deleted, but the code might persist in memory for the current session.
      
      if (fs.existsSync(pluginPath)) {
        fs.unlinkSync(pluginPath);
      }
      await message.sendMessage(message.jid, `Plugin ${match} file deleted. Restart the bot for changes to fully take effect if commands are still active.`);
    }
  }
);

export default {};