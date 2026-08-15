use std::time::Duration;

use base64::prelude::{Engine as _, BASE64_STANDARD};
use serde_json::Value;

use crate::models::{
    BackupEntry, CommandResult, ConnectionProbe, EnvironmentInspection, InitializationOptions,
    OnlinePlayer, ServerProfile, ServerSnapshot, WorldSettingsInput, WorldSettingsOutput,
};
use crate::remote::{
    compose_template_hash, data_directory_check, data_directory_guard, in_compose_directory,
    probe_connection as probe_remote_connection, remote_directory_assignment, run_remote,
    run_remote_with_timeout, shell_quote, validate_profile, MANAGED_MARKER_CONTENT,
    MANAGED_MARKER_FILE,
};

const COMPOSE_TEMPLATE: &str = include_str!("../../../../compose.yaml");
const ENV_TEMPLATE: &str = include_str!("../../../../.env.example");
const COMPOSE_COMMAND: &str =
    "docker compose --project-directory . --env-file ./.env -f ./compose.yaml";

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
    let assignment = remote_directory_assignment(&profile.remote_path)?;
    let data_check = data_directory_check("\"$paldeck_dir/.env\"");
    let command = format!(
        "{assignment}; \
         printf 'PALDECK_OS=%s\\n' \"$(uname -s 2>/dev/null || printf unknown)\"; \
         printf 'PALDECK_ARCH=%s\\n' \"$(uname -m 2>/dev/null || printf unknown)\"; \
         if command -v docker >/dev/null 2>&1; then printf 'PALDECK_DOCKER=1\\n'; else printf 'PALDECK_DOCKER=0\\n'; fi; \
         if docker info >/dev/null 2>&1; then printf 'PALDECK_DOCKER_USABLE=1\\n'; else printf 'PALDECK_DOCKER_USABLE=0\\n'; fi; \
         if docker compose version >/dev/null 2>&1; then printf 'PALDECK_COMPOSE=1\\n'; else printf 'PALDECK_COMPOSE=0\\n'; fi; \
         paldeck_resolved=\"$(realpath -m -- \"$paldeck_dir\" 2>/dev/null || true)\"; \
         if [ -n \"$paldeck_resolved\" ] && [ \"$paldeck_resolved\" = \"$paldeck_dir\" ]; \
         then paldeck_path_safe=1; printf 'PALDECK_PATH_SAFE=1\\n'; \
         else paldeck_path_safe=0; printf 'PALDECK_PATH_SAFE=0\\n'; fi; \
         paldeck_directory=0; paldeck_managed=0; paldeck_files_safe=0; paldeck_data_safe=0; \
         if [ \"$paldeck_path_safe\" = 1 ] && [ -d \"$paldeck_dir\" ] && [ ! -L \"$paldeck_dir\" ]; then \
           paldeck_directory=1; printf 'PALDECK_DIRECTORY=1\\n'; \
           if [ -z \"$(find \"$paldeck_dir\" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)\" ]; \
           then printf 'PALDECK_DIRECTORY_EMPTY=1\\n'; else printf 'PALDECK_DIRECTORY_EMPTY=0\\n'; fi; \
           paldeck_marker_hash=''; \
           if [ -f \"$paldeck_dir/{marker_raw}\" ] && [ ! -L \"$paldeck_dir/{marker_raw}\" ] && \
              grep -Fqx {marker_content} \"$paldeck_dir/{marker_raw}\" && \
              [ \"$(grep -c '^COMPOSE_SHA256=' \"$paldeck_dir/{marker_raw}\" || true)\" = 1 ]; then \
             paldeck_marker_hash=\"$(sed -n 's/^COMPOSE_SHA256=//p' \"$paldeck_dir/{marker_raw}\")\"; \
           fi; \
           case \"$paldeck_marker_hash\" in *[!0-9a-f]*) paldeck_marker_hash='' ;; esac; \
           if [ \"${{#paldeck_marker_hash}}\" = 64 ]; \
           then paldeck_managed=1; printf 'PALDECK_MANAGED=1\\n'; else printf 'PALDECK_MANAGED=0\\n'; fi; \
           if [ -f \"$paldeck_dir/compose.yaml\" ] && [ ! -L \"$paldeck_dir/compose.yaml\" ]; \
           then paldeck_compose=1; printf 'PALDECK_COMPOSE_FILE=1\\n'; else paldeck_compose=0; printf 'PALDECK_COMPOSE_FILE=0\\n'; fi; \
           if [ -f \"$paldeck_dir/.env\" ] && [ ! -L \"$paldeck_dir/.env\" ]; \
           then paldeck_env=1; printf 'PALDECK_ENV_FILE=1\\n'; else paldeck_env=0; printf 'PALDECK_ENV_FILE=0\\n'; fi; \
           if [ \"$paldeck_compose\" = 1 ]; then \
             paldeck_compose_digest=\"$(sha256sum -- \"$paldeck_dir/compose.yaml\" 2>/dev/null || true)\"; \
             paldeck_compose_digest=\"${{paldeck_compose_digest%% *}}\"; \
             if [ -n \"$paldeck_marker_hash\" ] && [ \"$paldeck_compose_digest\" = \"$paldeck_marker_hash\" ]; \
             then paldeck_files_safe=1; fi; \
           fi; \
           {data_check}; \
           if [ \"$paldeck_data_safe\" = 1 ]; then \
             paldeck_data_top=\"${{paldeck_data_relative%%/*}}\"; \
             if [ -n \"$(find \"$paldeck_dir\" -mindepth 1 -maxdepth 1 \
               ! -name {marker} ! -name compose.yaml ! -name .env ! -name .env.paldeck.bak \
               ! -name \"$paldeck_data_top\" -print -quit 2>/dev/null)\" ]; \
             then printf 'PALDECK_UNEXPECTED_ENTRIES=1\\n'; else printf 'PALDECK_UNEXPECTED_ENTRIES=0\\n'; fi; \
           else printf 'PALDECK_UNEXPECTED_ENTRIES=0\\n'; fi; \
           if [ \"$paldeck_env\" != 1 ]; then paldeck_files_safe=0; fi; \
         else \
           printf 'PALDECK_DIRECTORY=0\\nPALDECK_DIRECTORY_EMPTY=0\\nPALDECK_UNEXPECTED_ENTRIES=0\\n'; \
           printf 'PALDECK_MANAGED=0\\nPALDECK_COMPOSE_FILE=0\\nPALDECK_ENV_FILE=0\\n'; \
         fi; \
         if [ \"$paldeck_directory\" = 1 ] && [ \"$paldeck_managed\" = 1 ] && \
            [ \"$paldeck_files_safe\" = 1 ] && [ \"$paldeck_data_safe\" = 1 ] && \
            cd -P -- \"$paldeck_dir\" && [ \"$PWD\" = \"$paldeck_dir\" ] && \
            {compose} config --quiet >/dev/null 2>&1 && \
            {compose} config --services 2>/dev/null | grep -qx palworld; \
         then printf 'PALDECK_DEPLOYMENT_VALID=1\\n'; else printf 'PALDECK_DEPLOYMENT_VALID=0\\n'; fi; \
         if [ \"$paldeck_directory\" = 1 ] && [ \"$paldeck_managed\" = 1 ] && \
            [ \"$paldeck_files_safe\" = 1 ] && [ \"$paldeck_data_safe\" = 1 ] && \
            cd -P -- \"$paldeck_dir\" && \
            [ -n \"$({compose} ps -q palworld 2>/dev/null)\" ]; \
         then printf 'PALDECK_RUNNING=1\\n'; else printf 'PALDECK_RUNNING=0\\n'; fi",
        marker = shell_quote(MANAGED_MARKER_FILE),
        marker_raw = MANAGED_MARKER_FILE,
        marker_content = shell_quote(MANAGED_MARKER_CONTENT),
        compose = COMPOSE_COMMAND,
        data_check = data_check,
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
        path_safe: inspection_flag(&result.stdout, "PALDECK_PATH_SAFE"),
        directory_exists: inspection_flag(&result.stdout, "PALDECK_DIRECTORY"),
        directory_empty: inspection_flag(&result.stdout, "PALDECK_DIRECTORY_EMPTY"),
        managed_directory: inspection_flag(&result.stdout, "PALDECK_MANAGED"),
        unexpected_entries: inspection_flag(&result.stdout, "PALDECK_UNEXPECTED_ENTRIES"),
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
    set_env_value(
        &mut environment,
        "PALWORLD_DATA_DIR",
        &options.data_directory,
    )?;

    let compose_encoded = BASE64_STANDARD.encode(COMPOSE_TEMPLATE.as_bytes());
    let environment_encoded = BASE64_STANDARD.encode(environment.as_bytes());
    let assignment = remote_directory_assignment(&profile.remote_path)?;
    let data_guard = data_directory_guard("\"$env_tmp\"");
    let start_command = if options.start_after_install {
        format!("{COMPOSE_COMMAND} up -d")
    } else {
        "printf 'Paldeck deployment files installed.\\n'".to_string()
    };
    let script = format!(
        "set -eu; umask 077; {assignment}; \
         paldeck_resolved=\"$(realpath -m -- \"$paldeck_dir\")\"; \
         if [ \"$paldeck_resolved\" != \"$paldeck_dir\" ]; then \
           printf '远程目录不是规范路径，或其父目录经过符号链接。\\n' >&2; exit 72; \
         fi; \
         if [ -e \"$paldeck_dir\" ] || [ -L \"$paldeck_dir\" ]; then \
           if [ ! -d \"$paldeck_dir\" ] || [ -L \"$paldeck_dir\" ]; then \
             printf '远程路径已存在，但不是安全的普通目录。\\n' >&2; exit 73; \
           fi; \
           if [ -n \"$(find \"$paldeck_dir\" -mindepth 1 -maxdepth 1 -print -quit)\" ]; then \
             printf '远程目录非空且未由 Paldeck 管理；为避免影响其他文件，初始化已停止。\\n' >&2; exit 73; \
           fi; \
         else mkdir -p -- \"$paldeck_dir\"; fi; \
         paldeck_resolved=\"$(realpath -e -- \"$paldeck_dir\")\"; \
         if [ \"$paldeck_resolved\" != \"$paldeck_dir\" ] || [ -L \"$paldeck_dir\" ]; then \
           printf '创建后的远程目录未通过安全检查。\\n' >&2; exit 73; \
         fi; \
         cd -P -- \"$paldeck_dir\"; [ \"$PWD\" = \"$paldeck_dir\" ]; \
         compose_tmp=\"$(mktemp -p . .paldeck-compose.XXXXXX)\"; \
         env_tmp=\"$(mktemp -p . .paldeck-env.XXXXXX)\"; \
         marker_tmp=\"$(mktemp -p . .paldeck-marker.XXXXXX)\"; \
         installed=0; compose_installed=0; env_installed=0; marker_installed=0; \
         cleanup() {{ rm -f -- \"$compose_tmp\" \"$env_tmp\" \"$marker_tmp\"; \
           if [ \"$installed\" != 1 ]; then \
             if [ \"$marker_installed\" = 1 ]; then rm -f -- {marker}; fi; \
             if [ \"$env_installed\" = 1 ]; then rm -f -- .env; fi; \
             if [ \"$compose_installed\" = 1 ]; then rm -f -- compose.yaml; fi; \
           fi; }}; \
         trap cleanup EXIT HUP INT TERM; \
         printf %s {} | base64 --decode > \"$compose_tmp\"; \
         printf %s {} | base64 --decode > \"$env_tmp\"; \
         printf '%s\\nCOMPOSE_SHA256=%s\\n' {marker_content} {compose_hash} > \"$marker_tmp\"; \
         chmod 600 \"$env_tmp\" \"$marker_tmp\"; \
         {data_guard}; \
         docker compose --project-directory . --env-file \"$env_tmp\" -f \"$compose_tmp\" config --quiet; \
         mv -n -- \"$compose_tmp\" compose.yaml; \
         if [ -e \"$compose_tmp\" ]; then printf 'compose.yaml 在初始化期间被创建，已停止。\\n' >&2; exit 73; fi; \
         compose_installed=1; \
         mv -n -- \"$env_tmp\" .env; \
         if [ -e \"$env_tmp\" ]; then printf '.env 在初始化期间被创建，已停止。\\n' >&2; exit 73; fi; \
         env_installed=1; \
         mv -n -- \"$marker_tmp\" {marker}; \
         if [ -e \"$marker_tmp\" ]; then printf '管理标记在初始化期间被创建，已停止。\\n' >&2; exit 73; fi; \
         marker_installed=1; \
         installed=1; \
         {start_command}",
        shell_quote(&compose_encoded),
        shell_quote(&environment_encoded),
        marker = shell_quote(MANAGED_MARKER_FILE),
        marker_content = shell_quote(MANAGED_MARKER_CONTENT),
        compose_hash = shell_quote(&compose_template_hash()),
        data_guard = data_guard,
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
        &format!(
            "{COMPOSE_COMMAND} ps --format json && docker stats --no-stream --format '{{{{json .}}}}' palworld-server"
        ),
    )?;
    run_remote(&profile, &command).await
}

