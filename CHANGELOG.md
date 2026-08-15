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
- 从 `master` 语义化版本标签构建三平台资产、生成校验和并创建 GitHub Release
  草稿的正式发布工作流。
- 支持跟随系统、简体中文和 English 的桌面界面，并在本地保存语言偏好。
- 总览、在线玩家、日志、备份列表和世界配置页面接入真实远程数据与操作。

### Fixed

- 修复前后端 OpenSSH 参数命名不一致导致的连接参数解析失败；OpenSSH 模式现在
  分别要求用户名和 Host，并明确以 `用户名@Host` 调用系统 SSH 客户端。
- 修复容器镜像标签缺少 `v` 导致无法拉取的问题，并默认在初始化后启动服务器。
- Compose 控制现在显示执行中状态、阻止重复操作、反馈结果并刷新真实容器状态。
- 删除玩家、性能、日志和备份演示数据；无法获取的值明确显示为不可用。
- Windows 发布版不再额外显示控制台窗口。
- 桌面界面可随 Windows、macOS 和 Linux 窗口宽度响应式调整。
- 使用管理标记区分 Paldeck 部署，拒绝修改非空的未受管同名目录。
- 收紧远程路径、符号链接、临时文件及 Compose 数据目录边界。
- 支持在部署目录内自定义 Palworld 数据子目录，并在每次管理操作前检查路径和
  Compose 模板摘要。
- macOS 开发包现在使用完整的 ad-hoc 签名，并在上传前执行严格签名校验，避免
  GitHub 下载产物因不完整签名被报告为已损坏。
- Unix 桌面构建静态编译 OpenSSL，避免产物依赖构建机上的 Homebrew 或系统
  OpenSSL 路径。
- 为旧版 WebKit 提供 UUID 回退，并在本地存储不可用时保持语言选择功能可启动。
- 三平台开发包增加自动关闭的启动存活测试；macOS 额外检查动态库边界与压缩包
  解压后的签名。
