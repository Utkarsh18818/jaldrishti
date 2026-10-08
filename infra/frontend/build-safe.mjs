// Next standalone copies root .env even with tracing exclusions. Temporarily
// park local environment files on the same project drive, restore in finally.
import { readdir, mkdir, rename, rmdir } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { spawn } from 'node:child_process';
const root = resolve(import.meta.dirname, '../..');
const parked = resolve(root, '.cache/build-env', String(Date.now()));
if (!relative(root, parked).replaceAll('\\', '/').startsWith('.cache/build-env/')) throw new Error('Unsafe temporary path.');
await mkdir(parked, { recursive: true });
const moved = [];
try {
  for (const name of await readdir(root)) {
    if (/^\.env(?:\.|$)/.test(name) && name !== '.env.example') {
      await rename(resolve(root, name), resolve(parked, name)); moved.push(name);
    }
  }
  const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1' };
  for (const key of Object.keys(env)) if (/^(AWS_|ACCESS_KEY$|SECRET_ACCESS_KEY$|JALDRISHTI_|NEXT_PUBLIC_JALDRISHTI_)/.test(key)) delete env[key];
  const child = spawn(process.execPath, [resolve(root, 'node_modules/next/dist/bin/next'), 'build'], { cwd: root, env, stdio: 'inherit' });
  process.exitCode = await new Promise((done, reject) => { child.on('error', reject); child.on('exit', code => done(code ?? 1)); });
} finally {
  for (const name of moved) await rename(resolve(parked, name), resolve(root, name));
  await rmdir(parked);
}
