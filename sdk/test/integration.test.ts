import { describe, it, expect, beforeAll } from "vitest";
import { WhitewallOS } from "../src/client.js";
import { zeroAddress } from "viem";

/**
 * Integration tests — reads from live Base Sepolia.
 *
 * The SDK connects to HumanVerifiedPolicy first,
 * reads registry addresses + required tier from chain,
 * then uses those to query agent status.
 *
 * Run: npx vitest run test/integration.test.ts
 */
describe("WhitewallOS — Base Sepolia integration", () => {
  let wos: WhitewallOS;

  const EXISTING_AGENT = 1n;
  const NON_EXISTENT_AGENT = 999999n;

  beforeAll(async () => {
    wos = await WhitewallOS.connect({ chain: "baseSepolia" });
  }, 15_000);

  describe("connect — policy config from chain", () => {
    it("reads identity registry address from policy contract", () => {
      const config = wos.getPolicyConfig();
      expect(config.identityRegistry).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(config.identityRegistry).not.toBe(zeroAddress);
    });

    it("reads validation registry address from policy contract", () => {
      const config = wos.getPolicyConfig();
      expect(config.validationRegistry).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(config.validationRegistry).not.toBe(zeroAddress);
    });

    it("reads world ID validator address from policy contract", () => {
      const config = wos.getPolicyConfig();
      expect(config.worldIdValidator).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it("reads required tier from policy contract", () => {
      const config = wos.getPolicyConfig();
      expect(config.requiredTier).toBe(2); // HUMAN_VERIFIED tier
    });

    it("discovered addresses match known deployed addresses", () => {
      const config = wos.getPolicyConfig();
      expect(config.identityRegistry.toLowerCase()).toBe(
        "0x8004A818BFB912233c491871b3d84c89A494BD9e".toLowerCase(),
      );
      expect(config.validationRegistry.toLowerCase()).toBe(
        "0x8004Cb1BF31DAf7788923b405b754f57acEB4272".toLowerCase(),
      );
    });
  });

  describe("agent queries", () => {
    it("isRegistered returns true for agent #1", async () => {
      expect(await wos.isRegistered(EXISTING_AGENT)).toBe(true);
    }, 15_000);

    it("isRegistered returns false for non-existent agent", async () => {
      expect(await wos.isRegistered(NON_EXISTENT_AGENT)).toBe(false);
    }, 15_000);

    it("getOwner returns a non-zero address for agent #1", async () => {
      const owner = await wos.getOwner(EXISTING_AGENT);
      expect(owner).not.toBe(zeroAddress);
      expect(owner).toMatch(/^0x[0-9a-fA-F]{40}$/);
    }, 15_000);

    it("getOwner throws for non-existent agent", async () => {
      await expect(wos.getOwner(NON_EXISTENT_AGENT)).rejects.toThrow();
    }, 15_000);

    it("getAgentStatus returns full struct for agent #1", async () => {
      const status = await wos.getAgentStatus(EXISTING_AGENT);

      expect(status.isRegistered).toBe(true);
      expect(status.owner).not.toBe(zeroAddress);
      expect(status.tier).toBeGreaterThanOrEqual(1);
      expect(status.tier).toBeLessThanOrEqual(2);
    }, 15_000);

    it("getAgentStatus returns empty struct for non-existent agent", async () => {
      const status = await wos.getAgentStatus(NON_EXISTENT_AGENT);

      expect(status.isRegistered).toBe(false);
      expect(status.isHumanVerified).toBe(false);
      expect(status.tier).toBe(0);
      expect(status.owner).toBe(zeroAddress);
    }, 15_000);

    it("getValidationSummary returns count and avgScore", async () => {
      const summary = await wos.getValidationSummary(EXISTING_AGENT);

      expect(typeof summary.count).toBe("bigint");
      expect(typeof summary.avgScore).toBe("number");
      expect(summary.count).toBeGreaterThanOrEqual(0n);
    }, 15_000);
  });
});
