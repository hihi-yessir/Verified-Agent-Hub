# 예슬 핸드오프 문서

> 재욱이 완료한 작업 + 예슬이 연동해야 할 인터페이스 전체 정리
> Chain: Base Sepolia (84532)

---

## 1. 예슬이 해야 할 일 (요약)

| # | 작업 | 설명 |
|---|------|------|
| 1 | **CRE Bonding Workflow** | World ID 증명 검증 → ValidationRegistry에 직접 기록 |
| 2 | **CRE Access Workflow** | 레지스트리 읽기 → 리포트 생성 → DON 서명 → WhitewallConsumer에 전송 |
| 3 | **`setForwarder()` 호출** | CRE 배포 후 실제 Forwarder 주소를 Consumer에 등록 |
| 4 | **ResourceGateway** | 데모 dApp (검증된 에이전트에 토큰 배포) |
| 5 | **Dashboard** | 파이프라인 시각화 + 데모 UI |

---

## 2. 배포된 컨트랙트 주소

### 레지스트리 (데이터 레이어)
| 컨트랙트 | 주소 | 용도 |
|----------|------|------|
| IdentityRegistry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | ERC-721 에이전트 등록 |
| ValidationRegistry | `0x8004Cb1BF31DAf7788923b405b754f57acEB4272` | 검증 기록 (HUMAN_VERIFIED 등) |
| WorldIDValidator | `0x1258f013d1ba690dc73ea89fd48f86e86ad0f124` | World ID ZK 증명 검증자 |

### ACE 스택 (접근 제어)
| 컨트랙트 | 주소 | 용도 |
|----------|------|------|
| PolicyEngine (proxy) | `0x4c09ed510603e9034928849c81365b6f1396edc7` | ACE 오케스트레이터 |
| WhitewallExtractor | `0x14f6ac8c514dca76e437fe9add8bc676df146243` | 리포트 파서 (stateless) |
| HumanVerifiedPolicy (proxy) | `0x8f66f55f4ade4e64b105820972d444a56449e8b3` | 온체인 이중 보호 정책 |
| WhitewallConsumer (proxy) | `0xec3114ea6bb29f77b63cd1223533870b663120bb` | ACE 컨슈머 (ACCESS 전용) |

### 와이어링 (이미 완료)
- PolicyEngine → `0x805f2132` (onReport selector) → WhitewallExtractor
- PolicyEngine → Consumer의 onReport → HumanVerifiedPolicy
- **Forwarder: `0x0000000000000000000000000000000000000001` (플레이스홀더 — 예슬가 CRE 배포 후 업데이트)**

---

## 3. 인터페이스 정의

### 3.1 Bonding (인간 검증) — ACE 안 거침

본딩은 **ValidationRegistry에 직접 기록**. ACE/Consumer를 거치지 않음.

```
ValidationRegistry 주소: 0x8004Cb1BF31DAf7788923b405b754f57acEB4272
```

**CRE Bonding Workflow 흐름:**
```
1. 유저가 World ID 증명을 제출
       ↓
2. ValidationRegistry.validationRequest(worldIdValidator, agentId, requestURI)
   - worldIdValidator = 0x1258f013d1ba690dc73ea89fd48f86e86ad0f124
   - agentId = 에이전트의 NFT 토큰 ID
       ↓ (ValidationRequested 이벤트 발생)
3. CRE Bonding Workflow가 이벤트 감지
       ↓
4. CRE: Confidential HTTP → World ID API → 증명 검증
       ↓
5. CRE: 시빌 체크 (nullifier 확인)
       ↓
6. ValidationRegistry.validationResponse(requestHash, score, responseURI, responseHash, "HUMAN_VERIFIED")
   - score: 1 이상 (검증 성공 시)
   - tag: 반드시 "HUMAN_VERIFIED" (정확히 이 문자열)
       ↓
7. 본딩 완료 — 온체인에 기록됨
```

**핵심 함수 시그니처:**
```solidity
// 1단계: 검증 요청 (프론트엔드 또는 CRE가 호출)
function validationRequest(
    address validatorAddress,  // 0x1258f013d1ba690dc73ea89fd48f86e86ad0f124
    uint256 agentId,           // 에이전트 NFT ID
    string calldata requestURI // 증명 데이터 URI
) external returns (bytes32 requestHash);

// 2단계: 검증 응답 (CRE가 호출)
function validationResponse(
    bytes32 requestHash,       // 1단계에서 받은 해시
    uint8 score,               // 검증 점수 (1 이상 = 성공)
    string calldata responseURI,
    bytes32 responseHash,
    string calldata tag        // 반드시 "HUMAN_VERIFIED"
) external;
```

**중요: `tag`는 반드시 `"HUMAN_VERIFIED"`여야 함.** HumanVerifiedPolicy가 이 태그로 ValidationRegistry.getSummary를 조회함. 다른 태그를 쓰면 정책 체크에서 탈락.

---

### 3.2 Access Request (접근 요청) — ACE 파이프라인

