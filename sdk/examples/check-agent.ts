/**
 * Example: Check agent status using Whitewall OS SDK
 *
 * Run: npx tsx examples/check-agent.ts [agentId]
 *
 * The SDK reads policy config (registries, validators, required tier)
 * directly from the on-chain HumanVerifiedPolicy contract.
 * Zero hardcoded logic — if the protocol updates, the SDK follows.
 */
import { WhitewallOS } from "../src/index.js";

const wos = await WhitewallOS.connect({ chain: "baseSepolia" });

// Show what the SDK discovered from on-chain policy
const policy = wos.getPolicyConfig();
console.log("Policy config (read from chain):");
console.log(`  Identity Registry:    ${policy.identityRegistry}`);
console.log(`  Validation Registry:  ${policy.validationRegistry}`);
console.log(`  World ID Validator:   ${policy.worldIdValidator}`);
console.log(`  Required Tier:        ${policy.requiredTier}`);

const agentId = BigInt(process.argv[2] ?? "1");
console.log(`\nChecking agent #${agentId}...\n`);

const status = await wos.getAgentStatus(agentId);

if (!status.isRegistered) {
  console.log(`Agent #${agentId}: NOT REGISTERED`);
  process.exit(0);
}

console.log(`Agent #${agentId}:`);
console.log(`  Registered:      ${status.isRegistered}`);
console.log(`  Human Verified:  ${status.isHumanVerified}`);
console.log(`  Tier:            ${status.tier}`);
console.log(`  Owner:           ${status.owner}`);
console.log(`  Agent Wallet:    ${status.agentWallet}`);
console.log(`  Validations:     ${status.validationCount}`);
console.log();
