import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function candidates() {
  const home = os.homedir();
  if (process.platform === 'win32') return [
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 't3code'),
    process.env.USERPROFILE && path.join(process.env.USERPROFILE, 'AppData', 'Local', 'Programs', 't3code')
  ].filter(Boolean);
  if (process.platform === 'darwin') return [
    '/Applications/T3 Code.app/Contents',
    path.join(home, 'Applications/T3 Code.app/Contents')
  ];
  return [
    path.join(home, '.local', 'share', 't3code'),
    '/opt/t3code',
    '/usr/lib/t3code'
  ];
}

export function resourcesDir(installDir) {
  return process.platform === 'darwin' ? path.join(installDir, 'Resources') : path.join(installDir, 'resources');
}

export function detectInstallDir(explicit) {
  const values = explicit ? [explicit] : [process.env.T3ZH_INSTALL_DIR, ...candidates()];
  const found = values.filter(Boolean).map(value => path.resolve(value)).find(dir => fs.existsSync(path.join(resourcesDir(dir), 'server.asar')));
  return found || (explicit ? path.resolve(explicit) : null);
}

export function appExecutable(installDir) {
  if (process.platform === 'win32') return path.join(installDir, 'T3 Code (Beta).exe');
  if (process.platform === 'darwin') return path.join(installDir, 'MacOS', 'T3 Code');
  return path.join(installDir, 't3code');
}

export function ensureClosed(installDir) {
  if (process.platform === 'win32') {
    const script = 'Get-Process | Where-Object { $_.Path -and $_.Path -eq $env:T3ZH_APP_EXE -and $_.Id -ne [int]$env:T3ZH_PATCH_PID } | Select-Object -ExpandProperty Id';
    const ids = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      encoding: 'utf8', windowsHide: true,
      env: { ...process.env, T3ZH_APP_EXE: appExecutable(installDir), T3ZH_PATCH_PID: String(process.pid) }
    }).trim();
    if (ids) throw Error('请先完全退出 T3 Code（包括托盘和 t3 CLI），再运行此脚本。不会自动结束你的进程。');
    return;
  }
  const marker = appExecutable(installDir);
  const rows = execFileSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8' }).split(/\r?\n/);
  const running = rows.some(row => {
    const match = row.trim().match(/^(\d+)\s+(.*)$/);
    return match && Number(match[1]) !== process.pid && match[2].includes(marker);
  });
  if (running) throw Error('请先完全退出 T3 Code，再运行此脚本。不会自动结束你的进程。');
}

export function signatureWarning() {
  if (process.platform === 'darwin') return 'macOS 应用包被修改后可能触发代码签名或 Gatekeeper 校验；请在测试副本中操作，并准备重新签名。';
  return null;
}
