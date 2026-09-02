# Paldeck

[English](README.md) | 简体中文

Paldeck 是一个面向 Palworld 独立服务器的开源部署方案与桌面管理客户端。
服务器通过 Docker Compose 运行，桌面端通过 SSH 执行经过白名单限制的管理操作。

> [!IMPORTANT]
> 项目处于早期开发阶段。桌面页面读取远程 Compose、Docker、Palworld REST API、
> 日志、备份和 `.env` 数据。当前不提供备份下载和玩家历史统计功能。

## 功能

- 使用 Docker Compose 部署 Palworld 独立服务器
- 通过 `.env` 配置常用服务器、网络、备份和世界参数
- 提供基于 Tauri 2、React 和 Rust 的跨平台桌面客户端
- 三平台统一使用更易读的字号；Windows 额外使用优化后的系统字体，并让主控制台和首次向导随宽屏或最大化窗口流式扩展（Beta）
- Windows OpenSSH 操作在后台运行，不闪现额外终端窗口（Beta）
- 保存多个服务器配置，并支持新增、切换、编辑或仅在本地删除（Beta）
- 桌面界面支持简体中文、English，或自动跟随系统语言
- 首次使用向导检查 Linux、amd64、Docker 与 Compose 环境
- 使用明确的 `用户名@Host` 复用系统 OpenSSH 配置和密钥，或直接使用账号密码登录
- 可继续使用 Paldeck 受管部署、显式导入兼容的现有部署（Beta），或安全创建新的远程部署
- 对远程路径和 Compose 操作进行白名单验证
- 默认将部署文件保存到远程账号的 `~/.palworld`
- 默认仅将 Palworld REST API 绑定至服务器回环地址
- 读取真实容器 CPU/内存、Palworld FPS、运行时间、世界天数和在线玩家
- 每 5 秒读取最近 200 条真实 Compose 日志，视图靠近底部时自动跟随新内容；配置自动备份计划和保留期限（Beta）；创建、验证、列出、
  删除及事务式恢复备份；并编辑当前固定容器版本支持的 79 项白名单世界配置
- 通过容器 REST 客户端广播消息，以及踢出或封禁在线玩家
- 手动保存世界时立即显示进度、保留 REST 失败结果，并根据远程存档文件时间确认
  成功请求是否真正落盘
- 停止或重启（Beta）前可自定义广播和倒计时，并验证世界保存；广播或保存失败时中止停服操作，
  停止后保留容器和 Compose 网络供下次启动
- 安全写入世界配置后，可选择立即重建容器应用，或留到稍后重启时应用

## 项目结构

