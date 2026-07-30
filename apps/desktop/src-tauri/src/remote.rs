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

pub fn validate_profile(profile: &ServerProfile) -> Result<(), String> {
    validate_authentication(&profile.auth)?;
    validate_remote_path(&profile.remote_path)
}

fn validate_authentication(authentication: &Authentication) -> Result<(), String> {
    match authentication {
        Authentication::OpenSsh { ssh_host } => validate_ssh_host(ssh_host),
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
            if username.trim().is_empty()
                || username.len() > 255
                || username.contains(['\0', '\n', '\r'])
            {
                return Err("SSH 用户名无效".into());
            }
            if password.len() > 4_096 || password.contains('\0') {
                return Err("SSH 密码无效".into());
            }
            Ok(())
        }
    }
}

fn validate_ssh_host(host: &str) -> Result<(), String> {
    let trimmed = host.trim();
    if trimmed.is_empty() || trimmed.len() > 255 {
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
        .all(|character| character.is_ascii_alphanumeric() || ".-_@".contains(character))
    {
        return Err("SSH Host 只能包含字母、数字、点、横线、下划线和 @".into());
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
    Ok(())
}

pub fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\"'\"'"))
}

pub fn remote_path_expression(path: &str) -> Result<String, String> {
    validate_remote_path(path)?;
    if let Some(relative) = path.strip_prefix("~/") {
        Ok(format!("\"$HOME\"/{}", shell_quote(relative)))
    } else {
        Ok(shell_quote(path))
    }
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
    let Authentication::OpenSsh { ssh_host } = &profile.auth else {
        return Err("登录方式不是 OpenSSH".into());
    };

    let child = Command::new("ssh")
        .args([
            "-o",
            "BatchMode=yes",
            "-o",
            "ConnectTimeout=8",
            ssh_host,
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
    Ok(format!(
        "cd -- {} && {command}",
        remote_path_expression(&profile.remote_path)?
    ))
}

#[cfg(test)]
mod tests {
    use super::{remote_path_expression, shell_quote, validate_profile};
    use crate::models::{Authentication, ServerProfile};

    fn openssh_profile(host: &str, path: &str) -> ServerProfile {
        ServerProfile {
            auth: Authentication::OpenSsh {
                ssh_host: host.into(),
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
        assert!(validate_profile(&openssh_profile("admin@palworld-server", "~/.palworld")).is_ok());
    }

    #[test]
    fn rejects_host_option_injection() {
        assert!(validate_profile(&openssh_profile("-oProxyCommand=bad", "/opt/palworld")).is_err());
    }

    #[test]
    fn rejects_root_as_remote_path() {
        assert!(validate_profile(&openssh_profile("palworld-server", "/")).is_err());
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
            remote_path_expression("~/.palworld").unwrap(),
            "\"$HOME\"/'.palworld'"
        );
    }

    #[test]
    fn quotes_single_quotes_for_remote_shell() {
        assert_eq!(shell_quote("/srv/a'b"), "'/srv/a'\"'\"'b'");
    }
}
