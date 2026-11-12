# T3 Code 简体中文补丁

给已安装的 T3 Code 桌面端一键汉化、一键恢复英文、一键更新汉化。自动探测安装目录，修改前备份原始资源，不修改聊天记录。

**不限定 T3 Code 版本。** 工具会直接扫描当前安装的界面资源：词典里有的文字翻译成中文，新版本新增或无法识别的文字保留英文，不会因为版本号变化而拒绝汉化。已在 0.1.8、0.1.9（Windows）上验证。

> 以下在线命令需维护者先将本仓库脚本推送到 GitHub `main`；npm 方式还需发布 `t3code-zh-cn`。本地验证方法见文末。

先安装 T3 Code。汉化、恢复、更新前，保存工作并完全退出 T3 Code，包括托盘和 `t3` 命令行进程。

## 方式一：npm / npx（推荐）

需要 Node.js 18+ 和 npm。推荐直接使用 npx，无需下载仓库、无需全局安装。Windows PowerShell 和 macOS 终端使用相同命令。

```sh
# 一键汉化：自动备份原始资源
npx t3code-zh-cn@latest apply

# 一键恢复英文
npx t3code-zh-cn@latest restore

# 一键更新：获取最新 npm 包，再重新应用汉化
npx t3code-zh-cn@latest upgrade
```

也可以全局安装，获得固定命令：

```sh
npm install -g t3code-zh-cn

t3code-zh-cn apply
t3code-zh-cn restore
t3code-zh-cn status
```

全局安装后，更新工具并更新汉化：

```sh
npm install -g t3code-zh-cn@latest
t3code-zh-cn upgrade
```

`upgrade` 使用当前工具内的词典，不会自行下载 npm 新版本，所以更新时应使用 `npx ...@latest upgrade`，或先更新全局安装。安装 npm 包本身不会修改应用。

### 命令与选项

| 命令 | 作用 |
| --- | --- |
| `apply` | 备份原资源并应用中文补丁；相同补丁无需重复安装 |
| `restore` | 校验备份并恢复原始英文资源 |
| `upgrade` | 已汉化时先恢复，再应用当前工具中的补丁；未汉化时尝试安装 |
| `check` | 只读扫描当前版本，显示可翻译的文件和替换数量，不修改应用 |
| `status` | 查看当前状态和备份目录；不指定命令时的默认动作 |
| `--help` | 显示帮助 |


## 方式二：直接执行脚本，无需安装 npm

脚本优先使用应用自带的 Node 运行时，无需单独安装 Node.js。

### Windows：在 PowerShell 中执行

一键汉化：

```powershell
& ([scriptblock]::Create((irm 'https://raw.githubusercontent.com/Codepql/t3code-zh-cn/main/install.ps1'))) -Mode apply
```

一键恢复英文：

```powershell
& ([scriptblock]::Create((irm 'https://raw.githubusercontent.com/Codepql/t3code-zh-cn/main/install.ps1'))) -Mode restore
```

一键更新汉化（下载最新脚本和词典后重新应用）：

```powershell
& ([scriptblock]::Create((irm 'https://raw.githubusercontent.com/Codepql/t3code-zh-cn/main/install.ps1'))) -Mode upgrade
```

将 `-Mode` 改为 `check` 可只读检查翻译结果，改为 `status` 可查看当前状态。命令需要联网下载本仓库文件；执行过程中不会自动结束应用进程。

默认探测 `%LOCALAPPDATA%\Programs\t3code`。自定义安装位置时，在命令末尾加上 `-InstallDir 'D:\Apps\t3code'`：

```powershell
& ([scriptblock]::Create((irm 'https://raw.githubusercontent.com/Codepql/t3code-zh-cn/main/install.ps1'))) -Mode apply -InstallDir 'D:\Apps\t3code'
```

### macOS：在终端中执行

默认探测 `/Applications/T3 Code.app/Contents` 和 `~/Applications/T3 Code.app/Contents`。

```sh
# 一键汉化
curl -fsSL https://raw.githubusercontent.com/Codepql/t3code-zh-cn/main/install.sh | sh -s -- apply

# 一键恢复英文
curl -fsSL https://raw.githubusercontent.com/Codepql/t3code-zh-cn/main/install.sh | sh -s -- restore

# 一键更新汉化
curl -fsSL https://raw.githubusercontent.com/Codepql/t3code-zh-cn/main/install.sh | sh -s -- upgrade
```

自定义安装位置时，在动作后加上 `.app` 内的 `Contents` 目录：

```sh
curl -fsSL https://raw.githubusercontent.com/Codepql/t3code-zh-cn/main/install.sh | sh -s -- check '/Applications/T3 Code.app/Contents'
```

macOS 入口尝试使用应用内的 `Contents/MacOS/T3 Code` 运行时；找不到时回退到系统 Node.js 18+。修改应用包可能触发代码签名或 Gatekeeper 校验，当前应先在副本上测试并准备重新签名。注意：macOS 版从 0.1.9 起不再包含 `server.asar`，暂不支持汉化。

## 成功后怎么使用

