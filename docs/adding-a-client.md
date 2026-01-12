# Adding a Torrent Client Adapter

> **Guide for contributing a new torrent client adapter to CTRL**

This guide walks you through adding support for a new BitTorrent client. CTRL uses a **Strategy pattern** where each client has its own adapter that implements the `ITorrentClient` interface.

---

## Prerequisites

Before you begin, you'll need:

1. **API Documentation** - Official docs for your torrent client's API (REST, JSON-RPC, XML-RPC, etc.)
2. **Test Instance** - A running instance of the client for testing
3. **Basic TypeScript knowledge** - Familiarity with async/await, interfaces, and Zod schemas

---

## Step 1: Create the Adapter Directory

```bash
mkdir -p extension/src/shared/api/clients/{client-name}
```

Your directory will contain two files:
- `{ClientName}Adapter.ts` - The adapter implementation
- `{ClientName}Schema.ts` - Zod schemas for API responses

---

## Step 2: Define the Response Schema

Create your schema file first. This ensures type safety when parsing API responses.

```typescript
// extension/src/shared/api/clients/example/ExampleSchema.ts
import { z } from 'zod';

// Define the shape of a single torrent from the API
export const ExampleTorrentSchema = z.object({
    id: z.string(),
    name: z.string(),
    status: z.string(),
    size: z.number(),
    progress: z.number(),
    downloadSpeed: z.number(),
    uploadSpeed: z.number(),
    eta: z.number().optional(),
    savePath: z.string().optional(),
});

export type ExampleTorrent = z.infer<typeof ExampleTorrentSchema>;

// Schema for the list response
export const ExampleListSchema = z.array(ExampleTorrentSchema);
```

---

## Step 3: Implement the Adapter

Create your adapter implementing `ITorrentClient`:

```typescript
// extension/src/shared/api/clients/example/ExampleAdapter.ts
import { injectable } from 'tsyringe';
import { ITorrentClient, AddTorrentOptions } from '@/entities/client/model/ITorrentClient';
import { Torrent, TorrentStatus } from '@/entities/torrent/model/Torrent';
import { FetchHttpClient } from '@/shared/api/network/FetchHttpClient';
import { ServerConfig } from '@/shared/lib/types';
import { ExampleListSchema, ExampleTorrent } from './ExampleSchema';

@injectable()
export class ExampleAdapter implements ITorrentClient {
    private client: FetchHttpClient;
    private config: ServerConfig;

    constructor(config: ServerConfig) {
        this.config = config;
        this.client = new FetchHttpClient(config.hostname);
    }

    // Required: Authentication
    async login(): Promise<void> {
        // Implement auth logic (session tokens, cookies, etc.)
    }

    async logout(): Promise<void> {
        // Clear session if applicable
    }

    // Required: Core CRUD operations
    async getTorrents(): Promise<Torrent[]> {
        const response = await this.client.get('api/torrents');
        const validated = ExampleListSchema.parse(response);
        return validated.map(t => this.mapTorrent(t));
    }

    async addTorrentUrl(url: string, options?: AddTorrentOptions): Promise<void> {
        await this.client.post('api/torrents/add', {
            url,
            paused: options?.paused,
            path: options?.path,
        });
    }

    async addTorrentFile(file: Blob, options?: AddTorrentOptions): Promise<void> {
        const form = new FormData();
        form.append('file', file);
        if (options?.paused) form.append('paused', 'true');
        if (options?.path) form.append('path', options.path);
        await this.client.post('api/torrents/add', form);
    }

    async pauseTorrent(id: string): Promise<void> {
        await this.client.post(`api/torrents/${id}/pause`);
    }

    async resumeTorrent(id: string): Promise<void> {
        await this.client.post(`api/torrents/${id}/resume`);
    }

    async removeTorrent(id: string, deleteData?: boolean): Promise<void> {
        await this.client.delete(`api/torrents/${id}`, {
            deleteData: deleteData ?? false
        });
    }

    // Required: Connection testing
    async testConnection(): Promise<boolean> {
        try {
            await this.login();
            return true;
        } catch {
            return false;
        }
    }

    async ping(): Promise<number> {
        const start = Date.now();
        await this.client.get('api/version');
        return Date.now() - start;
    }

    // Required: Categories/Tags (return empty arrays if not supported)
    async getCategories(): Promise<string[]> {
        // Return [] if the client doesn't support categories
        return [];
    }

    async setCategory(hash: string, category: string): Promise<void> {
        // No-op if not supported
    }

    async getTags(): Promise<string[]> {
        return [];
    }

    async addTags(hash: string, tags: string[]): Promise<void> {
        // No-op if not supported
    }

    async removeTags(hash: string, tags: string[]): Promise<void> {
        // No-op if not supported
    }

    // Private: Status mapping
    private mapTorrent(t: ExampleTorrent): Torrent {
        return {
            id: t.id,
            name: t.name,
            status: this.mapStatus(t.status),
            progress: t.progress,
            size: t.size,
            downloadSpeed: t.downloadSpeed,
            uploadSpeed: t.uploadSpeed,
            eta: t.eta ?? -1,
            savePath: t.savePath,
            addedDate: 0,
            category: undefined,
            tags: []
        };
    }

    private mapStatus(status: string): TorrentStatus {
        // Map client-specific status to CTRL standard statuses
        switch (status.toLowerCase()) {
            case 'downloading':
            case 'dl':
                return 'downloading';
            case 'seeding':
            case 'uploading':
                return 'seeding';
            case 'paused':
            case 'stopped':
                return 'paused';
            case 'queued':
            case 'waiting':
                return 'queued';
            case 'checking':
            case 'hashing':
                return 'checking';
            case 'error':
                return 'error';
            default:
                return 'unknown';
        }
    }
}
```

