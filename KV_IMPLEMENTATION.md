# KV Safe Wrapper - Implementation Guide

## Problem
The GitHub Spark `useKV` hook attempts to write to `/_spark/kv/*` endpoints that don't exist, causing 404 errors. These errors trigger uncaught promise rejections that crash the UI flow, making it appear to do nothing when users click "Yes" to add catalogue items.

## Solution Overview
We've implemented a three-layer defense strategy:

### 1. Client-Side Safe Wrapper (`src/lib/kv-safe.ts`)
- Provides `safeSetKey()` and `safeGetKey()` functions
- Never throws uncaught promise rejections
- Attempts multiple fallback strategies:
  1. Original `window.ho.setKey/getKey` if available
  2. Fetch PUT/GET to `/_spark/kv/:key`
  3. localStorage as final fallback

### 2. Runtime Patch Installer (`src/lib/install-kv-patch.ts`)
- Called at app startup in `src/main.tsx`
- Patches `window.ho.setKey/getKey` to use safe wrappers
- Ensures backward compatibility with existing code
- No changes needed to files that use `useKV` hook

### 3. Server-Side API Endpoint (`api/_spark/kv/[...key].ts`)
- Vercel serverless function
- Handles PUT, POST, GET, DELETE requests
- Returns 200 OK to prevent 404 errors
- Currently uses in-memory storage (resets on cold starts)

## Usage
No changes needed! The patch is automatically installed at app startup. All existing code that uses the `useKV` hook will work without modification.

## Upgrading to Persistent Storage

The current implementation uses in-memory storage which resets on serverless function cold starts. To add real persistence:

### Option 1: Vercel KV (Redis)
```bash
# Install Vercel KV
npm install @vercel/kv
```

Update `api/_spark/kv/[...key].ts`:
```typescript
import { kv } from '@vercel/kv';

// Replace memoryStore.set() with:
await kv.set(key, value);

// Replace memoryStore.get() with:
const value = await kv.get(key);

// Replace memoryStore.delete() with:
await kv.del(key);
```

### Option 2: Database (PostgreSQL, MongoDB, etc.)
Add your database client and update the handler to store/retrieve from your database instead of the in-memory Map.

### Option 3: Cloud Storage (S3, GCS, etc.)
Use cloud storage APIs to persist JSON files for each key.

## Testing
The fix has been tested by:
1. ✅ Building the application successfully (`npm run build`)
2. ✅ No TypeScript errors in new files
3. ✅ Backward compatibility maintained

## Monitoring
The implementation logs all operations to the console:
- Client: `[KV Safe]` prefix for client-side operations
- Client: `[KV Patch]` prefix for patch installation
- Server: `[KV API]` prefix for API endpoint operations

Check your browser console and Vercel logs to monitor KV operations.

## Files Modified
- `src/lib/kv-safe.ts` - Safe KV wrapper implementation
- `src/lib/install-kv-patch.ts` - Runtime patch installer
- `src/main.tsx` - Calls `installKVPatch()` at startup
- `api/_spark/kv/[...key].ts` - Vercel API endpoint handler

## Next Steps
1. Deploy to Vercel
2. Test the "Add catalogue item" flow
3. Verify no 404 errors in console
4. Verify localStorage fallback works
5. (Optional) Upgrade to persistent storage when needed
