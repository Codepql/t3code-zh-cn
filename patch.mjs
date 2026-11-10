import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { archive, rebuild, sha, translate } from './lib.mjs';
import { detectInstallDir, ensureClosed, resourcesDir, signatureWarning } from './platform.mjs';

// Electron normally exposes .asar paths as virtual directories. We must read
// and atomically replace the raw archive file, just as standalone Node does.
if (process.versions.electron) process.noAsar = true;

const home = path.dirname(fileURLToPath(import.meta.url));
let mode = process.argv[2] || 'status';
const installDir = detectInstallDir(process.argv[3]);
if (!installDir) throw Error('未找到 T3 Code 安装目录，请通过第 3 个参数指定，或设置 T3ZH_INSTALL_DIR。');
const resources = resourcesDir(installDir);
const target = path.join(resources, 'server.asar');
const dataRoot = path.resolve(process.env.T3ZH_DATA_DIR || home);
const stateFile = path.join(dataRoot, 'state.json');
const compat = JSON.parse(fs.readFileSync(path.join(home, 'compatibility.json'), 'utf8'));
const dict = JSON.parse(fs.readFileSync(path.join(home, 'zh-CN.json'), 'utf8'));
const literalOverrides = JSON.parse(fs.readFileSync(path.join(home, 'literal-overrides.json'), 'utf8'));
const displayMaps = JSON.parse(fs.readFileSync(path.join(home, 'display-maps.json'), 'utf8'));
const formatters = JSON.parse(fs.readFileSync(path.join(home, 'formatter-labels.json'), 'utf8'));
const contextTranslations = JSON.parse(fs.readFileSync(path.join(home, 'context-translations.json'), 'utf8'));
const rulesSha256 = sha(Buffer.concat([
  fs.readFileSync(path.join(home, 'lib.mjs')),
  Buffer.from(JSON.stringify(literalOverrides)), Buffer.from(JSON.stringify(displayMaps)), Buffer.from(JSON.stringify(formatters)), Buffer.from(JSON.stringify(contextTranslations))
]));
const readState = () => fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : null;
const atomicJson = (file, value) => {
  fs.writeFileSync(file + '.tmp', JSON.stringify(value, null, 2) + '\n', { flag: 'w' });
  fs.renameSync(file + '.tmp', file);
};
function checkStateTarget(state) {
  if (path.resolve(state.target).toLowerCase() !== target.toLowerCase()) throw Error('备份对应其他安装位置，已停止。');
  if (state.originalSha256 !== compat.serverSha256) throw Error('备份版本与此补丁不匹配，已停止。');
}
function backupPath() {
  return path.join(dataRoot, 'backups', compat.serverSha256 + '.server.asar');
}
function swap(buffer, expectedCurrentHash) {
  // Same-directory rename replaces the archive without an interval where it is absent.
  const temp = target + '.t3zh-' + process.pid + '.tmp';
  try {
    fs.writeFileSync(temp, buffer, { flag: 'wx' });
    if (sha(fs.readFileSync(temp)) !== sha(buffer)) throw Error('临时文件写入校验失败。');
    ensureClosed(installDir);
    if (sha(fs.readFileSync(target)) !== expectedCurrentHash) throw Error('资源在操作期间发生变化，已停止。');
    fs.renameSync(temp, target);
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}
try {
  if (!['status', 'check', 'apply', 'restore', 'upgrade'].includes(mode)) throw Error('用法：patch.mjs status|check|apply|restore|upgrade [安装目录]');
  if (!fs.existsSync(target)) throw Error('未找到 T3 Code 资源：' + target);
  const warning = signatureWarning();
  if (warning && mode !== 'status') console.warn('提示：' + warning);
  let original = fs.readFileSync(target), currentHash = sha(original), state = readState();
  if (mode === 'upgrade') {
    if (state && currentHash === state.patchedSha256) {
      checkStateTarget(state);
      ensureClosed(installDir);
      const backup = fs.readFileSync(backupPath());
      if (sha(backup) !== state.originalSha256) throw Error('备份校验失败，未执行升级。');
      swap(backup, currentHash);
      atomicJson(stateFile, { ...state, status: 'restored-for-upgrade', restoredAt: new Date().toISOString() });
      original = fs.readFileSync(target);
      currentHash = sha(original);
    }
    mode = 'apply';
  }
  if (mode === 'status') {
    const status = state && currentHash === state.patchedSha256 ? '已安装中文补丁' : currentHash === compat.serverSha256 ? '原始英文资源，可安装补丁' : '资源已更新或被其他工具修改，此补丁不兼容';
    console.log(status + '\n资源：' + target + '\nSHA256：' + currentHash);
  } else if (mode === 'restore') {
    if (!state) throw Error('没有安装记录，未执行恢复。');
    checkStateTarget(state);
    if (currentHash === state.originalSha256) {
      console.log('已经是原始英文资源，无需恢复。');
    } else {
      if (currentHash !== state.patchedSha256) throw Error('资源已更新或被修改。为避免旧备份覆盖新版，未执行恢复。');
      ensureClosed(installDir);
      const backup = fs.readFileSync(backupPath());
      if (sha(backup) !== state.originalSha256) throw Error('备份校验失败，未执行恢复。');
      swap(backup, currentHash);
      atomicJson(stateFile, { ...state, status: 'restored', restoredAt: new Date().toISOString() });
      console.log('已恢复原始英文资源，SHA256 与安装前完全一致。现在可以正常启动 T3 Code。');
    }
  } else {
    if (state && currentHash === state.patchedSha256) {
      checkStateTarget(state);
      if (state.dictionarySha256 !== sha(Buffer.from(JSON.stringify(dict))) || state.rulesSha256 !== rulesSha256) throw Error('词典或翻译规则已更改，请先恢复英文，再重新汉化。');
      console.log('此中文补丁已安装，无需重复操作。');
    } else {
      if (currentHash !== compat.serverSha256) throw Error('此补丁仅适配已校验的 T3 Code ' + compat.version + '（' + compat.commit + '）。当前资源不匹配，未做修改。');
      const pkg = JSON.parse(archive(fs.readFileSync(path.join(resources, 'app.asar'))).read('package.json'));
      if (pkg.version !== compat.version || pkg.t3codeCommitHash !== compat.commit) throw Error('桌面应用版本或构建不匹配，未做修改。');
      const a = archive(original), replacements = new Map();
      let count = 0;
      for (const file of compat.files) {
        const bytes = a.read(file.path);
        if (sha(bytes) !== file.hash) throw Error('文件校验失败：' + file.path);
        const filename = path.basename(file.path);
        const t = translate(bytes.toString('utf8'), { ...dict, ...contextTranslations[filename] }, literalOverrides[filename] || [], displayMaps[filename] || [], formatters[filename]);
        if (t.edits.length) {
          replacements.set(file.path, Buffer.from(t.output));
          count += t.edits.length;
        }
      }
      if (!replacements.size) throw Error('没有匹配到中文词条，未做修改。');
      const patched = rebuild(original, replacements), verified = archive(patched);
      // Every other packed resource must be byte-for-byte identical.
      for (const { path: file, entry } of a.entries) {
        if (entry.unpacked || entry.link) continue;
        const expected = replacements.get(file) ?? a.read(file);
        if (!verified.read(file).equals(expected)) throw Error('重建资源校验失败：' + file);
      }
      const patchedSha256 = sha(patched);
      console.log(`校验通过：T3 Code ${pkg.version}，${replacements.size} 个界面文件，${count} 处中文替换。`);
      if (mode === 'apply') {
        ensureClosed(installDir);
        fs.mkdirSync(path.dirname(backupPath()), { recursive: true });
        if (!fs.existsSync(backupPath())) fs.writeFileSync(backupPath(), original, { flag: 'wx' });
        if (sha(fs.readFileSync(backupPath())) !== currentHash) throw Error('原始备份校验失败。');
        // Persist recovery information BEFORE touching installed resources.
        const record = {
          status: 'prepared', version: pkg.version, commit: compat.commit, target,
          originalSha256: currentHash, patchedSha256,
          dictionarySha256: sha(Buffer.from(JSON.stringify(dict))),
          rulesSha256,
          fileCount: replacements.size, replacementCount: count, preparedAt: new Date().toISOString()
        };
        atomicJson(stateFile, record);
        swap(patched, currentHash);
        atomicJson(stateFile, { ...record, status: 'applied', appliedAt: new Date().toISOString() });
        console.log('中文补丁已安装。现在可以从原来的快捷方式正常启动 T3 Code。\n恢复入口：' + path.join(home, '恢复英文.cmd'));
      } else {
        console.log('只读检查完成，未修改安装资源。\n补丁后 SHA256：' + patchedSha256);
      }
    }
  }
} catch (error) {
  console.error('操作停止：' + error.message);
  process.exitCode = 1;
}
