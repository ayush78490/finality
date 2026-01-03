// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract OutcomeToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    address public immutable market;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 amount
    );

    constructor(string memory _name, string memory _symbol, address _market) {
        name = _name;
        symbol = _symbol;
        market = _market;
    }

    modifier onlyMarket() {
        require(msg.sender == market, "only market");
        _;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(to != address(0), "zero address");
        uint256 senderBalance = balanceOf[msg.sender];
        require(senderBalance >= amount, "insufficient balance");
        unchecked {
            balanceOf[msg.sender] = senderBalance - amount;
            balanceOf[to] += amount;
        }
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool) {
        require(to != address(0), "zero address");
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "insufficient allowance");
        if (allowed != type(uint256).max)
            allowance[from][msg.sender] = allowed - amount;
        uint256 senderBalance = balanceOf[from];
        require(senderBalance >= amount, "insufficient balance");
        unchecked {
            balanceOf[from] = senderBalance - amount;
            balanceOf[to] += amount;
        }
        emit Transfer(from, to, amount);
        return true;
    }

    function mint(address to, uint256 amount) external onlyMarket {
        require(to != address(0), "zero address");
        totalSupply += amount;
        unchecked {
            balanceOf[to] += amount;
        }
        emit Transfer(address(0), to, amount);
    }

    function burn(address from, uint256 amount) external onlyMarket {
        uint256 senderBalance = balanceOf[from];
        require(senderBalance >= amount, "insufficient balance");
        unchecked {
            balanceOf[from] = senderBalance - amount;
            totalSupply -= amount;
        }
        emit Transfer(from, address(0), amount);
    }
}
