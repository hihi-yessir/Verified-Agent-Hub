// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IWhitewallOS} from "../interfaces/IWhitewallOS.sol";

/**
 * @title WhitewallOSGuard
 * @notice Abstract contract that any dApp inherits for instant Whitewall OS protection.
 *
 * Usage:
 *   contract MyDeFi is WhitewallOSGuard {
 *       constructor(address whitewallOS_) WhitewallOSGuard(whitewallOS_) {}
 *
 *       function withdraw(uint256 amt) external requireHumanVerified(agentId) {
 *           // Protected by Whitewall OS
 *       }
 *   }
 */
abstract contract WhitewallOSGuard {
    IWhitewallOS public immutable whitewallOS;

    error NotRegistered(uint256 agentId);
    error NotHumanVerified(uint256 agentId);
    error InsufficientTier(uint256 agentId, uint8 required, uint8 actual);

    constructor(address whitewallOS_) {
        whitewallOS = IWhitewallOS(whitewallOS_);
    }

    modifier requireRegistered(uint256 agentId) {
        if (!whitewallOS.isRegistered(agentId)) {
            revert NotRegistered(agentId);
        }
        _;
    }

    modifier requireHumanVerified(uint256 agentId) {
        if (!whitewallOS.isHumanVerified(agentId)) {
            revert NotHumanVerified(agentId);
        }
        _;
    }

    modifier requireTier(uint256 agentId, uint8 minTier) {
        uint8 tier = whitewallOS.getTier(agentId);
        if (tier < minTier) {
            revert InsufficientTier(agentId, minTier, tier);
        }
        _;
    }
}
