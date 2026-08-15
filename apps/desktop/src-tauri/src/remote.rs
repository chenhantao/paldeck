use std::io::Read;
use std::net::{TcpStream, ToSocketAddrs};
use std::process::Stdio;
use std::time::Duration;

use base64::prelude::{Engine as _, BASE64_STANDARD, BASE64_STANDARD_NO_PAD};
use sha2::{Digest, Sha256};
use ssh2::Session;
use tokio::process::Command;
use tokio::time::timeout;

use crate::models::{Authentication, CommandResult, ConnectionProbe, ServerProfile};

const SSH_TIMEOUT: Duration = Duration::from_secs(30);
const CONNECT_TIMEOUT: Duration = Duration::from_secs(8);
pub const MANAGED_MARKER_FILE: &str = ".paldeck-managed";
pub const MANAGED_MARKER_CONTENT: &str = "PALDECK_MANAGED_DIRECTORY_V1";
const COMPOSE_TEMPLATE: &str = include_str!("../../../../compose.yaml");

pub fn validate_profile(profile: &ServerProfile) -> Result<(), String> {
    validate_authentication(&profile.auth)?;
    validate_remote_path(&profile.remote_path)
}

fn validate_authentication(authentication: &Authentication) -> Result<(), String> {
    match authentication {
        Authentication::OpenSsh { host, username } => {
            validate_ssh_host(host)?;
            validate_ssh_username(username)
        }
        Authentication::Password {
            host,
            port,
            username,
            password,
            ..
        } => {
            validate_direct_host(host)?;
            if *port == 0 {
                return Err("SSH 端口必须在 1 到 65535 之间".into());
            }
            validate_ssh_username(username)?;
            if password.len() > 4_096 || password.contains('\0') {
                return Err("SSH 密码无效".into());
            }
            Ok(())
        }
    }
}

fn validate_ssh_username(username: &str) -> Result<(), String> {
    let trimmed = username.trim();
    if trimmed.is_empty()
        || trimmed != username
        || trimmed.len() > 255
        || !trimmed
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || "._-".contains(character))
    {
        return Err("SSH 用户名无效".into());
    }
    Ok(())
}

fn validate_ssh_host(host: &str) -> Result<(), String> {
    let trimmed = host.trim();
    if trimmed.is_empty() || trimmed != host || trimmed.len() > 255 {
        return Err("SSH Host 长度无效".into());
    }

    let first = trimmed
        .chars()
        .next()
        .ok_or_else(|| "SSH Host 不能为空".to_string())?;
    if !first.is_ascii_alphanumeric() {
        return Err("SSH Host 必须以字母或数字开头".into());
    }

    if !trimmed
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || ".-_".contains(character))
    {
        return Err("SSH Host 只能包含字母、数字、点、横线和下划线".into());
    }

    Ok(())
}

fn validate_direct_host(host: &str) -> Result<(), String> {
    let trimmed = host.trim();
    if trimmed.is_empty()
        || trimmed.len() > 255
        || trimmed
            .chars()
            .any(|character| character.is_control() || character.is_whitespace())
    {
        return Err("服务器地址无效".into());
    }
    Ok(())
}

fn validate_remote_path(path: &str) -> Result<(), String> {
    let is_home_relative = path.starts_with("~/") && path.len() > 2;
    let is_safe_absolute = path.starts_with('/') && path != "/";
    if !is_home_relative && !is_safe_absolute {
        return Err("远程目录必须是 ~/ 下的目录或非根绝对路径".into());
    }
    if path.len() > 4096 || path.contains(['\0', '\n', '\r']) {
        return Err("远程目录包含无效字符".into());
    }
    if path.ends_with('/') || path.contains('\\') {
        return Err("远程目录必须使用规范的 Linux 路径".into());
    }

    let relative = path.strip_prefix("~/").unwrap_or_else(|| &path[1..]);
    if relative
        .split('/')
        .any(|segment| segment.is_empty() || segment == "." || segment == "..")
    {
        return Err("远程目录不能包含空段、. 或 ..".into());
    }
    Ok(())
}

pub fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\"'\"'"))
}

