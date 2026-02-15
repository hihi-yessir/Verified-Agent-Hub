# Whitewall OS Architecture (Current State)

> Last updated: 2025-02-14
> Chain: Base Sepolia (84532)

---

## 1. What is Whitewall OS?

AI agent accountability protocol. Any service (on-chain dApp, backend API, AI agent) can verify:
**"Is there a real, unique human behind this agent?"**

```
Any Service              Whitewall OS Protocol                  Verification
┌──────────┐      ┌──────────────────────────┐      ┌──────────────────┐
│ DeFi     │      │                          │      │                  │
│ OpenRouter│─────▶│  On-chain Registries     │◀─────│  World ID        │
│ API GW   │      │  ACE Policy Engine       │      │  (Human proof)   │
│ AI Agent │      │  SDK / MCP               │      │                  │
└──────────┘      └──────────────────────────┘      └──────────────────┘
```

Three integration levels:
| Level | How | Target |
|-------|-----|--------|
| 1. Solidity SDK | `contract X is WhitewallOSGuard` | On-chain dApps |
| 2. TypeScript SDK | `wos.getAgentStatus(addr)` | Backend/frontend apps (OpenRouter, etc.) |
| 3. MCP Server | `auth_os_check_agent` tool | AI agents verifying other agents |

---

## 2. Smart Contracts

### 2.1 Data Layer (Registries)

**IdentityRegistryUpgradeable** — "Who is an agent?"
- ERC-721 NFT. `register()` mints token, returns `agentId`
- `ownerOf(agentId)` — who owns this agent
- `getAgentWallet(agentId)` — agent's operating wallet (EOA or CA)
- Stores arbitrary metadata via ERC-8004

**ValidationRegistryUpgradeable** — "Is this agent verified?"
- Request/response pattern: `validationRequest()` → `validationResponse()`
- `getSummary(agentId, validators, tag)` — count + avg score for a tag
- Tags: `"HUMAN_VERIFIED"`, etc.
- **Person B's CRE bonding workflow writes here directly** (not through ACE)

**WorldIDValidator** — "Validate World ID proofs"
- Verifies ZK proofs from World ID
- Acts as a validator in ValidationRegistry

### 2.2 ACE Layer (Access Control Engine) — ACCESS only

> Bonding does NOT go through ACE. CRE writes directly to ValidationRegistry.

**WhitewallConsumer** — Entry point for ACCESS requests
- Inherits `PolicyProtected` (Chainlink ACE)
- `onReport(metadata, report)` — called by CRE Forwarder
- `runPolicy` modifier runs PolicyEngine BEFORE function body executes
- If policy approves → emits `AccessGranted(agentId, human, tier)`
- If policy rejects → entire tx reverts (body never runs)

**WhitewallExtractor** — Report parser
- Stateless (no proxy needed)
- Input: `onReport` calldata bytes
- Output: 5 structured parameters:

```
[0] agentId          (uint256)  — keccak256("agentId")
[1] approved         (bool)     — keccak256("approved")
[2] tier             (uint8)    — keccak256("tier")
[3] accountableHuman (address)  — keccak256("accountableHuman")
[4] reason           (bytes32)  — keccak256("reason")
```

**HumanVerifiedPolicy** — On-chain safety net (double protection)
- Called by PolicyEngine with mapped parameters
- 4 sequential checks:

```
Check 1: approved == true?                    (CRE report value)
Check 2: tier >= requiredTier (2)?            (CRE report value)
Check 3: IdentityRegistry.ownerOf(agentId)    (ON-CHAIN read)
Check 4: ValidationRegistry.getSummary(...)   (ON-CHAIN read)
```

- Checks 3-4 are independent of CRE — even if CRE is compromised, on-chain state is verified directly

**PolicyEngine** (vendored from chainlink-ace)
- Orchestrator: extract → map → policy → allow/reject
- `setExtractor(selector, extractor)` — which extractor for which function
- `addPolicy(target, selector, policy, paramNames)` — which policy for which contract+function

