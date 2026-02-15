import hre from "hardhat";
import {
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  toHex,
  type Hex,
} from "viem";
import dotenv from "dotenv";

dotenv.config();

/**
 * Deploy Whitewall OS ACE stack:
 *   1. PolicyEngine (proxy)
 *   2. WhitewallExtractor (no proxy — stateless)
 *   3. HumanVerifiedPolicy (proxy)
 *   4. WhitewallConsumer (proxy)
 *   5. Wire: setExtractor + addPolicy
 *
 * Required env vars:
 *   IDENTITY_REGISTRY_ADDRESS
 *   VALIDATION_REGISTRY_ADDRESS
 *   WORLD_ID_VALIDATOR_ADDRESS
 *   FORWARDER_ADDRESS (CRE Forwarder — can be placeholder for now)
 */

// Existing registry addresses (deployed in previous phase)
const IDENTITY_REGISTRY = (process.env.IDENTITY_REGISTRY_ADDRESS ?? "0x8004A818BFB912233c491871b3d84c89A494BD9e") as Hex;
const VALIDATION_REGISTRY = (process.env.VALIDATION_REGISTRY_ADDRESS ?? "0x8004Cb1BF31DAf7788923b405b754f57acEB4272") as Hex;
const WORLD_ID_VALIDATOR = (process.env.WORLD_ID_VALIDATOR_ADDRESS ?? "0x0000000000000000000000000000000000000000") as Hex;
// CRE Forwarder address — Person B will provide after CRE deployment
const FORWARDER = (process.env.FORWARDER_ADDRESS ?? "0x0000000000000000000000000000000000000001") as Hex;

// HumanVerifiedPolicy config
const REQUIRED_TIER = 2; // Must be HUMAN_VERIFIED (tier 2)

// onReport selector: bytes4(keccak256("onReport(bytes,bytes)"))
const ON_REPORT_SELECTOR = "0x805f2132" as Hex;

async function main() {
  const { viem } = await hre.network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer] = await viem.getWalletClients();
  const deployerAddress = deployer.account.address;

  console.log(`\nDeployer: ${deployerAddress}`);
  console.log(`Identity Registry: ${IDENTITY_REGISTRY}`);
  console.log(`Validation Registry: ${VALIDATION_REGISTRY}`);
  console.log(`World ID Validator: ${WORLD_ID_VALIDATOR}`);
  console.log(`Forwarder: ${FORWARDER}\n`);

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  // ── Helper: deploy proxy (same pattern as test/ace.ts) ──
  async function deployProxy(artifactName: string, initData: Hex) {
    const impl = await viem.deployContract(artifactName);
    console.log(`  ${artifactName} impl: ${impl.address}`);
    await sleep(5000); // wait for RPC rate limit
    const proxy = await viem.deployContract("ERC1967Proxy", [impl.address, initData]);
    console.log(`  ${artifactName} proxy: ${proxy.address}`);
    await sleep(5000);
    return { proxy: proxy.address, impl: impl.address };
  }

  // ── 1. PolicyEngine ──
  console.log("1. Deploying PolicyEngine...");
  const policyEngineInitData = encodeFunctionData({
    abi: [{ name: "initialize", type: "function", inputs: [{ name: "defaultAllow", type: "bool" }, { name: "initialOwner", type: "address" }], outputs: [], stateMutability: "nonpayable" }],
    functionName: "initialize",
    args: [false, deployerAddress],
  });
  const policyEngine = await deployProxy("PolicyEngine", policyEngineInitData);

  // ── 2. WhitewallExtractor ──
  console.log("\n2. Deploying WhitewallExtractor...");
  const extractor = await viem.deployContract("WhitewallExtractor");
  console.log(`  WhitewallExtractor: ${extractor.address}`);
  await sleep(5000);

  // ── 3. HumanVerifiedPolicy ──
  console.log("\n3. Deploying HumanVerifiedPolicy...");
  const policyConfigParams = encodeAbiParameters(
    [{ type: "address" }, { type: "address" }, { type: "address" }, { type: "uint8" }],
    [IDENTITY_REGISTRY, VALIDATION_REGISTRY, WORLD_ID_VALIDATOR, REQUIRED_TIER]
  );
  const policyInitData = encodeFunctionData({
    abi: [{ name: "initialize", type: "function", inputs: [{ name: "policyEngine", type: "address" }, { name: "initialOwner", type: "address" }, { name: "configParams", type: "bytes" }], outputs: [], stateMutability: "nonpayable" }],
    functionName: "initialize",
    args: [policyEngine.proxy, deployerAddress, policyConfigParams],
  });
  const policy = await deployProxy("HumanVerifiedPolicy", policyInitData);

  // ── 4. WhitewallConsumer ──
  console.log("\n4. Deploying WhitewallConsumer...");
  const consumerInitData = encodeFunctionData({
    abi: [{ name: "initialize", type: "function", inputs: [{ name: "initialOwner", type: "address" }, { name: "policyEngine", type: "address" }, { name: "forwarder", type: "address" }], outputs: [], stateMutability: "nonpayable" }],
    functionName: "initialize",
    args: [deployerAddress, policyEngine.proxy, FORWARDER],
  });
  const consumer = await deployProxy("WhitewallConsumer", consumerInitData);

  // ── 5. Wire: setExtractor + addPolicy ──
  console.log("\n5. Wiring PolicyEngine...");
  const policyEngineContract = await viem.getContractAt("PolicyEngine", policyEngine.proxy as Hex);

  // 5a. Set extractor for onReport selector
  console.log("  Setting extractor for onReport...");
  await policyEngineContract.write.setExtractor([ON_REPORT_SELECTOR, extractor.address]);
  await sleep(5000);

  // 5b. Add HumanVerifiedPolicy for consumer's onReport
  const policyParamNames: Hex[] = [
    keccak256(toHex("agentId")),
    keccak256(toHex("approved")),
    keccak256(toHex("tier")),
    keccak256(toHex("accountableHuman")),
  ];

  console.log("  Adding HumanVerifiedPolicy to consumer's onReport...");
  await policyEngineContract.write.addPolicy([
    consumer.proxy, ON_REPORT_SELECTOR, policy.proxy, policyParamNames,
  ]);

  // ── Summary ──
  console.log("\n" + "=".repeat(60));
  console.log("Whitewall OS ACE Stack Deployed Successfully!");
  console.log("=".repeat(60));
  console.log(`PolicyEngine:         ${policyEngine.proxy}`);
  console.log(`WhitewallExtractor:   ${extractor.address}`);
  console.log(`HumanVerifiedPolicy:  ${policy.proxy}`);
  console.log(`WhitewallConsumer:    ${consumer.proxy}`);
  console.log("=".repeat(60));
  console.log(`\nForwarder (placeholder): ${FORWARDER}`);
  console.log("→ Update with real CRE Forwarder address after Person B deploys CRE workflow");
  console.log(`→ Call: WhitewallConsumer.setForwarder(realForwarderAddress)`);

  // ── B한테 전달할 정보 ──
  console.log("\n── Person B에게 전달 ──");
  console.log(`Consumer address (WriteReport target): ${consumer.proxy}`);
  console.log(`onReport selector: ${ON_REPORT_SELECTOR}`);
  console.log("Report ABI: abi.encode(uint256 agentId, bool approved, uint8 tier, address accountableHuman, bytes32 reason)");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
