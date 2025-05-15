import config from "../config.js";

const commands = [];

function command(commandInfo, func) {
  commandInfo.function = func;
  if (commandInfo.pattern) {
    commandInfo.pattern =
      new RegExp(
        `(${config.HANDLERS})( ?${commandInfo.pattern}(?=\\b|$))(.*)`,
        "is"
      ) || false;
  }
  commandInfo.dontAddCommandList = commandInfo.dontAddCommandList || false;
  commandInfo.fromMe = commandInfo.fromMe || false;
  commandInfo.type = commandInfo.type || "misc";

  commands.push(commandInfo);
  return commandInfo;
}

export {
  command,
  commands,
};

export default {
  command,
  commands,
};
