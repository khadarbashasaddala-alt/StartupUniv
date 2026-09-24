import bcrypt from "bcryptjs";
import crypto from "crypto";

/**
 * Generate a secure random password
 * @param length - Password length (default: 12)
 * @returns Random password string
 */
export function generateRandomPassword(length: number = 12): string {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*";
  const allChars = uppercase + lowercase + numbers + symbols;

  // Ensure at least one character from each category
  let password = "";
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

/**
 * Hash a password using bcrypt
 * @param password - Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

/**
 * Generate credentials (email + password)
 * Returns both plain password (for email) and hashed password (for storage)
 */
export async function generateCredentials(): Promise<{
  password: string;
  hashedPassword: string;
}> {
  const password = generateRandomPassword(12);
  const hashedPassword = await hashPassword(password);

  return {
    password,
    hashedPassword,
  };
}