#[tauri::command]
pub async fn server_snapshot(profile: ServerProfile) -> Result<ServerSnapshot, String> {
    let script = server_snapshot_script();
    let command = in_compose_directory(&profile, &script)?;
    let result = run_remote(&profile, &command).await?;
    if !result.success {
        return Err(command_error(&result, "无法读取服务器状态"));
    }

    let remote_status =
        inspection_value(&result.stdout, "PALDECK_STATUS").unwrap_or_else(|| "unknown".into());
    let status = match remote_status.as_str() {
        "running" => "online",
        "created" | "restarting" => "starting",
        "exited" | "dead" | "offline" => "offline",
        _ => "unknown",
    }
    .to_string();
    let stats = decoded_json_value(&result.stdout, "PALDECK_STATS");
    let info = decoded_json_value(&result.stdout, "PALDECK_INFO");
    let metrics = decoded_json_value(&result.stdout, "PALDECK_METRICS");

    let (memory_used_bytes, memory_limit_bytes) = stats
        .as_ref()
        .and_then(|value| value.get("MemUsage").and_then(Value::as_str))
        .and_then(parse_memory_usage)
        .map(|(used, limit)| (Some(used), Some(limit)))
        .unwrap_or((None, None));

    Ok(ServerSnapshot {
        status,
        server_name: json_string(&info, "servername"),
        version: json_string(&info, "version"),
        online_players: json_u64(&metrics, "currentplayernum"),
        max_players: json_u64(&metrics, "maxplayernum"),
        world_day: json_u64(&metrics, "days"),
        cpu_percent: stats
            .as_ref()
            .and_then(|value| value.get("CPUPerc").and_then(Value::as_str))
            .and_then(|value| value.trim_end_matches('%').parse().ok()),
        memory_used_bytes,
        memory_limit_bytes,
        fps: json_f64(&metrics, "serverfps"),
        uptime_seconds: json_u64(&metrics, "uptime"),
        rest_available: info.is_some() && metrics.is_some(),
    })
}

