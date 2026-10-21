// Parse each browser script individually; these files intentionally share global bindings.
const { readdirSync } = require("node:fs");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

const directory = join(__dirname, "..", "static");
for (const file of readdirSync(directory)
  .filter((name) => name.endsWith(".js"))
  .sort()) {
  const result = spawnSync(process.execPath, ["--check", join(directory, file)], {
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("Frontend syntax checks passed.");
