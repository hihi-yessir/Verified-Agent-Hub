// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IWhitewallOS
 * @notice Public interface for querying Whitewall OS agent status.
 *         Used by the Solidity SDK (WhitewallOSGuard) and TypeScript SDK.
 *
 * Reads from IdentityRegistry + ValidationRegistry to provide
 * a unified view of agent verification status.
 */
interface IWhitewallOS {
    struct AgentStatus {
        bool isRegistered;
        bool isHumanVerified;
        uint8 tier;
        address owner;
        address accountableHuman;
        uint256 lastVerified;
    }

    /// @notice Check if an agent (by tokenId) is registered
    function isRegistered(uint256 agentId) external view returns (bool);

    /// @notice Check if an agent has a HUMAN_VERIFIED bond
    function isHumanVerified(uint256 agentId) external view returns (bool);

    /// @notice Get the verification tier of an agent
    function getTier(uint256 agentId) external view returns (uint8);

    /// @notice Get the full agent status
    function getAgentStatus(uint256 agentId) external view returns (AgentStatus memory);

    /// @notice Look up agentId by wallet address (reverse lookup)
    function getAgentByWallet(address wallet) external view returns (uint256 agentId);
}
