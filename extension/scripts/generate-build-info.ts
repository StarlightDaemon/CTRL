
import { writeFileSync } from 'fs';
import { join } from 'path';
import packageJson from '../package.json';

const buildInfoPath = join(process.cwd(), 'src', 'shared', 'lib', 'buildInfo.ts');

const buildInfoContent = `export const BUILD_INFO = {
    version: '${packageJson.version}',
    timestamp: '${new Date().toISOString()}',
    displayDate: '${new Date().toLocaleString()}'
};`;

writeFileSync(buildInfoPath, buildInfoContent);
console.log(`[BuildInfo] Generated build info for v${packageJson.version} at ${new Date().toISOString()}`);
