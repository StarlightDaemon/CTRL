
import { copy } from 'fs-extra';
import path, { join, resolve } from 'path';
import { mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';

async function backup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const version = process.env.npm_package_version || 'unknown';

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const baseBackupPath = resolve(__dirname, '../../backups');
    const backupDir = join(baseBackupPath, `src-v${version}-${timestamp}`);

    try {
        await mkdir(backupDir, { recursive: true });
        await copy(join(process.cwd(), 'src'), join(backupDir, 'src'));
        console.log(`[Backup] Source backed up to: ${backupDir}`);
    } catch (error) {
        console.error('[Backup] Failed:', error);
        process.exit(1);
    }
}

backup();
