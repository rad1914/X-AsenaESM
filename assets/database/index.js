import Notes from "./notes.js";
import Plugins from "./plugins.js";
import Filters from "./filters.js";
import Greetings from "./greetings.js";
import PausedChats from "./PausedChat.js";
import WarnDB from './warn.js';
import Gemini from './gemini.js';
import Ban from './ban.js';
import OptionsToggle from './options.js';
import Store from './StoreDb.js';

const allModules = {
  Notes,
  Plugins,
  Filters,
  Greetings,
  PausedChats,
  WarnDB,
  Gemini,
  Ban,
  OptionsToggle,
  Store,
};

export default allModules;

export {
  Notes,
  Plugins,
  Filters,
  Greetings,
  PausedChats,
  WarnDB,
  Gemini,
  Ban,
  OptionsToggle,
  Store,
};
