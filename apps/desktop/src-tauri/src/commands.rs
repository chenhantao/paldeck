use std::time::Duration;

use base64::prelude::{Engine as _, BASE64_STANDARD};

use crate::models::{
    CommandResult, ConnectionProbe, EnvironmentInspection, InitializationOptions, ServerProfile,
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
        &format!("{COMPOSE_COMMAND} logs --no-color --tail {lines} palworld"),
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
        dotenv_quote, inspection_flag, inspection_value, set_env_value, validate_data_directory,
    };

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
}
