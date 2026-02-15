// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

import {IPolicyEngine} from "./IPolicyEngine.sol";

/**
 * @title IMapper
 * @dev Interface for mapping extracted parameters to policy parameters.
 * @notice Vendored from chainlink-ace/packages/policy-management/src/interfaces/IMapper.sol
 */
interface IMapper {
  function map(IPolicyEngine.Parameter[] calldata extractedParameters) external view returns (bytes[] memory);
}
