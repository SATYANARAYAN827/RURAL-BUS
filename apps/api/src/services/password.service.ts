import { hash, verify } from '@node-rs/argon2';

/**
 * OWASP recommended Argon2id parameters
 * Algorithm: 2 (Argon2id)
 */
const ARGON2_OPTIONS = {
  memoryCost: 65536, // 64 MiB
  timeCost: 3, // 3 iterations
  parallelism: 4, // 4 threads
  outputLen: 32,
  algorithm: 2, // Argon2id
};

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hashStr: string, plainText: string): Promise<boolean> {
  try {
    return await verify(hashStr, plainText, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}
