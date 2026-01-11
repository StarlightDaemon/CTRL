import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const LOCALES_DIR = path.join(__dirname, '../../public/_locales');
const SOURCE_LOCALE = 'en';
const TARGET_LOCALES = ['fr', 'es', 'de', 'ja', 'ko', 'zh_CN', 'ru', 'pt_BR', 'pt_PT'];

async function main() {
    console.log('Starting Zero-Touch Localization Pipeline...');

    // 1. Load Source of Truth (English)
    const sourcePath = path.join(LOCALES_DIR, SOURCE_LOCALE, 'messages.json');
    if (!fs.existsSync(sourcePath)) {
        console.error(`Source file not found: ${sourcePath}`);
        process.exit(1);
    }
    const sourceMessages = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

    // 2. Iterate over target locales
    for (const locale of TARGET_LOCALES) {
        console.log(`Processing locale: ${locale}`);
        const targetPath = path.join(LOCALES_DIR, locale, 'messages.json');

        let targetMessages = {};
        if (fs.existsSync(targetPath)) {
            targetMessages = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
        }

        // 3. Diffing Logic
        let changed = false;
        const newMessages = { ...targetMessages };

        // Remove zombie keys
        for (const key of Object.keys(targetMessages)) {
            if (!sourceMessages[key]) {
                console.log(`[${locale}] Removing zombie key: ${key}`);
                delete newMessages[key];
                changed = true;
            }
        }

        // Add/Update keys
        for (const [key, value] of Object.entries(sourceMessages)) {
            if (!targetMessages[key]) {
                console.log(`[${locale}] New key found: ${key}`);
                // TODO: Call OpenAI API here for translation
                // For now, we just copy the English message with a prefix to indicate it needs translation
                newMessages[key] = {
                    message: `[${locale}] ${value.message}`,
                    description: value.description // Description is not needed in output but kept for context if needed
                };
                // In production, we would strip description from the output
                delete newMessages[key].description;
                changed = true;
            }
        }

        // 4. Save if changed
        if (changed) {
            // Ensure directory exists
            const targetDir = path.dirname(targetPath);
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            // Sort keys
            const sortedMessages = Object.keys(newMessages).sort().reduce((acc, key) => {
                acc[key] = newMessages[key];
                return acc;
            }, {});

            fs.writeFileSync(targetPath, JSON.stringify(sortedMessages, null, 2));
            console.log(`[${locale}] Updated messages.json`);
        } else {
            console.log(`[${locale}] No changes.`);
        }
    }

    console.log('Localization Pipeline Complete.');
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
