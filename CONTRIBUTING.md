# 贡献指南

感谢你愿意帮助改进 Paldeck。

## 开始之前

- 对缺陷和功能建议，优先使用对应的 GitHub Issue 模板。
- 较大的功能或架构调整，请先创建 Issue 讨论范围。
- 安全漏洞不要公开披露，请遵循 [SECURITY.md](SECURITY.md)。
- 参与项目即表示同意遵守 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。

## 本地开发

需要 Node.js 22+、npm、Rust stable，以及 Tauri 2 对应的系统依赖。

```bash
npm ci
npm run check
npm run build
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
```

浏览器 Preview 使用演示数据，不会连接远程服务器：

```bash
npm run dev
```

## Pull Request

- 从 `master` 创建一个用途明确的分支。
- 每个 Pull Request 尽量只解决一个问题。
- 不要提交 `.env`、凭据、服务器信息、存档或构建产物。
- 为行为变更补充测试或写明人工验证方法。
- 保持 TypeScript 检查、前端构建和 Rust 测试通过。
- 更新用户可见行为时，同步更新 README 或 CHANGELOG。

提交信息建议使用简短的祈使句，例如：

```text
Add backup retention settings
Fix SSH host validation
```

提交 Pull Request 即表示你同意按照本项目的 MIT License 授权你的贡献。
