import type { Address } from "viem";

export interface AgentStatus {
  isRegistered: boolean;
  isHumanVerified: boolean;
  tier: number;
  owner: Address;
  agentWallet: Address;
  validationCount: bigint;
}

export interface AccessGrantedEvent {
  agentId: bigint;
  accountableHuman: Address;
  tier: number;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
}

export interface ValidationSummary {
  count: bigint;
  avgScore: number;
}
