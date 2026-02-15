package whitewallos

import (
	"github.com/ethereum/go-ethereum/accounts/abi"
	"strings"
)

// ABI JSON strings for contract interactions.
// Only includes the functions the SDK actually calls.

const humanVerifiedPolicyABIJSON = `[
	{"inputs":[],"name":"getIdentityRegistry","outputs":[{"name":"","type":"address"}],"stateMutability":"view","type":"function"},
	{"inputs":[],"name":"getValidationRegistry","outputs":[{"name":"","type":"address"}],"stateMutability":"view","type":"function"},
	{"inputs":[],"name":"getWorldIdValidator","outputs":[{"name":"","type":"address"}],"stateMutability":"view","type":"function"},
	{"inputs":[],"name":"getRequiredTier","outputs":[{"name":"","type":"uint8"}],"stateMutability":"view","type":"function"}
]`

const identityRegistryABIJSON = `[
	{"inputs":[{"name":"tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"name":"","type":"address"}],"stateMutability":"view","type":"function"},
	{"inputs":[{"name":"agentId","type":"uint256"}],"name":"getAgentWallet","outputs":[{"name":"","type":"address"}],"stateMutability":"view","type":"function"},
	{"inputs":[{"name":"owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
	{"inputs":[{"name":"tokenId","type":"uint256"}],"name":"tokenURI","outputs":[{"name":"","type":"string"}],"stateMutability":"view","type":"function"},
	{"inputs":[{"name":"agentId","type":"uint256"},{"name":"metadataKey","type":"string"}],"name":"getMetadata","outputs":[{"name":"","type":"bytes"}],"stateMutability":"view","type":"function"}
]`

const validationRegistryABIJSON = `[
	{"inputs":[{"name":"agentId","type":"uint256"},{"name":"validatorAddresses","type":"address[]"},{"name":"tag","type":"string"}],"name":"getSummary","outputs":[{"name":"count","type":"uint64"},{"name":"avgResponse","type":"uint8"}],"stateMutability":"view","type":"function"},
	{"inputs":[{"name":"agentId","type":"uint256"}],"name":"getAgentValidations","outputs":[{"name":"","type":"bytes32[]"}],"stateMutability":"view","type":"function"}
]`

var (
	HumanVerifiedPolicyABI abi.ABI
	IdentityRegistryABI    abi.ABI
	ValidationRegistryABI  abi.ABI
)

func init() {
	var err error
	HumanVerifiedPolicyABI, err = abi.JSON(strings.NewReader(humanVerifiedPolicyABIJSON))
	if err != nil {
		panic("failed to parse HumanVerifiedPolicy ABI: " + err.Error())
	}
	IdentityRegistryABI, err = abi.JSON(strings.NewReader(identityRegistryABIJSON))
	if err != nil {
		panic("failed to parse IdentityRegistry ABI: " + err.Error())
	}
	ValidationRegistryABI, err = abi.JSON(strings.NewReader(validationRegistryABIJSON))
	if err != nil {
		panic("failed to parse ValidationRegistry ABI: " + err.Error())
	}
}