看到 `中文补丁已安装。` 后，从原来的快捷方式或应用图标正常启动 T3 Code，无需另找语言切换开关。恢复成功会提示 `已恢复原始英文资源`。

只读检查成功会提示 `扫描完成` 和 `只读检查完成`；检查不会安装补丁。当前词典不保证覆盖所有文案，新版本新增的界面文字在词典更新前显示英文，反馈遗漏时请提供应用版本、原始英文、所在界面和截图。

## 备份与更新说明

上面的**在线脚本和 npm 两种方式使用同一个默认备份目录**，可以交替使用：

- Windows：`%USERPROFILE%\.t3\localization\zh-CN`
- macOS：`~/.t3/localization/zh-CN`

其中 `backups/` 保存原始资源，`state.json` 记录补丁状态。不要删除、替换或从其他机器复制这两项。更新工具、清理 npx 缓存或清理脚本临时下载文件不会删除该目录。

PowerShell 在线脚本可通过 `-DataDir` 自定义此目录；npm 入口使用 `--data-dir`。所有入口也支持环境变量 `T3ZH_DATA_DIR`。不同命令必须使用同一个数据目录才能找到原安装记录。

**更新汉化和更新 T3 Code 是两回事。** T3 Code 自动更新后，新版本会覆盖中文补丁、恢复为英文；此时直接运行 `apply`（或 `npx t3code-zh-cn@latest upgrade` 获取最新词典）重新汉化即可，无需先恢复。`upgrade` 不会升级桌面应用。恢复时如果发现资源已被应用更新器或其他工具改动，会停止，避免旧备份覆盖新版应用。

## 常见问题

| 提示 | 处理方法 |
| --- | --- |
| 未找到安装目录 / 资源 | 确认已安装桌面端，使用上面的自定义安装路径参数。 |
| 部分文字仍是英文 | 新版本新增的文字尚未收录，属正常现象；可反馈遗漏或等待词典更新后运行 `upgrade`。 |
| 资源已含有中文补丁，但没有匹配的安装记录 | 数据目录不一致或记录丢失；为避免把已汉化文件当作原始备份，请重新安装 T3 Code 后再汉化。 |
| 请先完全退出 T3 Code | 保存工作，退出窗口、托盘及 `t3` CLI 后重试。 |
| 词典或翻译规则已更改 | 使用 `upgrade`，或先 `restore` 再 `apply`。 |
| 没有安装记录 | 检查数据目录是否一致，是否删除或移动了 `state.json` 和 `backups/`。 |
| 资源已更新或被修改，未执行恢复 | 不要用旧备份手工覆盖当前应用，先确认安装版本和当前资源来源。 |
| 找不到可用运行时 / node.exe | 检查应用安装位置和运行时路径，或安装 Node.js 18+ 后使用 npm 方式。 |
| npx 提示 npm 包不存在 | 确认维护者已发布包；未发布前可使用本地入口。 |

## 开发与发布

本地验证 npm 入口，无需先发布包：

```sh
npm run check
npm test
npm run pack:check
node ./bin/t3code-zh-CN.mjs --help
node ./bin/t3code-zh-CN.mjs check
```

验证全局安装的命令：

```sh
npm install -g .
t3code-zh-cn --help
```

本地脚本入口为 Windows 的 `run.ps1` 和 macOS 的 `run.sh`。例如：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\run.ps1 check
```

```sh
sh ./run.sh check
```

直接运行本地脚本或中文 `.cmd` 时，数据目录默认是补丁文件夹；如需与在线脚本/npm 共用备份，请设置 `T3ZH_DATA_DIR` 指向用户目录中的 `.t3/localization/zh-CN`。中文 `.cmd` 入口仍保留给下载整个仓库的 Windows 用户。

发布前在真实桌面应用上验证汉化、重启、恢复和更新，并确认 npm 打包清单不含个人数据、备份或应用安装包。将脚本推送到 GitHub `main` 后在线入口才可用；登录有发布权限的 npm 账号后执行：

```sh
npm publish --access public
```

仓库中的 GitHub Actions 发布工作流需要一个名为 `NPM_TOKEN` 的 Actions secret。请在 npm 创建具有该包发布权限的 granular access token（如果账号启用了双因素认证，确保 token 允许发布），然后在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 中保存为 `NPM_TOKEN`。工作流会将它作为 `NODE_AUTH_TOKEN` 传给 `npm publish`；不要把 token 写入仓库文件。首次发布完成后，也可以在 npm 包设置中配置 GitHub Actions trusted publisher，随后移除该 secret 并改用 OIDC 发布。

维护词典：编辑 `zh-CN.tsv` 或 `zh-CN-extra.tsv` 后运行 `node tools/build-dict.mjs` 生成 `zh-CN.json`。T3 Code 发布新版本后，可运行 `node tools/build-dict.mjs <server.asar> --untranslated 未翻译.txt` 查看新版本的覆盖情况和尚未翻译的文字（只读，不修改该文件）。

`prepublishOnly` 会自动运行代码语法检查和测试。后续发布必须先提升 `package.json` 中的版本号；真实 Windows/macOS 应用验证不能由单元测试替代。
