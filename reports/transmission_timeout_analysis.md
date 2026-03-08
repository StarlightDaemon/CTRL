# Transmission RPC Timeout Analysis (Firefox MV3)

## Objective
Determine why Firefox MV3 extension fetches to Transmission RPC are timing out.

## Evidence Summary

### 1. Background Network Evidence
Captured from background console logs (`reports/console-export-2026-2-19_23-40-33.log`):

*   **Observed Requests:** Multiple attempts to reach `http://localhost:9091/transmission/rpc`.
*   **Method:** OPTIONS (Preflight) and POST.
*   **Result:** **Connection timed out after 10s**.
*   **Key Detail:** The `FetchHttpClient.ts` in the extension codebase enforces a strict **10,000ms (10s)** timeout via `AbortController`.

### 2. CLI Evidence (OPTIONS Request)
Simulated preflight requests via `curl` from the shell:

| Host | Command | Duration | HTTP Status |
| :--- | :--- | :--- | :--- |
| `127.0.0.1:9091` | `curl -i -X OPTIONS ...` | **10.936s** | `200 OK` |
| `localhost:9091` | `curl -i -X OPTIONS ...` | **8.927s** | `200 OK` |
| `127.0.0.1:9091` | `curl -i -X POST ...` | **12.592s** | `409 Conflict` (Expected) |

*   **Latency Pattern:** Transmission is consistently responding in the **9s - 13s** range.
*   **IPv6:** `::1` failed immediately, confirming the server is listening on IPv4.

### 3. Conclusion: Class A (Hanging OPTIONS preflight)

The timeout is caused by a **latency mismatch** between the extension and the Transmission daemon:

1.  **Strict Client Timeout:** The extension's `FetchHttpClient` aborts any request that exceeds 10 seconds.
2.  **Slow Server Response:** The Transmission RPC server is taking slightly longer than 10 seconds to respond to the initial `OPTIONS` preflight request.
3.  **Result:** The browser aborts the preflight before it receives the headers required to proceed with the `POST` request.

## Storage Location
This report is saved at `/mnt/e/CTRL/reports/transmission_timeout_analysis.md`.
