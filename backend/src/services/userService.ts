import { prisma } from '../lib/prisma';
import { User, UserRole } from '@prisma/client';

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}

export interface UpdateUserInput {
  email?: string;
  name?: string;
  role?: UserRole;
  active?: boolean;
}

export class UserService {
  /**
   * Create a new user
   */
  async createUser(input: CreateUserInput): Promise<User> {
    const user = await prisma.user.create({
      data: {
        email: input.email,
        password: input.password, // Should be hashed before calling
        name: input.name,
        role: input.role || UserRole.STAFF,
        active: true,
      },
    });

    return user;
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Get all users
   */
  async getAllUsers(): Promise<User[]> {
    return prisma.user.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update user
   */
  async updateUser(id: string, input: UpdateUserInput): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: input,
    });
  }

  /**
   * Delete user (soft delete)
   */
  async deleteUser(id: string): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { active: false },
    });
  }

  /**
   * Grant warehouse access to user
   */
  async grantWarehouseAccess(
    userId: string,
    warehouseId: string,
    role: string
  ): Promise<any> {
    return prisma.warehouseAccess.create({
      data: {
        userId,
        warehouseId,
        role,
      },
    });
  }

  /**
   * Revoke warehouse access
   */
  async revokeWarehouseAccess(userId: string, warehouseId: string): Promise<void> {
    await prisma.warehouseAccess.deleteMany({
      where: {
        userId,
        warehouseId,
      },
    });
  }

  /**
   * Get user's warehouse accesses
   */
  async getUserWarehouseAccesses(userId: string): Promise<any[]> {
    return prisma.warehouseAccess.findMany({
      where: { userId },
      include: {
        warehouse: true,
      },
    });
  }
}

export const userService = new UserService();
