# Whitewall OS — Product Requirements Document

> **TL;DR**: Whitewall OS is an access control protocol that bonds AI agents to verified humans. Built on Chainlink CRE + ACE + CCIP + World ID + ERC-8004. Ships as a **protocol + SDK** — any dApp integrates in 3 lines of Solidity or 1 line of TypeScript.

---

## 1. Problem

AI agents are becoming autonomous on-chain actors. But:

- **No accountability** — If an agent exploits a protocol, who's responsible?
- **Sybil attacks** — One person can spin up 1000 agents to drain resources, game governance, farm airdrops
- **Binary access** — Today it's either "allow everyone" (chaos) or "strict KYC" (centralization). No middle ground.

**Bottom line**: dApps have no way to verify "is there a real, unique human behind this agent?"

---

## 2. Solution

**Whitewall OS** = Access Control Engine for the Agent Economy.

```
Any dApp                Whitewall OS Protocol              Verification Sources
┌──────────┐     ┌─────────────────────────┐     ┌──────────────────────┐
│ DeFi     │     │  ACE (Access Control)   │     │  World ID (Human)    │
│ DAO      │────▶│  CRE (Off-chain logic)  │◀───▶│  ERC-8004 (Identity) │
│ Faucet   │     │  CCIP (Cross-chain)     │     │  Reputation data     │
│ Any dApp │     │  SDK / MCP              │     │                      │
└──────────┘     └─────────────────────────┘     └──────────────────────┘
```

**Core idea**: Every agent must be cryptographically bonded to a verified human. Whitewall OS enforces this bond at the protocol level.

---

## 3. Key Features

### 3.1 Human-Agent Bonding (World ID)
- Human verifies with World ID (privacy-preserving biometric proof)
- Proof is validated off-chain by CRE via Confidential HTTP
- Bond is recorded on-chain: `Agent #42 → HUMAN_VERIFIED`
- Sybil-proof: same human can't bond unlimited agents (nullifier-based)

### 3.2 5-Gate Access Control Pipeline
Every access request runs through 5 sequential gates:

| Gate | Check | Fail Result |
|------|-------|-------------|
| 1. Identity | Is this address a registered agent? | REJECT: "Unregistered" |
| 2. Verification | Does this agent have HUMAN_VERIFIED bond? | REJECT: "No human bond" |
| 3. Liveness | Is the verification still valid (TTL)? | REJECT: "Expired" |
| 4. Reputation | What's the agent's trust score? | Determines access tier |
| 5. Execute | All gates passed → approve transaction | Grant access |

### 3.3 Cross-Chain Identity (CCIP)
- Agent verified on Chain A → accesses dApp on Chain B
- CRE reads Chain A registries via CCIP Read
- **"Verify once, use everywhere"**

### 3.4 SDK / Protocol Layer (The Differentiator)

Whitewall OS isn't just a demo — it's a **pluggable protocol**.

**Solidity SDK** — Any contract inherits `WhitewallOSGuard`:
```solidity
contract MyDeFi is WhitewallOSGuard {
    function withdraw(uint256 amt) external requireHumanVerified(msg.sender) {
        // Protected by Whitewall OS
    }
}
```

**TypeScript SDK** — Any frontend integrates:
```typescript
const wos = new WhitewallOS({ chain: 'sepolia' })
const status = await wos.getAgentStatus('0xAgent...')
// → { tier: 2, verified: true, reputation: 85, ttlRemaining: '29d' }
```

**MCP Server** — AI agents verify other AI agents:
```
Tool: auth_os_check_agent
Input: { address: "0xAgent..." }
Output: { verified: true, tier: 2, owner: "0xHuman..." }
```

---

## 4. Technical Architecture

### 4.1 Tech Stack

| Layer | Technology | Role |
|-------|-----------|------|
| Smart Contracts | Solidity + Foundry | On-chain state + access control |
| Off-chain Logic | Chainlink CRE | Workflow execution (verify, check, approve) |
| Access Control | Chainlink ACE | Policy engine (PolicyProtected + runPolicy) |
| Cross-chain | Chainlink CCIP | Read registries across chains |
| Human Verification | World ID | Privacy-preserving proof of personhood |
| Agent Identity | ERC-8004 | Agent registration + validation records |
| Secret Protection | Confidential HTTP | API key protection (World ID key) |
| Frontend | Next.js + RainbowKit | Dashboard + demo |
| SDK | TypeScript + Solidity | Protocol integration layer |
| AI Integration | MCP Server | Agent-to-agent verification |

### 4.2 Smart Contracts

