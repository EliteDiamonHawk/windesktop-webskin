import { spawn } from "node:child_process";

const child = spawn(
  "dotnet",
  [
    "watch",
    "--project",
    "src/WebSkin.Backend/WebSkin.Backend.csproj",
    "run",
    "--",
    "--urls",
    "http://127.0.0.1:8000",
  ],
  {
    env: { ...process.env, WEBSKIN_DEV: "true" },
    stdio: "inherit",
  },
);

const forwardSignal = (signal) => child.kill(signal);
process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));

child.on("exit", (code, signal) => {
  process.exit(signal ? 1 : code ?? 1);
});
