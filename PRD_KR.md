# Whitewall OS — 제품 요구사항 정의서 (PRD)

> **한 줄 요약**: Whitewall OS는 AI 에이전트를 검증된 인간에 본딩하는 접근 제어 프로토콜. Chainlink CRE + ACE + CCIP + World ID + ERC-8004 기반. **프로토콜 + SDK**로 출시 — 어떤 dApp이든 Solidity 3줄 / TypeScript 1줄로 통합.

---

## 1. 문제

AI 에이전트가 온체인 자율 행위자가 되고 있다. 하지만:

- **책임 부재** — 에이전트가 프로토콜을 공격하면, 누가 책임지나?
- **시빌 공격** — 한 사람이 에이전트 1000개를 만들어 리소스 탈취, 거버넌스 조작, 에어드랍 파밍 가능
- **이진적 접근** — 현재는 "모두 허용" (혼란) 아니면 "엄격한 KYC" (중앙화). 중간이 없음.

**핵심**: dApp들은 "이 에이전트 뒤에 진짜 고유한 인간이 있나?"를 확인할 방법이 없다.

---

## 2. 솔루션

**Whitewall OS** = 에이전트 경제를 위한 접근 제어 엔진.

```
아무 dApp               Whitewall OS 프로토콜                검증 소스
┌──────────┐     ┌─────────────────────────┐     ┌──────────────────────┐
│ DeFi     │     │  ACE (접근 제어)         │     │  World ID (인간 검증)  │
│ DAO      │────▶│  CRE (오프체인 로직)      │◀───▶│  ERC-8004 (에이전트 ID)│
│ 파우셋    │     │  CCIP (크로스체인)        │     │  평판 데이터           │
│ 아무 앱   │     │  SDK / MCP              │     │                      │
└──────────┘     └─────────────────────────┘     └──────────────────────┘
```

**핵심 아이디어**: 모든 에이전트는 검증된 인간에게 암호학적으로 본딩되어야 함. Whitewall OS가 이 본딩을 프로토콜 레벨에서 강제.

---

## 3. 핵심 기능

### 3.1 인간-에이전트 본딩 (World ID)
- 인간이 World ID로 인증 (프라이버시 보존 생체 증명)
- CRE가 Confidential HTTP로 오프체인 검증
- 본딩이 온체인 기록: `에이전트 #42 → HUMAN_VERIFIED`
- 시빌 방지: 같은 인간이 무한 에이전트 본딩 불가 (nullifier 기반)

### 3.2 5-게이트 접근 제어 파이프라인
모든 접근 요청이 5개 순차 게이트를 통과:

| 게이트 | 체크 내용 | 실패 시 |
|--------|----------|---------|
| 1. 신원 | 이 주소가 등록된 에이전트인가? | 거부: "미등록" |
| 2. 검증 | HUMAN_VERIFIED 본딩이 있는가? | 거부: "인간 미인증" |
| 3. 유효성 | 인증이 아직 유효한가 (TTL)? | 거부: "만료" |
| 4. 평판 | 에이전트의 신뢰 점수는? | 접근 등급 결정 |
| 5. 실행 | 모든 게이트 통과 → 트랜잭션 승인 | 접근 허가 |

### 3.3 크로스체인 신원 (CCIP)
- 에이전트가 Chain A에서 인증 → Chain B의 dApp에 접근
- CRE가 CCIP Read로 Chain A 레지스트리 조회
- **"한 번 인증, 어디서든 사용"**

### 3.4 SDK / 프로토콜 레이어 (차별화 포인트)

Whitewall OS는 데모앱이 아니라 **끼워 쓰는 프로토콜**.

**Solidity SDK** — 아무 컨트랙트가 `WhitewallOSGuard` 상속:
```solidity
contract MyDeFi is WhitewallOSGuard {
    function withdraw(uint256 amt) external requireHumanVerified(msg.sender) {
        // Whitewall OS가 자동으로 보호
    }
}
```

