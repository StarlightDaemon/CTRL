export class SecurityService {
    private static readonly ALGORITHM = 'AES-GCM';
    private static readonly KDF_ALGORITHM = 'PBKDF2';
    private static readonly SALT_LENGTH = 16;
    private static readonly IV_LENGTH = 12;
    private static readonly ITERATIONS = 300000;

    /**
     * Derives a cryptographic key from a user password and salt.
     */
    static async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            enc.encode(password).buffer as ArrayBuffer,
            { name: 'PBKDF2' },
            false,
            ['deriveBits', 'deriveKey']
        );

        return await crypto.subtle.deriveKey(
            {
                name: this.KDF_ALGORITHM,
                salt: salt.buffer as ArrayBuffer,
                iterations: this.ITERATIONS,
                hash: 'SHA-256',
            },
            keyMaterial,
            { name: this.ALGORITHM, length: 256 },
            true, // Exportable for session storage
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Generates a random salt.
     */
    static generateSalt(): Uint8Array {
        return crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
    }

    /**
     * Encrypts plaintext using the provided key.
     * Returns an object containing the IV and ciphertext.
     */
    static async encrypt(plaintext: string, key: CryptoKey): Promise<{ iv: Uint8Array; ciphertext: ArrayBuffer }> {
        const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
        const enc = new TextEncoder();

        const ciphertext = await crypto.subtle.encrypt(
            {
                name: this.ALGORITHM,
                iv: iv,
            },
            key,
            enc.encode(plaintext).buffer as ArrayBuffer
        );

        return { iv, ciphertext };
    }

    /**
     * Decrypts ciphertext using the provided key and IV.
     */
    static async decrypt(ciphertext: ArrayBuffer, iv: Uint8Array, key: CryptoKey): Promise<string> {
        try {
            const decrypted = await crypto.subtle.decrypt(
                {
                    name: this.ALGORITHM,
                    iv: iv as any,
                },
                key,
                ciphertext
            );

            const dec = new TextDecoder();
            return dec.decode(decrypted);
        } catch (e) {
            console.error('[SecurityService] Decryption failed:', e);
            throw new Error('Invalid password or corrupted data');
        }
    }
}
