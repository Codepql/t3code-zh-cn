import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { translate } from '../lib.mjs';

const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const dict = JSON.parse(read('zh-CN.json'));
const overrides = JSON.parse(read('literal-overrides.json'));

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
