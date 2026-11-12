// 维护工具：根据 zh-CN.tsv 与 zh-CN-extra.tsv 生成 zh-CN.json。
// 传入任意版本的 server.asar 时，额外输出覆盖情况和尚未翻译的界面文字（不修改该文件）。
// 用法：node tools/build-dict.mjs [server.asar] [--untranslated 输出文件]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { archive, candidates, chunkBase, isClientAsset, localizeArchive } from '../lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const outIndex = args.indexOf('--untranslated');
const outFile = outIndex >= 0 ? args.splice(outIndex, 2)[1] : null;
const [serverPath] = args;
const file = name => path.join(root, name);
const json = name => JSON.parse(fs.readFileSync(file(name), 'utf8'));

const dict = {};
for (const line of ['zh-CN.tsv', 'zh-CN-extra.tsv'].flatMap(name => fs.readFileSync(file(name), 'utf8').split(/\r?\n/))) {
  if (!line) continue;
  const pos = line.indexOf('\t');
  if (pos < 1) throw Error('词典行格式无效：' + line);
  const key = line.slice(0, pos), val = line.slice(pos + 1);
  if (dict[key] && dict[key] !== val) throw Error('词典条目冲突：' + key);
  dict[key] = val;
}
fs.writeFileSync(file('zh-CN.json'), JSON.stringify(dict, null, 2) + '\n');
console.log('词典条目：' + Object.keys(dict).length);
if (!serverPath) process.exit(0);

const rules = { dict, literalOverrides: json('literal-overrides.json'), displayMaps: json('display-maps.json'), formatters: json('formatter-labels.json'), contextTranslations: json('context-translations.json') };
const raw = fs.readFileSync(serverPath), result = localizeArchive(raw, rules);
console.log(`界面文件：${result.fileCount}，中文替换：${result.count}，无法处理：${result.skipped.length}`);
for (const s of result.skipped) console.log('  跳过 ' + s.path + '：' + s.reason);

const a = archive(raw), missing = new Map(), bases = new Set();
for (const item of a.entries.filter(isClientAsset)) {
  const base = chunkBase(item.path), source = a.read(item.path).toString('utf8');
  bases.add(base);
  try {
    for (const c of candidates(source, rules.literalOverrides[base] || [], rules.displayMaps[base] || [])) {
      if (!Object.hasOwn(dict, c.value) && !Object.hasOwn(rules.contextTranslations[base] || {}, c.value)) missing.set(c.value, base);
    }
  } catch { /* already reported above */ }
}
const unusedRules = Object.keys({ ...rules.literalOverrides, ...rules.displayMaps, ...rules.formatters, ...rules.contextTranslations }).filter(b => !bases.has(b));
if (unusedRules.length) console.log('以下规则对应的文件在此版本中不存在（相关文字会保留英文）：' + unusedRules.join('、'));
console.log('未翻译的候选文字：' + missing.size + (outFile ? '，已写入 ' + outFile : ''));
if (outFile) fs.writeFileSync(outFile, [...missing].map(([s, b]) => JSON.stringify(s) + '\t' + b).join('\n') + '\n');
