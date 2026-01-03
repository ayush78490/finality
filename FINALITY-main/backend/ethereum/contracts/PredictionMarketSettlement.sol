// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./OutcomeToken.sol";

/**
 * @title PredictionMarketSettlement
 * @notice Ethereum settlement layer for Vara-powered prediction markets
 * @dev Handles deposits, withdrawals, and settlement verification from Vara
 */
contract PredictionMarketSettlement {
    enum MarketStatus {
        Open,
        Closed,
        Resolved
    }
    enum Outcome {
        Undecided,
        Yes,
        No
    }

    struct Market {
        address creator;
        string question;
        string category;
        uint256 endTime;
        MarketStatus status;
        Outcome outcome;
        OutcomeToken yesToken;
        OutcomeToken noToken;
        uint256 totalBacking;
        uint256 platformFees;
        uint256 creatorFees;
        bytes32 varaStateHash; // Hash of pool state from Vara
    }

    struct VaraResult {
        uint256 marketId;
        bytes32 resultHash;
        uint256 yesPool;
        uint256 noPool;
        uint256 tokensOut;
        uint256 timestamp;
    }

    uint256 public nextMarketId;
    mapping(uint256 => Market) public markets;
    
    address public owner;
    address public relayer; // Authorized relayer address
    uint32 public constant CREATOR_FEE_BPS = 200; // 2%
    uint32 public constant PLATFORM_FEE_BPS = 100; // 1%
    uint32 public constant TOTAL_FEE_BPS = 300; // 3%

    uint256 constant MIN_INITIAL_LIQUIDITY = 0.01 ether;
    uint256 private _lock = 1;

    // Events for Vara to listen to
    event MarketCreated(
        uint256 indexed marketId,
        address indexed creator,
        string question,
        string category,
        address yesToken,
        address noToken,
        uint256 endTime,
        uint256 initialYes,
        uint256 initialNo
    );

    event DepositMade(
        uint256 indexed marketId,
        address indexed user,
        bool isYes,
        uint256 amount,
        uint256 timestamp
    );

    event WithdrawalRequested(
        uint256 indexed marketId,
        address indexed user,
        bool isYes,
        uint256 tokenAmount,
        uint256 timestamp
    );

    // Events from Vara results
    event TradeFinalized(
        uint256 indexed marketId,
        address indexed user,
        bool isYes,
        uint256 amountIn,
        uint256 tokensOut,
        bytes32 varaStateHash
    );

    event MarketResolved(
        uint256 indexed marketId,
        Outcome outcome,
        bytes32 finalStateHash
    );

    event RedemptionClaimed(
        uint256 indexed marketId,
        address indexed user,
        uint256 amount
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyRelayer() {
        require(msg.sender == relayer, "not relayer");
        _;
    }

    modifier nonReentrant() {
        require(_lock == 1, "reentrancy");
        _lock = 2;
        _;
        _lock = 1;
    }

    modifier marketExists(uint256 id) {
        require(id < nextMarketId, "market does not exist");
        _;
    }

    constructor(address _relayer) {
        owner = msg.sender;
        relayer = _relayer;
    }

    /**
     * @notice Create a new prediction market
     * @dev Emits MarketCreated event for Vara to initialize pools
     */
    function createMarket(
        string calldata question,
        string calldata category,
        uint256 endTime,
        uint256 initialYes,
        uint256 initialNo
    ) external payable nonReentrant returns (uint256) {
        require(endTime > block.timestamp + 1 hours, "invalid end time");
        require(bytes(question).length > 0 && bytes(question).length <= 280, "invalid question");
        require(
            initialYes > 0 &&
                initialNo > 0 &&
                (initialYes + initialNo) >= MIN_INITIAL_LIQUIDITY,
            "insufficient initial liquidity"
        );
        require(msg.value >= (initialYes + initialNo), "insufficient ETH");

        uint256 marketId = nextMarketId++;

        // Create outcome tokens
        OutcomeToken yesToken = new OutcomeToken(
            string.concat("YES: ", _truncate(question, 50)),
            string.concat("YES", _toString(marketId)),
            address(this)
        );
        OutcomeToken noToken = new OutcomeToken(
            string.concat("NO: ", _truncate(question, 50)),
            string.concat("NO", _toString(marketId)),
            address(this)
        );

        markets[marketId] = Market({
            creator: msg.sender,
            question: question,
            category: category,
            endTime: endTime,
            status: MarketStatus.Open,
            outcome: Outcome.Undecided,
            yesToken: yesToken,
            noToken: noToken,
            totalBacking: initialYes + initialNo,
            platformFees: 0,
            creatorFees: 0,
            varaStateHash: bytes32(0)
        });

        // Mint initial liquidity tokens to creator
        yesToken.mint(msg.sender, initialYes);
        noToken.mint(msg.sender, initialNo);

        // Refund excess ETH
        if (msg.value > (initialYes + initialNo)) {
            _transferETH(msg.sender, msg.value - (initialYes + initialNo));
        }

        emit MarketCreated(
            marketId,
            msg.sender,
            question,
            category,
            address(yesToken),
            address(noToken),
            endTime,
            initialYes,
            initialNo
        );

        return marketId;
    }

    /**
     * @notice Deposit ETH to buy YES or NO tokens
     * @dev Emits DepositMade for Vara to process the trade
     */
    function deposit(
        uint256 marketId,
        bool isYes
    ) external payable nonReentrant marketExists(marketId) {
        Market storage market = markets[marketId];
        require(market.status == MarketStatus.Open, "market not open");
        require(block.timestamp < market.endTime, "market ended");
        require(msg.value > 0, "zero deposit");

        market.totalBacking += msg.value;

        emit DepositMade(marketId, msg.sender, isYes, msg.value, block.timestamp);
    }

    /**
     * @notice Finalize trade from Vara computation
     * @dev Only callable by authorized relayer with Vara's signed result
     */
    function finalizeTradeFromVara(
        uint256 marketId,
        address user,
        bool isYes,
        uint256 amountIn,
        uint256 tokensOut,
        uint256 creatorFee,
        uint256 platformFee,
        bytes32 varaStateHash
    ) external onlyRelayer marketExists(marketId) {
        Market storage market = markets[marketId];
        require(market.status == MarketStatus.Open, "market not open");

        // Update state hash from Vara
        market.varaStateHash = varaStateHash;

        // Accumulate fees
        market.creatorFees += creatorFee;
        market.platformFees += platformFee;

        // Mint tokens to user
        if (isYes) {
            market.yesToken.mint(user, tokensOut);
        } else {
            market.noToken.mint(user, tokensOut);
        }

        emit TradeFinalized(marketId, user, isYes, amountIn, tokensOut, varaStateHash);
    }

    /**
     * @notice Request withdrawal by burning tokens
     * @dev Emits event for Vara to calculate ETH output
     */
    function requestWithdrawal(
        uint256 marketId,
        bool isYes,
        uint256 tokenAmount
    ) external nonReentrant marketExists(marketId) {
        Market storage market = markets[marketId];
        require(market.status == MarketStatus.Open, "market not open");
        require(block.timestamp < market.endTime, "market ended");
        require(tokenAmount > 0, "zero amount");

        OutcomeToken token = isYes ? market.yesToken : market.noToken;
        require(token.balanceOf(msg.sender) >= tokenAmount, "insufficient balance");

        // Burn tokens
        token.burn(msg.sender, tokenAmount);

        emit WithdrawalRequested(marketId, msg.sender, isYes, tokenAmount, block.timestamp);
    }

    /**
     * @notice Finalize withdrawal from Vara calculation
     * @dev Only callable by relayer after Vara computes output
     */
    function finalizeWithdrawalFromVara(
        uint256 marketId,
        address user,
        uint256 ethOut,
        uint256 creatorFee,
        uint256 platformFee,
        bytes32 varaStateHash
    ) external onlyRelayer marketExists(marketId) nonReentrant {
        Market storage market = markets[marketId];

        // Update state
        market.varaStateHash = varaStateHash;
        market.creatorFees += creatorFee;
        market.platformFees += platformFee;
        market.totalBacking -= ethOut;

        // Transfer ETH to user (after fees)
        uint256 userReceives = ethOut - creatorFee - platformFee;
        _transferETH(user, userReceives);

        // Transfer creator fee
        if (creatorFee > 0) {
            _transferETH(market.creator, creatorFee);
        }
    }

    /**
     * @notice Resolve market with outcome from Vara
     * @dev Only callable by relayer with Vara's resolution
     */
    function resolveMarket(
        uint256 marketId,
        uint8 outcomeIndex,
        bytes32 finalStateHash
    ) external onlyRelayer marketExists(marketId) {
        Market storage market = markets[marketId];
        require(market.status == MarketStatus.Open, "market not open");
        require(block.timestamp >= market.endTime, "market not ended");
        require(outcomeIndex <= 2, "invalid outcome");

        market.outcome = Outcome(outcomeIndex);
        market.status = MarketStatus.Resolved;
        market.varaStateHash = finalStateHash;

        emit MarketResolved(marketId, market.outcome, finalStateHash);
    }

    /**
     * @notice Claim winnings after market resolution
     */
    function claimRedemption(
        uint256 marketId
    ) external nonReentrant marketExists(marketId) {
        Market storage market = markets[marketId];
        require(market.status == MarketStatus.Resolved, "not resolved");

        uint256 yesTokens = market.yesToken.balanceOf(msg.sender);
        uint256 noTokens = market.noToken.balanceOf(msg.sender);

        if (market.outcome == Outcome.Yes) {
            require(yesTokens > 0, "no winning tokens");
            market.yesToken.burn(msg.sender, yesTokens);
            _transferETH(msg.sender, yesTokens);
            emit RedemptionClaimed(marketId, msg.sender, yesTokens);
        } else if (market.outcome == Outcome.No) {
            require(noTokens > 0, "no winning tokens");
            market.noToken.burn(msg.sender, noTokens);
            _transferETH(msg.sender, noTokens);
            emit RedemptionClaimed(marketId, msg.sender, noTokens);
        }
    }

    /**
     * @notice Withdraw accumulated platform fees
     */
    function withdrawPlatformFees(
        uint256 marketId
    ) external onlyOwner nonReentrant marketExists(marketId) {
        Market storage market = markets[marketId];
        uint256 fees = market.platformFees;
        require(fees > 0, "no fees");

        market.platformFees = 0;
        _transferETH(owner, fees);
    }

    /**
     * @notice Update relayer address
     */
    function setRelayer(address newRelayer) external onlyOwner {
        require(newRelayer != address(0), "zero address");
        relayer = newRelayer;
    }

    /**
     * @notice Get market information
     */
    function getMarketInfo(
        uint256 marketId
    ) external view marketExists(marketId) returns (Market memory) {
        return markets[marketId];
    }

    // Internal helpers
    function _transferETH(address to, uint256 amount) internal {
        (bool success, ) = to.call{value: amount}("");
        require(success, "ETH transfer failed");
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    function _truncate(
        string memory str,
        uint256 maxLen
    ) internal pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        if (strBytes.length <= maxLen) return str;
        bytes memory result = new bytes(maxLen);
        for (uint256 i = 0; i < maxLen; i++) {
            result[i] = strBytes[i];
        }
        return string(result);
    }

    receive() external payable {}
}
