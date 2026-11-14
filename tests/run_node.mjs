// Runs the same tests as tests.html, in the terminal: node tests/run_node.mjs
// Exits with code 1 if any test fails (so the deploy workflow can stop on a failure).
import { runHmmTests } from "./hmm_tests.js";
import { runConverterTests } from "./converter_tests.js";

const results = [...runHmmTests(), ...runConverterTests()];
for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}\n      ${r.detail}`);
const failed = results.filter((r) => !r.pass).length;
console.log(failed === 0 ? `\nAll ${results.length} tests passed.` : `\n${failed} test(s) FAILED.`);
process.exit(failed === 0 ? 0 : 1);
