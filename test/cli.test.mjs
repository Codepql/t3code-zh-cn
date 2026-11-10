import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { sha } from '../lib.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = path.join(root, 'bin', 't3code-zh-CN.mjs');
function run(args, env = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: 'utf8', env: { ...process.env, ...env }
  });
}
function asar(files) {
  const tree = { files: {} }, parts = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const bytes = Buffer.from(content);
    tree.files[name] = { size: bytes.length, offset: String(offset) };
    parts.push(bytes);
    offset += bytes.length;
  }
  const json = Buffer.from(JSON.stringify(tree));
  const payloadSize = Math.ceil((4 + json.length) / 4) * 4;
  const header = Buffer.alloc(12 + payloadSize);
  header.writeUInt32LE(4, 0);
  header.writeUInt32LE(4 + payloadSize, 4);
  header.writeUInt32LE(payloadSize, 8);
  header.writeUInt32LE(json.length, 12);
  json.copy(header, 16);
  return Buffer.concat([header, ...parts]);
}

test('CLI validates commands and options before accessing an installation', () => {
  assert.equal(run(['--help']).status, 0);
  for (const args of [['bad'], ['apply', '--instal-dir', 'x'], ['check', '--data-dir'], ['status', '--data-dir', 'a', '--data-dir', 'b']]) {
    assert.equal(run(args).status, 2);
  }
});

test('missing installation produces an actionable error without a stack trace', () => {
  const result = run(['check', '--install-dir', path.join(root, 'does-not-exist')]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /操作停止/);
  assert.doesNotMatch(result.stderr, /at ModuleJob/);
});

test('npm CLI lifecycle keeps backups outside tool files and restores across tool builds', t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 't3zh-test-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const tool = path.join(temp, 'tool'), install = path.join(temp, 'app');
  const data = path.join(temp, 'persistent-data');
  fs.mkdirSync(path.join(tool, 'vendor'), { recursive: true });
  fs.mkdirSync(path.join(install, 'resources'), { recursive: true });
  for (const file of ['patch.mjs', 'lib.mjs', 'vendor/babel-parser.cjs']) {
    fs.copyFileSync(path.join(root, file), path.join(tool, file));
  }
  // Fixture isolates archive/backup behavior from OS process enumeration.
  fs.writeFileSync(path.join(tool, 'platform.mjs'), `
    import path from 'node:path';
    export const detectInstallDir = value => value;
    export const resourcesDir = value => path.join(value, 'resources');
    export const ensureClosed = () => {};
    export const signatureWarning = () => null;
  `);
  const source = 'const ui = {title: "Hello"};';
  const original = asar({ 'ui.js': source, 'untouched.txt': 'keep me' });
  const target = path.join(install, 'resources', 'server.asar');
  const compatibility = {
    version: '0.1.8', commit: 'fixture', serverSha256: sha(original),
    files: [{ path: 'ui.js', hash: sha(Buffer.from(source)) }]
  };
  const json = (name, value) => fs.writeFileSync(path.join(tool, name), JSON.stringify(value));
  json('compatibility.json', compatibility);
  json('zh-CN.json', { Hello: '你好' });
  for (const file of ['context-translations.json', 'literal-overrides.json', 'display-maps.json', 'formatter-labels.json']) json(file, {});
  fs.writeFileSync(target, original);
  fs.writeFileSync(path.join(install, 'resources', 'app.asar'), asar({ 'package.json': JSON.stringify({ version: '0.1.8', t3codeCommitHash: 'fixture' }) }));
  const env = { T3ZH_HOME: tool, T3ZH_DATA_DIR: data };
  const invoke = command => run([command, '--install-dir', install], env);
  const success = command => {
    const result = invoke(command);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  success('check');
  assert.deepEqual(fs.readFileSync(target), original);
  assert.equal(fs.existsSync(data), false);
  assert.match(success('apply'), /t3code-zh-cn restore/);
  const patched = fs.readFileSync(target);
  assert.notDeepEqual(patched, original);
  assert.equal(fs.existsSync(path.join(tool, 'state.json')), false);
  assert.match(success('status'), /已安装中文补丁/);
  success('apply');
  assert.deepEqual(fs.readFileSync(target), patched);
  json('zh-CN.json', { Hello: '您好' });
  assert.equal(invoke('apply').status, 1);
  success('upgrade');
  assert.notDeepEqual(fs.readFileSync(target), patched);
  // Installing a newer npm tool must not prevent recovery of the previous build.
  json('compatibility.json', { ...compatibility, serverSha256: 'a'.repeat(64) });
  success('restore');
  assert.deepEqual(fs.readFileSync(target), original);
  success('restore');
  json('compatibility.json', compatibility);
  success('apply');
  fs.writeFileSync(target, 'updated by app installer');
  assert.equal(invoke('restore').status, 1);
  assert.equal(fs.readFileSync(target, 'utf8'), 'updated by app installer');
  fs.writeFileSync(target, patched);
  // Use the recorded patched bytes so the restore reaches backup verification.
  const state = JSON.parse(fs.readFileSync(path.join(data, 'state.json'), 'utf8'));
  state.patchedSha256 = sha(patched);
  fs.writeFileSync(path.join(data, 'state.json'), JSON.stringify(state));
  fs.writeFileSync(path.join(data, 'backups', sha(original) + '.server.asar'), 'corrupt');
  assert.equal(invoke('restore').status, 1);
  assert.deepEqual(fs.readFileSync(target), patched);
});