fn server_snapshot_script() -> String {
    format!(
        "container_id=\"$({COMPOSE_COMMAND} ps -q palworld 2>/dev/null || true)\"; \
         if [ -n \"$container_id\" ]; then \
           paldeck_status=\"$(docker inspect --format '{{{{.State.Status}}}}' \"$container_id\" 2>/dev/null || printf unknown)\"; \
           paldeck_stats=\"$(docker stats --no-stream --format '{{{{json .}}}}' \"$container_id\" 2>/dev/null || true)\"; \
         else paldeck_status=offline; paldeck_stats=''; fi; \
         if [ \"$paldeck_status\" = running ]; then \
           paldeck_info=\"$({COMPOSE_COMMAND} exec -T palworld rest-cli info --no-flush-log 2>/dev/null || true)\"; \
           paldeck_metrics=\"$({COMPOSE_COMMAND} exec -T palworld rest-cli metrics --no-flush-log 2>/dev/null || true)\"; \
         else paldeck_info=''; paldeck_metrics=''; fi; \
         printf 'PALDECK_STATUS=%s\\n' \"$paldeck_status\"; \
         printf 'PALDECK_STATS=%s\\n' \"$(printf %s \"$paldeck_stats\" | base64 | tr -d '\\n')\"; \
         printf 'PALDECK_INFO=%s\\n' \"$(printf %s \"$paldeck_info\" | base64 | tr -d '\\n')\"; \
         printf 'PALDECK_METRICS=%s\\n' \"$(printf %s \"$paldeck_metrics\" | base64 | tr -d '\\n')\""
    )
}

