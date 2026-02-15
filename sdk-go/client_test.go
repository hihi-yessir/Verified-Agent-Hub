package whitewallos

import (
	"context"
	"math/big"
	"strings"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum/common"
)

// ─── Test helpers ───

func connectOrSkip(t *testing.T) *WhitewallOS {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	a, err := Connect(ctx, Config{Chain: BaseSepolia})
	if err != nil {
		t.Fatalf("Connect failed: %v", err)
	}
	t.Cleanup(func() { a.Close() })
	return a
}

var (
	existingAgent    = big.NewInt(1)
	nonExistentAgent = big.NewInt(999999)
)

// ─── Connect: Policy Config from Chain ───

func TestConnect_ReadsPolicyConfig(t *testing.T) {
	a := connectOrSkip(t)
	cfg := a.GetPolicyConfig()

	if cfg.IdentityRegistry == ZeroAddress {
		t.Error("IdentityRegistry is zero address")
	}
	if cfg.ValidationRegistry == ZeroAddress {
		t.Error("ValidationRegistry is zero address")
	}
	if cfg.WorldIDValidator == ZeroAddress {
		t.Error("WorldIDValidator is zero address")
	}
	if cfg.RequiredTier != 2 {
		t.Errorf("RequiredTier = %d, want 2", cfg.RequiredTier)
	}
}

func TestConnect_DiscoveredAddressesMatchDeployed(t *testing.T) {
	a := connectOrSkip(t)
	cfg := a.GetPolicyConfig()

	expectedIdentity := common.HexToAddress("0x8004A818BFB912233c491871b3d84c89A494BD9e")
	expectedValidation := common.HexToAddress("0x8004Cb1BF31DAf7788923b405b754f57acEB4272")

	if !strings.EqualFold(cfg.IdentityRegistry.Hex(), expectedIdentity.Hex()) {
		t.Errorf("IdentityRegistry = %s, want %s", cfg.IdentityRegistry.Hex(), expectedIdentity.Hex())
	}
	if !strings.EqualFold(cfg.ValidationRegistry.Hex(), expectedValidation.Hex()) {
		t.Errorf("ValidationRegistry = %s, want %s", cfg.ValidationRegistry.Hex(), expectedValidation.Hex())
	}
}

func TestConnect_UnsupportedChain(t *testing.T) {
	ctx := context.Background()
	_, err := Connect(ctx, Config{Chain: "fakechain"})
	if err == nil {
		t.Error("expected error for unsupported chain, got nil")
	}
}

// ─── IsRegistered ───

func TestIsRegistered_ExistingAgent(t *testing.T) {
	a := connectOrSkip(t)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	registered, err := a.IsRegistered(ctx, existingAgent)
	if err != nil {
		t.Fatalf("IsRegistered error: %v", err)
	}
	if !registered {
		t.Error("agent #1 should be registered")
	}
}

func TestIsRegistered_NonExistentAgent(t *testing.T) {
	a := connectOrSkip(t)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	registered, err := a.IsRegistered(ctx, nonExistentAgent)
	if err != nil {
		t.Fatalf("IsRegistered error: %v", err)
	}
	if registered {
		t.Error("agent #999999 should NOT be registered")
	}
}

// ─── GetOwner ───

func TestGetOwner_ExistingAgent(t *testing.T) {
	a := connectOrSkip(t)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	owner, err := a.GetOwner(ctx, existingAgent)
	if err != nil {
		t.Fatalf("GetOwner error: %v", err)
	}
	if owner == ZeroAddress {
		t.Error("owner should not be zero address")
	}
	t.Logf("Agent #1 owner: %s", owner.Hex())
}

func TestGetOwner_NonExistentAgent(t *testing.T) {
	a := connectOrSkip(t)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	_, err := a.GetOwner(ctx, nonExistentAgent)
	if err == nil {
		t.Error("GetOwner should error for non-existent agent")
	}
}

// ─── GetAgentWallet ───

func TestGetAgentWallet_ExistingAgent(t *testing.T) {
	a := connectOrSkip(t)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	wallet, err := a.GetAgentWallet(ctx, existingAgent)
	if err != nil {
		t.Fatalf("GetAgentWallet error: %v", err)
	}
	t.Logf("Agent #1 wallet: %s", wallet.Hex())
}

// ─── GetValidationSummary ───

func TestGetValidationSummary_ExistingAgent(t *testing.T) {
	a := connectOrSkip(t)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	summary, err := a.GetValidationSummary(ctx, existingAgent)
	if err != nil {
		t.Fatalf("GetValidationSummary error: %v", err)
	}
	t.Logf("Agent #1 validations: count=%d, avgScore=%d", summary.Count, summary.AvgScore)
}

func TestGetValidationSummary_NonExistentAgent(t *testing.T) {
	a := connectOrSkip(t)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	summary, err := a.GetValidationSummary(ctx, nonExistentAgent)
	if err != nil {
		t.Fatalf("GetValidationSummary error: %v", err)
	}
	if summary.Count != 0 {
		t.Errorf("non-existent agent should have 0 validations, got %d", summary.Count)
	}
}

