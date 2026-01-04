# CTRL API Reference

> Client adapter interface and usage documentation

---

## ITorrentClient Interface

All torrent client adapters implement the `ITorrentClient` interface.

### Core Methods

```typescript
interface ITorrentClient {
  // Authentication
  login(): Promise<void>;
  logout(): Promise<void>;
  testConnection(): Promise<boolean>;
  ping(): Promise<number>;

  // Torrent Management
  getTorrents(): Promise<Torrent[]>;
  addTorrentUrl(url: string, options?: AddTorrentOptions): Promise<void>;
  addTorrentFile(file: Blob, options?: AddTorrentOptions): Promise<void>;
  pauseTorrent(id: string): Promise<void>;
  resumeTorrent(id: string): Promise<void>;
  removeTorrent(id: string, deleteData?: boolean): Promise<void>;

  // Categories & Tags
  getCategories(): Promise<string[]>;
  setCategory(hash: string, category: string): Promise<void>;
  getTags(): Promise<string[]>;
  addTags(hash: string, tags: string[]): Promise<void>;
  removeTags(hash: string, tags: string[]): Promise<void>;
}
```

### AddTorrentOptions

```typescript
interface AddTorrentOptions {
  paused?: boolean;    // Start paused
  path?: string;       // Save directory
  label?: string;      // Category/label
}
```

### Torrent Model

```typescript
interface Torrent {
  id: string;
  name: string;
  status: TorrentStatus;
  progress: number;      // 0-100
  size: number;          // Bytes
  downloadSpeed: number; // Bytes/s
  uploadSpeed: number;   // Bytes/s
  eta: number;           // Seconds
  savePath: string;
  addedDate: number;     // Unix timestamp
  category?: string;
  tags?: string[];
}

type TorrentStatus = 
  | 'downloading' 
  | 'seeding' 
  | 'paused' 
  | 'checking' 
  | 'queued' 
  | 'completed' 
  | 'error' 
  | 'unknown';
```

---

## Supported Clients

| Adapter | Protocol | Auth | Categories | Tags |
|---------|----------|------|------------|------|
| **qBittorrent** | REST | Cookie | ✅ | ✅ |
| **Transmission** | JSON-RPC | Session ID | ✅ (labels) | ✅ |
| **Deluge** | JSON-RPC | Cookie + Daemon | ✅ (Label plugin) | ❌ |
| **Flood** | REST | JWT | ✅ (via tags) | ✅ |
| **ruTorrent** | XML-RPC | Basic Auth | ✅ (custom1) | ❌ |
| **uTorrent** | REST | Token | ✅ | ❌ |
| **Aria2** | JSON-RPC | Token | ❌ | ❌ |
| **BiglyBT** | JSON-RPC | Session ID | ✅ | ✅ |
| **Vuze** | JSON-RPC | Session ID | ✅ | ✅ |

---

## Usage Example

```typescript
import { ClientFactory } from '@/entities/client/lib/ClientFactory';

const config = {
  type: 'qbittorrent',
  hostname: 'http://localhost:8080',
  username: 'admin',
  password: 'adminadmin',
  // ...
};

const factory = new ClientFactory();
const client = await factory.create(config);

// Login
await client.login();

// Get torrents
const torrents = await client.getTorrents();

// Add a torrent
await client.addTorrentUrl('magnet:?xt=urn:btih:...', {
  paused: true,
  path: '/downloads/movies'
});

// Pause/Resume
await client.pauseTorrent(torrents[0].id);
await client.resumeTorrent(torrents[0].id);
```

---

## Client-Specific Notes

### qBittorrent
- Default path: `/api/v2/`
- Requires cookie-based session after login

### Transmission
- Default path: `/transmission/rpc`
- Handles 409 responses automatically for session ID

### Deluge
- Default path: `/json`
- Multi-step handshake: `auth.login` → `web.connected` → `web.connect`

### ruTorrent
- Default path: `/plugins/httprpc/action.php`
- Uses XML-RPC protocol with Basic Auth

### Aria2
- Default path: `/jsonrpc`
- Token-based auth: `token:YOUR_SECRET`

---

## Error Handling

All adapters throw descriptive errors:

```typescript
try {
  await client.login();
} catch (error) {
  // 'Authentication Failed'
  // 'Connection refused'
  // 'rTorrent Fault: Access denied (-1)'
}
```

Use `testConnection()` for safe connection testing:

```typescript
const isConnected = await client.testConnection();
// Returns false instead of throwing
```
