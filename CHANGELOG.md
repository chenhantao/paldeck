# Changelog

本项目的重要变更将记录在此文件中。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循
[Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added

- Palworld Docker Compose 部署配置与环境变量模板。
- Paldeck Tauri 桌面客户端 Preview。
- 带输入验证、超时和操作白名单的 SSH 后端基础能力。
- 带接管/新建流程的首次使用初始化向导。
- OpenSSH 配置/密钥和直接账号密码两种登录方式。
- 账号密码模式的 SSH 主机密钥指纹确认与固定。
- 默认使用远程账号的 `~/.palworld` 作为部署目录。
- 对 Linux、amd64、Docker、Compose 和现有部署有效性的远程检查。
- 开源项目治理文件和持续集成配置。

### Fixed

- Windows 发布版不再额外显示控制台窗口。
- 桌面界面可随 Windows、macOS 和 Linux 窗口宽度响应式调整。
- 使用管理标记区分 Paldeck 部署，拒绝修改非空的未受管同名目录。
- 收紧远程路径、符号链接、临时文件及 Compose 数据目录边界。
- 支持在部署目录内自定义 Palworld 数据子目录，并在每次管理操作前检查路径和
  Compose 模板摘要。
