# 更新记录

## 未发布

- 增加 Windows PowerShell 和 macOS Shell 在线入口，无 npm 时优先使用应用自带运行时。
- 统一在线入口与 npm 入口的默认备份目录。
- 将 npm 命令统一为小写 `t3code-zh-cn`，补充参数校验和操作提示。
- 允许使用安装记录恢复旧构建的备份，同时保留资源和备份哈希校验。
- 增加命令行生命周期测试与发布前检查，重写面向两种安装方式的 README。

## 0.0.1

- 增加 `apply`、`restore`、`upgrade`、`status` 和 `check` 命令。
- 将备份和状态数据移到用户 `.t3/localization/zh-CN` 目录。
- 增加 Windows、macOS 和 Linux 安装位置探测。
- 补充界面词典和动态文案翻译。
- 增加 npm 打包清单、许可证和第三方声明。

当前版本适配 T3 Code 0.1.8 / `bf469bb19669`。
