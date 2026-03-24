import "dotenv/config";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const proc = spawn("bun", ["run", "start"], {
  cwd: repoRoot,
  stdio: "inherit",
  env: process.env,
});
