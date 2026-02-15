package whitewallos

import (
	"context"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
)

const humanVerifiedTag = "HUMAN_VERIFIED"

// WhitewallOS is the main SDK client. Create one via Connect().
type WhitewallOS struct {
	client *ethclient.Client
	addrs  Addresses
	policy PolicyConfig
}

// Config holds the configuration for connecting to Whitewall OS.
type Config struct {
	Chain  ChainName
	RPCUrl string // optional override
}

// Connect creates a new WhitewallOS client and reads policy config from chain.
// This mirrors the on-chain HumanVerifiedPolicy to ensure the SDK
// uses the same registries, validators, and tier requirements as ACE.
func Connect(ctx context.Context, cfg Config) (*WhitewallOS, error) {
	addrs, ok := ChainAddresses[cfg.Chain]
	if !ok {
		return nil, fmt.Errorf("unsupported chain: %s", cfg.Chain)
	}

	rpcUrl := cfg.RPCUrl
	if rpcUrl == "" {
		rpcUrl = ChainRPC[cfg.Chain]
	}

	client, err := ethclient.DialContext(ctx, rpcUrl)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RPC: %w", err)
	}

	a := &WhitewallOS{client: client, addrs: addrs}
	if err := a.loadPolicyConfig(ctx); err != nil {
		return nil, fmt.Errorf("failed to read policy config from chain: %w", err)
	}

	return a, nil
}

// loadPolicyConfig reads all 4 config values from HumanVerifiedPolicy.
func (a *WhitewallOS) loadPolicyConfig(ctx context.Context) error {
	addr := a.addrs.HumanVerifiedPolicy

	identityRegistry, err := a.callAddress(ctx, addr, HumanVerifiedPolicyABI, "getIdentityRegistry")
	if err != nil {
		return fmt.Errorf("getIdentityRegistry: %w", err)
	}
	validationRegistry, err := a.callAddress(ctx, addr, HumanVerifiedPolicyABI, "getValidationRegistry")
	if err != nil {
		return fmt.Errorf("getValidationRegistry: %w", err)
	}
	worldIdValidator, err := a.callAddress(ctx, addr, HumanVerifiedPolicyABI, "getWorldIdValidator")
	if err != nil {
		return fmt.Errorf("getWorldIdValidator: %w", err)
	}
	requiredTier, err := a.callUint8(ctx, addr, HumanVerifiedPolicyABI, "getRequiredTier")
	if err != nil {
		return fmt.Errorf("getRequiredTier: %w", err)
	}

	a.policy = PolicyConfig{
		IdentityRegistry:   identityRegistry,
		ValidationRegistry: validationRegistry,
		WorldIDValidator:   worldIdValidator,
		RequiredTier:       requiredTier,
	}
	return nil
}

// ─── Core Read Methods ───

// IsRegistered checks if an agent exists in the IdentityRegistry.
func (a *WhitewallOS) IsRegistered(ctx context.Context, agentId *big.Int) (bool, error) {
	owner, err := a.GetOwner(ctx, agentId)
	if err != nil {
		return false, nil // ownerOf reverts for non-existent tokens
	}
	return owner != ZeroAddress, nil
}

// IsHumanVerified checks if an agent meets the protocol's verification requirements.
func (a *WhitewallOS) IsHumanVerified(ctx context.Context, agentId *big.Int) (bool, error) {
	summary, err := a.GetValidationSummary(ctx, agentId)
	if err != nil {
		return false, err
	}
	return summary.Count > 0 && summary.AvgScore >= a.policy.RequiredTier, nil
}

// GetOwner returns the owner address of an agent NFT.
func (a *WhitewallOS) GetOwner(ctx context.Context, agentId *big.Int) (common.Address, error) {
	return a.callAddress(ctx, a.policy.IdentityRegistry, IdentityRegistryABI, "ownerOf", agentId)
}

// GetAgentWallet returns the operating wallet address of an agent.
func (a *WhitewallOS) GetAgentWallet(ctx context.Context, agentId *big.Int) (common.Address, error) {
	return a.callAddress(ctx, a.policy.IdentityRegistry, IdentityRegistryABI, "getAgentWallet", agentId)
}

// GetTokenURI returns the token URI for an agent.
func (a *WhitewallOS) GetTokenURI(ctx context.Context, agentId *big.Int) (string, error) {
	return a.callString(ctx, a.policy.IdentityRegistry, IdentityRegistryABI, "tokenURI", agentId)
}

// GetMetadata returns metadata bytes for an agent and key.
func (a *WhitewallOS) GetMetadata(ctx context.Context, agentId *big.Int, key string) ([]byte, error) {
	return a.callBytes(ctx, a.policy.IdentityRegistry, IdentityRegistryABI, "getMetadata", agentId, key)
}

// ─── Validation ───

// GetValidationSummary returns the validation count and avg score for an agent.
// Uses the worldIdValidator and HUMAN_VERIFIED tag from the on-chain policy config.
func (a *WhitewallOS) GetValidationSummary(ctx context.Context, agentId *big.Int) (*ValidationSummary, error) {
	validators := []common.Address{a.policy.WorldIDValidator}

	data, err := ValidationRegistryABI.Pack("getSummary", agentId, validators, humanVerifiedTag)
	if err != nil {
		return nil, fmt.Errorf("pack getSummary: %w", err)
	}

	result, err := a.client.CallContract(ctx, ethereum.CallMsg{
		To:   &a.policy.ValidationRegistry,
		Data: data,
	}, nil)
	if err != nil {
		return nil, fmt.Errorf("call getSummary: %w", err)
	}

	unpacked, err := ValidationRegistryABI.Unpack("getSummary", result)
	if err != nil {
		return nil, fmt.Errorf("unpack getSummary: %w", err)
	}

	return &ValidationSummary{
		Count:    unpacked[0].(uint64),
		AvgScore: unpacked[1].(uint8),
	}, nil
}