```text
.
├── .env.example                 # 可公开的服务器配置模板
├── compose.yaml                 # Palworld Docker Compose 服务
├── apps/
│   └── desktop/
│       ├── src/                 # React 前端、平台检测和平台样式
│       └── src-tauri/           # Rust 后端和各平台 Tauri 配置
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

服务器存档、配置和备份保存在 `PALWORLD_DATA_DIR` 指定的部署内相对子目录中，
默认为 `./palworld`。该路径必须始终位于部署目录之下；默认目录不会被 Git 跟踪。

## 桌面端开发

需要 Node.js 22+、npm、Rust stable，以及 Tauri 2 对应的系统依赖。

Apple Silicon 桌面版本要求 macOS 11 或更高版本。

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

1. OpenSSH/密钥模式分别填写用户名和 Host，Paldeck 通过系统 SSH 客户端连接
   `用户名@Host`；加密私钥未由 `ssh-agent` 解锁时，可填写仅保存在内存中的私钥
   口令（Beta）；也可使用账号密码直接登录。
2. 账号密码模式首次连接时核对服务器 SHA256 主机密钥指纹。
3. 检查远程系统、架构、Docker 权限和 Compose 插件。
4. 继续使用已有的 Paldeck 受管部署、显式导入兼容的现有部署，或初始化不存在/
   完全为空的目录。
5. 导入时检查 Compose、唯一的 `palworld` 服务、固定的 v2.5.0 镜像、安全数据目录
   和 `/palworld` 数据卷映射。用户明确确认后，Paldeck 会先把原始
   `compose.yaml` 和 `.env` 备份到 `.paldeck-import-backup`，再写入管理标记；
   不会停止或重建现有容器。
6. 新建时选择安全的数据子目录、写入管理标记、生成 `.env`、验证 Compose 文件，
   并按需启动服务。

初始化向导、侧边栏和世界配置页面均提供语言选择器。语言偏好保存在本机；选择
“跟随系统”时，中文系统使用简体中文，其他系统语言使用 English。

账号密码模式底层同样使用 SSH 协议。登录密码和私钥口令只保留在当前应用会话中，
不会写入浏览器存储或本地配置；服务器公开主机密钥和其他非敏感连接信息会持久化。

侧边栏的服务器选择器可以管理多个已保存连接，旧版的单服务器配置会自动迁移。
删除服务器记录只会清除本机的非敏感连接信息，不会停止服务器，也不会删除远程
部署、存档或备份；删除最后一条记录后会返回初始化向导。多服务器配置管理、现有部署
导入、加密私钥口令、安全停止/重启、备份策略/删除/恢复，以及 Windows 宽窗口和后台
SSH 行为目前标记为 **Beta**，等待更多打包客户端和远程服务器验证。试用时请另外保留
原连接信息和一份独立存档备份。

常用检查：

```bash
npm run check
npm run build
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
```

## 下载开发版

推送到 `develop` 分支后，GitHub Actions 会在 Windows、macOS 和 Linux
原生 Runner 上构建开发包。构建完成后，进入仓库的
**Actions → Development builds → 对应运行记录 → Artifacts** 下载：

- `Paldeck-windows-x64-development`：NSIS 安装包和绿色版预览 ZIP。
- `Paldeck-macos-arm64-development`：使用 ad-hoc 签名的 Apple Silicon `.app` ZIP。
- `Paldeck-linux-x64-development`：AppImage 和 Debian 软件包。

开发产物保留 14 天，不会创建 GitHub Release。Windows 绿色版是 Tauri 裸
可执行文件的预览打包，目标机器仍需具备 Microsoft Edge WebView2 Runtime；
Tauri 不保证完整的 portable 模式。开发包均没有受信任的 Developer ID；macOS
包会在上传前完成 ad-hoc 签名和严格校验，但未经 Apple 公证，因此仍可能需要在
**系统设置 → 隐私与安全性**中手动允许。Windows 与 Linux 包未进行代码签名，
操作系统也可能显示来源或安全警告。

每个平台的开发包在上传前都必须通过启动存活测试。macOS 任务还会拒绝非系统
动态库，并在解压最终 ZIP 后再次验证签名。

## 发布正式版本

正式版本会从 `master` 的版本标签重新构建，不会把开发分支产物直接升级为正式
资产。推送匹配 `v*` 的标签后，只有满足以下条件才会继续发布工作流：

- 标签符合语义化版本，并指向 `master` 可达的提交
- 根项目、桌面端、Rust 和 Tauri 的版本号均与标签一致
- `CHANGELOG.md` 已包含该版本的小节
- 三个平台的原生构建和限时启动测试全部通过
- macOS 包通过签名和动态库边界检查

工作流会创建一个包含五个原生资产和 `SHA256SUMS.txt` 的 GitHub Release
**草稿**。应先检查草稿并下载验证产物，再手动公开发布。macOS 包仍使用 ad-hoc
签名且未经 Apple 公证；Windows 与 Linux 包仍未签名。

## 安全边界

- 不要提交 `.env`、SSH 私钥、服务器地址、密码、私钥口令或真实存档。
- SSH Host、账号密码连接参数和远程路径会在 Rust 层验证。
- 账号密码模式会固定首次确认的服务器主机公钥，密钥变化时拒绝连接。
- Compose 与服务器操作使用固定白名单，不提供任意远程命令入口。
- 未填写私钥口令时 SSH 使用批处理模式；加密私钥连接通过应用内置的 askpass
  入口提供口令、禁用远程密码认证，并设置连接与操作超时。
- 初始化验证成功后才写入 `.paldeck-managed` 管理标记，并记录所安装 Compose
  模板的 SHA-256 摘要。非空且没有标记的目录绝不会被自动初始化，只能通过显式的
  兼容性检查和确认流程导入。导入会保留无关文件，把原始 `compose.yaml` 和 `.env`
  复制到权限受限的 `.paldeck-import-backup`，确认备份期间源文件未发生变化后，才把
  现有 Compose 摘要写入管理标记。
- 远程路径拒绝目录穿越和非规范形式。自定义数据路径必须以 `./` 开头、位于部署
  目录内、只使用受限字符，并且不能经过符号链接。
- Compose 操作会显式指定受管目录、`.env` 和 `compose.yaml`；每次管理操作前
  都会核对已记录的 Compose 摘要和 `PALWORLD_DATA_DIR` 的最终路径边界。
- `.env` 更新会先写入临时文件，验证 Compose 配置后再原子替换。
- 保存世界配置时会通过可回滚事务升级未被修改过的旧版 Paldeck Compose 模板，
  验证成功后将旧模板保留为 `compose.yaml.paldeck.bak`。
- 保存配置不会静默中断服务器。Paldeck 会询问是立即重新创建容器，还是保留已经
  验证的 `.env` 改动并在稍后重启时应用。
- 从备份恢复前会检查归档路径和条目类型，然后停止服务。Paldeck 会先移开当前
  `Saved` 目录并创建一份保留的恢复前安全归档，再安装所选备份，最后恢复服务器
  原本的运行或停止状态。如果交换存档后的步骤失败，会放回原 `Saved` 并尝试重新
  启动原本正在运行的服务。
- 删除和恢复仅接受配置数据目录内、经过路径保护的普通
  `palworld-save-*.tar.gz` 文件。
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
