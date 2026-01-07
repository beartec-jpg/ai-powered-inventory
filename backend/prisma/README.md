# Prisma Schema (Archived)

⚠️ **This directory contains the original Prisma schema for reference only.**

## Migration Notice

This project has been migrated from Prisma to Drizzle ORM. The Prisma schema is kept here for:
- Historical reference
- Schema comparison
- Rollback scenarios (if needed)

## Current Database Layer

The active database layer is now:
- **Location**: `backend/src/db/`
- **ORM**: Drizzle ORM
- **Schema**: `backend/src/db/schema.ts`
- **Client**: `backend/src/db/client.ts`

## Migration Documentation

See `/MIGRATION.md` in the project root for complete migration details.

## Original Schema

The `schema.prisma` file in this directory represents the original database design with:
- 11 core models
- PostgreSQL as the database provider
- Prisma Client generation configuration

This schema was converted 1:1 to Drizzle tables with additional enhancements for Clerk authentication and chat functionality.