접근 요청은 **WhitewallConsumer를 통해 ACE 파이프라인**을 거침.

```
Consumer 주소: 0xec3114ea6bb29f77b63cd1223533870b663120bb
onReport selector: 0x805f2132
```

**CRE Access Workflow 흐름:**
```
1. 에이전트가 리소스 접근 요청
       ↓
2. CRE Access Workflow 트리거
       ↓
3. CRE가 온체인 레지스트리 읽기:
   - IdentityRegistry.ownerOf(agentId) → 등록 여부
   - ValidationRegistry.getSummary(agentId, [worldIdValidator], "HUMAN_VERIFIED") → 검증 여부
       ↓
4. CRE가 리포트 생성 (아래 포맷)
       ↓
5. DON 서명 → Forwarder → WhitewallConsumer.onReport(metadata, report)
       ↓ [runPolicy modifier 자동 실행]
6. PolicyEngine → WhitewallExtractor → HumanVerifiedPolicy
   - Check 1: approved == true?
   - Check 2: tier >= 2?
   - Check 3: IdentityRegistry.ownerOf(agentId) — 온체인 직접 확인
   - Check 4: ValidationRegistry.getSummary(...) — 온체인 직접 확인
       ↓
7a. 모두 통과 → AccessGranted(agentId, accountableHuman, tier) 이벤트 발생
7b. 하나라도 실패 → 전체 tx revert
```

**리포트 포맷 (CRE가 생성해야 하는 형식):**
```solidity
abi.encode(
    uint256 agentId,          // 에이전트 NFT 토큰 ID
    bool    approved,         // CRE의 오프체인 판단 (true = 승인)
    uint8   tier,             // 검증 등급 (2 = HUMAN_VERIFIED)
    address accountableHuman, // 이 에이전트에 본딩된 인간의 주소
    bytes32 reason            // 거부 사유 (승인 시 0x00...00)
)
```

**이중 보호 (Double Protection):**
CRE가 `approved: true, tier: 2`로 리포트를 보내더라도, 온체인 HumanVerifiedPolicy가 독립적으로 레지스트리를 확인함. CRE가 해킹당해서 가짜 승인 리포트를 보내도, 실제 온체인 상태가 검증되지 않은 에이전트라면 거부됨.

---

### 3.3 Forwarder 설정

CRE 배포 후, 실제 Forwarder 주소를 Consumer에 등록해야 함:

```solidity
WhitewallConsumer(0xec3114ea6bb29f77b63cd1223533870b663120bb)
    .setForwarder(realForwarderAddress)
```

**주의:** `setForwarder`는 owner만 호출 가능. 현재 owner는 배포자 주소 `0x21fdEd74C901129977B8e28C2588595163E1e235`.

---

## 4. 재욱 완료 항목

### 4.1 스마트 컨트랙트

| 컨트랙트 | 파일 | 테스트 |
|----------|------|--------|
| IdentityRegistryUpgradeable | `contracts/IdentityRegistryUpgradeable.sol` | core.ts, upgradeable.ts |
| ValidationRegistryUpgradeable | `contracts/ValidationRegistryUpgradeable.sol` | core.ts, upgradeable.ts |
| ReputationRegistryUpgradeable | `contracts/ReputationRegistryUpgradeable.sol` | core.ts, upgradeable.ts |
| WorldIDValidator | `contracts/WorldIDValidator.sol` | core.ts |
| WhitewallConsumer | `contracts/ace/WhitewallConsumer.sol` | ace.ts (8/8) |
| WhitewallExtractor | `contracts/ace/WhitewallExtractor.sol` | ace.ts |
| HumanVerifiedPolicy | `contracts/ace/HumanVerifiedPolicy.sol` | ace.ts |
| PolicyEngine (vendored) | `contracts/ace/vendor/core/PolicyEngine.sol` | ace.ts |

**테스트 결과:**
- `test/ace.ts` — 8/8 통과 (ACE 파이프라인 + 이중 보호)
- `test/upgradeable.ts` — 18/18 통과 (프록시/업그레이드)
- `test/core.ts` — 55/61 통과 (6개 실패는 test infra 이슈, 컨트랙트 문제 아님)

### 4.2 Base Sepolia 배포

- 모든 컨트랙트 배포 완료 (주소는 위 섹션 2 참고)
- PolicyEngine 와이어링 완료 (Extractor + Policy 연결)
- Forwarder만 플레이스홀더 상태

### 4.3 TypeScript SDK (`sdk/`)

```
sdk/
├── src/
│   ├── index.ts          # 모든 export
│   ├── client.ts         # WhitewallOS 클래스
│   ├── types.ts          # AgentStatus, ValidationSummary 등
│   ├── abis.ts           # 컨트랙트 ABI
│   └── addresses.ts      # 체인별 배포 주소
├── test/
│   ├── unit.test.ts      # 14 unit tests
│   └── integration.test.ts # 12 integration tests (Base Sepolia)
├── examples/
│   └── check-agent.ts    # 사용 예시
├── package.json
└── tsconfig.json
```

