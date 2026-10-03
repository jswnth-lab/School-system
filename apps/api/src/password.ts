// PBKDF2 via WebCrypto: native, fits Workers CPU limits (Better Auth's default scrypt is pure JS and too slow).
// 100k iterations is the Workers maximum.
const ITER = 100_000;
const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b)));
const unb64 = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iter: number) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, key, 256);
}

export async function hash(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
  return `pbkdf2$${ITER}$${b64(salt)}$${b64(await derive(password, salt, ITER))}`;
}

export async function verify({ hash: stored, password }: { hash: string; password: string }) {
  const [alg, iter, salt, want] = stored.split("$");
  if (alg !== "pbkdf2") return false;
  const got = new Uint8Array(await derive(password, unb64(salt), Number(iter)));
  const exp = unb64(want);
  let diff = got.length ^ exp.length;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ (exp[i] ?? 0);
  return diff === 0;
}