#[tauri::command]
pub async fn online_players(profile: ServerProfile) -> Result<Vec<OnlinePlayer>, String> {
    let command = in_compose_directory(
        &profile,
        &format!("{COMPOSE_COMMAND} exec -T palworld rest-cli players --no-flush-log"),
    )?;
    let result = run_remote(&profile, &command).await?;
    if !result.success {
        return Err(command_error(&result, "无法读取在线玩家"));
    }
    let payload: Value = serde_json::from_str(result.stdout.trim())
        .map_err(|error| format!("玩家接口返回了无效数据：{error}"))?;
    let players = payload
        .get("players")
        .and_then(Value::as_array)
        .ok_or_else(|| "玩家接口缺少 players 数组".to_string())?;
    Ok(players
        .iter()
        .filter_map(|player| {
            let user_id = player.get("userId")?.as_str()?.to_string();
            Some(OnlinePlayer {
                id: user_id,
                player_id: player
                    .get("playerId")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string(),
                name: player
                    .get("name")
                    .and_then(Value::as_str)
                    .unwrap_or("Unknown")
                    .to_string(),
                account_name: player
                    .get("accountName")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string(),
                ping_ms: player.get("ping").and_then(Value::as_f64).unwrap_or(0.0),
                level: player.get("level").and_then(Value::as_u64).unwrap_or(0),
            })
        })
        .collect())
}

