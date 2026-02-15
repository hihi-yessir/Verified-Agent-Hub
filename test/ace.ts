import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import {
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  toHex,
  type Hex,
  getAddress,
} from "viem";

/**
 * Whitewall OS ACE Pipeline Test
 *
 * Tests the full on-chain policy enforcement for ACCESS requests:
 *   Forwarder → onReport(metadata, report) → runPolicy → Extractor → Policy → execute
 *
 * Bonding is NOT tested here — it goes directly to ValidationRegistry.
 */
describe("Whitewall OS ACE Pipeline", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();

  const ON_REPORT_SELECTOR = "0x805f2132" as Hex; // bytes4(keccak256("onReport(bytes,bytes)"))

  // ── Helper: encode an ACCESS report ──
  function encodeReport(
    agentId: bigint,
    approved: boolean,
    tier: number,
    accountableHuman: Hex,
    reason: Hex = "0x0000000000000000000000000000000000000000000000000000000000000000"
  ): Hex {
    return encodeAbiParameters(
      [
        { type: "uint256" },
        { type: "bool" },
        { type: "uint8" },
        { type: "address" },
        { type: "bytes32" },
      ],
      [agentId, approved, tier, accountableHuman, reason]
    );
  }

  // ── Helper: deploy proxy ──
  async function deployProxy(artifactName: string, initData: Hex) {
    const impl = await viem.deployContract(artifactName);
    const proxy = await viem.deployContract("ERC1967Proxy", [impl.address, initData]);
    return await viem.getContractAt(artifactName, proxy.address);
  }

  // ── Setup: deploy everything ──
  async function setupFullStack() {
    const [deployer] = await viem.getWalletClients();
    const deployerAddress = deployer.account.address;

    // 1. Deploy IdentityRegistry
    const minimalImpl = await viem.deployContract("HardhatMinimalUUPS");
    const minimalInitCalldata = encodeFunctionData({
      abi: [{ name: "initialize", type: "function", inputs: [{ name: "addr", type: "address" }], outputs: [], stateMutability: "nonpayable" }],
      functionName: "initialize",
      args: ["0x0000000000000000000000000000000000000000"],
    });
    const identityProxy = await viem.deployContract("ERC1967Proxy", [minimalImpl.address, minimalInitCalldata]);
    const identityMinimal = await viem.getContractAt("HardhatMinimalUUPS", identityProxy.address);
    const identityImpl = await viem.deployContract("IdentityRegistryUpgradeable");
    await identityMinimal.write.upgradeToAndCall([identityImpl.address, "0x8129fc1c"]);
    const identityRegistry = await viem.getContractAt("IdentityRegistryUpgradeable", identityProxy.address);

    // 2. Deploy ValidationRegistry
    const valMinimalImpl = await viem.deployContract("HardhatMinimalUUPS");
    const valProxy = await viem.deployContract("ERC1967Proxy", [valMinimalImpl.address, minimalInitCalldata]);
    const valMinimal = await viem.getContractAt("HardhatMinimalUUPS", valProxy.address);
    const valImpl = await viem.deployContract("ValidationRegistryUpgradeable");
    const valInitData = encodeFunctionData({
      abi: [{ name: "initialize", type: "function", inputs: [{ name: "identityRegistry_", type: "address" }], outputs: [], stateMutability: "nonpayable" }],
      functionName: "initialize",
      args: [identityRegistry.address],
    });
    await valMinimal.write.upgradeToAndCall([valImpl.address, valInitData]);
    const validationRegistry = await viem.getContractAt("ValidationRegistryUpgradeable", valProxy.address);

    // 3. Register an agent
    const registerHash = await identityRegistry.write.register();
    const registerReceipt = await publicClient.getTransactionReceipt({ hash: registerHash });
    const registeredLog = registerReceipt.logs.find(
      (log) => log.topics[0] === keccak256(toHex("Registered(uint256,string,address)"))
    );
    const agentId = BigInt(registeredLog!.topics[1]!);

    // 4. Create HUMAN_VERIFIED validation (deployer = mock WorldIDValidator)
    const mockValidatorAddress = deployerAddress;
    const requestHash = keccak256(toHex("test-world-id-verification"));
    await validationRegistry.write.validationRequest([
      mockValidatorAddress, agentId, "ipfs://test-request", requestHash,
    ]);
    await validationRegistry.write.validationResponse([
      requestHash, 100, "ipfs://test-response", keccak256(toHex("response-data")), "HUMAN_VERIFIED",
    ]);

    // 5. Deploy PolicyEngine
    const policyEngineInitData = encodeFunctionData({
      abi: [{ name: "initialize", type: "function", inputs: [{ name: "defaultAllow", type: "bool" }, { name: "initialOwner", type: "address" }], outputs: [], stateMutability: "nonpayable" }],
      functionName: "initialize",
      args: [false, deployerAddress],
    });
    const policyEngine = await deployProxy("PolicyEngine", policyEngineInitData);

    // 6. Deploy WhitewallExtractor
    const extractor = await viem.deployContract("WhitewallExtractor");

    // 7. Deploy HumanVerifiedPolicy
    const policyConfigParams = encodeAbiParameters(
      [{ type: "address" }, { type: "address" }, { type: "address" }, { type: "uint8" }],
      [identityRegistry.address, validationRegistry.address, mockValidatorAddress, 2]
    );
    const policyInitData = encodeFunctionData({
      abi: [{ name: "initialize", type: "function", inputs: [{ name: "policyEngine", type: "address" }, { name: "initialOwner", type: "address" }, { name: "configParams", type: "bytes" }], outputs: [], stateMutability: "nonpayable" }],
      functionName: "initialize",
      args: [policyEngine.address, deployerAddress, policyConfigParams],
    });
    const policy = await deployProxy("HumanVerifiedPolicy", policyInitData);

    // 8. Deploy WhitewallConsumer (forwarder = deployer for testing)
    const consumerInitData = encodeFunctionData({
      abi: [{ name: "initialize", type: "function", inputs: [{ name: "initialOwner", type: "address" }, { name: "policyEngine", type: "address" }, { name: "forwarder", type: "address" }], outputs: [], stateMutability: "nonpayable" }],
      functionName: "initialize",
      args: [deployerAddress, policyEngine.address, deployerAddress],
    });
    const consumer = await deployProxy("WhitewallConsumer", consumerInitData);

    // 9. Wire: setExtractor + addPolicy
    await policyEngine.write.setExtractor([ON_REPORT_SELECTOR, extractor.address]);
    const policyParamNames: Hex[] = [
      keccak256(toHex("agentId")),
      keccak256(toHex("approved")),
      keccak256(toHex("tier")),
      keccak256(toHex("accountableHuman")),
    ];
    await policyEngine.write.addPolicy([
      consumer.address, ON_REPORT_SELECTOR, policy.address, policyParamNames,
    ]);

    return {
      identityRegistry, validationRegistry, policyEngine,
      extractor, policy, consumer, deployerAddress, agentId,
    };
  }

  // ══════════════════════════════════════════════════════
  const stack = await setupFullStack();
  // ══════════════════════════════════════════════════════

  it("ACCESS: verified agent → AccessGranted", async () => {
    const report = encodeReport(stack.agentId, true, 2, stack.deployerAddress as Hex);
    const hash = await stack.consumer.write.onReport(["0x" as Hex, report]);
    const receipt = await publicClient.getTransactionReceipt({ hash });

    const accessGrantedTopic = keccak256(toHex("AccessGranted(uint256,address,uint8)"));
    const log = receipt.logs.find((l) => l.topics[0] === accessGrantedTopic);
    assert.ok(log, "AccessGranted event should be emitted");
    assert.equal(BigInt(log.topics[1]!), stack.agentId);
  });

  it("ACCESS: approved=false → PolicyRejected", async () => {
    const report = encodeReport(stack.agentId, false, 2, stack.deployerAddress as Hex);
    await assert.rejects(
      stack.consumer.write.onReport(["0x" as Hex, report]),
      /CRE: agent not approved/,
    );
  });

  it("ACCESS: insufficient tier → PolicyRejected", async () => {
    const report = encodeReport(stack.agentId, true, 1, stack.deployerAddress as Hex);
    await assert.rejects(
      stack.consumer.write.onReport(["0x" as Hex, report]),
      /Insufficient verification tier/,
    );
  });

  it("forwarder check: correct forwarder is set", async () => {
    const forwarder = await stack.consumer.read.getForwarder();
    assert.equal(getAddress(forwarder), getAddress(stack.deployerAddress));
  });

  it("wiring: PolicyEngine has correct extractor + policy", async () => {
    const policies = await stack.policyEngine.read.getPolicies([
      stack.consumer.address, ON_REPORT_SELECTOR,
    ]);
    assert.equal(policies.length, 1);
    assert.equal(getAddress(policies[0]), getAddress(stack.policy.address));

    const extractorAddr = await stack.policyEngine.read.getExtractor([ON_REPORT_SELECTOR]);
    assert.equal(getAddress(extractorAddr), getAddress(stack.extractor.address));
  });

  it("double protection: policy reads on-chain registries", async () => {
    assert.equal(await stack.policy.read.getRequiredTier(), 2);
    assert.equal(
      getAddress(await stack.policy.read.getIdentityRegistry()),
      getAddress(stack.identityRegistry.address),
    );
    assert.equal(
      getAddress(await stack.policy.read.getValidationRegistry()),
      getAddress(stack.validationRegistry.address),
    );
  });

  // ══════════════════════════════════════════════════════
  // Critical: Double protection — on-chain catches what CRE misses
  // ══════════════════════════════════════════════════════

  it("DOUBLE PROTECTION: CRE compromised — registered but unverified agent → on-chain rejects", async () => {
    // Register a NEW agent but do NOT create HUMAN_VERIFIED validation
    const registerHash = await stack.identityRegistry.write.register();
    const receipt = await publicClient.getTransactionReceipt({ hash: registerHash });
    const registeredLog = receipt.logs.find(
      (log) => log.topics[0] === keccak256(toHex("Registered(uint256,string,address)"))
    );
    const unverifiedAgentId = BigInt(registeredLog!.topics[1]!);

    // CRE is compromised: sends approved=true, tier=2 for an unverified agent
    const fakeReport = encodeReport(unverifiedAgentId, true, 2, stack.deployerAddress as Hex);
    await assert.rejects(
      stack.consumer.write.onReport(["0x" as Hex, fakeReport]),
      /No human verification bond on-chain/,
    );
  });

  it("DOUBLE PROTECTION: CRE compromised — unregistered agent → on-chain rejects", async () => {
    // Use a non-existent agentId — never registered in IdentityRegistry
    const fakeAgentId = 999999n;

    // CRE is compromised: sends approved=true, tier=2 for a non-existent agent
    const fakeReport = encodeReport(fakeAgentId, true, 2, stack.deployerAddress as Hex);
    await assert.rejects(
      stack.consumer.write.onReport(["0x" as Hex, fakeReport]),
      /Agent not registered/,
    );
  });
});
