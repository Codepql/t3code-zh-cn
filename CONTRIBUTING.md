# 贡献说明

提交词典或翻译规则时，请说明发现该文字的 T3 Code 版本，并保留原始词条、使用位置和语境。翻译规则按资源文件的稳定名称（去掉末尾哈希，例如 `SettingsPanels`）登记。

提交前运行：

```bash
npm run check
npm test
npm run pack:check
```

不要提交应用安装包、ASAR 文件、用户数据、备份、状态文件或个人路径。
