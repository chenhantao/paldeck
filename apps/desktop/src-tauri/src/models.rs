use serde::{Deserialize, Serialize};

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerProfile {
    pub auth: Authentication,
    pub remote_path: String,
}

#[derive(Clone, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Authentication {
    #[serde(rename = "openssh")]
    OpenSsh { ssh_host: String },
    Password {
        host: String,
        port: u16,
        username: String,
        password: String,
        trusted_host_key: Option<String>,
    },
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
    pub directory_exists: bool,
    pub compose_exists: bool,
    pub env_exists: bool,
    pub deployment_valid: bool,
    pub container_running: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitializationOptions {
    pub server_name: String,
    pub server_password: String,
    pub admin_password: String,
    pub players: u8,
    pub start_after_install: bool,
}
