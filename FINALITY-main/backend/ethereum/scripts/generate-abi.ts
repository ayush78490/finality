import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "../.env") });

async function main() {
    console.log("\n📝 === Generating Solidity ABI from Vara Program ===\n");

    const varaDir = path.join(__dirname, "../../vara");
    const idlPath = path.join(varaDir, "target/wasm32-unknown-unknown/release/prediction_market_vara.idl");
    
    // Check if IDL exists
    if (!fs.existsSync(idlPath)) {
        console.log("⚠️  IDL file not found. Building Vara program first...\n");
        
        try {
            console.log("Building Vara program...");
            execSync("cargo build --release", {
                cwd: varaDir,
                stdio: "inherit"
            });
            console.log("✅ Build complete\n");
        } catch (error) {
            console.error("❌ Build failed. Please build manually:");
            console.error("   cd backend/vara && cargo build --release\n");
            process.exit(1);
        }
    }

    // Check if IDL still doesn't exist (might need Sails)
    if (!fs.existsSync(idlPath)) {
        console.log("⚠️  IDL file not found after build.");
        console.log("   The program may need Sails framework for IDL generation.");
        console.log("   Current program structure is compatible with Vara.eth.");
        console.log("   ABI can be generated manually from types.rs if needed.\n");
        console.log("📝 Manual ABI Generation:");
        console.log("   1. Review backend/vara/src/types.rs");
        console.log("   2. Create Solidity interface matching MarketEngineAction/Event");
        console.log("   3. Or use @vara-eth/api for TypeScript integration\n");
        return;
    }

    // Try to generate Solidity interface using sails
    try {
        console.log("Generating Solidity interface from IDL...");
        execSync(`cargo sails sol --idl-path ${idlPath}`, {
            cwd: varaDir,
            stdio: "inherit"
        });
        
        const solPath = path.join(varaDir, "PredictionMarket.sol");
        if (fs.existsSync(solPath)) {
            console.log(`\n✅ Solidity interface generated: ${solPath}`);
            console.log("   This can be used for direct contract integration.\n");
        }
    } catch (error) {
        console.log("\n⚠️  Sails CLI not available or IDL format incompatible.");
        console.log("   This is OK - you can use @vara-eth/api for TypeScript integration.");
        console.log("   Or generate ABI manually from types.rs.\n");
    }

    console.log("📚 Alternative: Use @vara-eth/api");
    console.log("   The TypeScript API handles encoding/decoding automatically.");
    console.log("   No manual ABI generation needed for frontend integration.\n");
}

main();