#[tauri::command]
pub async fn player_action(
    profile: ServerProfile,
    action: String,
    user_id: Option<String>,
    message: String,
) -> Result<CommandResult, String> {
    if message.len() > 512 || message.contains(['\0', '\n', '\r']) {
        return Err("消息长度或内容无效".into());
    }
    let (api, payload) = match action.as_str() {
        "announce" => {
            if message.trim().is_empty() {
                return Err("广播消息不能为空".into());
            }
            ("announce", serde_json::json!({ "message": message }))
        }
        "kick" | "ban" => {
            let id = user_id.ok_or_else(|| "缺少玩家 ID".to_string())?;
            if id.is_empty()
                || id.len() > 128
                || !id
                    .chars()
                    .all(|character| character.is_ascii_alphanumeric() || "_:-".contains(character))
            {
                return Err("玩家 ID 无效".into());
            }
            (
                action.as_str(),
                serde_json::json!({ "userid": id, "message": message }),
            )
        }
        _ => return Err("不支持的玩家操作".into()),
    };
    let payload = serde_json::to_string(&payload).map_err(|error| error.to_string())?;
    let command = in_compose_directory(
        &profile,
        &format!(
            "{COMPOSE_COMMAND} exec -T palworld rest-cli {api} {} --no-flush-log",
            shell_quote(&payload)
        ),
    )?;
    run_remote(&profile, &command).await
}

#[tauri::command]
pub async fn list_backups(profile: ServerProfile) -> Result<Vec<BackupEntry>, String> {
    let data_guard = data_directory_guard("./.env");
    let script = format!(
        "{data_guard}; backup_dir=\"$paldeck_data_path/backups\"; \
         if [ ! -e \"$backup_dir\" ]; then exit 0; fi; \
         if [ ! -d \"$backup_dir\" ] || [ -L \"$backup_dir\" ]; then \
           printf '备份目录不是安全的普通目录。\\n' >&2; exit 74; fi; \
         find \"$backup_dir\" -maxdepth 1 -type f ! -lname '*' \
           -printf '%T@\\t%s\\t%f\\n' | sort -nr | head -n 100"
    );
    let command = in_compose_directory(&profile, &script)?;
    let result = run_remote(&profile, &command).await?;
    if !result.success {
        return Err(command_error(&result, "无法读取备份列表"));
    }
    result
        .stdout
        .lines()
        .map(|line| {
            let mut fields = line.splitn(3, '\t');
            let modified = fields
                .next()
                .and_then(|value| value.split('.').next())
                .and_then(|value| value.parse().ok())
                .ok_or_else(|| "备份时间格式无效".to_string())?;
            let size_bytes = fields
                .next()
                .and_then(|value| value.parse().ok())
                .ok_or_else(|| "备份大小格式无效".to_string())?;
            let filename = fields.next().ok_or_else(|| "备份名称缺失".to_string())?;
            if filename.is_empty() || filename.contains(['/', '\0', '\n', '\r']) {
                return Err("备份名称无效".into());
            }
            Ok(BackupEntry {
                filename: filename.to_string(),
                modified_unix: modified,
                size_bytes,
            })
        })
        .collect()
}

