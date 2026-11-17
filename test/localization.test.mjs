import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { archive, localizeArchive, translate } from '../lib.mjs';

const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const dict = JSON.parse(read('zh-CN.json'));
const overrides = JSON.parse(read('literal-overrides.json'));
const rules = {
  dict, literalOverrides: overrides,
  displayMaps: JSON.parse(read('display-maps.json')),
  formatters: JSON.parse(read('formatter-labels.json')),
  contextTranslations: JSON.parse(read('context-translations.json'))
};

function fixtureArchive(files) {
  const tree = { files: {} }, buffers = [];
  let offset = 0;
  for (const [name, source] of Object.entries(files)) {
    const bytes = Buffer.from(source);
    tree.files[name] = {size: bytes.length, offset: String(offset)};
    offset += bytes.length;
    buffers.push(bytes);
  }
  const json = Buffer.from(JSON.stringify(tree));
  const payload = Math.ceil((4 + json.length) / 4) * 4;
  const header = Buffer.alloc(12 + payload);
  [4, 4 + payload, payload, json.length].forEach((n, i) => header.writeUInt32LE(n, i * 4));
  json.copy(header, 16);
  return Buffer.concat([header, ...buffers]);
}

test('0.1.10 English locale catalog translates direct and hoisted messages without changing hashes', () => {
  const file = 'apps/server/dist/client/assets/en-C17-Nw8w.js';
  const source = 'var label=`Appearance`, messages={"0a75e464d833bca8":`Settings`,fa19046edd6cfbd4:label,"58058320796d28f6":`Code`}; export{label as fa19046edd6cfbd4,messages as default};';
  const result = localizeArchive(fixtureArchive({[file]: source}), rules);
  assert.ok(result.patched, 'English locale catalog must be localized');
  const output = archive(result.patched).read(file).toString();
  assert.match(output, /设置/);
  assert.match(output, /外观/);
  assert.match(output, /代码/);
  assert.match(output, /0a75e464d833bca8/);
  assert.match(output, /fa19046edd6cfbd4/);
  assert.match(output, /label as fa19046edd6cfbd4/);
  const code = 'var data={"58058320796d28f6":`Code`};export{data as default};';
  const codeResult = localizeArchive(fixtureArchive({[file]: code}), rules);
  assert.match(archive(codeResult.patched).read(file).toString(), /代码/);
});

test('0.1.10 command formatter remains localized after moving to settingsSearch', () => {
  const file = 'apps/server/dist/client/assets/settingsSearch-DjR_uMu-.js';
  const source = 'function Q(e){if(e===`workspace.focusNext`)return `Focus Next Workspace Area`;if(e===`sidebar.toggle`)return `Toggle Sidebar`;return e;} export {Q};';
  const result = localizeArchive(fixtureArchive({[file]: source}), rules);
  assert.ok(result.patched, 'Moved command formatter must still be localized');
  const output = archive(result.patched).read(file).toString();
  const format = new Function(output.replace('export {Q};', '') + ';return Q;')();
  assert.equal(format('sidebar.toggle'), '侧边栏：显示或隐藏');
  assert.equal(format('unknown.command'), 'unknown.command');
});

test('locale handling is opt-in and does not rewrite non-catalog data or executable values', () => {
  const source = 'var label=`Appearance`, data={"0a75e464d833bca8":`Settings`,fa19046edd6cfbd4:label};export{data as default};';
  assert.equal(translate(source, dict).output, source);
  const mixed = 'var label=`Appearance`, data={"0a75e464d833bca8":`Settings`,locale:`en`};export{data as default};';
  assert.equal(translate(mixed, dict, [], [], null, {localeCatalog:true}).output, mixed);
  const executable = 'const data={"0a75e464d833bca8":()=>"Settings"};export default data;';
  assert.equal(translate(executable, dict, [], [], null, {localeCatalog:true}).output, executable);
});