**TypeScript SDK** — 아무 프론트엔드가 통합:
```typescript
const wos = new WhitewallOS({ chain: 'sepolia' })
const status = await wos.getAgentStatus('0xAgent...')
// → { tier: 2, verified: true, reputation: 85, ttlRemaining: '29d' }
```

**MCP 서버** — AI 에이전트가 다른 AI 에이전트를 검증:
```
Tool: auth_os_check_agent
Input: { address: "0xAgent..." }
Output: { verified: true, tier: 2, owner: "0xHuman..." }
```

---

## 4. 기술 아키텍처

### 4.1 기술 스택

| 레이어 | 기술 | 역할 |
|--------|------|------|
| 스마트 컨트랙트 | Solidity + Foundry | 온체인 상태 + 접근 제어 |
| 오프체인 로직 | Chainlink CRE | 워크플로우 실행 (검증, 체크, 승인) |
| 접근 제어 | Chainlink ACE | 정책 엔진 (PolicyProtected + runPolicy) |
| 크로스체인 | Chainlink CCIP | 체인 간 레지스트리 조회 |
| 인간 검증 | World ID | 프라이버시 보존 신원 증명 |
| 에이전트 신원 | ERC-8004 | 에이전트 등록 + 검증 기록 |
| 비밀 보호 | Confidential HTTP | API 키 보호 (World ID 키) |
| 프론트엔드 | Next.js + RainbowKit | 대시보드 + 데모 |
| SDK | TypeScript + Solidity | 프로토콜 통합 레이어 |
| AI 통합 | MCP 서버 | 에이전트 간 검증 |

### 4.2 스마트 컨트랙트

| 컨트랙트 | 용도 |
|----------|------|
| `IdentityRegistry` | ERC-721 에이전트 등록. agentId, 소유자, 메타데이터 저장. |
| `ValidationRegistry` | 검증 기록. HUMAN_VERIFIED 본딩 + 타임스탬프 저장. |
| `WhitewallConsumer` | ACE 컨슈머. DON 서명 리포트를 받아 본딩/클레임 로직 실행. |
| `WhitewallExtractor` | 리포트 바이트를 정책 엔진용 구조화 파라미터로 파싱. |
| `HumanVerifiedPolicy` | 온체인 안전장치. CRE가 해킹돼도 미인증 에이전트 차단. |
| `ResourceGateway` | 데모 dApp. 검증된 에이전트에게 토큰 배포. |
| `WhitewallOSGuard` | SDK abstract 컨트랙트. 아무 dApp이 상속하면 즉시 보호. |
| `IWhitewallOS` | 공개 인터페이스. `isRegistered()`, `isHumanVerified()`, `getTier()`. |

### 4.3 CRE 워크플로우 (EVM 이벤트 트리거)

모든 워크플로우는 **이벤트 기반** (탈중앙화 — HTTP 서버 없음):

**본딩 워크플로우** — `ValidationRequest` 이벤트로 트리거:
```
온체인 이벤트 → CRE 감지 → 증명 가져오기 → World ID API에 Confidential HTTP
→ 시빌 체크 → DON 리포트 서명 → WhitewallConsumer에 기록 → 본딩 완료
```

**클레임 워크플로우** — `AccessRequested` 이벤트로 트리거:
```
온체인 이벤트 → CRE 감지 → 게이트 1-5 체크 (레지스트리 읽기)
→ DON 리포트 서명 → WhitewallConsumer에 기록 → 승인 또는 거부
```

**크로스체인 클레임 워크플로우** — Chain B에서 트리거:
```
Chain B 이벤트 → CRE 감지 → CCIP로 Chain A 레지스트리 읽기
→ 검증 확인 → DON 서명 → Chain B에서 실행
```

### 4.4 체인
- **Chain A (Sepolia)**: 신원 + 검증 레지스트리, WhitewallConsumer, 본딩
- **Chain B (Avalanche Fuji)**: ResourceGateway, 크로스체인 클레임

---

## 5. 데모 계획

### 5.1 포지셔닝
**"파이프라인이 데모다."**

유즈케이스는 의도적으로 단순하게 (에이전트가 리소스에 접근 요청).
인상적인 부분은 **전체 파이프라인이 실시간으로 돌아가는 것** + **SDK로 얼마나 쉽게 통합하는지**.

