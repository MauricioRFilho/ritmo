import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";
const executable = isWindows ? "py" : "python3";
const prefix = isWindows ? ["-3"] : [];

function run(args, cwd = root) {
  const result = spawnSync(executable, [...prefix, ...args], {
    cwd, stdio: "inherit", shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run([
  "-m", "py_compile",
  "services/ai-gateway/app/main.py",
  "services/ai-gateway/app/worker.py",
  "services/ai-gateway/app/privacy_worker.py",
]);
run(
  ["-m", "unittest", "discover", "-s", "tests", "-p", "test_*.py"],
  resolve(root, "services/ai-gateway"),
);