// GetAgentValidations returns all validation request hashes for an agent.
func (a *WhitewallOS) GetAgentValidations(ctx context.Context, agentId *big.Int) ([][32]byte, error) {
	data, err := ValidationRegistryABI.Pack("getAgentValidations", agentId)
	if err != nil {
		return nil, fmt.Errorf("pack getAgentValidations: %w", err)
	}

	result, err := a.client.CallContract(ctx, ethereum.CallMsg{
		To:   &a.policy.ValidationRegistry,
		Data: data,
	}, nil)
	if err != nil {
		return nil, fmt.Errorf("call getAgentValidations: %w", err)
	}

	unpacked, err := ValidationRegistryABI.Unpack("getAgentValidations", result)
	if err != nil {
		return nil, fmt.Errorf("unpack getAgentValidations: %w", err)
	}

	return unpacked[0].([][32]byte), nil
}

// ─── Composite ───

// GetAgentStatus returns the full verification status of an agent.
func (a *WhitewallOS) GetAgentStatus(ctx context.Context, agentId *big.Int) (*AgentStatus, error) {
	registered, err := a.IsRegistered(ctx, agentId)
	if err != nil {
		return nil, err
	}
	if !registered {
		return &AgentStatus{}, nil
	}

	owner, err := a.GetOwner(ctx, agentId)
	if err != nil {
		return nil, err
	}
	wallet, err := a.GetAgentWallet(ctx, agentId)
	if err != nil {
		return nil, err
	}
	summary, err := a.GetValidationSummary(ctx, agentId)
	if err != nil {
		return nil, err
	}

	verified := summary.Count > 0 && summary.AvgScore >= a.policy.RequiredTier
	tier := uint8(1)
	if verified {
		tier = a.policy.RequiredTier
	}

	return &AgentStatus{
		IsRegistered:    true,
		IsHumanVerified: verified,
		Tier:            tier,
		Owner:           owner,
		AgentWallet:     wallet,
		ValidationCount: summary.Count,
	}, nil
}

// ─── Utilities ───

// GetPolicyConfig returns the protocol policy config read from chain.
func (a *WhitewallOS) GetPolicyConfig() PolicyConfig {
	return a.policy
}

// GetAddresses returns the protocol entry point addresses.
func (a *WhitewallOS) GetAddresses() Addresses {
	return a.addrs
}

// Close closes the underlying RPC client.
func (a *WhitewallOS) Close() {
	a.client.Close()
}

// ─── Internal helpers ───

func (a *WhitewallOS) callRaw(ctx context.Context, to common.Address, abiDef interface{ Pack(string, ...interface{}) ([]byte, error) }, method string, args ...interface{}) ([]byte, error) {
	data, err := abiDef.Pack(method, args...)
	if err != nil {
		return nil, fmt.Errorf("pack %s: %w", method, err)
	}
	return a.client.CallContract(ctx, ethereum.CallMsg{To: &to, Data: data}, nil)
}

func (a *WhitewallOS) callAddress(ctx context.Context, to common.Address, abiDef interface {
	Pack(string, ...interface{}) ([]byte, error)
	Unpack(string, []byte) ([]interface{}, error)
}, method string, args ...interface{}) (common.Address, error) {
	result, err := a.callRaw(ctx, to, abiDef, method, args...)
	if err != nil {
		return ZeroAddress, err
	}
	unpacked, err := abiDef.Unpack(method, result)
	if err != nil {
		return ZeroAddress, fmt.Errorf("unpack %s: %w", method, err)
	}
	return unpacked[0].(common.Address), nil
}

func (a *WhitewallOS) callUint8(ctx context.Context, to common.Address, abiDef interface {
	Pack(string, ...interface{}) ([]byte, error)
	Unpack(string, []byte) ([]interface{}, error)
}, method string, args ...interface{}) (uint8, error) {
	result, err := a.callRaw(ctx, to, abiDef, method, args...)
	if err != nil {
		return 0, err
	}
	unpacked, err := abiDef.Unpack(method, result)
	if err != nil {
		return 0, fmt.Errorf("unpack %s: %w", method, err)
	}
	return unpacked[0].(uint8), nil
}

func (a *WhitewallOS) callString(ctx context.Context, to common.Address, abiDef interface {
	Pack(string, ...interface{}) ([]byte, error)
	Unpack(string, []byte) ([]interface{}, error)
}, method string, args ...interface{}) (string, error) {
	result, err := a.callRaw(ctx, to, abiDef, method, args...)
	if err != nil {
		return "", err
	}
	unpacked, err := abiDef.Unpack(method, result)
	if err != nil {
		return "", fmt.Errorf("unpack %s: %w", method, err)
	}
	return unpacked[0].(string), nil
}

func (a *WhitewallOS) callBytes(ctx context.Context, to common.Address, abiDef interface {
	Pack(string, ...interface{}) ([]byte, error)
	Unpack(string, []byte) ([]interface{}, error)
}, method string, args ...interface{}) ([]byte, error) {
	result, err := a.callRaw(ctx, to, abiDef, method, args...)
	if err != nil {
		return nil, err
	}
	unpacked, err := abiDef.Unpack(method, result)
	if err != nil {
		return nil, fmt.Errorf("unpack %s: %w", method, err)
	}
	return unpacked[0].([]byte), nil
}
