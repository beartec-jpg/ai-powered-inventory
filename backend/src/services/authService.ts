import { PrismaClient, User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { UnauthorizedError, ConflictError } from '../types';

const prisma = new PrismaClient();

interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
}

interface AuthTokens {
  token: string;
  refreshToken: string;
}

export class AuthService {
  private static readonly JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key-change-in-production';
  private static readonly JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';
  private static readonly JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

  /**
   * Hash a password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Compare a password with a hash
   */
  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate JWT token
   */
  static generateToken(payload: TokenPayload, expiresIn?: string): string {
    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: expiresIn || this.JWT_EXPIRY,
    } as jwt.SignOptions);
  }

  /**
   * Generate access and refresh tokens
   */
  static generateTokens(user: User): AuthTokens {
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const token = this.generateToken(payload, this.JWT_EXPIRY);
    const refreshToken = this.generateToken(payload, this.JWT_REFRESH_EXPIRY);

    return { token, refreshToken };
  }

  /**
   * Verify JWT token
   */
  static verifyToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, this.JWT_SECRET) as TokenPayload;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Token expired');
      }
      throw new UnauthorizedError('Token verification failed');
    }
  }

  /**
   * Register a new user
   */
  static async register(
    email: string,
    password: string,
    name: string,
    role: UserRole = UserRole.STAFF
  ): Promise<{ user: Omit<User, 'password'>; tokens: AuthTokens }> {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await this.hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
      },
    });

    // Generate tokens
    const tokens = this.generateTokens(user);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      tokens,
    };
  }

  /**
   * Login user
   */
  static async login(
    email: string,
    password: string
  ): Promise<{ user: Omit<User, 'password'>; tokens: AuthTokens }> {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check if user is active
    if (!user.active) {
      throw new UnauthorizedError('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await this.comparePassword(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Generate tokens
    const tokens = this.generateTokens(user);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      tokens,
    };
  }

  /**
   * Refresh access token
   */
  static async refreshToken(refreshToken: string): Promise<AuthTokens> {
    // Verify refresh token
    const payload = this.verifyToken(refreshToken);

    // Get user to ensure they still exist and are active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || !user.active) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Generate new tokens
    return this.generateTokens(user);
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: string): Promise<Omit<User, 'password'> | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return null;
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Validate user credentials (for middleware)
   */
  static async validateUser(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { active: true },
    });

    return user?.active || false;
  }
}
