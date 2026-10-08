// Run only after a clean, secret-free Linux Node 24 npm ci/build.
import { cp, mkdir, rm, readFile, readdir, writeFile, chmod, stat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = resolve(import.meta.dirname, '../..');
const output = resolve(root, '.cache/frontend-package');
if (process.platform !== 'linux' || process.arch !== 'x64' || Number(process.versions.node.split('.')[0]) !== 24)
  throw new Error('Release packaging requires Linux x86_64 Node 24; Windows output is not deployable.');
if (relative(root, output) !== '.cache/frontend-package') throw new Error('Unsafe output path.');
await rm(output, { recursive: true, force: true }); await mkdir(output, { recursive: true });
await cp(resolve(root, '.next/standalone'), output, { recursive: true, dereference: true });
await cp(resolve(root, '.next/static'), resolve(output, '.next/static'), { recursive: true });
await cp(resolve(root, 'public'), resolve(output, 'public'), { recursive: true }).catch(error => { if (error.code !== 'ENOENT') throw error; });
for (const file of ['bootstrap.mjs', 'run.sh']) await cp(resolve(root, 'infra/frontend', file), resolve(output, file));
await cp(resolve(root, 'src/lib/aws-runtime.mjs'), resolve(output, 'aws-runtime.mjs'));
await chmod(resolve(output, 'run.sh'), 0o755);
// Next may bundle route imports. Bootstrap's external signer still needs its
// lockfile-installed runtime dependency graph beside aws-runtime.mjs.
const copied = new Set();
async function copyRuntimeDependency(name) {
  if (copied.has(name)) return;
  copied.add(name);
  const source = resolve(root, 'node_modules', name);
  const pkg = JSON.parse(await readFile(resolve(source, 'package.json'), 'utf8'));
  await cp(source, resolve(output, 'node_modules', name), { recursive: true, dereference: true });
  for (const dependency of Object.keys(pkg.dependencies ?? {})) await copyRuntimeDependency(dependency);
}
await copyRuntimeDependency('@smithy/signature-v4');
await stat(resolve(output, 'node_modules/@smithy/signature-v4'));
let bytes = 0; const manifest = [];
async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name), name = relative(output, path).replaceAll('\\', '/');
    if (entry.isSymbolicLink()) throw new Error('Release must have no unresolved symlinks.');
    if (entry.isDirectory()) await scan(path);
    else {
      if (/^\.env(?:\.|$)/.test(entry.name) || /\.(?:pem|key)$/.test(entry.name)) throw new Error('Forbidden secret file.');
      const data = await readFile(path); bytes += data.length;
      if (/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/.test(data.toString('utf8'))) throw new Error('Credential pattern found.');
      manifest.push({ path: name, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
    }
  }
}
await scan(output);
// Expanded size of the checksum-verified x86 adapter layer version 30.
const layerBytes = 3238478;
if (bytes + layerBytes > 250 * 1024 * 1024) throw new Error('Lambda unzipped size limit exceeded.');
await writeFile(resolve(root, 'artifacts/frontend-manifest.json'), JSON.stringify({ platform: process.platform, arch: process.arch, node: process.version,
  bytes, layerBytes, executableMode: (await stat(resolve(output, 'run.sh'))).mode & 0o777, files: manifest }, null, 2));
const zipPath = resolve(root, 'artifacts/frontend-linux.zip');
await rm(zipPath, { force: true });
const zip = spawnSync('zip', ['-qr', zipPath, '.'], { cwd: output, stdio: 'inherit' });
if (zip.status !== 0) throw new Error('Linux zip packaging failed.');
const zipBytes = (await stat(zipPath)).size;
if (zipBytes > 50 * 1024 * 1024) throw new Error('Direct Lambda upload limit exceeded; review packaging rather than adding storage services.');
console.log(JSON.stringify({ bytes, zipBytes, files: manifest.length }));