### 2.3 SDK Layer

**IWhitewallOS** — Public read interface
- `isRegistered(agentId)`, `isHumanVerified(agentId)`, `getTier(agentId)`
- `getAgentStatus(agentId)` — full status struct

**WhitewallOSGuard** — Abstract contract for dApp integration
- `modifier requireHumanVerified(agentId)`
- `modifier requireRegistered(agentId)`
- `modifier requireTier(agentId, minTier)`

---

## 3. Access Control Flow

### 3.1 Bonding (Human Verification) — Person B

```
Human submits World ID proof
    ↓
ValidationRegistry.validationRequest(worldIdValidator, agentId, ...)
    ↓ (emits ValidationRequested event)
CRE Bonding Workflow detects event
    ↓
CRE: Confidential HTTP → World ID API → verify proof
    ↓
CRE: sybil check (nullifier)
    ↓
ValidationRegistry.validationResponse(hash, score, ..., "HUMAN_VERIFIED")
    ↓
Bond recorded on-chain
```

**No ACE involved.** CRE writes directly to ValidationRegistry.

### 3.2 Access Request — Person A (ACE Pipeline)

```
Agent requests resource access
    ↓
CRE Access Workflow: reads registries, builds report
    ↓
DON signs report → Forwarder sends to WhitewallConsumer
    ↓
WhitewallConsumer.onReport(metadata, report)
    ↓ [runPolicy modifier fires]
PolicyEngine.run()
    ↓
WhitewallExtractor.extract()
  → parse report → (agentId, approved, tier, accountableHuman, reason)
    ↓
HumanVerifiedPolicy.run()
  → Check 1: CRE approved?              ✅/❌
  → Check 2: tier >= 2?                 ✅/❌
  → Check 3: IdentityRegistry.ownerOf() ✅/❌  ← on-chain
  → Check 4: ValidationRegistry.getSummary() ✅/❌  ← on-chain
    ↓
All pass → PolicyResult.Allowed
    ↓
WhitewallConsumer body executes
  → emit AccessGranted(agentId, human, tier)
```

---

## 4. Report Format

```
abi.encode(
    uint256 agentId,          // agent's NFT token ID
    bool    approved,         // CRE's off-chain decision
    uint8   tier,             // verification tier (2 = HUMAN_VERIFIED)
    address accountableHuman, // human bonded to this agent
    bytes32 reason            // rejection reason (0x00...00 if approved)
)
```

onReport selector: `0x805f2132` = `bytes4(keccak256("onReport(bytes,bytes)"))`

---

## 5. Deployed Addresses (Base Sepolia)

### Registries (Phase 1 — previously deployed)
| Contract | Address |
|----------|---------|
| IdentityRegistry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| ValidationRegistry | `0x8004Cb1BF31DAf7788923b405b754f57acEB4272` |
| WorldIDValidator | `0x1258f013d1ba690dc73ea89fd48f86e86ad0f124` |

### ACE Stack (Phase 1b — just deployed)
| Contract | Address |
|----------|---------|
| PolicyEngine (proxy) | `0x4c09ed510603e9034928849c81365b6f1396edc7` |
| WhitewallExtractor | `0x14f6ac8c514dca76e437fe9add8bc676df146243` |
| HumanVerifiedPolicy (proxy) | `0x8f66f55f4ade4e64b105820972d444a56449e8b3` |
| WhitewallConsumer (proxy) | `0xec3114ea6bb29f77b63cd1223533870b663120bb` |

### Wiring
- PolicyEngine: extractor for `0x805f2132` → WhitewallExtractor
- PolicyEngine: policy for Consumer's `onReport` → HumanVerifiedPolicy
- Forwarder: `0x0000000000000000000000000000000000000001` (placeholder — Person B updates after CRE deploy)

---

## 6. Project Structure (Actual)

