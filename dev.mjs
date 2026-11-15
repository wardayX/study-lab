
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const isWindows = process.platform === "win32";
const npm = isWindows ? "npm.cmd" : "npm";

const processes = [
  spawn(npm, ["run", "server"], {
    cwd: root,
    stdio: "inherit",
    shell: isWindows,
  }),
  spawn(npm, ["exec", "--", "vite", "--host", "0.0.0.0"], {
    cwd: root,
    stdio: "inherit",
    shell: isWindows,
  }),
];

function shutdown() {
  for (const child of processes) {
    if (!child.killed) child.kill();
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

for (const child of processes) {
  child.on("error", (error) => {
    console.error("Failed to start a process:", error);
    shutdown();
    process.exitCode = 1;
  });

  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`A process exited with code ${code}`);
      shutdown();
      process.exitCode = code;
    }
  });
}
