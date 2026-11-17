// API server (2012) va Vite (2011) ni birga ishga tushiradi: `npm run dev:full`
import { spawn } from "node:child_process";

const run = (cmd, args) => spawn(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
const procs = [run("npm", ["run", "server"]), run("npm", ["run", "dev"])];
const stop = () => procs.forEach((p) => p.kill("SIGTERM"));
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
procs.forEach((p) => p.on("exit", (code) => code && stop()));