```
~/github/whitewall-os/
├── contracts/
│   ├── IdentityRegistryUpgradeable.sol    # ERC-721 agent registration
│   ├── ValidationRegistryUpgradeable.sol  # Verification records
│   ├── ReputationRegistryUpgradeable.sol  # Agent reputation/feedback
│   ├── WorldIDValidator.sol               # World ID ZK proof verifier
│   ├── ace/
│   │   ├── WhitewallConsumer.sol             # ACE consumer (ACCESS only)
│   │   ├── WhitewallExtractor.sol            # Report → parameters parser
│   │   ├── HumanVerifiedPolicy.sol        # On-chain double protection
│   │   └── vendor/
│   │       ├── core/
│   │       │   ├── PolicyEngine.sol       # Chainlink ACE orchestrator
│   │       │   ├── PolicyProtected.sol    # Base with runPolicy modifier
│   │       │   └── Policy.sol             # Base for policy contracts
│   │       └── interfaces/
│   │           ├── IPolicyEngine.sol
│   │           ├── IPolicyProtected.sol
│   │           ├── IExtractor.sol
│   │           ├── IPolicy.sol
│   │           └── IMapper.sol
│   ├── interfaces/
│   │   └── IWhitewallOS.sol                    # Public read interface
│   └── sdk/
│       └── WhitewallOSGuard.sol                # Abstract contract for dApps
├── scripts/
│   └── deploy-ace.ts                      # Deploys full ACE stack
├── test/
│   ├── ace.ts                             # ACE pipeline tests (8/8 pass)
│   ├── core.ts                            # Registry unit tests
│   └── upgradeable.ts                     # Proxy/upgrade tests (18/18 pass)
├── hardhat.config.ts
└── package.json
```

---

## 7. Person A / Person B Split

### Person A (done)
- All smart contracts (registries + ACE + SDK)
- Tests (8/8 ACE, 18/18 upgradeable)
- Base Sepolia deployment + wiring
- **Next**: TypeScript SDK, MCP Server

### Person B (in progress)
- CRE Bonding Workflow (World ID → ValidationRegistry)
- CRE Access Workflow (read registries → sign report → Forwarder → WhitewallConsumer)
- ResourceGateway (demo dApp)
- Dashboard
- After CRE deploy: call `WhitewallConsumer.setForwarder(realForwarderAddress)`

### Interface for Person B

```
Consumer address: 0xec3114ea6bb29f77b63cd1223533870b663120bb
onReport selector: 0x805f2132
Chain: Base Sepolia (84532)

Report format:
  abi.encode(uint256 agentId, bool approved, uint8 tier, address accountableHuman, bytes32 reason)

Bonding:
  Write directly to ValidationRegistry (0x8004Cb1BF31DAf7788923b405b754f57acEB4272)
  validationResponse(requestHash, score, uri, hash, "HUMAN_VERIFIED")
```

---

## 8. Key Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| BOND vs ACCESS separation | BOND bypasses ACE, goes directly to ValidationRegistry | ACE is for access control, not data recording. ValidationRegistry already has validator pattern. |
| Double protection | On-chain policy reads registries independently | Even if CRE is compromised, on-chain checks catch fake reports |
| Report format | No actionType field | Only ACCESS goes through ACE, so no need to distinguish |
| Proxy pattern | ERC1967Proxy + UUPS | Upgradeable for all stateful contracts |
| Extractor is stateless | No proxy for WhitewallExtractor | Pure function, no storage needed |
| defaultAllow = false | PolicyEngine rejects by default | Fail-safe: if no policy matches, reject |

---

## 9. What's Next

| Priority | Task | Owner | Status |
|----------|------|-------|--------|
| 1 | TypeScript SDK (`@whitewall-os/sdk`) | Person A | Pending |
| 2 | MCP Server (`@whitewall-os/mcp`) | Person A | Pending |
| 3 | CRE Bonding Workflow | Person B | In progress |
| 4 | CRE Access Workflow | Person B | In progress |
| 5 | ResourceGateway | Person B | Pending |
| 6 | Dashboard | Person B | Pending |
| 7 | CCIP Cross-chain | Both | Future |
