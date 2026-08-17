export const PASSWORD_ITERATIONS = 100_000;

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomHex(byteLength) {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(byteLength)));
}

async function derivePassword(password, saltHex) {
  const salt = Uint8Array.from(
    saltHex.match(/.{2}/g) ?? [],
    (byte) => Number.parseInt(byte, 16),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PASSWORD_ITERATIONS },
    key,
    256,
  );
  return bytesToHex(new Uint8Array(bits));
}

export async function makePassword(password) {
  const salt = randomHex(16);
  return { salt, hash: await derivePassword(password, salt) };
}

export async function passwordMatches(password, salt, expectedHash) {
  return (await derivePassword(password, salt)) === expectedHash;
}