test('0.1.10 default-English rendering translates settings navigation and section titles', () => {
  // The i18n hook and q(message) return source text in the default locale;
  // translating the asynchronously loaded catalog alone never reaches these.
  const cases = [
    ['settingsSearch', 'const q = message => message; const routes = {"/settings/general":q(`General`),"/settings/appearance":q(`Appearance`),"/settings/diffs":q(`Diffs & pull requests`)}; const row={title:q(`Project grouping`)}; return [routes["/settings/general"],routes["/settings/appearance"],routes["/settings/diffs"],row.title];', ['常规','外观','差异与拉取请求','项目分组']],
    ['SettingsPanels', 'const t = message => message; const heading=t(`Notifications`),sidebar=t(`Sidebar`),confirmation=t(`Confirmations`); return [heading,sidebar,confirmation];', ['通知','侧边栏','确认操作']],
    ['_chat.settings', 'const t = message => message; return [t(`Search`),t(`Settings`),t(`Agents`),t(`Connections`)];', ['搜索','设置','智能体','连接']]
  ];
  for (const [base, body, expected] of cases) {
    const source = 'function render() {' + body + '}';
    const result = translate(source, {...dict,...rules.contextTranslations[base]}, overrides[base] || []);
    const actual = new Function(result.output + '; return render();')();
    assert.deepEqual(actual, expected, base);
    assert.match(result.output, /\/settings\/general|function render/);
  }
});

test('generated dictionary matches TSV sources and preserves interpolation order', () => {
  const expected = {};
  const slots = text => [...text.matchAll(/\$\{(\d+)\}/g)].map(match => match[1]);
  for (const line of (read('zh-CN.tsv') + '\n' + read('zh-CN-extra.tsv')).split(/\r?\n/)) {
    if (!line) continue;
    const tab = line.indexOf('\t');
    assert.ok(tab > 0, line);
    const key = line.slice(0, tab), value = line.slice(tab + 1);
    if (Object.hasOwn(expected, key)) assert.equal(value, expected[key], key);
    expected[key] = value;
    assert.deepEqual(slots(value), slots(key), key);
  }
  assert.deepEqual(dict, expected);
});

test('indirect settings descriptions and model notices translate with scoped rules', () => {
  // Both 0.1.8 and 0.1.9 hoist these UI strings into local variables/functions.
  const settings = 'const hint = project ? `Model for new threads in this project.` : `Default model for new threads. Projects can override it.`; const row = {description: hint};';
  assert.equal(translate(settings, dict).edits.length, 0);
  const translated = translate(settings, dict, overrides.ProjectDefaultsSettings).output;
  assert.match(translated, /此项目中新会话使用的模型/);
  assert.match(translated, /项目可以覆盖此设置/);

  const notice = 'function notice(name) { return `Open provider setup to install ${name} on this environment.`; }';
  const output = translate(notice, dict, overrides.ProviderModelPicker).output;
  const fn = new Function(output + '; return notice;')();
  assert.equal(fn('Codex'), '打开服务提供商配置，以在此环境中安装 Codex。');
});

test('small labels translate while routes, models and protocol values stay intact', () => {
  const source = 'const model = "gpt-5"; const route = "/settings/providers"; const status = "ready"; const ui = {children: "New", title: "Favorites", placeholder: "Search models..."};';
  const output = translate(source, dict, overrides.ProviderModelPicker).output;
  const value = new Function(output + '; return {model, route, status, ui};')();
  assert.deepEqual(value, { model: 'gpt-5', route: '/settings/providers', status: 'ready', ui: {children: '新增', title: '收藏', placeholder: '搜索模型…'} });
});

test('preview pagination keeps expression values and evaluation order', () => {
  const source = 'function label(first, last, total) { return {children: `${first()}–${last()} of ${total()}`}; }';
  const output = translate(source, dict).output;
  const label = new Function(output + '; return label;')();
  const calls = [];
  const value = label(...[1, 50, 120].map(n => () => { calls.push(n); return n; }));
  assert.equal(value.children, '第 1–50 行，共 120 行');
  assert.deepEqual(calls, [1, 50, 120]);
});
