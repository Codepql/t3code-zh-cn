import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { archive, localizeArchive, PATCH_MARKER, sha } from './lib.mjs';
import { detectInstallDir, ensureClosed, resourcesDir, signatureWarning } from './platform.mjs';

// Electron normally exposes .asar paths as virtual directories. We must read
// and atomically replace the raw archive file, just as standalone Node does.
if (process.versions.electron) process.noAsar = true;

const home = path.dirname(fileURLToPath(import.meta.url));
let mode = process.argv[2] || 'status';
const installDir = detectInstallDir(process.argv[3]);
if (!installDir) throw Error('未找到 T3 Code 安装目录，请使用 --install-dir <安装目录>（直接运行 patch.mjs 时传入第 3 个参数），或设置 T3ZH_INSTALL_DIR。');
const resources = resourcesDir(installDir);
const target = path.join(resources, 'server.asar');
const dataRoot = path.resolve(process.env.T3ZH_DATA_DIR || home);
const stateFile = path.join(dataRoot, 'state.json');
const load = name => JSON.parse(fs.readFileSync(path.join(home, name), 'utf8'));
const rules = {
  dict: load('zh-CN.json'),
  literalOverrides: load('literal-overrides.json'),
  displayMaps: load('display-maps.json'),
  formatters: load('formatter-labels.json'),
  contextTranslations: load('context-translations.json')
};
const dictionarySha256 = sha(Buffer.from(JSON.stringify(rules.dict)));
const rulesSha256 = sha(Buffer.concat([
  fs.readFileSync(path.join(home, 'lib.mjs')),
  Buffer.from(JSON.stringify(rules.literalOverrides)), Buffer.from(JSON.stringify(rules.displayMaps)), Buffer.from(JSON.stringify(rules.formatters)), Buffer.from(JSON.stringify(rules.contextTranslations))
]));
const readState = () => fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : null;
const atomicJson = (file, value) => {
  fs.writeFileSync(file + '.tmp', JSON.stringify(value, null, 2) + '\n', { flag: 'w' });
  fs.renameSync(file + '.tmp', file);
};
function appVersion() {
  try {
    const pkg = JSON.parse(archive(fs.readFileSync(path.join(resources, 'app.asar'))).read('package.json'));
    return { version: pkg.version || '未知', commit: pkg.t3codeCommitHash || '未知' };
  } catch {
    return { version: '未知', commit: '未知' };
  }
}
function checkStateTarget(state) {
  if (path.resolve(state.target).toLowerCase() !== target.toLowerCase()) throw Error('备份对应其他安装位置，已停止。');
}
function backupPath(hash) {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw Error('备份哈希格式无效，已停止。');
  return path.join(dataRoot, 'backups', hash + '.server.asar');
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
  const patchedByUs = () => state && currentHash === state.patchedSha256;
  if (mode === 'upgrade') {
    if (patchedByUs()) {
      checkStateTarget(state);
      ensureClosed(installDir);
      const backup = fs.readFileSync(backupPath(state.originalSha256));
      if (sha(backup) !== state.originalSha256) throw Error('备份校验失败，未执行升级。');
      swap(backup, currentHash);
      atomicJson(stateFile, { ...state, status: 'restored-for-upgrade', restoredAt: new Date().toISOString() });
      original = fs.readFileSync(target);
      currentHash = sha(original);
    }
    mode = 'apply';
  }
  const { version, commit } = appVersion();
  if (mode === 'status') {
    const status = patchedByUs() ? '已安装中文补丁（T3 Code ' + state.version + '）'
      : original.includes(PATCH_MARKER) ? '资源含有中文补丁痕迹，但没有对应的安装记录'
      : '英文资源（T3 Code ' + version + '），可安装中文补丁';
    console.log(status + '\n资源：' + target + '\n备份和状态目录：' + dataRoot + '\nSHA256：' + currentHash);
  } else if (mode === 'restore') {
    if (!state) throw Error('没有安装记录，未执行恢复。');
    checkStateTarget(state);
    if (currentHash === state.originalSha256) {
      console.log('已经是原始英文资源，无需恢复。');
    } else {
      if (currentHash !== state.patchedSha256) throw Error('资源已更新或被修改。为避免旧备份覆盖新版，未执行恢复。\n若 T3 Code 已自动更新，新版本本身就是英文，无需恢复。');
      ensureClosed(installDir);
      const backup = fs.readFileSync(backupPath(state.originalSha256));
      if (sha(backup) !== state.originalSha256) throw Error('备份校验失败，未执行恢复。');
      swap(backup, currentHash);
      atomicJson(stateFile, { ...state, status: 'restored', restoredAt: new Date().toISOString() });
      console.log('已恢复原始英文资源，SHA256 与安装前完全一致。现在可以正常启动 T3 Code。');
    }
  } else if (patchedByUs()) {
    checkStateTarget(state);
    if (state.dictionarySha256 !== dictionarySha256 || state.rulesSha256 !== rulesSha256) throw Error('词典或翻译规则已更改，请运行 upgrade 重新汉化。');
    console.log('此中文补丁已安装，无需重复操作。');
  } else {
    // Never back up an already-patched archive as if it were the English original.
    if (original.includes(PATCH_MARKER)) throw Error('资源已含有中文补丁，但没有匹配的安装记录，未做修改。请重新安装 T3 Code 后再汉化。');
    const result = localizeArchive(original, rules);
    if (!result.patched) throw Error('没有匹配到可翻译的界面文字，未做修改。');
    const patchedSha256 = sha(result.patched);
    console.log(`扫描完成：T3 Code ${version}，${result.fileCount} 个界面文件，${result.count} 处中文替换。未收录的文字保留英文。`);
    if (result.skipped.length) console.log(`另有 ${result.skipped.length} 个文件无法处理，已保持原样：` + result.skipped.map(s => path.basename(s.path)).join('、'));
    if (mode === 'apply') {
      ensureClosed(installDir);
      const backup = backupPath(currentHash);
      fs.mkdirSync(path.dirname(backup), { recursive: true });
      if (!fs.existsSync(backup)) fs.writeFileSync(backup, original, { flag: 'wx' });
      if (sha(fs.readFileSync(backup)) !== currentHash) throw Error('原始备份校验失败。');
      // Persist recovery information BEFORE touching installed resources.
      const record = {
        status: 'prepared', version, commit, target,
        originalSha256: currentHash, patchedSha256, dictionarySha256, rulesSha256,
        fileCount: result.fileCount, replacementCount: result.count, preparedAt: new Date().toISOString()
      };
      atomicJson(stateFile, record);
      swap(result.patched, currentHash);
      atomicJson(stateFile, { ...record, status: 'applied', appliedAt: new Date().toISOString() });
      console.log('中文补丁已安装。现在可以从原来的快捷方式正常启动 T3 Code。\n备份和状态目录：' + dataRoot);
      console.log(process.env.T3ZH_CLI === '1'
        ? '恢复命令：t3code-zh-cn restore --install-dir ' + JSON.stringify(installDir) + ' --data-dir ' + JSON.stringify(dataRoot) + '\n未全局安装时：npx t3code-zh-cn@latest restore（使用相同的 --install-dir 和 --data-dir）。'
        : '恢复入口：' + path.join(home, '恢复英文.cmd'));
    } else {
      console.log('只读检查完成，未修改安装资源。\n补丁后 SHA256：' + patchedSha256);
    }
  }
} catch (error) {
  console.error('操作停止：' + error.message);
  process.exitCode = 1;
}
