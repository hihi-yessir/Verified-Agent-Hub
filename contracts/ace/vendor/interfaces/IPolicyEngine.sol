// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

/**
 * @title IPolicyEngine
 * @dev Interface for the policy engine.
 * @notice Vendored from chainlink-ace/packages/policy-management/src/interfaces/IPolicyEngine.sol
 */
interface IPolicyEngine {
  error TargetNotAttached(address target);
  error TargetAlreadyAttached(address target);
  error PolicyEngineUndefined();
  error PolicyRunRejected(bytes4 selector, address policy, string rejectReason);
  error PolicyMapperError(address policy, bytes errorReason);
  error PolicyRejected(string rejectReason);
  error PolicyRunError(bytes4 selector, address policy, bytes errorReason);
  error PolicyRunUnauthorizedError(address account);
  error PolicyPostRunError(bytes4 selector, address policy, bytes errorReason);
  error UnsupportedSelector(bytes4 selector);
  error InvalidConfiguration(string errorReason);
  error ExtractorError(bytes4 selector, address extractor, bytes errorReason);

  event TargetAttached(address indexed target);
  event TargetDetached(address indexed target);
  event PolicyRunComplete(address indexed sender, address indexed target, bytes4 indexed selector);
  event PolicyAdded(address indexed target, bytes4 indexed selector, address policy);
  event PolicyRemoved(address indexed target, bytes4 indexed selector, address policy);
  event ExtractorSet(bytes4 indexed selector, address indexed extractor);
  event PolicyParametersSet(address indexed policy, bytes[] parameters);
  event DefaultPolicyAllowSet(bool defaultAllow);
  event TargetDefaultPolicyAllowSet(address indexed target, bool defaultAllow);

  enum PolicyResult {
    None,
    Allowed,
    Continue
  }

  struct Payload {
    bytes4 selector;
    address sender;
    bytes data;
    bytes context;
  }

  struct Parameter {
    bytes32 name;
    bytes value;
  }

  function attach() external;
  function detach() external;
  function setExtractor(bytes4 selector, address extractor) external;
  function setExtractors(bytes4[] calldata selectors, address extractor) external;
  function getExtractor(bytes4 selector) external view returns (address);
  function setPolicyMapper(address policy, address mapper) external;
  function getPolicyMapper(address policy) external view returns (address);
  function addPolicy(address target, bytes4 selector, address policy, bytes32[] calldata policyParameterNames) external;
  function addPolicyAt(address target, bytes4 selector, address policy, bytes32[] calldata policyParameterNames, uint256 position) external;
  function removePolicy(address target, bytes4 selector, address policy) external;
  function getPolicies(address target, bytes4 selector) external view returns (address[] memory);
  function setDefaultPolicyAllow(bool defaultAllow) external;
  function setTargetDefaultPolicyAllow(address target, bool defaultAllow) external;
  function check(Payload calldata payload) external view;
  function run(Payload calldata payload) external;
}