---

## Step 4: Register the Adapter

Add your client to the factory in `extension/src/entities/client/lib/ClientFactory.ts`:

```typescript
import { ExampleAdapter } from '@/shared/api/clients/example/ExampleAdapter';

// In the create() method, add a case:
case 'example':
    return new ExampleAdapter(config);
```

Also add the client type to the options in `extension/src/shared/lib/types.ts`:

```typescript
export type ClientType = 
    | 'qbittorrent' 
    | 'transmission' 
    | 'example'  // Add here
    | ... ;
```

---

## Step 5: Write Unit Tests

Create tests for your adapter in `extension/tests/unit/adapters/`:

```typescript
// extension/tests/unit/adapters/ExampleAdapter.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExampleAdapter } from '@/shared/api/clients/example/ExampleAdapter';

describe('ExampleAdapter', () => {
    let adapter: ExampleAdapter;

    beforeEach(() => {
        adapter = new ExampleAdapter({
            hostname: 'http://localhost:8080',
            clientType: 'example',
            username: 'admin',
            password: 'password'
        });
    });

    it('should map torrent status correctly', () => {
        // Test status mapping
    });

    it('should handle login', async () => {
        // Mock the HTTP client and test login flow
    });

    it('should parse getTorrents response', async () => {
        // Mock response and verify parsing
    });
});
```

---

## Step 6: Test End-to-End

1. **Build the extension**: `npm run build:chrome`
2. **Load in browser**: `chrome://extensions` → Load unpacked → Select `builds/chrome-mv3`
3. **Configure your client**: Add your test server in the options page
4. **Verify operations**: Test add/pause/resume/remove

---

## Interface Reference

The `ITorrentClient` interface requires these 14 methods:

| Method | Purpose |
|--------|---------|
| `login()` | Authenticate with the client |
| `logout()` | End the session |
| `getTorrents()` | Fetch all torrents |
| `addTorrentUrl(url, options)` | Add via magnet/URL |
| `addTorrentFile(blob, options)` | Add via .torrent file |
| `pauseTorrent(id)` | Pause a torrent |
| `resumeTorrent(id)` | Resume a torrent |
| `removeTorrent(id, deleteData)` | Remove a torrent |
| `testConnection()` | Verify connectivity |
| `ping()` | Measure latency (ms) |
| `getCategories()` | List categories |
| `setCategory(hash, category)` | Set torrent category |
| `getTags()` | List tags |
| `addTags(hash, tags)` | Add tags to torrent |
| `removeTags(hash, tags)` | Remove tags from torrent |

---

## Status Mapping

CTRL uses standardized torrent statuses. Map your client's statuses to:

| CTRL Status | Meaning |
|-------------|---------|
| `downloading` | Actively downloading |
| `seeding` | Actively uploading |
| `paused` | User-paused |
| `queued` | Waiting in queue |
| `checking` | Verifying integrity |
| `error` | Error state |
| `unknown` | Fallback |

---

## Tips & Best Practices

1. **Use Zod schemas** - Always validate API responses to catch breaking changes early
2. **Handle edge cases** - Check for empty responses, missing fields, and error states
3. **Log strategically** - Use `console.log('[ClientName] ...')` for debugging
4. **Test failure modes** - What happens when auth fails? When the server is down?
5. **Check existing adapters** - Look at `QBittorrentAdapter` or `TransmissionAdapter` for patterns

---

## Need Help?

- Check existing adapters in `extension/src/shared/api/clients/`
- Open an issue with the "adapter-request" label
- Join the discussion in GitHub Discussions

---

*Last Updated: January 2026*