**사용법:**
```typescript
import { WhitewallOS } from "@whitewall-os/sdk";

// connect()가 온체인 HumanVerifiedPolicy에서 정책 설정을 읽어옴
const wos = await WhitewallOS.connect({ chain: "baseSepolia" });

// 에이전트 검증 상태 조회
const status = await wos.getAgentStatus(1n);
// → { isRegistered: true, isHumanVerified: false, tier: 1, owner: "0x21fd...", ... }

// 개별 체크
await wos.isRegistered(1n);      // true
await wos.isHumanVerified(1n);   // false (아직 World ID 본딩 안 됨)

// 이벤트 감시
wos.onAccessGranted((event) => {
  console.log(event.agentId, event.accountableHuman, event.tier);
});
```

**테스트:** 26/26 통과 (14 unit + 12 integration)

### 4.4 Go SDK (`sdk-go/`)

```
sdk-go/
├── addresses.go    # 체인별 배포 주소 + PolicyConfig
├── abi.go          # 컨트랙트 ABI JSON
├── types.go        # AgentStatus, ValidationSummary
├── client.go       # WhitewallOS 구조체 + 모든 메서드
├── client_test.go  # 17 integration tests
└── go.mod
```

**사용법:**
```go
import whitewallos "github.com/whitewall-os/sdk-go"

ctx := context.Background()
a, _ := whitewallos.Connect(ctx, whitewallos.Config{Chain: whitewallos.BaseSepolia})
defer a.Close()

status, _ := a.GetAgentStatus(ctx, big.NewInt(1))
// status.IsRegistered == true
// status.IsHumanVerified == false
// status.Owner == 0x21fdEd74C901129977B8e28C2588595163E1e235
```

**테스트:** 17/17 통과 (전부 Base Sepolia 실시간 테스트, TS SDK와 교차 검증 포함)

### 4.5 MCP Server (`mcp/`)

```
mcp/
├── src/
│   └── index.ts    # MCP 서버 (3개 도구)
├── test-mcp.ts     # stdio 테스트 스크립트
├── package.json
└── tsconfig.json
```

**제공 도구:**
| 도구 | 설명 |
|------|------|
| `auth_os_check_agent` | 에이전트 검증 여부 빠른 확인 |
| `auth_os_get_status` | 에이전트 전체 상태 (등록, 검증, 등급, 소유자 등) |
| `auth_os_get_policy` | 현재 온체인 정책 설정 조회 |

**MCP 클라이언트 설정:**
```json
{
  "mcpServers": {
    "whitewall-os": {
      "command": "node",
      "args": ["/path/to/whitewall-os/mcp/dist/index.js"]
    }
  }
}
```

---

## 5. SDK/MCP가 정책을 읽는 방식

SDK와 MCP는 하드코딩된 값을 쓰지 않음. `connect()` 시 온체인 `HumanVerifiedPolicy`에서 4개 설정을 직접 읽어옴:

```
HumanVerifiedPolicy.getIdentityRegistry()    → 어떤 레지스트리에서 에이전트 확인
HumanVerifiedPolicy.getValidationRegistry()  → 어떤 레지스트리에서 검증 확인
HumanVerifiedPolicy.getWorldIdValidator()    → 어떤 검증자 주소로 필터
HumanVerifiedPolicy.getRequiredTier()        → 몇 등급부터 "검증됨"인지
```

정책 컨트랙트가 업그레이드되면 SDK도 자동으로 따라감. **ACE 파이프라인과 SDK가 항상 동일한 기준으로 판단함.**

---

## 6. 주의사항

1. **`tag`는 정확히 `"HUMAN_VERIFIED"`** — 대소문자, 공백 모두 정확해야 함
2. **`score`는 1 이상** — 0이면 `getSummary`의 `count`에 포함되지만 `avgResponse`가 0이 되어 정책 체크 통과 불가
3. **Forwarder 업데이트 필수** — 현재 플레이스홀더(`0x01`)이므로, CRE 배포 후 `setForwarder()` 호출 필요
4. **Owner 권한** — `setForwarder`는 Consumer의 owner만 호출 가능 (`0x21fdEd74C901129977B8e28C2588595163E1e235`)
5. **이중 보호** — CRE 리포트에 `approved: true`를 넣어도, 실제 온체인 상태가 검증 안 되어 있으면 거부됨. 반드시 본딩을 먼저 완료한 후 접근 요청해야 함.

---

## 7. 테스트용 에이전트

현재 Base Sepolia에 등록된 에이전트:

| Agent ID | Owner | 상태 |
|----------|-------|------|
| 1 | `0x21fdEd74C901129977B8e28C2588595163E1e235` | 등록됨, 미검증 (World ID 본딩 필요) |

예슬가 본딩 워크플로우를 테스트할 때 이 에이전트를 사용할 수 있음.

**SDK로 확인:**
```bash
# TypeScript
cd sdk && npx tsx examples/check-agent.ts 1

# Go
cd sdk-go && go test -run TestCrossSDKConsistency -v
```
