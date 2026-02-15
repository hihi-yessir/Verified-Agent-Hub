/**
 * Test the Whitewall OS MCP server by spawning it as a subprocess
 * and sending JSON-RPC messages over stdio.
 */
import { spawn } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = resolve(__dirname, "dist/index.js");

const child = spawn("node", [serverPath], {
  stdio: ["pipe", "pipe", "pipe"],
});

let buffer = "";

child.stdout.on("data", (data: Buffer) => {
  buffer += data.toString();
  // Parse newline-delimited JSON responses
  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";
  for (const line of lines) {
    if (line.trim()) {
      try {
        const msg = JSON.parse(line);
        console.log(`\n── Response (id=${msg.id ?? "notification"}) ──`);
        console.log(JSON.stringify(msg, null, 2));
      } catch {
        console.log("RAW:", line);
      }
    }
  }
});

child.stderr.on("data", (data: Buffer) => {
  console.error("STDERR:", data.toString());
});

function send(msg: object) {
  child.stdin.write(JSON.stringify(msg) + "\n");
}

// Sequence of messages
async function run() {
  // 1. Initialize
  send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "whitewall-os-test", version: "1.0.0" },
    },
  });

  await sleep(3000); // wait for connect + init

  // 2. Initialized notification
  send({ jsonrpc: "2.0", method: "notifications/initialized" });

  await sleep(1000);

  // 3. List tools
  send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  await sleep(1000);

  // 4. Check agent #1 (exists)
  console.log("\n====== Testing whitewall_os_check_agent (agent #1) ======");
  send({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "whitewall_os_check_agent", arguments: { agentId: "1" } },
  });
  await sleep(3000);

  // 5. Check agent #999999 (doesn't exist)
  console.log("\n====== Testing whitewall_os_check_agent (agent #999999) ======");
  send({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: { name: "whitewall_os_check_agent", arguments: { agentId: "999999" } },
  });
  await sleep(3000);

  // 6. Full status
  console.log("\n====== Testing whitewall_os_get_status (agent #1) ======");
  send({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: { name: "whitewall_os_get_status", arguments: { agentId: "1" } },
  });
  await sleep(3000);

  // 7. Policy config
  console.log("\n====== Testing whitewall_os_get_policy ======");
  send({
    jsonrpc: "2.0",
    id: 6,
    method: "tools/call",
    params: { name: "whitewall_os_get_policy", arguments: {} },
  });
  await sleep(3000);

  // Done
  console.log("\n====== All tests sent. Shutting down. ======");
  child.kill();
  process.exit(0);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

run();
