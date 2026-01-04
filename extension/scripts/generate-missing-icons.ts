/**
 * Generate missing icon sizes from original 64px icon
 */
import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconDir = join(__dirname, '../src/public/icon');

async function generateMissingSizes() {
    const source64 = join(iconDir, 'default-64.png');

    console.log('Generating missing icon sizes from original 64px...');

    // Generate 16px
    await sharp(source64)
        .resize(16, 16)
        .png()
        .toFile(join(iconDir, 'default-16.png'));
    console.log('✓ Generated default-16.png');

    // Generate 128px (upscale)
    await sharp(source64)
        .resize(128, 128, { kernel: 'lanczos3' })
        .png()
        .toFile(join(iconDir, 'default-128.png'));
    console.log('✓ Generated default-128.png');

    console.log('\nDone! All icon sizes ready.');
}

generateMissingSizes().catch(console.error);
