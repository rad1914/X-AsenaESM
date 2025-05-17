import got from "got";
import Heroku from "heroku-client";
import { command, isPrivate } from "../../lib/index.js";
import Config from "../../config.js";
import { secondsToDHMS } from "../../lib/functions.js";
import { delay } from "baileys";
import { exec as cpExec } from "child_process"; // Aliased to cpExec

const heroku = Config.HEROKU_API_KEY ? new Heroku({ token: Config.HEROKU_API_KEY }) : null;
const baseURI = Config.HEROKU_APP_NAME ? "/apps/" + Config.HEROKU_APP_NAME : null;

command(
  {
    pattern: "restart",
    fromMe: true,
    type: "heroku",
    desc: "Restart Dyno",
    // type: "heroku", // Duplicate type property removed
  },
  async (message) => {
    await message.reply(`_Restarting_`);
    if (Config.HEROKU) {
      if (!Config.HEROKU_APP_NAME) { // Check HEROKU_APP_NAME presence
        return await message.reply("Add `HEROKU_APP_NAME` env variable");
      }
      if (!Config.HEROKU_API_KEY || !heroku) { // Check HEROKU_API_KEY presence and heroku client initialization
        return await message.reply("Add `HEROKU_API_KEY` env variable");
      }
      try {
        await heroku.delete(baseURI + "/dynos");
      } catch (error) {
        await message.reply(`HEROKU : ${error.body ? error.body.message : error.message}`);
      }
    } else {
      cpExec(`pm2 restart ${Config.PROCESSNAME}`, (error, stdout, stderr) => {
        if (error) {
          return message.sendMessage(message.jid, `Error: ${error.message}`);
        }
        // Restart command usually doesn't send a success message back, PM2 handles it.
        // return; // Removed as it might not be needed.
      });
    }
  }
);

command(
  {
    pattern: "shutdown",
    fromMe: true,
    type: "heroku",
    desc: "Dyno off",
    // type: "heroku", // Duplicate type property removed
  },
  async (message) => {
    if (Config.HEROKU) {
      if (!Config.HEROKU_APP_NAME) {
        return await message.reply("Add `HEROKU_APP_NAME` env variable");
      }
      if (!Config.HEROKU_API_KEY || !heroku) {
        return await message.reply("Add `HEROKU_API_KEY` env variable");
      }
      try {
        const formation = await heroku.get(baseURI + "/formation");
        if (formation && formation.length > 0) {
          await message.reply(`_Shutting down._`);
          await heroku.patch(baseURI + "/formation/" + formation[0].id, {
            body: {
              quantity: 0,
            },
          });
        } else {
          await message.reply(`_No dyno formation found to shutdown._`);
        }
      } catch (error) {
        await message.reply(`HEROKU : ${error.body ? error.body.message : error.message}`);
      }
    } else {
      await message.reply(`_Shutting down._`);
      await delay(1000).then(() => process.exit(0));
    }
  }
);

command(
  {
    pattern: "dyno",
    fromMe: true,
    desc: "Show Quota info",
    type: "heroku",
  },
  async (message) => {
    if (!Config.HEROKU)
      return await message.reply("You are not using Heroku as your server.");

    if (!Config.HEROKU_APP_NAME)
      return await message.reply("Add `HEROKU_APP_NAME` env variable");
    if (!Config.HEROKU_API_KEY || !heroku)
      return await message.reply("Add `HEROKU_API_KEY` env variable");

    try {
      const account = await heroku.get("/account");
      const url = `https://api.heroku.com/accounts/${account.id}/actions/get-quota`;
      const headers = {
        "User-Agent": "Chrome/80.0.3987.149 Mobile Safari/537.36",
        Authorization: "Bearer " + Config.HEROKU_API_KEY,
        Accept: "application/vnd.heroku+json; version=3.account-quotas",
      };
      const res = await got(url, { headers, responseType: 'json' }); // Specify responseType
      const resp = res.body; // got will parse JSON if responseType is 'json'
      
      const total_quota = Math.floor(resp.account_quota);
      const quota_used = Math.floor(resp.quota_used);
      const remaining = total_quota - quota_used;
      const quotaMsg = `Total Quota : ${secondsToDHMS(total_quota)}
Used  Quota : ${secondsToDHMS(quota_used)}
Remaning    : ${secondsToDHMS(remaining)}`;
      await message.reply("```" + quotaMsg + "```");
    } catch (error) {
      console.error("Dyno command error:", error);
      await message.reply(`Error fetching dyno info: ${error.body ? error.body.message : error.message}`);
    }
  }
);

export default {};