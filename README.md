# Paldeck

Paldeck 是一个面向 Palworld 独立服务器的开源部署方案与桌面管理客户端。
服务器通过 Docker Compose 运行，桌面端通过 SSH 执行经过白名单限制的管理操作。

> [!IMPORTANT]
> 项目仍处于早期开发阶段。首次初始化与基础 Compose 操作已经接入真实后端；
> 总览指标、玩家、备份和部分世界配置目前仍使用演示数据。

## 功能

- 使用 Docker Compose 部署 Palworld 独立服务器
- 通过 `.env` 配置常用服务器、网络、备份和世界参数
- 提供基于 Tauri 2、React 和 Rust 的跨平台桌面客户端
- 首次使用向导检查 Linux、amd64、Docker 与 Compose 环境
- 支持复用系统 OpenSSH 配置，或直接使用服务器账号密码
- 可接管有效的现有部署，或安全创建新的远程部署
- 对远程路径和 Compose 操作进行白名单验证
- 默认将部署文件保存到远程账号的 `~/.palworld`
- 默认仅将 Palworld REST API 绑定至服务器回环地址

## 项目结构

```text
.
├── .env.example                 # 可公开的服务器配置模板
├── compose.yaml                 # Palworld Docker Compose 服务
├── apps/
│   └── desktop/
│       ├── src/                 # React + TypeScript 前端
│       └── src-tauri/           # Tauri/Rust 桌面后端
├── .github/                     # CI、Issue 与依赖更新配置
└── package.json                 # npm workspace 入口
```

## 部署服务器

目标主机需要是 `x86_64/amd64` Linux，并已安装 Docker Engine 与 Docker
Compose 插件。

```bash
cp .env.example .env
```

编辑 `.env`，至少将 `ADMIN_PASSWORD` 改成强密码。部署前可检查最终配置：

```bash
docker compose config
```

确认无误后启动：

```bash
docker compose up -d
```

服务器存档、配置和备份默认保存在仓库目录下的 `palworld/`，该目录不会被
Git 跟踪。

## 桌面端开发

需要 Node.js 22+、npm、Rust stable，以及 Tauri 2 对应的系统依赖。

```bash
npm install
npm run dev
```

`npm run dev` 只启动浏览器 Preview，不会执行 SSH 或 Docker 命令。启动
Tauri 桌面窗口：

```bash
npm run tauri -- dev
```

只有 Tauri 桌面运行时会调用 Rust 后端，并尝试使用系统 `ssh`。

首次启动桌面端会进入初始化向导：

1. 选择 OpenSSH 配置/密钥或账号密码登录。
2. 账号密码模式首次连接时核对服务器 SHA256 主机密钥指纹。
3. 检查远程系统、架构、Docker 权限和 Compose 插件。
4. 接管已有有效部署，或在 `~/.palworld` 创建新部署。
5. 生成 `.env`、执行 `docker compose config`，并按需启动服务。

账号密码模式底层同样使用 SSH 协议。登录密码只保留在当前应用会话中，不会写入
浏览器存储或本地配置；服务器公开主机密钥和其他非敏感连接信息会持久化。

常用检查：

```bash
npm run check
npm run build
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
```

## 下载开发版

推送到 `develop` 分支后，GitHub Actions 会在 Windows、macOS 和 Linux
原生 Runner 上构建未签名的开发包。构建完成后，进入仓库的
**Actions → Development builds → 对应运行记录 → Artifacts** 下载：

- `Paldeck-windows-x64-development`：NSIS 安装包和绿色版预览 ZIP。
- `Paldeck-macos-arm64-development`：未签名的 Apple Silicon `.app` ZIP。
- `Paldeck-linux-x64-development`：AppImage 和 Debian 软件包。

开发产物保留 14 天，不会创建 GitHub Release。Windows 绿色版是 Tauri 裸
可执行文件的预览打包，目标机器仍需具备 Microsoft Edge WebView2 Runtime；
Tauri 不保证完整的 portable 模式。所有开发包均未进行代码签名，操作系统可能
显示来源或安全警告。

正式版本将在未来从 `master` 的版本标签单独发布，不使用开发分支产物。

## 安全边界

- 不要提交 `.env`、SSH 私钥、服务器地址、密码或真实存档。
- SSH Host、账号密码连接参数和远程路径会在 Rust 层验证。
- 账号密码模式会固定首次确认的服务器主机公钥，密钥变化时拒绝连接。
- Compose 与服务器操作使用固定白名单，不提供任意远程命令入口。
- SSH 使用批处理模式，并设置连接与操作超时。
- 初始化拒绝覆盖已有 `compose.yaml` 或 `.env`。
- `.env` 更新会先写入临时文件，验证 Compose 配置后再原子替换。
- 不建议将 Palworld REST API 直接暴露到公网。

安全问题请不要创建公开 Issue，参见 [SECURITY.md](SECURITY.md)。

## 参与贡献

欢迎提交缺陷报告、功能建议和 Pull Request。开始之前请阅读
[CONTRIBUTING.md](CONTRIBUTING.md) 和 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。

## 声明

Paldeck 是非官方社区项目，与 Pocketpair, Inc. 无隶属、认可或赞助关系。
Palworld 及相关名称和素材归其各自权利人所有。
应用图标使用了官方 PALWORLD 字标作为兼容对象标识，该字标不包含在本项目的
MIT 许可证中。详见 [TRADEMARKS.md](TRADEMARKS.md)。

## 许可证

项目以 [MIT License](LICENSE) 发布。
