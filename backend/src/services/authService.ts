import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

class AuthService {
  async hashPassword(plainPassword: string): Promise<string> {
    if (!plainPassword || plainPassword.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }
    return bcrypt.hash(plainPassword, SALT_ROUNDS);
  }

  async comparePassword(plainPassword: string, hash: string): Promise<boolean> {
    if (!plainPassword || !hash) return false;
    return bcrypt.compare(plainPassword, hash);
  }
}

export default new AuthService();