### 5.2 데모 흐름 (4막, ~5분)

**Act 1: 문제 (30초)**
> "AI 에이전트가 DeFi에 접근하는데, 뒤에 누가 있는지 아무도 모릅니다."
- 봇 스웜이 리소스를 탈취하는 시뮬레이션

**Act 2: 파이프라인 (2분)** — 기술적 깊이
> "Whitewall OS가 미인증 에이전트를 전부 차단합니다. 지켜보세요."
- Whitewall OS 활성화. 같은 공격.
- 대시보드에서 전체 파이프라인 실시간 표시:
  - `[EVENT]` AccessRequested 감지
  - `[CRE]` 워크플로우 트리거 (0.5초)
  - `[GATE 1]` 신원 확인 → PASS/FAIL
  - `[GATE 2]` 인간 검증 → PASS/FAIL
  - `[GATE 3]` TTL 체크 → PASS/FAIL
  - `[GATE 4]` 평판 → 점수: 85
  - `[DON]` 3/5 노드 리포트 서명
  - `[ACE]` 정책 엔진: 승인
  - `[TX]` 100 토큰 전송
- 봇: 빨간 거부 로그. 인증된 에이전트: 초록 성공.
- 크로스체인: 다른 체인에서 CCIP 검증 표시

**Act 3: SDK (1분)** — 실사용성
> "이 복잡한 파이프라인을? 당신 앱에 3줄이면 붙습니다."
- Solidity: `contract MyApp is WhitewallOSGuard { ... }`
- TypeScript: `wos.getAgentStatus(address)`
- MCP: AI 에이전트가 다른 에이전트 검증

**Act 4: 직접 해보기 (1분)** — 인터랙티브
> "직접 해보세요. 지갑 연결. 에이전트 등록. 인증."
- 심사위원이 지갑 연결
- 에이전트 등록 (파이프라인 시작)
- World ID 인증 (전체 본딩 파이프라인 표시)
- 리소스 클레임 (5-게이트 파이프라인 표시)
- 성공

### 5.3 대시보드 레이아웃

```
┌──────────────────────────────────────────────────────────┐
│  Whitewall OS 대시보드                                         │
├──────────────┬───────────────────────────────────────────┤
│              │                                            │
│  컨트롤 패널  │     파이프라인 시각화                        │
│              │                                            │
│  [봇 스웜]    │  이벤트 → CRE → WorldID → 시빌체크         │
│  [등록된 봇]  │    → DON 서명 → ACE 정책 → 실행           │
│  [인증된 유저] │                                           │
│  [크로스체인]  │  각 단계: 타이밍, 상태, 체인 정보           │
│              │                                            │
│  [직접 해보기]│                                            │
│              │                                            │
├──────────────┴───────────────────────────────────────────┤
│  SDK 쇼케이스                                              │
│  [Solidity] [TypeScript] [MCP]                           │
│  코드 스니펫 ←→ 실제 실행 결과 나란히                       │
├──────────────────────────────────────────────────────────┤
│  실시간 터미널                                             │
│  [ACE] Gate 1: 신원 ✅ (0.3초)                            │
│  [ACE] Gate 2: 인간 검증 ❌ — 거부                        │
│  [CCIP] Sepolia 크로스체인 읽기 ✅ (4.1초)                 │
│  [DON] 3/5 노드 리포트 서명 ✅                             │
└──────────────────────────────────────────────────────────┘
```

---

## 6. 프로젝트 구조

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
├── workflows/                    # CRE TypeScript 워크플로우
│   ├── bonding-workflow/         # World ID 검증 + 밸리데이션 기록
│   ├── claim-workflow/           # 5-게이트 체크 + 승인/거부
│   └── crosschain-claim-workflow/# CCIP 읽기 + 크로스체인 승인
├── sdk/                          # TypeScript SDK (@whitewall-os/sdk)
│   └── src/                      # Client, types, 이벤트 구독
├── mcp/                          # MCP 서버 (@whitewall-os/mcp)
│   └── src/                      # MCP 도구 정의
└── app/                          # Next.js 대시보드
    └── src/
        ├── components/           # PipelineVisualizer, PersonaPanel,
        │                         # LiveTerminal, SDKShowcase, TryItYourself
        └── lib/                  # 컨트랙트 ABI, 파이프라인 추적
