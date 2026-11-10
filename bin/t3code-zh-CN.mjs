#!/usr/bin/env node
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const help = `T3 Code 简体中文补丁\n\n用法：t3code-zh-cn <命令> [选项]\n也可运行：npx t3code-zh-cn@latest <命令> [选项]\n\n命令：\n  apply      一键汉化（自动备份原始资源）\n  restore    一键恢复英文\n  upgrade    一键更新汉化（使用当前工具内的词典，不下载新包）\n  status     查看当前资源和安装状态（默认命令）\n  check      只读检查兼容性，不修改文件\n\n选项：\n  --install-dir <目录>  指定 T3 Code 安装目录\n  --data-dir <目录>     指定备份和状态目录（默认用户 .t3/localization/zh-CN）\n  --help, -h           显示帮助\n\n请先退出 T3 Code，再执行 apply、restore 或 upgrade。\n获取最新补丁并更新：npx t3code-zh-cn@latest upgrade\n`;
const command = args[0] || 'status';
if (args.includes('--help') || args.includes('-h')) { console.log(help); process.exit(0); }
if (!['apply', 'restore', 'upgrade', 'status', 'check'].includes(command)) { console.error('未知命令：' + command + '\n\n' + help); process.exit(2); }
const options = new Map();
for (let i = 1; i < args.length; i++) {
  const name = args[i];
  if (!['--install-dir', '--data-dir'].includes(name)) { console.error('未知选项：' + name); process.exit(2); }
  if (options.has(name)) { console.error('选项重复：' + name); process.exit(2); }
  if (!args[i + 1] || args[i + 1].startsWith('-')) { console.error('选项缺少值：' + name); process.exit(2); }
  options.set(name, args[++i]);
}
const installDir = options.get('--install-dir');
const home = process.env.T3ZH_HOME || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultData = path.join(os.homedir(), '.t3', 'localization', 'zh-CN');
process.env.T3ZH_DATA_DIR = path.resolve(options.get('--data-dir') || process.env.T3ZH_DATA_DIR || defaultData);
process.env.T3ZH_CLI = '1';
if (installDir) process.env.T3ZH_INSTALL_DIR = path.resolve(installDir);
process.argv = [process.argv[0], path.join(home, 'patch.mjs'), command, ...(installDir ? [path.resolve(installDir)] : [])];
try {
  await import(pathToFileURL(path.join(home, 'patch.mjs')));
} catch (error) {
  console.error('操作停止：' + error.message);
  process.exitCode = 1;
}
