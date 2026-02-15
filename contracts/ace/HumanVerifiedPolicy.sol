// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Policy} from "./vendor/core/Policy.sol";
import {IPolicyEngine} from "./vendor/interfaces/IPolicyEngine.sol";

// Read-only interfaces for on-chain state verification
interface IIdentityRegistryReader {
    function ownerOf(uint256 tokenId) external view returns (address);
}

interface IValidationRegistryReader {
    function getSummary(
        uint256 agentId,
        address[] calldata validatorAddresses,
        string calldata tag
    ) external view returns (uint64 count, uint8 avgResponse);
}

/**
 * @title HumanVerifiedPolicy
 * @notice On-chain safety net for Whitewall OS ACCESS requests.
 *         Independently verifies agent status against on-chain registries —
 *         even if CRE is compromised, this policy blocks unverified agents.
 *
 * Double protection checks:
 *   1. CRE report says approved == true
 *   2. tier >= requiredTier
 *   3. IdentityRegistry: agent is registered (ownerOf doesn't revert)
 *   4. ValidationRegistry: agent has HUMAN_VERIFIED validation from WorldIDValidator
 *
 * Bonding is NOT handled here — CRE writes directly to ValidationRegistry.
 */
contract HumanVerifiedPolicy is Policy {
    // ── Storage ──
    /// @custom:storage-location erc7201:whitewall-os.HumanVerifiedPolicy
    struct HumanVerifiedPolicyStorage {
        IIdentityRegistryReader identityRegistry;
        IValidationRegistryReader validationRegistry;
        address worldIdValidator;
        uint8 requiredTier;
    }

    bytes32 private constant STORAGE_LOCATION =
        keccak256(abi.encode(uint256(keccak256("whitewall-os.HumanVerifiedPolicy")) - 1)) & ~bytes32(uint256(0xff));

    function _getStorage() private pure returns (HumanVerifiedPolicyStorage storage $) {
        bytes32 slot = STORAGE_LOCATION;
        assembly {
            $.slot := slot
        }
    }

    // ── Initialization ──

    /**
     * @dev configParams = abi.encode(address identityRegistry, address validationRegistry, address worldIdValidator, uint8 requiredTier)
     */
    function configure(bytes calldata configParams) internal override {
        (
            address identityRegistry_,
            address validationRegistry_,
            address worldIdValidator_,
            uint8 requiredTier_
        ) = abi.decode(configParams, (address, address, address, uint8));

        HumanVerifiedPolicyStorage storage $ = _getStorage();
        $.identityRegistry = IIdentityRegistryReader(identityRegistry_);
        $.validationRegistry = IValidationRegistryReader(validationRegistry_);
        $.worldIdValidator = worldIdValidator_;
        $.requiredTier = requiredTier_;
    }

    // ── Policy execution ──

    /**
     * @notice Runs the ACCESS policy check with double protection.
     * @dev Parameters mapped by PolicyEngine from WhitewallExtractor output:
     *   parameters[0] = agentId (uint256)
     *   parameters[1] = approved (bool)
     *   parameters[2] = tier (uint8)
     *   parameters[3] = accountableHuman (address)
     */
    function run(
        address,          /* caller */
        address,          /* subject */
        bytes4,           /* selector */
        bytes[] calldata parameters,
        bytes calldata    /* context */
    ) public view override returns (IPolicyEngine.PolicyResult) {
        // Check 1: CRE says approved
        bool approved = abi.decode(parameters[1], (bool));
        if (!approved) {
            revert IPolicyEngine.PolicyRejected("CRE: agent not approved");
        }

        // Check 2: sufficient tier
        uint8 tier = abi.decode(parameters[2], (uint8));
        HumanVerifiedPolicyStorage storage $ = _getStorage();
        if (tier < $.requiredTier) {
            revert IPolicyEngine.PolicyRejected("Insufficient verification tier");
        }

        // Check 3: on-chain — agent must be registered
        uint256 agentId = abi.decode(parameters[0], (uint256));
        try $.identityRegistry.ownerOf(agentId) returns (address owner) {
            if (owner == address(0)) {
                revert IPolicyEngine.PolicyRejected("Agent not registered");
            }
        } catch {
            revert IPolicyEngine.PolicyRejected("Agent not registered");
        }

        // Check 4: on-chain — agent must have HUMAN_VERIFIED validation
        address[] memory validators = new address[](1);
        validators[0] = $.worldIdValidator;
        (uint64 count,) = $.validationRegistry.getSummary(agentId, validators, "HUMAN_VERIFIED");
        if (count == 0) {
            revert IPolicyEngine.PolicyRejected("No human verification bond on-chain");
        }

        return IPolicyEngine.PolicyResult.Allowed;
    }

    // ── View helpers ──

    function getRequiredTier() external view returns (uint8) {
        return _getStorage().requiredTier;
    }

    function getIdentityRegistry() external view returns (address) {
        return address(_getStorage().identityRegistry);
    }

    function getValidationRegistry() external view returns (address) {
        return address(_getStorage().validationRegistry);
    }

    function getWorldIdValidator() external view returns (address) {
        return _getStorage().worldIdValidator;
    }
}
