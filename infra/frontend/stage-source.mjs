import { cp, mkdir, rm, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
const root = resolve(import.meta.dirname, '../..'), stage = resolve(root, '.cache/frontend-source');
if (relative(root, stage).replaceAll('\\', '/') !== '.cache/frontend-source') throw new Error('Unsafe stage path.');
await rm(stage, { recursive: true, force: true }); await mkdir(stage, { recursive: true });
const allowlist = ['src', 'public', 'package.json', 'package-lock.json', 'tsconfig.json', 'next.config.ts', 'next-env.d.ts',
  'eslint.config.mjs', 'postcss.config.mjs', 'infra/lambda', 'infra/template.json', 'infra/package.json', 'infra/package-lock.json', 'infra/frontend'];
for (const name of allowlist) {
  const path = resolve(stage, name); await mkdir(resolve(path, '..'), { recursive: true });
  await cp(resolve(root, name), path, { recursive: true, dereference: true }).catch(error => { if (name !== 'public' || error.code !== 'ENOENT') throw error; });
}
const secrets = ['ACCESS_KEY', 'SECRET_ACCESS_KEY', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN',
  'JALDRISHTI_ACCESS_CODE', 'JALDRISHTI_SESSION_SECRET', 'JALDRISHTI_BACKEND_TOKEN'].map(key => process.env[key]).filter(Boolean);
const files = [];
async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) await scan(path);
    else {
      const data = await readFile(path), text = data.toString('utf8');
      if (/^\.env(?:\.|$)/.test(entry.name) || secrets.some(secret => text.includes(secret)) || /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/.test(text))
        throw new Error('Forbidden secret in allowlisted source.');
      files.push({ path: relative(stage, path).replaceAll('\\', '/'), bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
    }
  }
}
await scan(stage);
await writeFile(resolve(root, 'artifacts/aws/phase-7.3/source-manifest.json'), JSON.stringify({ secretLeaks: 0, files }, null, 2));
console.log(JSON.stringify({ source: stage, files: files.length, secretLeaks: 0 }));