| Contract | Purpose |
|----------|---------|
| `IdentityRegistry` | ERC-721 agent registration. Stores agentId, owner, metadata. |
| `ValidationRegistry` | Verification records. Stores HUMAN_VERIFIED bonds + timestamps. |
| `WhitewallConsumer` | ACE consumer. Receives DON-signed reports, executes bond/claim logic. |
| `WhitewallExtractor` | Parses report bytes into structured parameters for policy engine. |
| `HumanVerifiedPolicy` | On-chain safety net. Rejects unverified agents even if CRE is compromised. |
| `ResourceGateway` | Demo dApp. Distributes tokens to verified agents. |
| `WhitewallOSGuard` | SDK abstract contract. Any dApp inherits for instant protection. |
| `IWhitewallOS` | Public interface. `isRegistered()`, `isHumanVerified()`, `getTier()`. |

### 4.3 CRE Workflows (EVM Event Triggers)

All workflows are **event-driven** (decentralized — no HTTP server):

**Bonding Workflow** — Triggered by `ValidationRequest` event:
```
On-chain event → CRE detects → Fetch proof → Confidential HTTP to World ID API
→ Sybil check → DON signs report → Write to WhitewallConsumer → Bond recorded
```

**Claim Workflow** — Triggered by `AccessRequested` event:
```
On-chain event → CRE detects → Gate 1-5 checks (read registries)
→ DON signs report → Write to WhitewallConsumer → Grant or Reject
```

**Cross-chain Claim Workflow** — Triggered on Chain B:
```
Chain B event → CRE detects → CCIP Read Chain A registries
→ Verification confirmed → DON signs → Execute on Chain B
```

### 4.4 Chains
- **Chain A (Sepolia)**: Identity + Validation registries, WhitewallConsumer, bonding
- **Chain B (Avalanche Fuji)**: ResourceGateway, cross-chain claims

---

## 5. Demo Plan

### 5.1 Positioning
**"The pipeline IS the demo."**

The use case is intentionally simple (agent requests access to a resource).
The impressive part is **the full pipeline running in real-time** + **how easy it is to integrate via SDK**.

### 5.2 Demo Flow (4 acts, ~5 minutes)

**Act 1: The Problem (30s)**
> "AI agents are accessing DeFi, but nobody knows who's behind them."
- Show bot swarm draining resources with no protection

**Act 2: The Pipeline (2min)** — Technical depth
> "Whitewall OS blocks every unauthorized agent. Watch it happen."
- Enable Whitewall OS. Same attack.
- Dashboard shows full pipeline in real-time:
  - `[EVENT]` AccessRequested detected
  - `[CRE]` Workflow triggered (0.5s)
  - `[GATE 1]` Identity check → PASS/FAIL
  - `[GATE 2]` Human verification → PASS/FAIL
  - `[GATE 3]` TTL check → PASS/FAIL
  - `[GATE 4]` Reputation → Score: 85
  - `[DON]` Report signed by 3/5 nodes
  - `[ACE]` Policy engine: APPROVED
  - `[TX]` 100 tokens transferred
- Bots: red rejection logs. Verified agent: green success.
- Cross-chain: show CCIP verification from another chain

**Act 3: The SDK (1min)** — Real-world utility
> "All of that complexity? Your app integrates it in 3 lines."
- Show Solidity: `contract MyApp is WhitewallOSGuard { ... }`
- Show TypeScript: `wos.getAgentStatus(address)`
- Show MCP: AI agent verifying another agent

**Act 4: Try It Yourself (1min)** — Interactive
> "You try. Connect wallet. Register your agent. Verify."
- Judge connects wallet
- Registers agent (sees pipeline start)
- Verifies with World ID (sees full bonding pipeline)
- Claims resource (sees 5-gate pipeline)
- Success

### 5.3 Dashboard Layout

```
┌──────────────────────────────────────────────────────────┐
│  Whitewall OS Dashboard                                        │
├──────────────┬───────────────────────────────────────────┤
│              │                                            │
│  CONTROL     │     PIPELINE VISUALIZER                    │
│              │                                            │
│  [Bot Swarm] │  Event → CRE → WorldID → Sybil           │
│  [Reg. Bot]  │    → DON Sign → ACE Policy → Execute     │
│  [Verified]  │                                            │
│  [X-Chain]   │  Each step: timing, status, chain info    │
│              │                                            │
│  [Try It ▶]  │                                            │
│              │                                            │
├──────────────┴───────────────────────────────────────────┤
│  SDK SHOWCASE                                             │
│  [Solidity] [TypeScript] [MCP]                           │
│  Code snippet ←→ Live result side by side                │
├──────────────────────────────────────────────────────────┤
│  LIVE TERMINAL                                            │
│  [ACE] Gate 1: Identity ✅ (0.3s)                        │
│  [ACE] Gate 2: Human Verified ❌ — REJECTED              │
│  [CCIP] Cross-chain read from Sepolia ✅ (4.1s)          │
│  [DON] Report signed by 3/5 nodes ✅                     │
└──────────────────────────────────────────────────────────┘
```

