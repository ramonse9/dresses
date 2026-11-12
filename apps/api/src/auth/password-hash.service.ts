import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { argon2id, hash, verify } from 'argon2';

const argonOptions = {
  type: argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class PasswordHashService {
  private readonly dummyHash = hash(randomUUID(), argonOptions);

  hashPassword(password: string): Promise<string> {
    return hash(password, argonOptions);
  }

  async verifyPassword(
    password: string,
    passwordHash: string | undefined,
  ): Promise<boolean> {
    const hashToVerify = passwordHash ?? (await this.dummyHash);

    try {
      const matches = await verify(hashToVerify, password);
      return passwordHash !== undefined && matches;
    } catch {
      await verify(await this.dummyHash, password);
      return false;
    }
  }
}
