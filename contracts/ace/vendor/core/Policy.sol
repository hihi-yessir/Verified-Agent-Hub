// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

import {IPolicy} from "../interfaces/IPolicy.sol";
import {IPolicyEngine} from "../interfaces/IPolicyEngine.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ERC165Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";

/**
 * @title Policy
 * @dev Abstract base for policies.
 * @notice Vendored from chainlink-ace/packages/policy-management/src/core/Policy.sol
 *         (pragma relaxed from 0.8.26 to ^0.8.20 for compatibility)
 */
abstract contract Policy is Initializable, OwnableUpgradeable, ERC165Upgradeable, IPolicy {
  error Unauthorized();

  /// @custom:storage-location erc7201:policy-management.Policy
  struct PolicyStorage {
    address policyEngine;
  }

  // keccak256(abi.encode(uint256(keccak256("policy-management.Policy")) - 1)) &
  // ~bytes32(uint256(0xff))
  bytes32 private constant PolicyStorageLocation = 0xe4b9805cdebef99d9d38a3fed61079cbd4f3c0d610c4396bdc28a2ed8ad07100;

  function _getPolicyStorage() private pure returns (PolicyStorage storage $) {
    assembly {
      $.slot := PolicyStorageLocation
    }
  }

  constructor() {
    _disableInitializers();
  }

  modifier onlyPolicyEngine() {
    if (msg.sender != _getPolicyStorage().policyEngine) {
      revert Unauthorized();
    }
    _;
  }

  function initialize(
    address policyEngine,
    address initialOwner,
    bytes calldata configParams
  ) public virtual initializer {
    __Policy_init(policyEngine, initialOwner);
    configure(configParams);
  }

  function configure(bytes calldata parameters) internal virtual onlyInitializing {}

  function __Policy_init(address policyEngine, address initialOwner) internal onlyInitializing {
    __Policy_init_unchained(policyEngine);
    __Ownable_init(initialOwner);
    __ERC165_init();
  }

  function __Policy_init_unchained(address policyEngine) internal onlyInitializing {
    _getPolicyStorage().policyEngine = policyEngine;
  }

  function onInstall(bytes4) public virtual override onlyPolicyEngine {}
  function onUninstall(bytes4) public virtual override onlyPolicyEngine {}

  function run(
    address caller,
    address subject,
    bytes4 selector,
    bytes[] calldata parameters,
    bytes calldata context
  ) public view virtual override returns (IPolicyEngine.PolicyResult);

  function postRun(
    address,
    address,
    bytes4,
    bytes[] calldata,
    bytes calldata
  ) public virtual override onlyPolicyEngine {}

  function supportsInterface(bytes4 interfaceId)
    public
    view
    virtual
    override(ERC165Upgradeable, IERC165)
    returns (bool)
  {
    return interfaceId == type(IPolicy).interfaceId || super.supportsInterface(interfaceId);
  }
}
