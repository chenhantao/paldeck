use std::time::Duration;

use base64::prelude::{Engine as _, BASE64_STANDARD};

use crate::models::{
    CommandResult, ConnectionProbe, EnvironmentInspection, InitializationOptions, ServerProfile,
};
use crate::remote::{
    in_compose_directory, probe_connection as probe_remote_connection, remote_path_expression,
    run_remote, run_remote_with_timeout, shell_quote, validate_profile,
};

const COMPOSE_TEMPLATE: &str = include_str!("../../../../compose.yaml");
const ENV_TEMPLATE: &str = include_str!("../../../../.env.example");

#[tauri::command]
pub async fn probe_connection(profile: ServerProfile) -> Result<ConnectionProbe, String> {
    probe_remote_connection(profile).await
}

#[tauri::command]
pub async fn check_connection(profile: ServerProfile) -> Result<CommandResult, String> {
    run_remote(&profile, "printf 'paldeck-ok'").await
}

#[tauri::command]
pub async fn inspect_environment(profile: ServerProfile) -> Result<EnvironmentInspection, String> {
    validate_profile(&profile)?;
    let directory = remote_path_expression(&profile.remote_path)?;
    let compose_file = format!("{directory}/{}", shell_quote("compose.yaml"));
    let env_file = format!("{directory}/{}", shell_quote(".env"));
    let command = format!(
        "printf 'PALDECK_OS=%s\\n' \"$(uname -s 2>/dev/null || printf unknown)\"; \
         printf 'PALDECK_ARCH=%s\\n' \"$(uname -m 2>/dev/null || printf unknown)\"; \
         if command -v docker >/dev/null 2>&1; then printf 'PALDECK_DOCKER=1\\n'; else printf 'PALDECK_DOCKER=0\\n'; fi; \
         if docker info >/dev/null 2>&1; then printf 'PALDECK_DOCKER_USABLE=1\\n'; else printf 'PALDECK_DOCKER_USABLE=0\\n'; fi; \
         if docker compose version >/dev/null 2>&1; then printf 'PALDECK_COMPOSE=1\\n'; else printf 'PALDECK_COMPOSE=0\\n'; fi; \
         if [ -d {directory} ]; then printf 'PALDECK_DIRECTORY=1\\n'; else printf 'PALDECK_DIRECTORY=0\\n'; fi; \
         if [ -f {compose_file} ]; then printf 'PALDECK_COMPOSE_FILE=1\\n'; else printf 'PALDECK_COMPOSE_FILE=0\\n'; fi; \
         if [ -f {env_file} ]; then printf 'PALDECK_ENV_FILE=1\\n'; else printf 'PALDECK_ENV_FILE=0\\n'; fi; \
         if [ -f {compose_file} ] && [ -f {env_file} ] && cd -- {directory} && \
           docker compose config --quiet >/dev/null 2>&1 && \
           docker compose config --services 2>/dev/null | grep -qx palworld; \
         then printf 'PALDECK_DEPLOYMENT_VALID=1\\n'; else printf 'PALDECK_DEPLOYMENT_VALID=0\\n'; fi; \
         if [ -f {compose_file} ] && cd -- {directory} && [ -n \"$(docker compose ps -q palworld 2>/dev/null)\" ]; \
         then printf 'PALDECK_RUNNING=1\\n'; else printf 'PALDECK_RUNNING=0\\n'; fi"
    );
    let result = run_remote(&profile, &command).await?;
    if !result.success {
        return Err(if result.stderr.is_empty() {
            "无法检查远程环境".into()
        } else {
            result.stderr
        });
    }

    Ok(EnvironmentInspection {
        os: inspection_value(&result.stdout, "PALDECK_OS").unwrap_or_else(|| "unknown".into()),
        arch: inspection_value(&result.stdout, "PALDECK_ARCH").unwrap_or_else(|| "unknown".into()),
        docker_installed: inspection_flag(&result.stdout, "PALDECK_DOCKER"),
        docker_usable: inspection_flag(&result.stdout, "PALDECK_DOCKER_USABLE"),
        compose_installed: inspection_flag(&result.stdout, "PALDECK_COMPOSE"),
        directory_exists: inspection_flag(&result.stdout, "PALDECK_DIRECTORY"),
        compose_exists: inspection_flag(&result.stdout, "PALDECK_COMPOSE_FILE"),
        env_exists: inspection_flag(&result.stdout, "PALDECK_ENV_FILE"),
        deployment_valid: inspection_flag(&result.stdout, "PALDECK_DEPLOYMENT_VALID"),
        container_running: inspection_flag(&result.stdout, "PALDECK_RUNNING"),
    })
}

