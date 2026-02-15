package whitewallos

import "github.com/ethereum/go-ethereum/common"

// ChainName identifies a supported chain.
type ChainName string

const (
	BaseSepolia ChainName = "baseSepolia"
)

// Addresses holds the protocol entry points for a chain.
// Only the policy and consumer are needed — registry addresses
// are discovered from the on-chain policy contract at connect time.
type Addresses struct {
	HumanVerifiedPolicy common.Address
	WhitewallConsumer   common.Address
}

// PolicyConfig holds the protocol configuration read from the
// on-chain HumanVerifiedPolicy contract. The SDK reads these
// at connect time so it mirrors the actual ACE pipeline.
type PolicyConfig struct {
	IdentityRegistry   common.Address
	ValidationRegistry common.Address
	WorldIDValidator   common.Address
	RequiredTier       uint8
}

// ChainRPC maps chain names to their default public RPC endpoints.
var ChainRPC = map[ChainName]string{
	BaseSepolia: "https://sepolia.base.org",
}

// ChainAddresses maps chain names to their deployed protocol addresses.
var ChainAddresses = map[ChainName]Addresses{
	BaseSepolia: {
		HumanVerifiedPolicy: common.HexToAddress("0x8f66f55f4ade4e64b105820972d444a56449e8b3"),
		WhitewallConsumer:   common.HexToAddress("0xec3114ea6bb29f77b63cd1223533870b663120bb"),
	},
}
