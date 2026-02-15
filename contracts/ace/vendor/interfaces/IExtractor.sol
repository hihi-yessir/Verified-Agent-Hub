// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

import {IPolicyEngine} from "./IPolicyEngine.sol";

/**
 * @title IExtractor
 * @dev Interface for extracting parameters from a payload.
 * @notice Vendored from chainlink-ace/packages/policy-management/src/interfaces/IExtractor.sol
 */
interface IExtractor {
  function extract(IPolicyEngine.Payload calldata payload) external view returns (IPolicyEngine.Parameter[] memory);
}