#[tauri::command]
pub async fn compose_action(
    profile: ServerProfile,
    action: String,
) -> Result<CommandResult, String> {
    let compose_command = match action.as_str() {
        "start" => format!("{COMPOSE_COMMAND} up -d"),
        "stop" => format!("{COMPOSE_COMMAND} down"),
        "restart" => format!("{COMPOSE_COMMAND} restart"),
        "pull" => format!("{COMPOSE_COMMAND} pull"),
        _ => return Err("不支持的 Compose 操作".into()),
    };

    let command = in_compose_directory(&profile, &compose_command)?;
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
        "save" => format!("{COMPOSE_COMMAND} exec -T palworld rest-cli save"),
        "backup" => format!("{COMPOSE_COMMAND} exec -T palworld backup"),
        _ => return Err("不支持的服务器操作".into()),
    };

    let command = in_compose_directory(&profile, &container_command)?;
    run_remote(&profile, &command).await
}

#[tauri::command]
pub async fn read_logs(profile: ServerProfile, tail: Option<u16>) -> Result<CommandResult, String> {
    let lines = tail.unwrap_or(300).clamp(1, 2_000);
    let command = in_compose_directory(
        &profile,
        &format!("{COMPOSE_COMMAND} logs --no-color --timestamps --tail {lines} palworld"),
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
    let data_guard = data_directory_guard("\"$env_tmp\"");
    let script = format!(
        "umask 077; \
         env_tmp=\"$(mktemp -p . .paldeck-env.XXXXXX)\"; \
         backup_tmp=\"$(mktemp -p . .paldeck-backup.XXXXXX)\"; \
         trap 'rm -f -- \"$env_tmp\" \"$backup_tmp\"' EXIT HUP INT TERM; \
         printf %s {} | base64 --decode > \"$env_tmp\"; \
         chmod 600 \"$env_tmp\"; \
         {data_guard}; \
         docker compose --project-directory . --env-file \"$env_tmp\" -f ./compose.yaml config --quiet; \
         if [ -L .env.paldeck.bak ]; then \
           printf '备份路径是符号链接，已拒绝写入。\\n' >&2; exit 74; \
         fi; \
         cp -p -- .env \"$backup_tmp\"; \
         mv -- \"$backup_tmp\" .env.paldeck.bak; \
         mv -- \"$env_tmp\" .env; \
         trap - EXIT HUP INT TERM",
        shell_quote(&encoded),
        data_guard = data_guard,
    );
    let command = in_compose_directory(&profile, &script)?;
    run_remote(&profile, &command).await
}

#[tauri::command]
pub async fn read_world_settings(profile: ServerProfile) -> Result<WorldSettingsOutput, String> {
    let result = read_env(profile).await?;
    if !result.success {
        return Err(command_error(&result, "无法读取世界配置"));
    }
    Ok(WorldSettingsOutput {
        server_name: env_string(&result.stdout, "SERVER_NAME")?,
        server_description: env_string(&result.stdout, "SERVER_DESCRIPTION")?,
        server_password: env_string(&result.stdout, "SERVER_PASSWORD")?,
        max_players: env_parse(&result.stdout, "PLAYERS")?,
        exp_rate: env_parse(&result.stdout, "EXP_RATE")?,
        capture_rate: env_parse(&result.stdout, "PAL_CAPTURE_RATE")?,
        spawn_rate: env_parse(&result.stdout, "PAL_SPAWN_NUM_RATE")?,
        work_speed_rate: env_parse(&result.stdout, "WORK_SPEED_RATE")?,
        egg_hatching_time: env_parse(&result.stdout, "PAL_EGG_DEFAULT_HATCHING_TIME")?,
        death_penalty: env_string(&result.stdout, "DEATH_PENALTY")?,
        pvp: env_bool(&result.stdout, "IS_PVP")?,
        friendly_fire: env_bool(&result.stdout, "ENABLE_FRIENDLY_FIRE")?,
        fast_travel: env_bool(&result.stdout, "ENABLE_FAST_TRAVEL")?,
        allow_client_mod: env_bool(&result.stdout, "ALLOW_CLIENT_MOD")?,
    })
}

#[tauri::command]
pub async fn write_world_settings(
    profile: ServerProfile,
    settings: WorldSettingsInput,
) -> Result<CommandResult, String> {
    validate_world_settings(&settings)?;
    let current = read_env(profile.clone()).await?;
    if !current.success {
        return Err(command_error(&current, "无法读取现有世界配置"));
    }
    let mut contents = current.stdout;
    for (key, value) in [
        ("SERVER_NAME", dotenv_quote(&settings.server_name)),
        (
            "SERVER_DESCRIPTION",
            dotenv_quote(&settings.server_description),
        ),
        ("SERVER_PASSWORD", dotenv_quote(&settings.server_password)),
        ("PLAYERS", settings.max_players.to_string()),
        ("EXP_RATE", format_rate(settings.exp_rate)),
        ("PAL_CAPTURE_RATE", format_rate(settings.capture_rate)),
        ("PAL_SPAWN_NUM_RATE", format_rate(settings.spawn_rate)),
        ("WORK_SPEED_RATE", format_rate(settings.work_speed_rate)),
        (
            "PAL_EGG_DEFAULT_HATCHING_TIME",
            format_rate(settings.egg_hatching_time),
        ),
        ("DEATH_PENALTY", settings.death_penalty.clone()),
        ("IS_PVP", settings.pvp.to_string()),
        ("ENABLE_FRIENDLY_FIRE", settings.friendly_fire.to_string()),
        ("ENABLE_FAST_TRAVEL", settings.fast_travel.to_string()),
        ("ALLOW_CLIENT_MOD", settings.allow_client_mod.to_string()),
    ] {
        set_env_value(&mut contents, key, &value)?;
    }
    write_env(profile, contents).await
}

fn validate_world_settings(settings: &WorldSettingsInput) -> Result<(), String> {
    if settings.server_name.trim().is_empty() || settings.server_name.len() > 128 {
        return Err("服务器名称长度无效".into());
    }
    if settings.server_description.len() > 512 || settings.server_password.len() > 128 {
        return Err("服务器描述或密码过长".into());
    }
    if !(1..=32).contains(&settings.max_players) {
        return Err("玩家数量必须在 1 到 32 之间".into());
    }
    for value in [
        settings.exp_rate,
        settings.capture_rate,
        settings.spawn_rate,
        settings.work_speed_rate,
        settings.egg_hatching_time,
    ] {
        if !value.is_finite() || !(0.0..=10.0).contains(&value) {
            return Err("世界倍率必须在 0 到 10 之间".into());
        }
    }
    if !["None", "Item", "ItemAndEquipment", "All"].contains(&settings.death_penalty.as_str()) {
        return Err("死亡惩罚配置无效".into());
    }
    for value in [
        &settings.server_name,
        &settings.server_description,
        &settings.server_password,
    ] {
        if value.contains(['\0', '\n', '\r']) {
            return Err("世界配置不能包含换行或空字符".into());
        }
    }
    Ok(())
}

fn format_rate(value: f64) -> String {
    format!("{value:.6}")
}

fn env_raw<'a>(contents: &'a str, key: &str) -> Result<&'a str, String> {
    let prefix = format!("{key}=");
    contents
        .lines()
        .find_map(|line| line.strip_prefix(&prefix))
        .ok_or_else(|| format!("环境配置缺少变量 {key}"))
}

