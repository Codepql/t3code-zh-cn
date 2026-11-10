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

## 范围与备份

- 词典包含 4367 条中文翻译，当前构建修改 108 个前端文件、6046 处显示文本或显示逻辑位置。另外为 74 个已知快捷键命令提供中文名称，命令 ID 与按键配置不变。覆盖审计仍保留少量品牌、协议、路径、代码示例和单位等原文，不将它们误算为漏译。
- 解析 JavaScript 语法树，只修改指定显示属性及其显示分支中的已知词条；不通过页面 DOM 改写聊天。
- 不读取或修改用户聊天数据库、配置、密钥、项目文件。聊天正文、代码和终端内容不经过翻译处理。
- 已扩展到动态模板、30 处经核对的显示选项表，以及设置、聊天、项目、Git、模型接入、语音、截图、连接、用量、主题和诊断等区域。
- 动态模板保留原始表达式及求值顺序；无法确认用途的字符串不做替换。未收录的动态文案、后端直接返回的错误、系统原生菜单及部分第三方组件仍可能显示英文。
- 品牌、模型标识、编程语言名、命令、路径和协议字段有意保留原文。不能把这些英文算作漏译，也不以替换数量宣称 100% 汉化。
- 仅修改 `resources\server.asar` 的已识别前端文本。其他封装资源逐项比对，保持字节内容一致。
- 原件保存在本目录 `backups\<原始SHA256>.server.asar`，恢复信息在 `state.json`。请保留这些文件。
- 修改前验证应用版本、构建标识和原始资源 SHA256；重建后重新解析脚本并校验所有资源内容。
- 运行中的应用不会被脚本强制关闭；脚本会停止并提示先退出。
- 如果资源已更新或被其他工具修改，安装和恢复都会停止，避免用旧资源覆盖新版本。
- 更新应用前建议先恢复英文。更新后需要适配新版补丁；此版本不会自行联网更新。

## 修改词典

`zh-CN.json` 是实际使用的词典。编辑词典前先恢复英文，再编辑并重新运行汉化。`zh-CN.tsv` 与 `zh-CN-extra.tsv` 是便于查看和维护的源稿，运行时不读取它们。动态词条中的 `${0}`、`${1}` 等占位符必须完整保留，且顺序不变。

## 文件说明

- `patch.mjs`：版本检查、备份、安装、恢复。
- `lib.mjs`：ASAR 读写、语法树定位和翻译。
- `compatibility.json`：已核验构建及文件哈希。
- `literal-overrides.json`：按具体构建逐项核对的显示常量，覆盖设置选项表和输入框提示。
- `display-maps.json`：按语法位置及原始键值校验的显示选项表，不修改内部键或键盘按键编码表。
- `formatter-labels.json`：已知内置快捷键命令的显示名称；自定义脚本命令沿用原显示逻辑。
- `context-translations.json`：处理“条件 / 时间”等因页面语境不同而需要区别的译法。
- `vendor/babel-parser.cjs`：离线 JavaScript 解析器，许可见同目录 `BABEL-LICENSE.txt`。

安装目录必须有写入权限。若执行被安全软件阻止，先检查具体提示，不要删除备份或手动覆盖新版资源。
