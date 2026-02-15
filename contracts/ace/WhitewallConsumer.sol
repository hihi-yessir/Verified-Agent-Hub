// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {PolicyProtected} from "./vendor/core/PolicyProtected.sol";
import {IPolicyEngine} from "./vendor/interfaces/IPolicyEngine.sol";

/**
 * @title WhitewallConsumer
 * @notice ACE consumer for ACCESS requests only.
 *         Receives DON-signed reports from CRE Forwarder.
 *         The `runPolicy` modifier ensures the on-chain policy engine validates
 *         every report before business logic executes — the "double protection" layer.
 *
 *         Bonding (HUMAN_VERIFIED) is NOT handled here — CRE writes directly to
 *         ValidationRegistry.validationResponse() via a separate bonding workflow.
 *
 * Report format (ABI-encoded):
 *   (uint256 agentId, bool approved, uint8 tier, address accountableHuman, bytes32 reason)
 */
contract WhitewallConsumer is PolicyProtected {
    // ── Storage ──
    /// @custom:storage-location erc7201:whitewall-os.WhitewallConsumer
    struct WhitewallConsumerStorage {
        address forwarderAddress;
    }

    bytes32 private constant STORAGE_LOCATION =
        keccak256(abi.encode(uint256(keccak256("whitewall-os.WhitewallConsumer")) - 1)) & ~bytes32(uint256(0xff));

    function _getStorage() private pure returns (WhitewallConsumerStorage storage $) {
        bytes32 slot = STORAGE_LOCATION;
        assembly {
            $.slot := slot
        }
    }

    // ── Events ──
    event AccessGranted(
        uint256 indexed agentId,
        address indexed accountableHuman,
        uint8 tier
    );

    event AccessDenied(
        uint256 indexed agentId,
        bytes32 reason
    );

    // ── Errors ──
    error OnlyForwarder(address caller, address expected);

    // ── Initialization ──

    function initialize(
        address initialOwner,
        address policyEngine,
        address forwarder
    ) public initializer {
        __PolicyProtected_init(initialOwner, policyEngine);
        _getStorage().forwarderAddress = forwarder;
    }

    // ── Core: DON report handler ──

    /**
     * @notice Called by CRE Forwarder with DON-signed ACCESS report.
     *         The `runPolicy` modifier runs the ACE policy engine BEFORE this body executes.
     *         If the policy rejects, the entire transaction reverts.
     * @param metadata CRE metadata (workflow ID, DON ID, etc.)
     * @param report ABI-encoded access report
     */
    function onReport(
        bytes calldata metadata,
        bytes calldata report
    ) external runPolicy {
        WhitewallConsumerStorage storage $ = _getStorage();
        if (msg.sender != $.forwarderAddress) {
            revert OnlyForwarder(msg.sender, $.forwarderAddress);
        }

        (
            uint256 agentId,
            bool    approved,
            uint8   tier,
            address accountableHuman,
            bytes32 reason
        ) = abi.decode(report, (uint256, bool, uint8, address, bytes32));

        if (approved) {
            emit AccessGranted(agentId, accountableHuman, tier);
        } else {
            emit AccessDenied(agentId, reason);
        }
    }

    // ── Admin ──

    function setForwarder(address newForwarder) external onlyOwner {
        _getStorage().forwarderAddress = newForwarder;
    }

    function getForwarder() external view returns (address) {
        return _getStorage().forwarderAddress;
    }

    // ── ERC-165 ──

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
