import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.20",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
            viaIR: true, // Fix "stack too deep" errors
        },
    },
    networks: {
        hoodi: {
            url: process.env.HOODI_RPC_URL || "https://hoodi-reth-rpc.gear-tech.io",
            accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
            chainId: 560048,
        },
        sepolia: {
            url: process.env.SEPOLIA_RPC_URL || "https://sepolia.infura.io/v3/YOUR_KEY",
            accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
            chainId: 11155111,
        },
        hardhat: {
            chainId: 31337,
        },
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY,
        customChains: [
            {
                network: "hoodi",
                chainId: 560048,
                urls: {
                    apiURL: "https://explorer.hoodi.io/api",
                    browserURL: "https://explorer.hoodi.io",
                },
            },
        ],
    },
};

export default config;
