import crypto from 'node:crypto';
import parser from './vendor/babel-parser.cjs';

export const sha = b => crypto.createHash('sha256').update(b).digest('hex');
export function archive(buffer) {
  const headerSize = buffer.readUInt32LE(4);
  const tree = JSON.parse(buffer.subarray(16, 16 + buffer.readUInt32LE(12)));
  const entries = [];
  function visit(dir, prefix = '') {
    for (const [name, entry] of Object.entries(dir.files || {})) {
      const path = prefix + name;
      if (entry.files) visit(entry, path + '/');
      else entries.push({ path, entry });
    }
  }
  visit(tree);
  const read = path => {
    const e = entries.find(x => x.path === path)?.entry;
    if (!e || e.unpacked || e.link) throw Error('Unsupported archive entry: ' + path);
    return buffer.subarray(8 + headerSize + Number(e.offset), 8 + headerSize + Number(e.offset) + e.size);
  };
  return { tree, entries, read };
}

export function rebuild(original, replacements) {
  const a = archive(original), parts = [];
  let offset = 0;
  for (const { path, entry } of a.entries) {
    if (entry.unpacked || entry.link) continue;
    const bytes = replacements.get(path) ?? a.read(path);
    entry.offset = String(offset);
    entry.size = bytes.length;
    offset += bytes.length;
    parts.push(bytes);
    if (replacements.has(path)) {
      const blockSize = entry.integrity?.blockSize || 4194304;
      const blocks = [];
      for (let i = 0; i < bytes.length; i += blockSize) blocks.push(sha(bytes.subarray(i, i + blockSize)));
      entry.integrity = { algorithm: 'SHA256', hash: sha(bytes), blockSize, blocks };
    }
  }
  const json = Buffer.from(JSON.stringify(a.tree));
  const payloadSize = Math.ceil((4 + json.length) / 4) * 4;
  const header = Buffer.alloc(8 + 4 + payloadSize);
  header.writeUInt32LE(4, 0);
  header.writeUInt32LE(4 + payloadSize, 4);
  header.writeUInt32LE(payloadSize, 8);
  header.writeUInt32LE(json.length, 12);
  json.copy(header, 16);
  return Buffer.concat([header, ...parts]);
}

const uiKeys = new Set(['children', 'title', 'description', 'placeholder', 'label', 'tooltip', 'aria-label', 'aria-description', 'emptyMessage', 'loadingText', 'message', 'detail', 'heading', 'actionLabel', 'confirmLabel', 'triggerLabel', 'detailLabel', 'subtitle', 'buttonLabel', 'cancelLabel', 'submitLabel', 'emptyText', 'errorMessage', 'successMessage']);
export function candidates(source, literalAllowList = [], displayMaps = []) {
  const ast = parser.parse(source, { sourceType: 'module' });
  const result = [];
  const approved = new Set(literalAllowList);
  const approvedMaps = new Map(displayMaps.map(m => [m.start, m.entries]));
  function visit(node, eligible = false) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'ObjectExpression' && approvedMaps.has(node.start)) {
      const strings = node.properties.map(p => [p.key?.name ?? p.key?.value, p.value?.type === 'StringLiteral' ? p.value.value : p.value?.type === 'TemplateLiteral' && !p.value.expressions.length ? p.value.quasis[0].value.cooked : null]);
      if (JSON.stringify(strings) !== JSON.stringify(approvedMaps.get(node.start))) throw Error('显示选项表与适配记录不一致：' + node.start);
      for (const p of node.properties) visit(p.value, true);
      return;
    }
    if (node.type === 'StringLiteral' || node.type === 'TemplateLiteral') {
      const dynamic = node.type === 'TemplateLiteral' && node.expressions.length > 0;
      const value = node.type === 'StringLiteral' ? node.value : node.quasis.map((q, i) => (q.value.cooked ?? q.value.raw) + (i < node.expressions.length ? '${' + i + '}' : '')).join('');
      if ((eligible || approved.has(value)) && value && /[A-Za-z]/.test(value)) {
        result.push({ start: node.start, end: node.end, value, ...(dynamic ? { expressions: node.expressions.map(e => source.slice(e.start, e.end)) } : {}) });
      }
      return;
    }
    if (node.type === 'ObjectProperty') {
      const key = node.key.name ?? node.key.value;
      visit(node.value, !node.computed && (uiKeys.has(key) || (typeof key === 'string' && key.startsWith('/settings/'))));
      return;
    }
    // Only follow display branches, never tests, calls, functions, or object keys.
    if (eligible && node.type === 'ConditionalExpression') {
      visit(node.consequent, true); visit(node.alternate, true); return;
    }
    if (eligible && node.type === 'ArrayExpression') {
      for (const child of node.elements) visit(child, true);
      return;
    }
    if (eligible && node.type === 'LogicalExpression') {
      visit(node.right, true); return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (['loc', 'extra', 'comments', 'tokens'].includes(key)) continue;
      if (Array.isArray(value)) for (const child of value) visit(child, false);
      else if (value && typeof value === 'object') visit(value, false);
    }
  }
  visit(ast);
  return result;
}
export function translate(source, dictionary, literalAllowList = [], displayMaps = [], formatter = null) {
  const edits = candidates(source, literalAllowList, displayMaps).filter(e => Object.hasOwn(dictionary, e.value));
  if (formatter) {
    const ast = parser.parse(source, { sourceType: 'module' });
    const targets = ast.program.body.filter(n => n.type === 'FunctionDeclaration' && n.id?.name === formatter.functionName);
    if (targets.length !== 1 || targets[0].params.length !== 1 || targets[0].params[0].name !== formatter.argument) throw Error('显示名称函数不匹配');
    const pos = targets[0].body.start + 1;
    const prefix = 'const __t3zhCommandLabels=' + JSON.stringify(formatter.labels) + ';if(Object.prototype.hasOwnProperty.call(__t3zhCommandLabels,' + formatter.argument + '))return __t3zhCommandLabels[' + formatter.argument + '];';
    edits.push({ start: pos, end: pos, replacement: prefix });
  }
  let output = source;
  for (const e of edits.toSorted((a, b) => b.start - a.start)) {
    let replacement = e.replacement ?? JSON.stringify(dictionary[e.value]);
    if (e.expressions) {
      const pieces = dictionary[e.value].split(/\$\{(\d+)\}/g);
      const slots = pieces.filter((_, i) => i % 2 === 1).map(Number);
      if (slots.length !== e.expressions.length || slots.some((s, i) => s !== i)) throw Error('动态翻译必须保留插值及其求值顺序：' + e.value);
      replacement = '`' + pieces.map((s, i) => i % 2 ? '${' + e.expressions[Number(s)] + '}' : s.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${')).join('') + '`';
    }
    output = output.slice(0, e.start) + replacement + output.slice(e.end);
  }
  if (edits.length) parser.parse(output, { sourceType: 'module' });
  return { output, edits };
}