pub fn remote_directory_assignment(path: &str) -> Result<String, String> {
    validate_remote_path(path)?;
    if let Some(relative) = path.strip_prefix("~/") {
        Ok(format!(
            "paldeck_home=\"$(realpath -e -- \"$HOME\")\"; paldeck_dir=\"$paldeck_home\"/{}",
            shell_quote(relative)
        ))
    } else {
        Ok(format!("paldeck_dir={}", shell_quote(path)))
    }
}

pub fn compose_template_hash() -> String {
    format!("{:x}", Sha256::digest(COMPOSE_TEMPLATE.as_bytes()))
}

pub fn data_directory_check(env_file: &str) -> String {
    format!(
        "paldeck_data_safe=0; paldeck_data_relative=''; paldeck_env_file={env_file}; \
         paldeck_data_count=\"$(grep -c '^PALWORLD_DATA_DIR=' \"$paldeck_env_file\" 2>/dev/null || true)\"; \
         if [ \"$paldeck_data_count\" = 1 ]; then \
           paldeck_data_value=\"$(sed -n 's/^PALWORLD_DATA_DIR=//p' \"$paldeck_env_file\")\"; \
           case \"$paldeck_data_value\" in \
             ./*) paldeck_data_relative=\"${{paldeck_data_value#./}}\" ;; \
             *) paldeck_data_relative='' ;; \
           esac; \
           case \"$paldeck_data_value\" in \
             */|*[!A-Za-z0-9._/-]*) paldeck_data_relative='' ;; \
           esac; \
           case \"/$paldeck_data_relative/\" in \
             *//*|*/./*|*/../*) paldeck_data_relative='' ;; \
           esac; \
           if [ -n \"$paldeck_data_relative\" ]; then \
             paldeck_data_path=\"$paldeck_dir/$paldeck_data_relative\"; \
             paldeck_data_resolved=\"$(realpath -m -- \"$paldeck_data_path\" 2>/dev/null || true)\"; \
             if [ \"$paldeck_data_resolved\" = \"$paldeck_data_path\" ]; then \
               if [ ! -e \"$paldeck_data_path\" ]; then paldeck_data_safe=1; \
               elif [ -d \"$paldeck_data_path\" ] && [ ! -L \"$paldeck_data_path\" ]; then paldeck_data_safe=1; fi; \
             fi; \
           fi; \
         fi"
    )
}

pub fn data_directory_guard(env_file: &str) -> String {
    format!(
        "{}; if [ \"$paldeck_data_safe\" != 1 ]; then \
           printf 'PALWORLD_DATA_DIR 必须是部署目录内的安全相对子目录，且不能经过符号链接。\\n' >&2; exit 74; \
         fi",
        data_directory_check(env_file)
    )
}

pub async fn probe_connection(profile: ServerProfile) -> Result<ConnectionProbe, String> {
    validate_profile(&profile)?;
    match &profile.auth {
        Authentication::OpenSsh { .. } => {
            let result = run_openssh(&profile, "printf 'paldeck-ok'", SSH_TIMEOUT).await?;
            Ok(ConnectionProbe {
                success: result.success,
                requires_trust: false,
                fingerprint: None,
                host_key: None,
                message: if result.success {
                    "SSH 连接成功".into()
                } else {
                    result.stderr
                },
            })
        }
        Authentication::Password { .. } => {
            let authentication = profile.auth.clone();
            timeout(
                SSH_TIMEOUT,
                tokio::task::spawn_blocking(move || probe_password(&authentication)),
            )
            .await
            .map_err(|_| "SSH 操作超时（30 秒）".to_string())?
            .map_err(|error| format!("SSH 后台任务失败：{error}"))?
        }
    }
}

pub async fn run_remote(
    profile: &ServerProfile,
    remote_command: &str,
) -> Result<CommandResult, String> {
    run_remote_with_timeout(profile, remote_command, SSH_TIMEOUT).await
}

pub async fn run_remote_with_timeout(
    profile: &ServerProfile,
    remote_command: &str,
    operation_timeout: Duration,
) -> Result<CommandResult, String> {
    validate_profile(profile)?;
    match &profile.auth {
        Authentication::OpenSsh { .. } => {
            run_openssh(profile, remote_command, operation_timeout).await
        }
        Authentication::Password { .. } => {
            let authentication = profile.auth.clone();
            let command = remote_command.to_string();
            timeout(
                operation_timeout,
                tokio::task::spawn_blocking(move || {
                    run_password_command(&authentication, &command, operation_timeout)
                }),
            )
            .await
            .map_err(|_| format!("SSH 操作超时（{} 秒）", operation_timeout.as_secs()))?
            .map_err(|error| format!("SSH 后台任务失败：{error}"))?
        }
    }
}