```

---

## 7. 빌드 계획

### Phase 1: 코어 컨트랙트
> 모든 작업의 기반. 이게 먼저.

- IdentityRegistry (ERC-721 에이전트 등록)
- ValidationRegistry (검증 기록)
- WhitewallConsumer (ACE 컨슈머: `onReport` + `runPolicy`)
- WhitewallExtractor (리포트 파서)
- HumanVerifiedPolicy (온체인 안전장치)
- ResourceGateway (데모 dApp)
- IWhitewallOS + WhitewallOSGuard (Solidity SDK)

### Phase 2: CRE 워크플로우 (순차, Phase 1 의존)
- 본딩 워크플로우 (Confidential HTTP로 World ID 검증)
- 클레임 워크플로우 (5-게이트 접근 제어)

### Phase 3: SDK + 대시보드 (Phase 2와 병렬 가능)
- TypeScript SDK (컨트랙트 래퍼 + 이벤트 구독)
- 대시보드 (파이프라인 시각화 + 페르소나 패널 + 라이브 터미널 + SDK 쇼케이스 + 직접 해보기)

### Phase 4: 크로스체인 + MCP (Phase 2 이후)
- CCIP 크로스체인 클레임 워크플로우
- MCP 서버 (TS SDK 위의 얇은 래퍼)

### 의존성 그래프

```
Phase 1 (컨트랙트)
  ├──▶ Phase 2 (CRE 워크플로우)
  │      └──▶ Phase 4a (CCIP 워크플로우)
  └──▶ Phase 3 (SDK + 대시보드) ──▶ Phase 4b (MCP)
```

---

## 8. 타겟 상금 트랙

- **CRE & AI (메인)**: AI 에이전트 검증을 위한 CRE 워크플로우 오케스트레이션
- **Risk & Compliance**: 자율 에이전트를 위한 탈중앙화 "KYC"
- **스폰서 (World)**: 에이전트 책임 추적을 위한 World ID 활용
- **DeFi & Tokenization**: CCIP를 통한 크로스체인 에이전트 접근

---

## 9. 주요 설계 결정

| 결정 사항 | 선택 | 이유 |
|-----------|------|------|
| 트리거 방식 | EVM 이벤트 (HTTP 아님) | 탈중앙화 — 서버 불필요 |
| 프라이버시 | Confidential HTTP만 | Private Tx는 온체인 상태 변경(balanceOf)을 숨기지 못함. Privacy Pools 수준 기능 나오면 재도입. |
| 데모 유즈케이스 | 단순한 리소스 접근 | 유즈케이스는 트리거일 뿐 — **파이프라인 시각화가 진짜 데모** |
| 템플릿 | `stablecoin-ace-ccip` 포크 | Whitewall OS 아키텍처와 거의 1:1 패턴 매칭 |
| SDK 접근법 | Solidity + TS + MCP | 세 가지 통합 레벨: 컨트랙트 / 프론트엔드 / AI 에이전트 |

---

## 10. 참고 자료

| 항목 | 위치 |
|------|------|
| ACE Consumer 패턴 | `~/github/cre-templates/.../MintingConsumerWithACE.sol` |
| ACE Policy 패턴 | `~/github/cre-templates/.../AddressBlacklistPolicy.sol` |
| CRE Workflow 패턴 | `~/github/cre-templates/.../bank-stablecoin-por-ace-ccip-workflow/main.ts` |
| PolicyProtected 베이스 | `~/github/chainlink-ace/src/PolicyProtected.sol` |
| 아키텍처 다이어그램 (EN) | `~/whitewall-os-diagram.html` |
| 아키텍처 다이어그램 (KR) | `~/whitewall-os-diagram-kr.html` |
| 원본 설계 문서 | `~/implementation_plan_idea_1.md` |
