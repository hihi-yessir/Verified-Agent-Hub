import { describe, it, expect, vi, beforeEach } from "vitest";
import { WhitewallOS } from "../src/client.js";
import { addresses } from "../src/addresses.js";
import { zeroAddress, type PublicClient } from "viem";

// Known addresses that the mock policy contract will return
const MOCK_POLICY_CONFIG = {
  identityRegistry: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" as const,
  validationRegistry: "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" as const,
  worldIdValidator: "0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC" as const,
  requiredTier: 2,
};

function createMockClient() {
  const mock = {
    readContract: vi.fn(),
    watchEvent: vi.fn(() => vi.fn()),
  } as unknown as PublicClient<any, any>;

  // Default: loadPolicyConfig reads from HumanVerifiedPolicy
  (mock.readContract as any).mockImplementation(({ functionName }: any) => {
    switch (functionName) {
      case "getIdentityRegistry": return MOCK_POLICY_CONFIG.identityRegistry;
      case "getValidationRegistry": return MOCK_POLICY_CONFIG.validationRegistry;
      case "getWorldIdValidator": return MOCK_POLICY_CONFIG.worldIdValidator;
      case "getRequiredTier": return MOCK_POLICY_CONFIG.requiredTier;
      default: throw new Error(`unexpected call during connect: ${functionName}`);
    }
  });

  return mock;
}

