# Paldeck

Paldeck 是一个面向 Palworld 独立服务器的开源部署方案与桌面管理客户端。
服务器通过 Docker Compose 运行，桌面端通过 SSH 执行经过白名单限制的管理操作。

> [!IMPORTANT]
> 项目仍处于早期开发阶段。Docker Compose 配置可用于部署；桌面端当前包含
> Preview 界面和第一阶段 SSH 后端，部分管理页面仍使用演示数据。

## 功能

- 使用 Docker Compose 部署 Palworld 独立服务器
- 通过 `.env` 配置常用服务器、网络、备份和世界参数
- 提供基于 Tauri 2、React 和 Rust 的跨平台桌面客户端
- 通过系统 SSH 配置连接远程服务器
- 对远程路径和 Compose 操作进行白名单验证
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

常用检查：

```bash
npm run check
npm run build
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
```

## 安全边界

- 不要提交 `.env`、SSH 私钥、服务器地址、密码或真实存档。
- SSH Host 和远程路径会在 Rust 层验证。
- Compose 与服务器操作使用固定白名单，不提供任意远程命令入口。
- SSH 使用批处理模式，并设置连接与操作超时。
- `.env` 更新会先写入临时文件，验证 Compose 配置后再原子替换。
- 不建议将 Palworld REST API 直接暴露到公网。

安全问题请不要创建公开 Issue，参见 [SECURITY.md](SECURITY.md)。

## 参与贡献

欢迎提交缺陷报告、功能建议和 Pull Request。开始之前请阅读
[CONTRIBUTING.md](CONTRIBUTING.md) 和 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。

## 声明

Paldeck 是非官方社区项目，与 Pocketpair, Inc. 无隶属、认可或赞助关系。
Palworld 及相关名称和素材归其各自权利人所有。

## 许可证

项目以 [MIT License](LICENSE) 发布。
