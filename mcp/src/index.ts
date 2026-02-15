#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { WhitewallOS, type AgentStatus } from "@whitewall-os/sdk";

const CHAIN = "baseSepolia" as const;

let wos: WhitewallOS;

function formatStatus(agentId: string, status: AgentStatus): string {
  if (!status.isRegistered) {
    return `Agent #${agentId}: NOT REGISTERED\nThis agent does not exist in the Whitewall OS protocol.`;
  }

  return [
    `Agent #${agentId}:`,
    `  Registered:      ${status.isRegistered}`,
    `  Human Verified:  ${status.isHumanVerified}`,
    `  Tier:            ${status.tier}`,
    `  Owner:           ${status.owner}`,
    `  Agent Wallet:    ${status.agentWallet}`,
    `  Validations:     ${status.validationCount}`,
  ].join("\n");
}

const server = new McpServer({
  name: "whitewall-os",
  version: "0.1.0",
});

// ─── Tool: check agent ───
server.registerTool(
  "whitewall_os_check_agent",
  {
    title: "Check Whitewall OS Agent",
    description:
      "Quick check: is this agent registered and human-verified in Whitewall OS? " +
      "Returns whether the agent has a verified human behind it.",
    inputSchema: z.object({
      agentId: z
        .string()
        .describe("The agent's numeric ID in the Whitewall OS IdentityRegistry"),
    }),
  },
  async ({ agentId }) => {
    const id = BigInt(agentId);
    const [registered, verified] = await Promise.all([
      wos.isRegistered(id),
      wos.isHumanVerified(id),
    ]);

    const text = registered
      ? verified
        ? `Agent #${agentId} is VERIFIED — a real human is accountable for this agent.`
        : `Agent #${agentId} is registered but NOT human-verified. No accountability bond.`
      : `Agent #${agentId} does NOT exist in Whitewall OS.`;

    return { content: [{ type: "text" as const, text }] };
  },
);

// ─── Tool: get full status ───
server.registerTool(
  "whitewall_os_get_status",
  {
    title: "Get Whitewall OS Agent Status",
    description:
      "Get full verification status for a Whitewall OS agent: registration, " +
      "human verification, tier, owner, wallet, and validation count.",
    inputSchema: z.object({
      agentId: z
        .string()
        .describe("The agent's numeric ID in the Whitewall OS IdentityRegistry"),
    }),
  },
  async ({ agentId }) => {
    const status = await wos.getAgentStatus(BigInt(agentId));
    return { content: [{ type: "text" as const, text: formatStatus(agentId, status) }] };
  },
);

// ─── Tool: get policy config ───
server.registerTool(
  "whitewall_os_get_policy",
  {
    title: "Get Whitewall OS Policy Config",
    description:
      "Read the current Whitewall OS protocol policy configuration from chain: " +
      "registry addresses, accepted validators, and required verification tier.",
    inputSchema: z.object({}),
  },
  async () => {
    const config = wos.getPolicyConfig();
    const text = [
      "Whitewall OS Policy Config (read from on-chain HumanVerifiedPolicy):",
      `  Identity Registry:    ${config.identityRegistry}`,
      `  Validation Registry:  ${config.validationRegistry}`,
      `  World ID Validator:   ${config.worldIdValidator}`,
      `  Required Tier:        ${config.requiredTier}`,
      `  Chain:                Base Sepolia (84532)`,
    ].join("\n");

    return { content: [{ type: "text" as const, text }] };
  },
);

// ─── Start ───
async function main() {
  wos = await WhitewallOS.connect({ chain: CHAIN });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Failed to start Whitewall OS MCP server:", err);
  process.exit(1);
});
