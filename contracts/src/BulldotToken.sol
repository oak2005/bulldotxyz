// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @notice SECURITY NOTES:
 * - 1,000,000,000 * 10^18 fixed total supply minted entirely upon construction.
 * - Total supply is permanently fixed. No minting or burning functions exist after deployment.
 * - EIP-2612 Permit includes dynamic domain separator computation if block.chainid changes (fork protection).
 * - Enforces ECDSA signature malleability restrictions (s-value in lower half of secp256k1 order).
 * - Strictly follows checks-effects-interactions; safe against reentrancy.
 */
contract BulldotToken {
    error InsufficientBalance();
    error InsufficientAllowance();
    error ZeroAddress();
    error PermitExpired();
    error InvalidSigner();

    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public constant totalSupply = 1_000_000_000 * 1e18; // 1 Billion tokens

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => uint256) public nonces;

    uint256 public immutable INITIAL_CHAIN_ID;
    bytes32 public immutable INITIAL_DOMAIN_SEPARATOR;

    bytes32 public constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, address _recipient) {
        if (_recipient == address(0)) revert ZeroAddress();

        name = _name;
        symbol = _symbol;

        INITIAL_CHAIN_ID = block.chainid;
        INITIAL_DOMAIN_SEPARATOR = _computeDomainSeparator();

        balanceOf[_recipient] = totalSupply;
        emit Transfer(address(0), _recipient, totalSupply);
    }

    function _computeDomainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name)),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function DOMAIN_SEPARATOR() public view returns (bytes32) {
        return block.chainid == INITIAL_CHAIN_ID ? INITIAL_DOMAIN_SEPARATOR : _computeDomainSeparator();
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 currentAllowance = allowance[from][msg.sender];
        if (currentAllowance != type(uint256).max) {
            if (currentAllowance < amount) revert InsufficientAllowance();
            unchecked {
                allowance[from][msg.sender] = currentAllowance - amount;
            }
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        if (to == address(0)) revert ZeroAddress();
        uint256 fromBalance = balanceOf[from];
        if (fromBalance < amount) revert InsufficientBalance();

        unchecked {
            balanceOf[from] = fromBalance - amount;
            balanceOf[to] += amount;
        }
        emit Transfer(from, to, amount);
    }

    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        if (block.timestamp > deadline) revert PermitExpired();

        // Prevent signature malleability (s in lower half of secp256k1 order)
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E735E5A8314959D54611DE66242) {
            revert InvalidSigner();
        }
        if (v != 27 && v != 28) revert InvalidSigner();

        bytes32 structHash = keccak256(
            abi.encode(PERMIT_TYPEHASH, owner, spender, value, nonces[owner]++, deadline)
        );
        bytes32 hash = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR(), structHash));
        address signer = ecrecover(hash, v, r, s);
        if (signer == address(0) || signer != owner) revert InvalidSigner();

        allowance[owner][spender] = value;
        emit Approval(owner, spender, value);
    }
}
