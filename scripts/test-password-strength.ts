import {
  evaluatePasswordStrength,
  generateStrongPassword,
  hashPassword,
  verifyPassword,
} from "../lib/auth/password";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("PASS:", msg);
}

async function testPasswordStrength() {
  console.log("Testing Password Security Utility...\n");

  // 1. Weak passwords must be rejected
  const weak1 = evaluatePasswordStrength("short");
  assert(!weak1.isValid, "Rejects short passwords");

  const weak2 = evaluatePasswordStrength("password123456");
  assert(!weak2.isValid, "Rejects common word passwords");

  const weak3 = evaluatePasswordStrength("ALLUPPERCASE123!@#");
  assert(!weak3.isValid, "Rejects missing lowercase passwords");

  const weak4 = evaluatePasswordStrength("AlexRivera123!@#", "alexrivera");
  assert(!weak4.isValid, "Rejects passwords containing username");

  // 2. Strong password generator
  const generated = generateStrongPassword();
  assert(generated.length >= 16, `Generated password is long (${generated.length} chars)`);
  const genEval = evaluatePasswordStrength(generated);
  assert(genEval.isValid, `Generated password passes all strength checks (score: ${genEval.score})`);

  // 3. Hashing and verification
  const raw = "K9#mQ$8vL2!xP5@z";
  const hashed = hashPassword(raw);
  assert(hashed.includes(":"), "Hash includes salt separator");
  assert(verifyPassword(raw, hashed), "Verifies correct password");
  assert(!verifyPassword("WrongPassword123!", hashed), "Rejects wrong password");

  console.log("\nAll password strength tests passed successfully!");
}

testPasswordStrength().catch((e) => {
  console.error(e);
  process.exit(1);
});
