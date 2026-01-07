import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/client';
import { users, warehouseAccesses } from '../db/schema';
import { v4 as uuidv4 } from 'uuid';

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role?: 'ADMIN' | 'MANAGER' | 'STAFF' | 'VIEWER';
}

export interface UpdateUserInput {
  email?: string;
  name?: string;
  role?: 'ADMIN' | 'MANAGER' | 'STAFF' | 'VIEWER';
  active?: boolean;
}

export class UserService {
  /**
   * Create a new user
   */
  async createUser(input: CreateUserInput) {
    const [user] = await db.insert(users).values({
      id: uuidv4(),
      email: input.email,
      password: input.password, // Should be hashed before calling
      name: input.name,
      role: input.role || 'STAFF',
      active: true,
    }).returning();

    return user;
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string) {
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return user;
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string) {
    const [user] = await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return user;
  }

  /**
   * Get all users with pagination
   */
  async getAllUsers(limit = 50, offset = 0) {
    const allUsers = await db.select()
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    return allUsers;
  }

  /**
   * Get users by role
   */
  async getUsersByRole(role: 'ADMIN' | 'MANAGER' | 'STAFF' | 'VIEWER') {
    const roleUsers = await db.select()
      .from(users)
      .where(eq(users.role, role))
      .orderBy(desc(users.createdAt));

    return roleUsers;
  }

  /**
   * Update user
   */
  async updateUser(id: string, input: UpdateUserInput) {
    const [updatedUser] = await db.update(users)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    return updatedUser;
  }

  /**
   * Delete user (soft delete by setting active to false)
   */
  async deleteUser(id: string) {
    const [deletedUser] = await db.update(users)
      .set({
        active: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    return deletedUser;
  }

  /**
   * Get user's warehouse accesses
   */
  async getUserWarehouseAccesses(userId: string) {
    const accesses = await db.select()
      .from(warehouseAccesses)
      .where(eq(warehouseAccesses.userId, userId));

    return accesses;
  }
}

export const userService = new UserService();