fn env_string(contents: &str, key: &str) -> Result<String, String> {
    let value = env_raw(contents, key)?;
    if value.len() >= 2 && value.starts_with('\'') && value.ends_with('\'') {
        Ok(value[1..value.len() - 1].replace("\\'", "'"))
    } else if value.len() >= 2 && value.starts_with('"') && value.ends_with('"') {
        Ok(value[1..value.len() - 1].to_string())
    } else {
        Ok(value.to_string())
    }
}

fn env_parse<T: std::str::FromStr>(contents: &str, key: &str) -> Result<T, String> {
    env_string(contents, key)?
        .parse()
        .map_err(|_| format!("环境配置变量 {key} 的值无效"))
}

fn env_bool(contents: &str, key: &str) -> Result<bool, String> {
    match env_string(contents, key)?.to_ascii_lowercase().as_str() {
        "true" | "1" => Ok(true),
        "false" | "0" => Ok(false),
        _ => Err(format!("环境配置变量 {key} 的布尔值无效")),
    }
}

fn command_error(result: &CommandResult, fallback: &str) -> String {
    if result.stderr.trim().is_empty() {
        fallback.to_string()
    } else {
        result.stderr.trim().to_string()
    }
}

fn decoded_json_value(output: &str, key: &str) -> Option<Value> {
    let encoded = inspection_value(output, key)?;
    if encoded.is_empty() {
        return None;
    }
    let decoded = BASE64_STANDARD.decode(encoded).ok()?;
    serde_json::from_slice(&decoded).ok()
}

fn json_string(value: &Option<Value>, key: &str) -> Option<String> {
    value.as_ref()?.get(key)?.as_str().map(str::to_string)
}

