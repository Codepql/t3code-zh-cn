#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const help = `T3 Code 简体中文补丁\n\n用法：t3code-zh-CN <命令> [选项]\n\n命令：\n  apply      安装中文补丁\n  restore    恢复原始英文资源\n  upgrade    恢复旧补丁后重新应用当前补丁\n  status     查看当前资源和安装状态\n  check      只读检查兼容性，不修改文件\n\n选项：\n  --install-dir <目录>  指定 T3 Code 安装目录\n  --data-dir <目录>     指定备份和状态目录（默认用户 .t3/localization/zh-CN）\n  --help                 显示帮助\n`;
const command = args[0] || 'status';
if (args.includes('--help') || args.includes('-h')) { console.log(help); process.exit(0); }
if (!['apply', 'restore', 'upgrade', 'status', 'check'].includes(command)) { console.error('未知命令：' + command + '\n\n' + help); process.exit(2); }
function option(name) {
  const i = args.indexOf(name);
  if (i < 0) return null;
  if (!args[i + 1] || args[i + 1].startsWith('-')) { console.error('选项缺少值：' + name); process.exit(2); }
  return args[i + 1];
}
const installDir = option('--install-dir');
const home = process.env.T3ZH_HOME || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultData = path.join(os.homedir(), '.t3', 'localization', 'zh-CN');
process.env.T3ZH_DATA_DIR = path.resolve(option('--data-dir') || defaultData);
if (installDir) process.env.T3ZH_INSTALL_DIR = path.resolve(installDir);
process.argv = [process.argv[0], path.join(home, 'patch.mjs'), command, ...(installDir ? [path.resolve(installDir)] : [])];
await import(pathToFileURL(path.join(home, 'patch.mjs')));
