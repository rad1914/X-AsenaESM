import { getFilter, setFilter, deleteFilter } from "../database/filters.js";
import { command } from "../../lib/index.js"; // Assuming lib is lib/index.js, or use ../../lib/index.js if lib is a directory

command(
  {
    pattern: "filter",
    fromMe: true,
    desc: "Adds a filter. When someone triggers the filter, it sends the corresponding response. To view your filter list, use `.filter`.",
    usage: ".filter keyword:message",
    type: "group",
  },
  async (message, match) => {
    let text, msg;
    try {
      // Ensure match is a string before splitting
      if (typeof match === 'string') {
        [text, msg] = match.split(":");
      }
    } catch (e) {
      // Optional: log error or handle cases where split might fail unexpectedly
      console.error("Error splitting filter match:", e);
    }

    if (!match) {
      const filtreler = await getFilter(message.jid); // Declared filtreler
      if (filtreler === false || filtreler.length === 0) { // Added length check for robustness
        await message.reply("No filters are currently set in this chat.");
      } else {
        let mesaj = "Your active filters for this chat:" + "\n\n"; // Used let instead of var
        filtreler.map(
          (filter) => (mesaj += `✒ ${filter.dataValues.pattern}\n`)
        );
        mesaj += "\nuse : .filter keyword:message\nto set a filter";
        await message.reply(mesaj);
      }
    } else if (!text || !msg) {
      return await message.reply(
        "```use : .filter keyword:message\nto set a filter```"
      );
    } else {
      await setFilter(message.jid, text, msg, true);
      return await message.reply(`_Successfully set filter for ${text}_`);
    }
  }
);

command(
  {
    pattern: "stop",
    fromMe: true,
    desc: "Stops a previously added filter.",
    usage: '.stop "hello"',
    type: "group",
  },
  async (message, match) => {
    if (!match) return await message.reply("\n*Example:* ```.stop hello```");

    const del = await deleteFilter(message.jid, match); // Declared del
    
    if (!del) {
      // It's conventional to inform deletion status first, then if it didn't exist.
      await message.reply("No existing filter matches the provided input to delete.");
    } else {
      await message.reply(`_Filter ${match} deleted_`);
    }
  }
);

command(
  { on: "text", fromMe: false, dontAddCommandList: true },
  async (message, match) => {
    // Ensure match is a string, as regex operations need it
    if (typeof match !== 'string') return;

    const filtreler = await getFilter(message.jid); // Used const instead of var
    if (!filtreler || filtreler.length === 0) return; // Added length check

    for (const filter of filtreler) { // Using for...of for cleaner async iteration if needed, though map is fine here
      const patternString = filter.dataValues.regex
        ? filter.dataValues.pattern
        : `\\b(${filter.dataValues.pattern})\\b`;
      const pattern = new RegExp(patternString, "gm"); // Declared pattern

      if (pattern.test(match)) {
        // Using return here will stop checking other filters once one matches and replies.
        // If multiple replies are desired for multiple matches, remove the 'return'.
        return await message.reply(filter.dataValues.text, {
          quoted: message,
        });
      }
    }
  }
);

// Add a default export as requested.
// If this module doesn't have a primary export, an empty object is common.
export default {};
