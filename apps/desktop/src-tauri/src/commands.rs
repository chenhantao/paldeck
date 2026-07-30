use base64::prelude::{Engine as _, BASE64_STANDARD};

use crate::models::{CommandResult, ServerProfile};
use crate::remote::{in_compose_directory, run_ssh, shell_quote, validate_profile};

#[tauri::command]
pub async fn check_connection(profile: ServerProfile) -> Result<CommandResult, String> {
    run_ssh(&profile, "printf 'paldeck-ok'").await
}

#[tauri::command]
pub async fn inspect_server(profile: ServerProfile) -> Result<CommandResult, String> {
    let command = in_compose_directory(
        &profile,
        "docker compose ps --format json && docker stats --no-stream --format '{{json .}}' palworld-server",
    );
    run_ssh(&profile, &command).await
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

    let command = in_compose_directory(&profile, compose_command);
    run_ssh(&profile, &command).await
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

    let command = in_compose_directory(&profile, container_command);
    run_ssh(&profile, &command).await
}

#[tauri::command]
pub async fn read_logs(profile: ServerProfile, tail: Option<u16>) -> Result<CommandResult, String> {
    let lines = tail.unwrap_or(300).clamp(1, 2_000);
    let command = in_compose_directory(
        &profile,
        &format!("docker compose logs --no-color --tail {lines} palworld"),
    );
    run_ssh(&profile, &command).await
}

#[tauri::command]
pub async fn read_env(profile: ServerProfile) -> Result<CommandResult, String> {
    let command = in_compose_directory(&profile, "cat -- .env");
    run_ssh(&profile, &command).await
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
    let command = in_compose_directory(&profile, &script);
    run_ssh(&profile, &command).await
}