#[tauri::command]
pub async fn initialize_server(
    profile: ServerProfile,
    options: InitializationOptions,
) -> Result<CommandResult, String> {
    validate_profile(&profile)?;
    validate_initialization_options(&options)?;

    let mut environment = ENV_TEMPLATE.to_string();
    set_env_value(
        &mut environment,
        "SERVER_NAME",
        &dotenv_quote(&options.server_name),
    )?;
    set_env_value(
        &mut environment,
        "SERVER_PASSWORD",
        &dotenv_quote(&options.server_password),
    )?;
    set_env_value(
        &mut environment,
        "ADMIN_PASSWORD",
        &dotenv_quote(&options.admin_password),
    )?;
    set_env_value(&mut environment, "PLAYERS", &options.players.to_string())?;

    let compose_encoded = BASE64_STANDARD.encode(COMPOSE_TEMPLATE.as_bytes());
    let environment_encoded = BASE64_STANDARD.encode(environment.as_bytes());
    let directory = remote_path_expression(&profile.remote_path)?;
    let start_command = if options.start_after_install {
        "docker compose up -d"
    } else {
        "printf 'Paldeck deployment files installed.\\n'"
    };
    let script = format!(
        "set -eu; umask 077; \
         mkdir -p -- {directory}; \
         cd -- {directory}; \
         if [ -e compose.yaml ] || [ -e .env ]; then \
           printf '目标目录已存在 compose.yaml 或 .env，已停止以避免覆盖。\\n' >&2; exit 73; \
         fi; \
         trap 'rm -f -- compose.paldeck.tmp .env.paldeck.tmp' EXIT; \
         printf %s {} | base64 --decode > compose.paldeck.tmp; \
         printf %s {} | base64 --decode > .env.paldeck.tmp; \
         chmod 600 .env.paldeck.tmp; \
         docker compose --env-file .env.paldeck.tmp -f compose.paldeck.tmp config --quiet; \
         mv -- compose.paldeck.tmp compose.yaml; \
         mv -- .env.paldeck.tmp .env; \
         trap - EXIT; \
         {start_command}",
        shell_quote(&compose_encoded),
        shell_quote(&environment_encoded),
    );
    let timeout = if options.start_after_install {
        Duration::from_secs(15 * 60)
    } else {
        Duration::from_secs(2 * 60)
    };
    run_remote_with_timeout(&profile, &script, timeout).await
}

#[tauri::command]
pub async fn inspect_server(profile: ServerProfile) -> Result<CommandResult, String> {
    let command = in_compose_directory(
        &profile,
        "docker compose ps --format json && docker stats --no-stream --format '{{json .}}' palworld-server",
    )?;
    run_remote(&profile, &command).await
}

#[tauri::command]
pub async fn compose_action(
    profile: ServerProfile,
    action: String,
) -> Result<CommandResult, String> {
    let compose_command = match action.as_str() {
        "start" => "docker compose up -d",
        "stop" => "docker compose down",
        "restart" => "docker compose restart",
        "pull" => "docker compose pull",
        _ => return Err("不支持的 Compose 操作".into()),
    };

    let command = in_compose_directory(&profile, compose_command)?;
    let timeout = match action.as_str() {
        "start" | "pull" => Duration::from_secs(15 * 60),
        _ => Duration::from_secs(2 * 60),
    };
    run_remote_with_timeout(&profile, &command, timeout).await
}

#[tauri::command]
pub async fn server_action(
    profile: ServerProfile,
    action: String,
) -> Result<CommandResult, String> {
    let container_command = match action.as_str() {
        "save" => "docker compose exec -T palworld rest-cli save",
        "backup" => "docker compose exec -T palworld backup",
        _ => return Err("不支持的服务器操作".into()),
    };

    let command = in_compose_directory(&profile, container_command)?;
    run_remote(&profile, &command).await
}