describe("WhitewallOS — unit tests", () => {
  const chain = "baseSepolia" as const;
  const addrs = addresses[chain];

  describe("connect", () => {
    it("reads policy config from on-chain HumanVerifiedPolicy", async () => {
      const mock = createMockClient();
      const wos = await WhitewallOS.connect({ chain, publicClient: mock });

      const config = wos.getPolicyConfig();
      expect(config.identityRegistry).toBe(MOCK_POLICY_CONFIG.identityRegistry);
      expect(config.validationRegistry).toBe(MOCK_POLICY_CONFIG.validationRegistry);
      expect(config.worldIdValidator).toBe(MOCK_POLICY_CONFIG.worldIdValidator);
      expect(config.requiredTier).toBe(2);

      // Should have called readContract 4 times (one per policy getter)
      expect(mock.readContract).toHaveBeenCalledTimes(4);
      for (const call of (mock.readContract as any).mock.calls) {
        expect(call[0].address).toBe(addrs.humanVerifiedPolicy);
      }
    });
  });

  describe("isRegistered", () => {
    it("returns true when ownerOf succeeds", async () => {
      const mock = createMockClient();
      const wos = await WhitewallOS.connect({ chain, publicClient: mock });

      // Reset mock after connect, set up for isRegistered
      (mock.readContract as any).mockResolvedValue("0x1234567890abcdef1234567890abcdef12345678");
      const result = await wos.isRegistered(1n);

      expect(result).toBe(true);
      expect(mock.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: MOCK_POLICY_CONFIG.identityRegistry,
          functionName: "ownerOf",
          args: [1n],
        }),
      );
    });

    it("returns false when ownerOf returns zero address", async () => {
      const mock = createMockClient();
      const wos = await WhitewallOS.connect({ chain, publicClient: mock });

      (mock.readContract as any).mockResolvedValue(zeroAddress);
      expect(await wos.isRegistered(1n)).toBe(false);
    });

    it("returns false when ownerOf reverts (non-existent token)", async () => {
      const mock = createMockClient();
      const wos = await WhitewallOS.connect({ chain, publicClient: mock });

      (mock.readContract as any).mockRejectedValue(new Error("ERC721: invalid token ID"));
      expect(await wos.isRegistered(999n)).toBe(false);
    });
  });

  describe("isHumanVerified", () => {
    it("returns true when count > 0 and avgScore >= requiredTier", async () => {
      const mock = createMockClient();
      const wos = await WhitewallOS.connect({ chain, publicClient: mock });

      (mock.readContract as any).mockResolvedValue([1n, 2]); // count=1, avgScore=2 (meets tier 2)
      expect(await wos.isHumanVerified(1n)).toBe(true);
    });

    it("returns false when avgScore < requiredTier", async () => {
      const mock = createMockClient();
      const wos = await WhitewallOS.connect({ chain, publicClient: mock });

      (mock.readContract as any).mockResolvedValue([1n, 1]); // count=1 but avgScore=1 < tier 2
      expect(await wos.isHumanVerified(1n)).toBe(false);
    });

    it("returns false when count is 0", async () => {
      const mock = createMockClient();
      const wos = await WhitewallOS.connect({ chain, publicClient: mock });

      (mock.readContract as any).mockResolvedValue([0n, 0]);
      expect(await wos.isHumanVerified(1n)).toBe(false);
    });
  });

  describe("getAgentStatus", () => {
    it("returns full status for registered + verified agent", async () => {
      const mock = createMockClient();
      const wos = await WhitewallOS.connect({ chain, publicClient: mock });

      const owner = "0x1111111111111111111111111111111111111111";
      const wallet = "0x2222222222222222222222222222222222222222";

      (mock.readContract as any).mockImplementation(({ functionName }: any) => {
        switch (functionName) {
          case "ownerOf": return owner;
          case "getAgentWallet": return wallet;
          case "getSummary": return [1n, 2]; // meets requiredTier=2
          default: throw new Error(`unexpected: ${functionName}`);
        }
      });

      const status = await wos.getAgentStatus(42n);

      expect(status.isRegistered).toBe(true);
      expect(status.isHumanVerified).toBe(true);
      expect(status.tier).toBe(2); // matches requiredTier from policy
      expect(status.owner).toBe(owner);
      expect(status.agentWallet).toBe(wallet);
      expect(status.validationCount).toBe(1n);
    });

    it("returns empty status for non-existent agent", async () => {
      const mock = createMockClient();
      const wos = await WhitewallOS.connect({ chain, publicClient: mock });

      (mock.readContract as any).mockRejectedValue(new Error("ERC721: invalid token ID"));

      const status = await wos.getAgentStatus(999n);
      expect(status.isRegistered).toBe(false);
      expect(status.isHumanVerified).toBe(false);
      expect(status.tier).toBe(0);
      expect(status.owner).toBe(zeroAddress);
    });

    it("returns tier 1 for registered but unverified agent", async () => {
      const mock = createMockClient();
      const wos = await WhitewallOS.connect({ chain, publicClient: mock });

      const owner = "0x1111111111111111111111111111111111111111";

      (mock.readContract as any).mockImplementation(({ functionName }: any) => {
        switch (functionName) {
          case "ownerOf": return owner;
          case "getAgentWallet": return zeroAddress;
          case "getSummary": return [0n, 0]; // no validations
          default: throw new Error(`unexpected: ${functionName}`);
        }
      });

      const status = await wos.getAgentStatus(1n);
      expect(status.isRegistered).toBe(true);
      expect(status.isHumanVerified).toBe(false);
      expect(status.tier).toBe(1);
    });
  });

  describe("getValidationSummary", () => {
    it("uses worldIdValidator from policy config, not hardcoded", async () => {
      const mock = createMockClient();
      const wos = await WhitewallOS.connect({ chain, publicClient: mock });

      (mock.readContract as any).mockResolvedValue([3n, 2]);

      await wos.getValidationSummary(42n);

      // Find the getSummary call (after the 4 connect calls)
      const getSummaryCall = (mock.readContract as any).mock.calls.find(
        (call: any) => call[0].functionName === "getSummary",
      );
      expect(getSummaryCall).toBeDefined();
      expect(getSummaryCall[0].address).toBe(MOCK_POLICY_CONFIG.validationRegistry);
      expect(getSummaryCall[0].args[1]).toEqual([MOCK_POLICY_CONFIG.worldIdValidator]);
    });
  });

  describe("event watchers", () => {
    it("onAccessGranted watches consumer address", async () => {
      const mock = createMockClient();
      const wos = await WhitewallOS.connect({ chain, publicClient: mock });
      wos.onAccessGranted(() => {});

      expect(mock.watchEvent).toHaveBeenCalledWith(
        expect.objectContaining({ address: addrs.whitewallConsumer }),
      );
    });

    it("onRegistered watches identity registry from policy config", async () => {
      const mock = createMockClient();
      const wos = await WhitewallOS.connect({ chain, publicClient: mock });
      wos.onRegistered(() => {});

      expect(mock.watchEvent).toHaveBeenCalledWith(
        expect.objectContaining({ address: MOCK_POLICY_CONFIG.identityRegistry }),
      );
    });

    it("onAccessGranted returns unwatch function", async () => {
      const unwatch = vi.fn();
      const mock = createMockClient();
      (mock.watchEvent as any).mockReturnValue(unwatch);
      const wos = await WhitewallOS.connect({ chain, publicClient: mock });
      const result = wos.onAccessGranted(() => {});
      expect(result).toBe(unwatch);
    });
  });
});
