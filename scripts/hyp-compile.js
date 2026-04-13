/**
 * Compile Hyperion (.hyp) smart contracts using @theqrl/hypc compiler.
 *
 * Reads all .hyp files from contracts/ and outputs JSON artifacts
 * (ABI + bytecode) to artifacts/.
 *
 * Usage:
 *   node scripts/hyp-compile.js
 *
 * Dependencies:
 *   npm install @theqrl/hypc
 */

const hypc = require("@theqrl/hypc");
const fs = require("fs");
const path = require("path");

const CONTRACTS_DIR = path.join(__dirname, "..", "contracts");
const OUTPUT_DIR = path.join(__dirname, "..", "artifacts");

function main() {
  console.log("Hyperion Compiler (@theqrl/hypc)");
  console.log("================================");
  console.log("Source dir:", CONTRACTS_DIR);
  console.log("Output dir:", OUTPUT_DIR);

  // Read all .hyp source files
  const files = fs.readdirSync(CONTRACTS_DIR).filter((f) => f.endsWith(".hyp"));
  if (files.length === 0) {
    console.error("No .hyp files found in", CONTRACTS_DIR);
    process.exit(1);
  }

  console.log(`\nFound ${files.length} .hyp files:`);
  const sources = {};
  for (const file of files) {
    const content = fs.readFileSync(path.join(CONTRACTS_DIR, file), "utf8");
    sources[file] = { content };
    console.log(`  - ${file} (${content.length} bytes)`);
  }

  // Prepare compiler input (Hyperion standard JSON)
  const input = {
    language: "Hyperion",
    sources,
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,
      },
      outputSelection: {
        "*": {
          "*": ["abi", "zvm.bytecode"],
        },
      },
    },
  };

  console.log("\nCompiling...");
  const outputJson = hypc.compile(JSON.stringify(input));
  const output = JSON.parse(outputJson);

  // Check for errors
  let hasError = false;
  if (output.errors) {
    for (const err of output.errors) {
      if (err.severity === "error") {
        console.error("\n[ERROR]", err.formattedMessage || err.message);
        hasError = true;
      } else {
        console.warn("\n[WARN]", err.formattedMessage || err.message);
      }
    }
  }

  if (hasError) {
    console.error("\nCompilation failed with errors.");
    process.exit(1);
  }

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Write artifacts
  let contractCount = 0;
  if (output.contracts) {
    for (const [fileName, contracts] of Object.entries(output.contracts)) {
      for (const [contractName, contractData] of Object.entries(contracts)) {
        // Skip interfaces and abstract contracts that have no bytecode
        const bytecodeObj =
          contractData.zvm &&
          contractData.zvm.bytecode &&
          contractData.zvm.bytecode.object;

        const artifact = {
          contractName,
          sourceFile: fileName,
          abi: contractData.abi || [],
          bytecode: bytecodeObj ? "0x" + bytecodeObj : "0x",
        };

        const outPath = path.join(OUTPUT_DIR, `${contractName}.json`);
        fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2));
        contractCount++;

        const hasCode = bytecodeObj && bytecodeObj.length > 0;
        console.log(
          `  ${contractName} -> ${outPath.replace(/\\/g, "/")} ${hasCode ? "(deployable)" : "(interface/abstract)"}`
        );
      }
    }
  }

  console.log(`\nCompilation complete: ${contractCount} artifacts written to ${OUTPUT_DIR}`);
}

main();