#[tauri::command]
pub async fn read_logs(profile: ServerProfile, tail: Option<u16>) -> Result<CommandResult, String> {
    let lines = tail.unwrap_or(300).clamp(1, 2_000);
    let command = in_compose_directory(
        &profile,
        &format!("docker compose logs --no-color --tail {lines} palworld"),
    )?;
    run_remote(&profile, &command).await
}

#[tauri::command]
pub async fn read_env(profile: ServerProfile) -> Result<CommandResult, String> {
    let command = in_compose_directory(&profile, "cat -- .env")?;
    run_remote(&profile, &command).await
}

#[tauri::command]
pub async fn write_env(profile: ServerProfile, contents: String) -> Result<CommandResult, String> {
    validate_profile(&profile)?;
    if contents.len() > 128 * 1024 {
        return Err(".env 文件超过 128 KiB 限制".into());
    }
    if contents.contains('\0') {
        return Err(".env 文件包含无效的空字符".into());
    }

    let encoded = BASE64_STANDARD.encode(contents.as_bytes());
    let temp_file = ".env.paldeck.tmp";
    let backup_file = ".env.paldeck.bak";
    let script = format!(
        "umask 077; printf %s {} | base64 --decode > {}; \
         docker compose --env-file {} config --quiet; \
         if [ -f .env ]; then cp -p -- .env {}; fi; \
         mv -- {} .env",
        shell_quote(&encoded),
        shell_quote(temp_file),
        shell_quote(temp_file),
        shell_quote(backup_file),
        shell_quote(temp_file),
    );
    let command = in_compose_directory(&profile, &script)?;
    run_remote(&profile, &command).await
}

fn inspection_value(output: &str, key: &str) -> Option<String> {
    output
        .lines()
        .find_map(|line| line.strip_prefix(&format!("{key}=")).map(str::to_string))
}

fn inspection_flag(output: &str, key: &str) -> bool {
    inspection_value(output, key).as_deref() == Some("1")
}

fn validate_initialization_options(options: &InitializationOptions) -> Result<(), String> {
    if options.server_name.trim().is_empty() || options.server_name.len() > 128 {
        return Err("服务器名称长度无效".into());
    }
    if options.admin_password.len() < 8 || options.admin_password.len() > 128 {
        return Err("管理员密码必须为 8 到 128 个字符".into());
    }
    if options.server_password.len() > 128 {
        return Err("服务器密码不能超过 128 个字符".into());
    }
    if !(1..=32).contains(&options.players) {
        return Err("玩家数量必须在 1 到 32 之间".into());
    }
    for value in [
        &options.server_name,
        &options.server_password,
        &options.admin_password,
    ] {
        if value.contains(['\0', '\n', '\r']) {
            return Err("初始化配置不能包含换行或空字符".into());
        }
    }
    Ok(())
}

fn dotenv_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "\\'"))
}

fn set_env_value(contents: &mut String, key: &str, value: &str) -> Result<(), String> {
    let prefix = format!("{key}=");
    let mut found = false;
    let updated = contents
        .lines()
        .map(|line| {
            if line.starts_with(&prefix) {
                found = true;
                format!("{prefix}{value}")
            } else {
                line.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join("\n");
    if !found {
        return Err(format!("环境模板缺少变量 {key}"));
    }
    *contents = format!("{updated}\n");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{dotenv_quote, inspection_flag, inspection_value, set_env_value};

    #[test]
    fn parses_environment_inspection() {
        let output = "PALDECK_OS=Linux\nPALDECK_DOCKER=1\n";
        assert_eq!(
            inspection_value(output, "PALDECK_OS").as_deref(),
            Some("Linux")
        );
        assert!(inspection_flag(output, "PALDECK_DOCKER"));
        assert!(!inspection_flag(output, "PALDECK_COMPOSE"));
    }

    #[test]
    fn quotes_dotenv_values_without_interpolation() {
        assert_eq!(dotenv_quote("pa$$'word"), "'pa$$\\'word'");
    }

    #[test]
    fn replaces_only_the_requested_environment_value() {
        let mut contents = "SERVER_NAME=old\nPLAYERS=8\n".to_string();
        set_env_value(&mut contents, "SERVER_NAME", "'new'").unwrap();
        assert_eq!(contents, "SERVER_NAME='new'\nPLAYERS=8\n");
    }
}