---

## 6. Project Structure

```
~/github/whitewall-os/
├── contracts/                    # Foundry (Solidity)
│   ├── src/
│   │   ├── registries/           # IdentityRegistry, ValidationRegistry
│   │   ├── consumer/             # WhitewallConsumer, Extractor, ResourceGateway
│   │   ├── policies/             # HumanVerifiedPolicy, SybilGuardPolicy
│   │   └── sdk/                  # WhitewallOSGuard, IWhitewallOS
│   ├── test/
│   └── script/
├── workflows/                    # CRE TypeScript Workflows
│   ├── bonding-workflow/         # World ID verify + write validation
│   ├── claim-workflow/           # 5-gate check + approve/reject
│   └── crosschain-claim-workflow/# CCIP Read + cross-chain approve
├── sdk/                          # TypeScript SDK (@whitewall-os/sdk)
│   └── src/                      # Client, types, event subscriber
├── mcp/                          # MCP Server (@whitewall-os/mcp)
│   └── src/                      # MCP tool definitions
└── app/                          # Next.js Dashboard
    └── src/
        ├── components/           # PipelineVisualizer, PersonaPanel,
        │                         # LiveTerminal, SDKShowcase, TryItYourself
        └── lib/                  # Contract ABIs, pipeline tracking
```

---

## 7. Build Plan

### Phase 1: Core Contracts
> All other work depends on this.

- IdentityRegistry (ERC-721 agent registration)
- ValidationRegistry (verification records)
- WhitewallConsumer (ACE consumer with `onReport` + `runPolicy`)
- WhitewallExtractor (report parser)
- HumanVerifiedPolicy (on-chain safety net)
- ResourceGateway (demo dApp)
- IWhitewallOS + WhitewallOSGuard (Solidity SDK)

### Phase 2: CRE Workflows (sequential, depends on Phase 1)
- Bonding workflow (World ID verification via Confidential HTTP)
- Claim workflow (5-gate access control)

### Phase 3: SDK + Dashboard (parallel with Phase 2)
- TypeScript SDK (contract wrappers + event subscriber)
- Dashboard (PipelineVisualizer + PersonaPanel + LiveTerminal + SDKShowcase + TryItYourself)

### Phase 4: Cross-chain + MCP (after Phase 2)
- CCIP cross-chain claim workflow
- MCP server (thin wrapper on TS SDK)

### Dependency Graph

```
Phase 1 (Contracts)
  ├──▶ Phase 2 (CRE Workflows)
  │      └──▶ Phase 4a (CCIP Workflow)
  └──▶ Phase 3 (SDK + Dashboard) ──▶ Phase 4b (MCP)
```

---

## 8. Target Prize Tracks

- **CRE & AI (Primary)**: Full CRE workflow orchestration for AI agent verification
- **Risk & Compliance**: Decentralized "KYC" for autonomous agents
- **Sponsor (World)**: World ID for agent accountability
- **DeFi & Tokenization**: Cross-chain agent access via CCIP

---

## 9. Key Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Trigger method | EVM events (not HTTP) | Decentralized — no server needed |
| Privacy | Confidential HTTP only | Private Tx doesn't hide on-chain state changes (balanceOf visible). Revisit if Privacy Pools-level feature ships. |
| Demo use case | Simple resource access | Use case is the trigger — **the pipeline visualization is the real demo** |
| Template | Fork from `stablecoin-ace-ccip` | Near 1:1 pattern match with Whitewall OS architecture |
| SDK approach | Solidity + TS + MCP | Three integration levels: contract / frontend / AI agent |

---

## 10. Reference

| What | Location |
|------|----------|
| ACE Consumer pattern | `~/github/cre-templates/.../MintingConsumerWithACE.sol` |
| ACE Policy pattern | `~/github/cre-templates/.../AddressBlacklistPolicy.sol` |
| CRE Workflow pattern | `~/github/cre-templates/.../bank-stablecoin-por-ace-ccip-workflow/main.ts` |
| PolicyProtected base | `~/github/chainlink-ace/src/PolicyProtected.sol` |
| Architecture diagram (EN) | `~/whitewall-os-diagram.html` |
| Architecture diagram (KR) | `~/whitewall-os-diagram-kr.html` |
| Original design doc | `~/implementation_plan_idea_1.md` |
