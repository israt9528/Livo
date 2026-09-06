import bcrypt from "bcrypt";
import config from "../config";

const SALT_ROUNDS = Number(config.bcrypt_salt_rounds);

export const hashPassword = async (plainText: string): Promise<string> => {
  return bcrypt.hash(plainText, SALT_ROUNDS);
};

export const comparePassword = async (
  plainText: string,
  hashed: string,
): Promise<boolean> => {
  return bcrypt.compare(plainText, hashed);
};
