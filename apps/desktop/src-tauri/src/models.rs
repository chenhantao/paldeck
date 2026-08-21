use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerProfile {
    pub auth: Authentication,
    pub remote_path: String,
}

#[derive(Clone, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum Authentication {
    #[serde(rename = "openssh")]
    OpenSsh { host: String, username: String },
    Password {
        host: String,
        port: u16,
        username: String,
        password: String,
        trusted_host_key: Option<String>,
    },
}

#[cfg(test)]
mod tests {
    use super::{Authentication, ServerProfile};

    #[test]
    fn deserializes_camel_case_authentication_fields() {
        let openssh: ServerProfile = serde_json::from_value(serde_json::json!({
            "auth": {
                "kind": "openssh",
                "host": "palworld-server",
                "username": "steam"
            },
            "remotePath": "~/.palworld"
        }))
        .expect("OpenSSH profile should deserialize");
        assert!(matches!(
            openssh.auth,
            Authentication::OpenSsh { host, username }
                if host == "palworld-server" && username == "steam"
        ));

        let password: ServerProfile = serde_json::from_value(serde_json::json!({
            "auth": {
                "kind": "password",
                "host": "192.0.2.10",
                "port": 22,
                "username": "steam",
                "password": "secret",
                "trustedHostKey": "ssh-ed25519 AAAA"
            },
            "remotePath": "~/.palworld"
        }))
        .expect("password profile should deserialize");
        assert!(matches!(
            password.auth,
            Authentication::Password { trusted_host_key, .. }
                if trusted_host_key.as_deref() == Some("ssh-ed25519 AAAA")
        ));
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
}

impl CommandResult {
    pub fn from_output(output: std::process::Output) -> Self {
        Self {
            success: output.status.success(),
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
            exit_code: output.status.code(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionProbe {
    pub success: bool,
    pub requires_trust: bool,
    pub fingerprint: Option<String>,
    pub host_key: Option<String>,
    pub message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentInspection {
    pub os: String,
    pub arch: String,
    pub docker_installed: bool,
    pub docker_usable: bool,
    pub compose_installed: bool,
    pub path_safe: bool,
    pub directory_exists: bool,
    pub directory_empty: bool,
    pub managed_directory: bool,
    pub unexpected_entries: bool,
    pub compose_exists: bool,
    pub env_exists: bool,
    pub deployment_valid: bool,
    pub container_running: bool,
    pub import_candidate: bool,
    pub import_compatible: bool,
    pub import_compose_valid: bool,
    pub import_service_compatible: bool,
    pub import_image_compatible: bool,
    pub import_data_directory_safe: bool,
    pub import_volume_compatible: bool,
    pub import_backup_available: bool,
    pub import_image: Option<String>,
    pub import_data_directory: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitializationOptions {
    pub server_name: String,
    pub server_password: String,
    pub admin_password: String,
    pub data_directory: String,
    pub players: u8,
    pub start_after_install: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerSnapshot {
    pub status: String,
    pub server_name: Option<String>,
    pub version: Option<String>,
    pub online_players: Option<u64>,
    pub max_players: Option<u64>,
    pub world_day: Option<u64>,
    pub cpu_percent: Option<f64>,
    pub memory_used_bytes: Option<u64>,
    pub memory_limit_bytes: Option<u64>,
    pub fps: Option<f64>,
    pub uptime_seconds: Option<u64>,
    pub rest_available: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OnlinePlayer {
    pub id: String,
    pub player_id: String,
    pub name: String,
    pub account_name: String,
    pub ping_ms: f64,
    pub level: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupEntry {
    pub filename: String,
    pub modified_unix: u64,
    pub size_bytes: u64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupSettings {
    pub enabled: bool,
    pub cron_expression: String,
    pub delete_old_backups: bool,
    pub retention_days: u16,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorldSettingsInput {
    pub values: BTreeMap<String, String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorldSettingsOutput {
    pub values: BTreeMap<String, String>,
}
