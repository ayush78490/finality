// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./OutcomeToken.sol";

/**
 * @title PredictionMarketSettlementVaraEth
 * @notice Ethereum settlement layer using Vara.eth Mirror for AMM computation
 * @dev Direct integration with Vara.eth - no relayer needed
 */
interface IVaraEthMirror {
    function sendMessage(bytes calldata payload, bool callReply) external payable returns (bytes32);
    function stateHash() external view returns (bytes32);
}

contract PredictionMarketSettlementVaraEth {
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
        bytes32 lastStateHash; // Last verified state hash from Vara.eth Mirror
    }

    uint256 public nextMarketId;
    mapping(uint256 => Market) public markets;
    
    address public owner;
    IVaraEthMirror public immutable marketEngineMirror; // Vara.eth Mirror contract
    
    uint32 public constant CREATOR_FEE_BPS = 200; // 2%
    uint32 public constant PLATFORM_FEE_BPS = 100; // 1%
    uint32 public constant TOTAL_FEE_BPS = 300; // 3%

    uint256 constant MIN_INITIAL_LIQUIDITY = 0.01 ether;
    uint256 private _lock = 1;

    // Events
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

    event TradeExecuted(
        uint256 indexed marketId,
        address indexed user,
        bool isYes,
        uint256 amountIn,
        uint256 tokensOut,
        bytes32 stateHash
    );

    event WithdrawalProcessed(
        uint256 indexed marketId,
        address indexed user,
        uint256 ethOut,
        bytes32 stateHash
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

    constructor(address _marketEngineMirror) {
        owner = msg.sender;
        marketEngineMirror = IVaraEthMirror(_marketEngineMirror);
        require(_marketEngineMirror != address(0), "zero mirror address");
    }

    /**
     * @notice Create a new prediction market
     * @dev Initializes market and calls Vara.eth Mirror to initialize pools
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
            lastStateHash: bytes32(0)
        });

        // Mint initial liquidity tokens to creator
        yesToken.mint(msg.sender, initialYes);
        noToken.mint(msg.sender, initialNo);

        // Initialize market on Vara.eth via Mirror
        // Payload: InitializeMarket { market_id, initial_yes, initial_no, ethereum_block }
        bytes memory initPayload = abi.encode(
            uint8(0), // Action: InitializeMarket
            marketId,
            initialYes,
            initialNo,
            block.number
        );
        
        // Try to send message to Mirror (may fail if Mirror not initialized or not funded)
        // We'll allow market creation even if Mirror call fails - state hash will be zero
        // Note: Mirror's sendMessage signature is: sendMessage(bytes calldata payload, bool callReply) payable
        try marketEngineMirror.sendMessage{value: 0}(initPayload, false) returns (bytes32) {
            // Success - update state hash
        markets[marketId].lastStateHash = marketEngineMirror.stateHash();
        } catch {
            // Mirror call failed - set state hash to zero
            // Market can still be created, but Vara.eth integration won't work until Mirror is fixed
            markets[marketId].lastStateHash = bytes32(0);
        }

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
     * @dev Calls Vara.eth Mirror to execute AMM trade
     * @dev State hash automatically updated from Mirror
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

        // Call Vara.eth Mirror to execute trade
        // Payload: ExecuteTrade { market_id, user, is_yes, amount }
        bytes memory tradePayload = abi.encode(
            uint8(1), // Action: ExecuteTrade
            marketId,
            uint256(uint160(msg.sender)), // Convert address to u256 for encoding
            isYes,
            msg.value
        );
        
        // Send message to Mirror (executes on Vara.eth)
        // Note: Mirror's sendMessage is payable, value is sent via msg.value
        marketEngineMirror.sendMessage{value: msg.value}(tradePayload, false);

        // Get updated state hash from Mirror
        bytes32 newStateHash = marketEngineMirror.stateHash();
        market.lastStateHash = newStateHash;

        // Decode result from Mirror reply (in production, use proper decoding)
        // For now, we'll need to read the result via a separate call or event
        // This is a simplified version - full implementation would decode the reply
        
        // Calculate tokens based on AMM (simplified - in production, decode from Mirror reply)
        // TODO: Implement proper reply decoding from Vara.eth Mirror
        // For now, this is a placeholder that needs to be completed with actual Mirror reply parsing
        
        emit TradeExecuted(marketId, msg.sender, isYes, msg.value, 0, newStateHash);
    }

    /**
     * @notice Request withdrawal by burning tokens
     * @dev Calls Vara.eth Mirror to calculate withdrawal
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

        // Burn tokens first
        token.burn(msg.sender, tokenAmount);

        // Call Vara.eth Mirror to calculate withdrawal
        // Payload: CalculateWithdrawal { market_id, user, is_yes, token_amount }
        bytes memory withdrawalPayload = abi.encode(
            uint8(5), // Action: CalculateWithdrawal
            marketId,
            uint256(uint160(msg.sender)),
            isYes,
            tokenAmount
        );
        
        marketEngineMirror.sendMessage{value: 0}(withdrawalPayload, false);

        // Get updated state hash
        bytes32 newStateHash = marketEngineMirror.stateHash();
        market.lastStateHash = newStateHash;

        // TODO: Decode withdrawal result from Mirror reply
        // For now, placeholder - needs proper reply parsing
        
        emit WithdrawalProcessed(marketId, msg.sender, 0, newStateHash);
    }

    /**
     * @notice Resolve market with outcome
     * @dev Can be called by anyone after endTime
     * @dev In production, should use oracle or multi-sig
     */
    function resolveMarket(
        uint256 marketId,
        uint8 outcomeIndex
    ) external marketExists(marketId) {
        Market storage market = markets[marketId];
        require(market.status == MarketStatus.Open, "market not open");
        require(block.timestamp >= market.endTime, "market not ended");
        require(outcomeIndex <= 2, "invalid outcome");

        market.outcome = Outcome(outcomeIndex);
        market.status = MarketStatus.Resolved;
        market.lastStateHash = marketEngineMirror.stateHash();

        emit MarketResolved(marketId, market.outcome, market.lastStateHash);
    }

    /**
     * @notice Claim winnings after market resolution
     * @dev FIXED: Calculates ETH value from pool ratio, not 1:1
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
            
            // FIXED: Calculate ETH value from pool ratio
            uint256 totalTokens = market.yesToken.totalSupply() + market.noToken.totalSupply();
            require(totalTokens > 0, "no tokens");
            
            uint256 ethValue = (yesTokens * market.totalBacking) / totalTokens;
            require(ethValue > 0, "zero value");
            
            market.yesToken.burn(msg.sender, yesTokens);
            market.totalBacking -= ethValue;
            _transferETH(msg.sender, ethValue);
            
            emit RedemptionClaimed(marketId, msg.sender, ethValue);
        } else if (market.outcome == Outcome.No) {
            require(noTokens > 0, "no winning tokens");
            
            // FIXED: Calculate ETH value from pool ratio
            uint256 totalTokens = market.yesToken.totalSupply() + market.noToken.totalSupply();
            require(totalTokens > 0, "no tokens");
            
            uint256 ethValue = (noTokens * market.totalBacking) / totalTokens;
            require(ethValue > 0, "zero value");
            
            market.noToken.burn(msg.sender, noTokens);
            market.totalBacking -= ethValue;
            _transferETH(msg.sender, ethValue);
            
            emit RedemptionClaimed(marketId, msg.sender, ethValue);
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
     * @notice Get market information
     */
    function getMarketInfo(
        uint256 marketId
    ) external view marketExists(marketId) returns (Market memory) {
        return markets[marketId];
    }

    /**
     * @notice Get current state hash from Vara.eth Mirror
     */
    function getStateHash() external view returns (bytes32) {
        return marketEngineMirror.stateHash();
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

