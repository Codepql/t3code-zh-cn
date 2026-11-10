# T3 Code 简体中文补丁

适配本机 T3 Code **0.1.8 / bf469bb19669**。第三方本地补丁，非官方语言包。无需联网、无需安装额外 npm 依赖。

## npm 命令行

显式运行命令，不会在安装 npm 包时自动修改应用：

```bash
npx t3code-zh-cn@latest status
npx t3code-zh-cn@latest check
npx t3code-zh-cn@latest apply
npx t3code-zh-cn@latest restore
npx t3code-zh-cn@latest upgrade
```

备份和 `state.json` 默认保存在用户目录 `~/.t3/localization/zh-CN`（Windows 为 `%USERPROFILE%\\.t3\\localization\\zh-CN`），不会写入 npx 临时目录。可用 `--install-dir` 指定 T3 Code 安装位置，用 `--data-dir` 指定持久数据目录。`upgrade` 只会在已有补丁记录和备份校验通过时恢复旧补丁，再应用当前包支持的构建；未知构建会停止。

## 使用

1. 将整个文件夹放到用户目录下的 `.t3/localization/zh-CN`（Windows 示例：`%USERPROFILE%\\.t3\\localization\\zh-CN`）。
2. 完全退出 T3 Code，包括托盘和正在使用的 `t3` 命令行进程。
3. 双击 `汉化.cmd`。成功后，从原来的快捷方式正常启动应用。
4. 恢复时同样先退出应用，再双击 `恢复英文.cmd`。
5. `检查状态.cmd` 可查看当前是否已应用补丁。
6. 已安装旧版补丁时，完全退出应用后双击 `更新汉化.cmd`，它会先恢复原件再应用新版词典和翻译规则。失败时会停止。

脚本使用 T3 Code 自带的 Node 运行时，不要求另外安装 Node。自定义安装位置可在 PowerShell 中运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\run.ps1 apply -InstallDir 'D:\Apps\t3code'
```

只读兼容性检查：将 `apply` 改为 `check`。恢复时改为 `restore`。

## 平台支持

- **Windows**：已在 T3 Code 0.1.8 / `bf469bb19669` 实机验证。默认探测 `%LOCALAPPDATA%\Programs\t3code`，也支持自定义安装目录。
- **macOS**：支持探测 `/Applications/T3 Code.app/Contents` 和用户 Applications 目录，资源位于 `Contents/Resources/server.asar`。本项目未在 macOS 实机验证；修改应用包可能触发代码签名或 Gatekeeper 校验，使用前应在副本上测试并准备重新签名。
- **Linux**：支持探测 `~/.local/share/t3code`、`/opt/t3code` 和 `/usr/lib/t3code`，资源位于 `resources/server.asar`。本项目未在 Linux 实机验证，发行版安装器的实际路径可能不同，可通过环境变量 `T3ZH_INSTALL_DIR` 或命令行参数指定。

Unix 系统可运行 `sh ./run.sh apply [/安装目录]`；Windows 继续使用 `run.ps1` 或中文 `.cmd` 入口。脚本只会检测并提示正在运行的 T3 Code，不会强制结束进程。
