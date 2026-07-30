use std::process::Stdio;
use std::time::Duration;

use tokio::process::Command;
use tokio::time::timeout;

use crate::models::{CommandResult, ServerProfile};

const SSH_TIMEOUT: Duration = Duration::from_secs(30);

pub fn validate_profile(profile: &ServerProfile) -> Result<(), String> {
    validate_ssh_host(&profile.ssh_host)?;
    validate_remote_path(&profile.remote_path)
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

fn validate_remote_path(path: &str) -> Result<(), String> {
    if !path.starts_with('/') {
        return Err("远程 Compose 目录必须是绝对路径".into());
    }
    if path.len() > 4096 || path.contains(['\0', '\n', '\r']) {
        return Err("远程 Compose 目录包含无效字符".into());
    }
    Ok(())
}

pub fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\"'\"'"))
}

pub async fn run_ssh(
    profile: &ServerProfile,
    remote_command: &str,
) -> Result<CommandResult, String> {
    validate_profile(profile)?;

    let child = Command::new("ssh")
        .args([
            "-o",
            "BatchMode=yes",
            "-o",
            "ConnectTimeout=8",
            &profile.ssh_host,
            remote_command,
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output();

    let output = timeout(SSH_TIMEOUT, child)
        .await
        .map_err(|_| "SSH 操作超时（30 秒）".to_string())?
        .map_err(|error| format!("无法启动系统 SSH：{error}"))?;

    Ok(CommandResult::from_output(output))
}

pub fn in_compose_directory(profile: &ServerProfile, command: &str) -> String {
    format!("cd -- {} && {command}", shell_quote(&profile.remote_path))
}

#[cfg(test)]
mod tests {
    use super::{shell_quote, validate_profile};
    use crate::models::ServerProfile;

    #[test]
    fn validates_safe_profile() {
        let profile = ServerProfile {
            ssh_host: "admin@palworld-server".into(),
            remote_path: "/opt/palworld dst".into(),
        };
        assert!(validate_profile(&profile).is_ok());
    }

    #[test]
    fn rejects_host_option_injection() {
        let profile = ServerProfile {
            ssh_host: "-oProxyCommand=bad".into(),
            remote_path: "/opt/palworld".into(),
        };
        assert!(validate_profile(&profile).is_err());
    }

    #[test]
    fn quotes_single_quotes_for_remote_shell() {
        assert_eq!(shell_quote("/srv/a'b"), "'/srv/a'\"'\"'b'");
    }
}