fn json_u64(value: &Option<Value>, key: &str) -> Option<u64> {
    value.as_ref()?.get(key)?.as_u64()
}

fn json_f64(value: &Option<Value>, key: &str) -> Option<f64> {
    let number = value.as_ref()?.get(key)?;
    number
        .as_f64()
        .or_else(|| number.as_u64().map(|value| value as f64))
}

fn parse_memory_usage(value: &str) -> Option<(u64, u64)> {
    let (used, limit) = value.split_once('/')?;
    Some((parse_size(used.trim())?, parse_size(limit.trim())?))
}

fn parse_size(value: &str) -> Option<u64> {
    let split = value
        .find(|character: char| !character.is_ascii_digit() && character != '.')
        .unwrap_or(value.len());
    let number: f64 = value[..split].parse().ok()?;
    let unit = value[split..].trim().to_ascii_lowercase();
    let multiplier = match unit.as_str() {
        "b" | "" => 1.0,
        "kb" => 1_000.0,
        "kib" => 1_024.0,
        "mb" => 1_000_000.0,
        "mib" => 1_048_576.0,
        "gb" => 1_000_000_000.0,
        "gib" => 1_073_741_824.0,
        "tb" => 1_000_000_000_000.0,
        "tib" => 1_099_511_627_776.0,
        _ => return None,
    };
    Some((number * multiplier).round() as u64)
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
    validate_data_directory(&options.data_directory)?;
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

fn validate_data_directory(path: &str) -> Result<(), String> {
    if path.len() <= 2 || path.len() > 512 || !path.starts_with("./") || path.ends_with('/') {
        return Err("游戏数据目录必须是以 ./ 开头的非空相对子目录".into());
    }
    if !path
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || "._-/".contains(character))
    {
        return Err("游戏数据目录只能包含字母、数字、点、横线、下划线和斜杠".into());
    }
    if path[2..]
        .split('/')
        .any(|segment| segment.is_empty() || segment == "." || segment == "..")
    {
        return Err("游戏数据目录不能包含空段、. 或 ..".into());
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
    use super::{
        dotenv_quote, env_bool, env_string, inspection_flag, inspection_value, parse_memory_usage,
        server_snapshot_script, set_env_value, validate_data_directory, validate_world_settings,
    };
    use crate::models::WorldSettingsInput;

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

    #[test]
    fn accepts_safe_custom_data_subdirectories() {
        for path in ["./palworld", "./data/palworld", "./world_data-01"] {
            assert!(validate_data_directory(path).is_ok(), "rejected {path}");
        }
    }

    #[test]
    fn rejects_unsafe_data_directories() {
        for path in [
            "palworld",
            "/srv/palworld",
            "../palworld",
            "./../palworld",
            "./data//palworld",
            "./data/./palworld",
            "./data/",
            "./data dir",
            "./data\\palworld",
        ] {
            assert!(validate_data_directory(path).is_err(), "accepted {path}");
        }
    }

    #[test]
    fn parses_docker_memory_units() {
        assert_eq!(
            parse_memory_usage("512MiB / 2GiB"),
            Some((536_870_912, 2_147_483_648))
        );
    }

    #[test]
    fn reads_only_requested_environment_values() {
        let contents = "SERVER_NAME='Pal Server'\nIS_PVP=false\nADMIN_PASSWORD=secret\n";
        assert_eq!(env_string(contents, "SERVER_NAME").unwrap(), "Pal Server");
        assert!(!env_bool(contents, "IS_PVP").unwrap());
    }

    #[test]
    fn rejects_non_finite_world_rates() {
        let settings = WorldSettingsInput {
            server_name: "Pal Server".into(),
            server_description: String::new(),
            server_password: String::new(),
            max_players: 8,
            exp_rate: f64::NAN,
            capture_rate: 1.0,
            spawn_rate: 1.0,
            work_speed_rate: 1.0,
            egg_hatching_time: 1.0,
            death_penalty: "Item".into(),
            pvp: false,
            friendly_fire: false,
            fast_travel: true,
            allow_client_mod: true,
        };
        assert!(validate_world_settings(&settings).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn server_snapshot_command_has_valid_shell_syntax() {
        let status = std::process::Command::new("sh")
            .args(["-n", "-c", &server_snapshot_script()])
            .status()
            .unwrap();
        assert!(status.success());
    }
}
