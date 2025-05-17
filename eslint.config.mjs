import globals from "globals";
import pluginJs from "@eslint/js";
// The import `import { rules } from "@eslint/js/src/configs/eslint-all";` from the original
// is non-standard for flat config and likely problematic.
// `pluginJs.configs.all` would provide all core rules if needed.

export default [
  { files: ["**/*.js"], languageOptions: { sourceType: "module" } }, // Changed commonjs to module
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  // The original config had `rules["no-unused-vars"]` as a standalone item here.
  // This is not valid flat config syntax.
  // `pluginJs.configs.recommended` already enables "no-unused-vars" (typically as an error).
  // If you need to customize it, add a configuration object like:
  // { rules: { "no-unused-vars": "warn" } } // Example to change severity
];