async fn run_openssh(
    profile: &ServerProfile,
    remote_command: &str,
    operation_timeout: Duration,
) -> Result<CommandResult, String> {
    let Authentication::OpenSsh { host, username } = &profile.auth else {
        return Err("登录方式不是 OpenSSH".into());
    };
    let target = openssh_target(username, host);

    let child = Command::new("ssh")
        .args([
            "-o",
            "BatchMode=yes",
            "-o",
            "ConnectTimeout=8",
            &target,
            remote_command,
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output();

    let output = timeout(operation_timeout, child)
        .await
        .map_err(|_| format!("SSH 操作超时（{} 秒）", operation_timeout.as_secs()))?
        .map_err(|error| format!("无法启动系统 SSH：{error}"))?;

    Ok(CommandResult::from_output(output))
}

fn openssh_target(username: &str, host: &str) -> String {
    format!("{username}@{host}")
}

fn probe_password(authentication: &Authentication) -> Result<ConnectionProbe, String> {
    let Authentication::Password {
        username,
        password,
        trusted_host_key,
        ..
    } = authentication
    else {
        return Err("登录方式不是账号密码".into());
    };

    let (session, host_key, fingerprint) = open_password_transport(authentication, SSH_TIMEOUT)?;

    if let Some(trusted) = trusted_host_key {
        if trusted != &host_key {
            return Err(format!(
                "服务器主机密钥与已信任记录不一致。当前指纹：{fingerprint}"
            ));
        }
    } else {
        return Ok(ConnectionProbe {
            success: false,
            requires_trust: true,
            fingerprint: Some(fingerprint),
            host_key: Some(host_key),
            message: "请确认服务器主机密钥指纹".into(),
        });
    }

    authenticate_password(&session, username, password)?;
    Ok(ConnectionProbe {
        success: true,
        requires_trust: false,
        fingerprint: Some(fingerprint),
        host_key: None,
        message: "账号密码验证成功".into(),
    })
}

fn run_password_command(
    authentication: &Authentication,
    command: &str,
    operation_timeout: Duration,
) -> Result<CommandResult, String> {
    let Authentication::Password {
        username,
        password,
        trusted_host_key,
        ..
    } = authentication
    else {
        return Err("登录方式不是账号密码".into());
    };
    if trusted_host_key.is_none() {
        return Err("请先确认服务器主机密钥指纹".into());
    }

    let (session, host_key, fingerprint) =
        open_password_transport(authentication, operation_timeout)?;
    if trusted_host_key.as_deref() != Some(host_key.as_str()) {
        return Err(format!(
            "服务器主机密钥与已信任记录不一致。当前指纹：{fingerprint}"
        ));
    }
    authenticate_password(&session, username, password)?;

    let mut channel = session
        .channel_session()
        .map_err(|error| format!("无法创建 SSH 命令通道：{error}"))?;
    channel
        .exec(command)
        .map_err(|error| format!("无法执行远程命令：{error}"))?;

    let mut stdout = String::new();
    let mut stderr = String::new();
    channel
        .read_to_string(&mut stdout)
        .map_err(|error| format!("无法读取 SSH 输出：{error}"))?;
    channel
        .stderr()
        .read_to_string(&mut stderr)
        .map_err(|error| format!("无法读取 SSH 错误输出：{error}"))?;
    channel
        .wait_close()
        .map_err(|error| format!("SSH 命令通道关闭失败：{error}"))?;
    let exit_code = channel.exit_status().ok();

    Ok(CommandResult {
        success: exit_code == Some(0),
        stdout,
        stderr,
        exit_code,
    })
}

fn open_password_transport(
    authentication: &Authentication,
    operation_timeout: Duration,
) -> Result<(Session, String, String), String> {
    let Authentication::Password { host, port, .. } = authentication else {
        return Err("登录方式不是账号密码".into());
    };

    let address = if host.contains(':') && !host.starts_with('[') {
        format!("[{host}]:{port}")
    } else {
        format!("{host}:{port}")
    };
    let socket_address = address
        .to_socket_addrs()
        .map_err(|error| format!("无法解析服务器地址：{error}"))?
        .next()
        .ok_or_else(|| "服务器地址没有可用的网络端点".to_string())?;
    let tcp = TcpStream::connect_timeout(&socket_address, CONNECT_TIMEOUT)
        .map_err(|error| format!("无法连接服务器：{error}"))?;

    let mut session = Session::new().map_err(|error| format!("无法创建 SSH 会话：{error}"))?;
    session.set_timeout(operation_timeout.as_millis().min(u32::MAX as u128) as u32);
    session.set_tcp_stream(tcp);
    session
        .handshake()
        .map_err(|error| format!("SSH 握手失败：{error}"))?;

    let (key, _) = session
        .host_key()
        .ok_or_else(|| "服务器没有提供 SSH 主机密钥".to_string())?;
    let host_key = BASE64_STANDARD.encode(key);
    let fingerprint = format!(
        "SHA256:{}",
        BASE64_STANDARD_NO_PAD.encode(Sha256::digest(key))
    );

    Ok((session, host_key, fingerprint))
}

fn authenticate_password(session: &Session, username: &str, password: &str) -> Result<(), String> {
    session
        .userauth_password(username, password)
        .map_err(|error| format!("账号或密码验证失败：{error}"))?;
    if !session.authenticated() {
        return Err("账号或密码验证失败".into());
    }
    Ok(())
}

pub fn in_compose_directory(profile: &ServerProfile, command: &str) -> Result<String, String> {
    let assignment = remote_directory_assignment(&profile.remote_path)?;
    let data_guard = data_directory_guard("./.env");
    Ok(format!(
        "set -eu; {assignment}; \
         paldeck_resolved=\"$(realpath -m -- \"$paldeck_dir\")\"; \
         if [ \"$paldeck_resolved\" != \"$paldeck_dir\" ]; then \
           printf '远程目录包含符号链接或解析后位置发生变化。\\n' >&2; exit 74; \
         fi; \
         if [ ! -d \"$paldeck_dir\" ] || [ -L \"$paldeck_dir\" ]; then \
           printf '远程部署目录不存在或不是安全目录。\\n' >&2; exit 74; \
         fi; \
         cd -P -- \"$paldeck_dir\"; \
         if [ \"$PWD\" != \"$paldeck_dir\" ]; then \
           printf '无法确认远程部署目录。\\n' >&2; exit 74; \
         fi; \
         if [ ! -f {marker} ] || [ -L {marker} ] || ! grep -Fqx {marker_content} {marker} || \
            [ \"$(grep -c '^COMPOSE_SHA256=' {marker} || true)\" != 1 ]; then \
           printf '目录不是由 Paldeck 创建或管理标记无效。\\n' >&2; exit 74; \
         fi; \
         paldeck_marker_hash=\"$(sed -n 's/^COMPOSE_SHA256=//p' {marker})\"; \
         case \"$paldeck_marker_hash\" in *[!0-9a-f]*) paldeck_marker_hash='' ;; esac; \
         if [ \"${{#paldeck_marker_hash}}\" != 64 ]; then \
           printf 'Paldeck 管理标记中的 Compose 摘要无效。\\n' >&2; exit 74; \
         fi; \
         if [ ! -f ./compose.yaml ] || [ -L ./compose.yaml ] || \
            [ ! -f ./.env ] || [ -L ./.env ]; then \
           printf '受管部署文件缺失或包含符号链接。\\n' >&2; exit 74; \
         fi; \
         paldeck_compose_digest=\"$(sha256sum -- ./compose.yaml 2>/dev/null || true)\"; \
         paldeck_compose_digest=\"${{paldeck_compose_digest%% *}}\"; \
         if [ \"$paldeck_compose_digest\" != \"$paldeck_marker_hash\" ]; then \
           printf 'compose.yaml 与 Paldeck 初始化记录不一致，已拒绝执行。\\n' >&2; exit 74; \
         fi; \
         {data_guard}; \
         {command}",
        marker = shell_quote(MANAGED_MARKER_FILE),
        marker_content = shell_quote(MANAGED_MARKER_CONTENT),
    ))
}

#[cfg(test)]
mod tests {
    use super::{
        compose_template_hash, in_compose_directory, openssh_target, remote_directory_assignment,
        shell_quote, validate_profile,
    };
    use crate::models::{Authentication, ServerProfile};

    fn openssh_profile(username: &str, host: &str, path: &str) -> ServerProfile {
        ServerProfile {
            auth: Authentication::OpenSsh {
                host: host.into(),
                username: username.into(),
            },
            remote_path: path.into(),
        }
    }

    fn password_profile(port: u16) -> ServerProfile {
        ServerProfile {
            auth: Authentication::Password {
                host: "192.0.2.10".into(),
                port,
                username: "steam".into(),
                password: "secret".into(),
                trusted_host_key: None,
            },
            remote_path: "~/.palworld".into(),
        }
    }

    #[test]
    fn validates_safe_profile() {
        assert!(
            validate_profile(&openssh_profile("admin", "palworld-server", "~/.palworld")).is_ok()
        );
    }

    #[test]
    fn builds_explicit_openssh_username_and_host_target() {
        assert_eq!(openssh_target("steam", "192.0.2.10"), "steam@192.0.2.10");
    }

    #[test]
    fn requires_separate_openssh_username_and_host() {
        assert!(validate_profile(&openssh_profile("", "palworld-server", "~/.palworld")).is_err());
        assert!(validate_profile(&openssh_profile(
            "admin",
            "admin@palworld-server",
            "~/.palworld"
        ))
        .is_err());
    }

    #[test]
    fn rejects_host_option_injection() {
        assert!(validate_profile(&openssh_profile(
            "admin",
            "-oProxyCommand=bad",
            "/opt/palworld"
        ))
        .is_err());
    }

    #[test]
    fn rejects_root_as_remote_path() {
        assert!(validate_profile(&openssh_profile("admin", "palworld-server", "/")).is_err());
    }

    #[test]
    fn rejects_remote_path_traversal_and_non_canonical_forms() {
        for path in [
            "~/../outside",
            "~/.palworld/./data",
            "/opt/paldeck/../../etc",
            "/opt//paldeck",
            "/opt/paldeck/",
            "~/.palworld\\data",
        ] {
            assert!(
                validate_profile(&openssh_profile("admin", "palworld-server", path)).is_err(),
                "accepted unsafe path: {path}"
            );
        }
    }

    #[test]
    fn validates_password_profile_without_logging_credentials() {
        assert!(validate_profile(&password_profile(22)).is_ok());
    }

    #[test]
    fn rejects_zero_ssh_port() {
        assert!(validate_profile(&password_profile(0)).is_err());
    }

    #[test]
    fn expands_home_relative_path_safely() {
        assert_eq!(
            remote_directory_assignment("~/.palworld").unwrap(),
            "paldeck_home=\"$(realpath -e -- \"$HOME\")\"; paldeck_dir=\"$paldeck_home\"/'.palworld'"
        );
    }

    #[test]
    fn quotes_single_quotes_for_remote_shell() {
        assert_eq!(shell_quote("/srv/a'b"), "'/srv/a'\"'\"'b'");
    }

    #[test]
    fn managed_commands_require_marker_and_reject_symlinks() {
        let command = in_compose_directory(
            &openssh_profile("admin", "palworld-server", "~/.palworld"),
            "printf ok",
        )
        .unwrap();
        assert!(command.contains("PALDECK_MANAGED_DIRECTORY_V1"));
        assert!(command.contains("COMPOSE_SHA256="));
        assert!(command.contains("PALWORLD_DATA_DIR"));
        assert!(command.contains("[ -L ./compose.yaml ]"));
    }

    #[test]
    fn compose_template_hash_is_sha256_hex() {
        let hash = compose_template_hash();
        assert_eq!(hash.len(), 64);
        assert!(hash.chars().all(|character| character.is_ascii_hexdigit()));
    }

    #[cfg(unix)]
    #[test]
    fn managed_command_has_valid_shell_syntax() {
        let command = in_compose_directory(
            &openssh_profile("admin", "palworld-server", "~/.palworld"),
            "printf ok",
        )
        .unwrap();
        let status = std::process::Command::new("sh")
            .args(["-n", "-c", &command])
            .status()
            .unwrap();
        assert!(status.success());
    }
}
