// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IExtractor} from "./vendor/interfaces/IExtractor.sol";
import {IPolicyEngine} from "./vendor/interfaces/IPolicyEngine.sol";

/**
 * @title WhitewallExtractor
 * @notice Extracts parameters from DON-signed ACCESS reports for the Whitewall OS policy engine.
 *
 * Report format (ABI-encoded by CRE access workflow):
 *   (uint256 agentId, bool approved, uint8 tier, address accountableHuman, bytes32 reason)
 *
 * Bonding is handled separately — CRE writes directly to ValidationRegistry.
 */
contract WhitewallExtractor is IExtractor {
    // ── Parameter name constants (keccak256 hashes) ──
    bytes32 public constant PARAM_AGENT_ID          = keccak256("agentId");
    bytes32 public constant PARAM_APPROVED          = keccak256("approved");
    bytes32 public constant PARAM_TIER              = keccak256("tier");
    bytes32 public constant PARAM_ACCOUNTABLE_HUMAN = keccak256("accountableHuman");
    bytes32 public constant PARAM_REASON            = keccak256("reason");

    /**
     * @notice Extracts structured parameters from an onReport calldata payload.
     * @dev payload.data = abi.encode(bytes metadata, bytes report) — the calldata
     *      of WhitewallConsumer.onReport (selector already stripped by PolicyProtected).
     */
    function extract(
        IPolicyEngine.Payload calldata payload
    ) external pure override returns (IPolicyEngine.Parameter[] memory) {
        // payload.data is onReport's arguments without selector:
        //   abi.encode(bytes metadata, bytes report)
        (, bytes memory report) = abi.decode(payload.data, (bytes, bytes));

        // Decode the CRE access report
        (
            uint256 agentId,
            bool    approved,
            uint8   tier,
            address accountableHuman,
            bytes32 reason
        ) = abi.decode(report, (uint256, bool, uint8, address, bytes32));

        // Build parameter array for policy engine
        IPolicyEngine.Parameter[] memory params = new IPolicyEngine.Parameter[](5);
        params[0] = IPolicyEngine.Parameter(PARAM_AGENT_ID,          abi.encode(agentId));
        params[1] = IPolicyEngine.Parameter(PARAM_APPROVED,          abi.encode(approved));
        params[2] = IPolicyEngine.Parameter(PARAM_TIER,              abi.encode(tier));
        params[3] = IPolicyEngine.Parameter(PARAM_ACCOUNTABLE_HUMAN, abi.encode(accountableHuman));
        params[4] = IPolicyEngine.Parameter(PARAM_REASON,            abi.encode(reason));

        return params;
    }
}
