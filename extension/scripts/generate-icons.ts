/**
 * Icon Generator Script
 * Converts the SVG icon to multiple PNG sizes for the extension
 */
import sharp from 'sharp';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconDir = join(__dirname, '../src/public/icon');

const SIZES = [16, 32, 48, 64, 128];

async function generateIcons() {
    const svgPath = join(iconDir, 'ctrl-icon.svg');
    const svgBuffer = readFileSync(svgPath);

    console.log('Generating icons from ctrl-icon.svg...');

    for (const size of SIZES) {
        const outputPath = join(iconDir, `default-${size}.png`);

        await sharp(svgBuffer)
            .resize(size, size)
            .png()
            .toFile(outputPath);

        console.log(`✓ Generated ${outputPath} (${size}x${size})`);
    }

    console.log('\nAll icons generated successfully!');
}

generateIcons().catch(console.error);