// ─── IsHumanVerified ───

func TestIsHumanVerified_ExistingAgent(t *testing.T) {
	a := connectOrSkip(t)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	verified, err := a.IsHumanVerified(ctx, existingAgent)
	if err != nil {
		t.Fatalf("IsHumanVerified error: %v", err)
	}
	// Agent #1 is not yet human-verified (no World ID bond yet)
	t.Logf("Agent #1 human verified: %v", verified)
}

// ─── GetAgentStatus (full composite) ───

func TestGetAgentStatus_ExistingAgent(t *testing.T) {
	a := connectOrSkip(t)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	status, err := a.GetAgentStatus(ctx, existingAgent)
	if err != nil {
		t.Fatalf("GetAgentStatus error: %v", err)
	}

	if !status.IsRegistered {
		t.Error("agent #1 should be registered")
	}
	if status.Owner == ZeroAddress {
		t.Error("owner should not be zero")
	}
	if status.Tier < 1 || status.Tier > 2 {
		t.Errorf("tier should be 1 or 2, got %d", status.Tier)
	}

	t.Logf("Agent #1 status: registered=%v verified=%v tier=%d owner=%s wallet=%s validations=%d",
		status.IsRegistered, status.IsHumanVerified, status.Tier,
		status.Owner.Hex(), status.AgentWallet.Hex(), status.ValidationCount)
}

func TestGetAgentStatus_NonExistentAgent(t *testing.T) {
	a := connectOrSkip(t)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	status, err := a.GetAgentStatus(ctx, nonExistentAgent)
	if err != nil {
		t.Fatalf("GetAgentStatus error: %v", err)
	}

	if status.IsRegistered {
		t.Error("non-existent agent should not be registered")
	}
	if status.IsHumanVerified {
		t.Error("non-existent agent should not be verified")
	}
	if status.Tier != 0 {
		t.Errorf("tier should be 0, got %d", status.Tier)
	}
	if status.Owner != ZeroAddress {
		t.Errorf("owner should be zero address, got %s", status.Owner.Hex())
	}
}

// ─── GetAgentValidations ───

func TestGetAgentValidations_ExistingAgent(t *testing.T) {
	a := connectOrSkip(t)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	hashes, err := a.GetAgentValidations(ctx, existingAgent)
	if err != nil {
		t.Fatalf("GetAgentValidations error: %v", err)
	}
	t.Logf("Agent #1 has %d validation records", len(hashes))
}

// ─── GetTokenURI ───

func TestGetTokenURI_ExistingAgent(t *testing.T) {
	a := connectOrSkip(t)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	uri, err := a.GetTokenURI(ctx, existingAgent)
	if err != nil {
		t.Fatalf("GetTokenURI error: %v", err)
	}
	t.Logf("Agent #1 URI: %s", uri)
}

// ─── Policy Config Consistency ───

func TestPolicyConfig_UsedByValidationSummary(t *testing.T) {
	a := connectOrSkip(t)
	cfg := a.GetPolicyConfig()

	// The worldIdValidator from policy should be a non-zero address
	if cfg.WorldIDValidator == ZeroAddress {
		t.Error("WorldIDValidator should not be zero")
	}

	// requiredTier should be reasonable
	if cfg.RequiredTier == 0 || cfg.RequiredTier > 10 {
		t.Errorf("RequiredTier = %d, seems unreasonable", cfg.RequiredTier)
	}

	t.Logf("Policy: identityRegistry=%s validationRegistry=%s worldIdValidator=%s requiredTier=%d",
		cfg.IdentityRegistry.Hex(), cfg.ValidationRegistry.Hex(),
		cfg.WorldIDValidator.Hex(), cfg.RequiredTier)
}

// ─── Cross-SDK consistency: same results as TS SDK ───

func TestCrossSDKConsistency_AgentStatus(t *testing.T) {
	a := connectOrSkip(t)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	status, err := a.GetAgentStatus(ctx, existingAgent)
	if err != nil {
		t.Fatalf("GetAgentStatus error: %v", err)
	}

	// These values should match what the TS SDK returns:
	// Agent #1: registered=true, verified=false, tier=1,
	// owner=0x21fdEd74C901129977B8e28C2588595163E1e235
	expectedOwner := common.HexToAddress("0x21fdEd74C901129977B8e28C2588595163E1e235")

	if !status.IsRegistered {
		t.Error("should be registered (TS SDK says true)")
	}
	if status.IsHumanVerified {
		t.Error("should not be verified (TS SDK says false)")
	}
	if status.Tier != 1 {
		t.Errorf("tier = %d, want 1 (TS SDK says 1)", status.Tier)
	}
	if !strings.EqualFold(status.Owner.Hex(), expectedOwner.Hex()) {
		t.Errorf("owner = %s, want %s (TS SDK confirmed)", status.Owner.Hex(), expectedOwner.Hex())
	}
}
