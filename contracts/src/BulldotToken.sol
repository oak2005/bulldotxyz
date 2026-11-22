// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @title BulldotToken
 * @notice Fixed-supply, gas-optimized ERC20 token with EIP-2612 Permit for Bulldot launches.
 * @dev 1,000,000,000 fixed supply minted 100% to recipient (bonding curve or initial pool).
 * Immutable - no minting functions exist after deployment.
 */
contract BulldotToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public constant totalSupply = 1_000_000_000 * 1e18; // 1 Billion tokens

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => uint256) public nonces;

    bytes32 public immutable DOMAIN_SEPARATOR;
    bytes32 public constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, address _recipient) {
        name = _name;
        symbol = _symbol;

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(_name)),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );

        balanceOf[_recipient] = totalSupply;
        emit Transfer(address(0), _recipient, totalSupply);
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
            require(currentAllowance >= amount, "ERC20: insufficient allowance");
            unchecked {
                allowance[from][msg.sender] = currentAllowance - amount;
            }
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "ERC20: transfer to zero");
        uint256 fromBalance = balanceOf[from];
        require(fromBalance >= amount, "ERC20: transfer exceeds balance");
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
        require(block.timestamp <= deadline, "ERC20Permit: expired");
        bytes32 structHash = keccak256(
            abi.encode(PERMIT_TYPEHASH, owner, spender, value, nonces[owner]++, deadline)
        );
        bytes32 hash = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        address signer = ecrecover(hash, v, r, s);
        require(signer != address(0) && signer == owner, "ERC20Permit: invalid signature");

        allowance[owner][spender] = value;
        emit Approval(owner, spender, value);
    }
}
