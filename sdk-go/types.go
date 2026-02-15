package whitewallos

import (
	"github.com/ethereum/go-ethereum/common"
	"math/big"
)

// AgentStatus is the full verification status of a Whitewall OS agent.
type AgentStatus struct {
	IsRegistered    bool
	IsHumanVerified bool
	Tier            uint8
	Owner           common.Address
	AgentWallet     common.Address
	ValidationCount uint64
}

// ValidationSummary holds the result of a getSummary call.
type ValidationSummary struct {
	Count    uint64
	AvgScore uint8
}

// ZeroAddress is the Ethereum zero address.
var ZeroAddress = common.Address{}

// ZeroBigInt is a zero-value *big.Int.
var ZeroBigInt = big.NewInt(0)
