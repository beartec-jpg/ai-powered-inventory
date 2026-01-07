import { prisma } from '../db/prisma';
import { UserRole } from '@prisma/client';

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
  async createUser(input: CreateUserInput) {
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
  async getUserById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    return user;
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string) {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    return user;
  }

  /**
   * Get all users with pagination
   */
  async getAllUsers(limit = 50, offset = 0) {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return users;
  }

  /**
   * Get users by role
   */
  async getUsersByRole(role: UserRole) {
    const users = await prisma.user.findMany({
      where: { role },
      orderBy: { createdAt: 'desc' },
    });

    return users;
  }

  /**
   * Update user
   */
  async updateUser(id: string, input: UpdateUserInput) {
    const user = await prisma.user.update({
      where: { id },
      data: input,
    });

    return user;
  }

  /**
   * Delete user (soft delete by setting active to false)
   */
  async deleteUser(id: string) {
    const user = await prisma.user.update({
      where: { id },
      data: { active: false },
    });

    return user;
  }

  /**
   * Get user's warehouse accesses
   */
  async getUserWarehouseAccesses(userId: string) {
    const accesses = await prisma.warehouseAccess.findMany({
      where: { userId },
    });

    return accesses;
  }
}

export const userService = new UserService();
