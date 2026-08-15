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

const WORLD_SETTING_DEFAULTS: &[(&str, &str)] = &[
    ("SERVER_NAME", "My Palworld Server"),
    ("SERVER_DESCRIPTION", "Private Palworld dedicated server"),
    ("SERVER_PASSWORD", ""),
    ("PLAYERS", "8"),
    ("REGION", ""),
    ("CROSSPLAY_PLATFORMS", "(Steam,Xbox,PS5,Mac)"),
    ("DIFFICULTY", "None"),
    ("RANDOMIZER_TYPE", ""),
    ("RANDOMIZER_SEED", "none"),
    ("DAYTIME_SPEEDRATE", "1.000000"),
    ("NIGHTTIME_SPEEDRATE", "1.000000"),
    ("EXP_RATE", "1.000000"),
    ("PAL_CAPTURE_RATE", "1.000000"),
    ("PAL_SPAWN_NUM_RATE", "1.000000"),
    ("PAL_DAMAGE_RATE_ATTACK", "1.000000"),
    ("PAL_DAMAGE_RATE_DEFENSE", "1.000000"),
    ("PLAYER_DAMAGE_RATE_ATTACK", "1.000000"),
    ("PLAYER_DAMAGE_RATE_DEFENSE", "1.000000"),
    ("PLAYER_STOMACH_DECREASE_RATE", "1.000000"),
    ("PLAYER_STAMINA_DECREASE_RATE", "1.000000"),
    ("PLAYER_AUTO_HP_REGEN_RATE", "1.000000"),
    ("PLAYER_AUTO_HP_REGEN_RATE_IN_SLEEP", "1.000000"),
    ("PAL_STOMACH_DECREASE_RATE", "1.000000"),
    ("PAL_STAMINA_DECREASE_RATE", "1.000000"),
    ("PAL_AUTO_HP_REGEN_RATE", "1.000000"),
    ("PAL_AUTO_HP_REGEN_RATE_IN_SLEEP", "1.000000"),
    ("BUILD_OBJECT_HP_RATE", "1.000000"),
    ("BUILD_OBJECT_DAMAGE_RATE", "1.000000"),
    ("BUILD_OBJECT_DETERIORATION_DAMAGE_RATE", "1.000000"),
    ("COLLECTION_DROP_RATE", "1.000000"),
    ("COLLECTION_OBJECT_HP_RATE", "1.000000"),
    ("COLLECTION_OBJECT_RESPAWN_SPEED_RATE", "1.000000"),
    ("ENEMY_DROP_ITEM_RATE", "1.000000"),
    ("DEATH_PENALTY", "Item"),
    ("ENABLE_PLAYER_TO_PLAYER_DAMAGE", "false"),
    ("ENABLE_FRIENDLY_FIRE", "false"),
    ("ENABLE_INVADER_ENEMY", "true"),
    ("ACTIVE_UNKO", "false"),
    ("ENABLE_AIM_ASSIST_PAD", "true"),
    ("ENABLE_AIM_ASSIST_KEYBOARD", "false"),
    ("DROP_ITEM_MAX_NUM", "3000"),
    ("DROP_ITEM_MAX_NUM_UNKO", "100"),
    ("BASE_CAMP_MAX_NUM", "128"),
    ("BASE_CAMP_WORKER_MAX_NUM", "15"),
    ("DROP_ITEM_ALIVE_MAX_HOURS", "1.000000"),
    ("AUTO_RESET_GUILD_NO_ONLINE_PLAYERS", "false"),
    ("AUTO_RESET_GUILD_TIME_NO_ONLINE_PLAYERS", "72.000000"),
    ("GUILD_PLAYER_MAX_NUM", "20"),
    ("BASE_CAMP_MAX_NUM_IN_GUILD", "4"),
    ("PAL_EGG_DEFAULT_HATCHING_TIME", "1.000000"),
    ("WORK_SPEED_RATE", "1.000000"),
    ("AUTO_SAVE_SPAN", "30.000000"),
    ("IS_MULTIPLAY", "true"),
    ("IS_PVP", "false"),
    ("HARDCORE", "false"),
    ("PAL_LOST", "false"),
    ("CAN_PICKUP_OTHER_GUILD_DEATH_PENALTY_DROP", "false"),
    ("ENABLE_NON_LOGIN_PENALTY", "true"),
    ("ENABLE_FAST_TRAVEL", "true"),
    ("IS_START_LOCATION_SELECT_BY_MAP", "true"),
    ("EXIST_PLAYER_AFTER_LOGOUT", "false"),
    ("ENABLE_DEFENSE_OTHER_GUILD_PLAYER", "false"),
    ("INVISIBLE_OTHER_GUILD_BASE_CAMP_AREA_FX", "false"),
    ("BUILD_AREA_LIMIT", "false"),
    ("ITEM_WEIGHT_RATE", "1.000000"),
    ("COOP_PLAYER_MAX_NUM", "4"),
    ("USEAUTH", "true"),
    (
        "BAN_LIST_URL",
        "https://api.palworldgame.com/api/banlist.txt",
    ),
    ("SHOW_PLAYER_LIST", "true"),
    ("ENABLE_PREDATOR_BOSS_PAL", "true"),
    ("MAX_BUILDING_LIMIT_NUM", "0"),
    ("SERVER_REPLICATE_PAWN_CULL_DISTANCE", "15000.000000"),
    (
        "SERVER_REPLICATE_PAWN_CULL_DISTANCE_IN_BASE_CAMP",
        "5000.000000",
    ),
    ("USE_BACKUP_SAVE_DATA", "true"),
    ("ALLOW_CLIENT_MOD", "true"),
    ("ALLOW_GLOBAL_PALBOX_EXPORT", "true"),
    ("ALLOW_GLOBAL_PALBOX_IMPORT", "false"),
    ("EQUIPMENT_DURABILITY_DAMAGE_RATE", "1.000000"),
    ("ITEM_CONTAINER_FORCE_MARK_DIRTY_INTERVAL", "1.000000"),
];

const STRING_WORLD_SETTINGS: &[&str] = &[
    "SERVER_NAME",
    "SERVER_DESCRIPTION",
    "SERVER_PASSWORD",
    "REGION",
    "CROSSPLAY_PLATFORMS",
    "RANDOMIZER_SEED",
    "BAN_LIST_URL",
];

const BOOL_WORLD_SETTINGS: &[&str] = &[
    "ENABLE_PLAYER_TO_PLAYER_DAMAGE",
    "ENABLE_FRIENDLY_FIRE",
    "ENABLE_INVADER_ENEMY",
    "ACTIVE_UNKO",
    "ENABLE_AIM_ASSIST_PAD",
    "ENABLE_AIM_ASSIST_KEYBOARD",
    "AUTO_RESET_GUILD_NO_ONLINE_PLAYERS",
    "IS_MULTIPLAY",
    "IS_PVP",
    "HARDCORE",
    "PAL_LOST",
    "CAN_PICKUP_OTHER_GUILD_DEATH_PENALTY_DROP",
    "ENABLE_NON_LOGIN_PENALTY",
    "ENABLE_FAST_TRAVEL",
    "IS_START_LOCATION_SELECT_BY_MAP",
    "EXIST_PLAYER_AFTER_LOGOUT",
    "ENABLE_DEFENSE_OTHER_GUILD_PLAYER",
    "INVISIBLE_OTHER_GUILD_BASE_CAMP_AREA_FX",
    "BUILD_AREA_LIMIT",
    "USEAUTH",
    "SHOW_PLAYER_LIST",
    "ENABLE_PREDATOR_BOSS_PAL",
    "USE_BACKUP_SAVE_DATA",
    "ALLOW_CLIENT_MOD",
    "ALLOW_GLOBAL_PALBOX_EXPORT",
    "ALLOW_GLOBAL_PALBOX_IMPORT",
];

const INTEGER_WORLD_SETTINGS: &[&str] = &[
    "PLAYERS",
    "DROP_ITEM_MAX_NUM",
    "DROP_ITEM_MAX_NUM_UNKO",
    "BASE_CAMP_MAX_NUM",
    "BASE_CAMP_WORKER_MAX_NUM",
    "GUILD_PLAYER_MAX_NUM",
    "BASE_CAMP_MAX_NUM_IN_GUILD",
    "COOP_PLAYER_MAX_NUM",
    "MAX_BUILDING_LIMIT_NUM",
];

const NUMBER_WORLD_SETTINGS: &[&str] = &[
    "DAYTIME_SPEEDRATE",
    "NIGHTTIME_SPEEDRATE",
    "EXP_RATE",
    "PAL_CAPTURE_RATE",
    "PAL_SPAWN_NUM_RATE",
    "PAL_DAMAGE_RATE_ATTACK",
    "PAL_DAMAGE_RATE_DEFENSE",
    "PLAYER_DAMAGE_RATE_ATTACK",
    "PLAYER_DAMAGE_RATE_DEFENSE",
    "PLAYER_STOMACH_DECREASE_RATE",
    "PLAYER_STAMINA_DECREASE_RATE",
    "PLAYER_AUTO_HP_REGEN_RATE",
    "PLAYER_AUTO_HP_REGEN_RATE_IN_SLEEP",
    "PAL_STOMACH_DECREASE_RATE",
    "PAL_STAMINA_DECREASE_RATE",
    "PAL_AUTO_HP_REGEN_RATE",
    "PAL_AUTO_HP_REGEN_RATE_IN_SLEEP",
    "BUILD_OBJECT_HP_RATE",
    "BUILD_OBJECT_DAMAGE_RATE",
    "BUILD_OBJECT_DETERIORATION_DAMAGE_RATE",
    "COLLECTION_DROP_RATE",
    "COLLECTION_OBJECT_HP_RATE",
    "COLLECTION_OBJECT_RESPAWN_SPEED_RATE",
    "ENEMY_DROP_ITEM_RATE",
    "DROP_ITEM_ALIVE_MAX_HOURS",
    "AUTO_RESET_GUILD_TIME_NO_ONLINE_PLAYERS",
    "PAL_EGG_DEFAULT_HATCHING_TIME",
    "WORK_SPEED_RATE",
    "AUTO_SAVE_SPAN",
    "ITEM_WEIGHT_RATE",
    "SERVER_REPLICATE_PAWN_CULL_DISTANCE",
    "SERVER_REPLICATE_PAWN_CULL_DISTANCE_IN_BASE_CAMP",
    "EQUIPMENT_DURABILITY_DAMAGE_RATE",
    "ITEM_CONTAINER_FORCE_MARK_DIRTY_INTERVAL",
];

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
               ! -name {marker} ! -name compose.yaml ! -name compose.yaml.paldeck.bak \
               ! -name .env ! -name .env.paldeck.bak \
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
    validate_player_message(&message)?;
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

fn validate_player_message(message: &str) -> Result<(), String> {
    if message.chars().count() > 512 || message.contains(['\0', '\n', '\r']) {
        return Err("消息长度或内容无效".into());
    }
    Ok(())
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
        // Recreate the container so changes written to .env are applied.
        "restart" => format!("{COMPOSE_COMMAND} up -d --force-recreate"),
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
        "save" => save_world_script(),
        "backup" => format!("{COMPOSE_COMMAND} exec -T palworld backup"),
        _ => return Err("不支持的服务器操作".into()),
    };

    let command = in_compose_directory(&profile, &container_command)?;
    run_remote(&profile, &command).await
}

fn save_world_script() -> String {
    let data_guard = data_directory_guard("./.env");
    format!(
        "{data_guard}; \
         save_root=\"$paldeck_data_path/Pal/Saved/SaveGames\"; \
         save_state() {{ \
           if [ ! -d \"$save_root\" ] || [ -L \"$save_root\" ]; then return 0; fi; \
           resolved_save_root=\"$(realpath -e -- \"$save_root\" 2>/dev/null || true)\"; \
           case \"$resolved_save_root\" in \"$paldeck_data_path\"/*) ;; *) return 0 ;; esac; \
           find \"$resolved_save_root\" -maxdepth 3 -type f -name Level.sav \
             -exec stat -c '%n:%y:%s' -- {{}} + 2>/dev/null | sort; \
         }}; \
         before=\"$(save_state)\"; \
         set +e; \
         save_output=\"$({COMPOSE_COMMAND} exec -T palworld rest-cli save --no-flush-log 2>&1)\"; \
         save_exit=$?; set -e; \
         if [ \"$save_exit\" -ne 0 ]; then \
           printf '%s\\n' \"$save_output\" >&2; exit \"$save_exit\"; \
         fi; \
         verified=0; after=\"$(save_state)\"; attempts=0; \
         while [ -n \"$before\" ] && [ \"$after\" = \"$before\" ] && [ \"$attempts\" -lt 10 ]; do \
           sleep 1; attempts=$((attempts + 1)); after=\"$(save_state)\"; \
         done; \
         if [ -n \"$before\" ] && [ \"$after\" = \"$before\" ]; then \
           printf 'REST API 已接受保存请求，但未检测到 Level.sav 更新。\\n' >&2; exit 75; \
         fi; \
         if [ -n \"$before\" ] && [ -n \"$after\" ]; then verified=1; fi; \
         printf '%s\\nPALDECK_SAVE_VERIFIED=%s\\n' \"$save_output\" \"$verified\""
    )
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

async fn upgrade_compose_template(profile: ServerProfile) -> Result<(), String> {
    let script = upgrade_compose_script();
    let command = in_compose_directory(&profile, &script)?;
    let result = run_remote(&profile, &command).await?;
    if !result.success {
        return Err(command_error(&result, "无法升级 Paldeck Compose 模板"));
    }
    Ok(())
}

fn upgrade_compose_script() -> String {
    let compose_hash = compose_template_hash();
    let compose_encoded = BASE64_STANDARD.encode(COMPOSE_TEMPLATE.as_bytes());
    format!(
        "if grep -Fqx {expected_hash} {marker}; then exit 0; fi; \
         umask 077; \
         compose_tmp=\"$(mktemp -p . .paldeck-compose-upgrade.XXXXXX)\"; \
         marker_tmp=\"$(mktemp -p . .paldeck-marker-upgrade.XXXXXX)\"; \
         compose_backup=\"$(mktemp -p . .paldeck-compose-backup.XXXXXX)\"; \
         marker_backup=\"$(mktemp -p . .paldeck-marker-backup.XXXXXX)\"; \
         backup_ready=0; upgraded=0; \
         rollback() {{ \
           if [ \"$backup_ready\" = 1 ] && [ \"$upgraded\" != 1 ]; then \
             cp -p -- \"$compose_backup\" ./compose.yaml 2>/dev/null || true; \
             cp -p -- \"$marker_backup\" {marker} 2>/dev/null || true; \
           fi; \
           rm -f -- \"$compose_tmp\" \"$marker_tmp\" \"$compose_backup\" \"$marker_backup\"; \
         }}; \
         trap rollback EXIT HUP INT TERM; \
         cp -p -- ./compose.yaml \"$compose_backup\"; \
         cp -p -- {marker} \"$marker_backup\"; \
         backup_ready=1; \
         printf %s {compose} | base64 --decode > \"$compose_tmp\"; \
         printf '%s\\nCOMPOSE_SHA256=%s\\n' {marker_content} {hash} > \"$marker_tmp\"; \
         docker compose --project-directory . --env-file ./.env -f \"$compose_tmp\" config --quiet; \
         if [ -L ./compose.yaml.paldeck.bak ]; then \
           printf 'Compose 备份路径是符号链接，已拒绝升级。\\n' >&2; exit 74; \
         fi; \
         cp -p -- ./compose.yaml ./compose.yaml.paldeck.bak; \
         mv -- \"$compose_tmp\" ./compose.yaml; \
         mv -- \"$marker_tmp\" {marker}; \
         upgraded=1; \
         trap - EXIT HUP INT TERM; \
         rm -f -- \"$compose_backup\" \"$marker_backup\"",
        expected_hash = shell_quote(&format!("COMPOSE_SHA256={compose_hash}")),
        marker = shell_quote(MANAGED_MARKER_FILE),
        compose = shell_quote(&compose_encoded),
        marker_content = shell_quote(MANAGED_MARKER_CONTENT),
        hash = shell_quote(&compose_hash),
    )
}

#[tauri::command]
pub async fn read_world_settings(profile: ServerProfile) -> Result<WorldSettingsOutput, String> {
    let result = read_env(profile).await?;
    if !result.success {
        return Err(command_error(&result, "无法读取世界配置"));
    }
    let values = WORLD_SETTING_DEFAULTS
        .iter()
        .map(|(key, default)| {
            let value =
                env_string_optional(&result.stdout, key).unwrap_or_else(|| default.to_string());
            ((*key).to_string(), value)
        })
        .collect();
    Ok(WorldSettingsOutput { values })
}

#[tauri::command]
pub async fn write_world_settings(
    profile: ServerProfile,
    settings: WorldSettingsInput,
) -> Result<CommandResult, String> {
    validate_world_settings(&settings)?;
    upgrade_compose_template(profile.clone()).await?;
    let current = read_env(profile.clone()).await?;
    if !current.success {
        return Err(command_error(&current, "无法读取现有世界配置"));
    }
    let mut contents = current.stdout;
    for (key, _) in WORLD_SETTING_DEFAULTS {
        let value = settings
            .values
            .get(*key)
            .ok_or_else(|| format!("世界配置缺少变量 {key}"))?;
        upsert_env_value(&mut contents, key, &world_setting_env_value(key, value));
    }
    write_env(profile, contents).await
}

fn validate_world_settings(settings: &WorldSettingsInput) -> Result<(), String> {
    if settings.values.len() != WORLD_SETTING_DEFAULTS.len() {
        return Err("世界配置变量数量不正确".into());
    }
    for (key, _) in WORLD_SETTING_DEFAULTS {
        let value = settings
            .values
            .get(*key)
            .ok_or_else(|| format!("世界配置缺少变量 {key}"))?;
        validate_world_setting(key, value)?;
    }
    if settings.values.keys().any(|key| {
        !WORLD_SETTING_DEFAULTS
            .iter()
            .any(|(allowed, _)| key == allowed)
    }) {
        return Err("世界配置包含不受支持的变量".into());
    }
    Ok(())
}

fn validate_world_setting(key: &str, value: &str) -> Result<(), String> {
    if value.len() > 512 || value.contains(['\0', '\n', '\r']) {
        return Err(format!("世界配置变量 {key} 的长度或内容无效"));
    }
    if BOOL_WORLD_SETTINGS.contains(&key) {
        if !matches!(value.to_ascii_lowercase().as_str(), "true" | "false") {
            return Err(format!("世界配置变量 {key} 必须为 true 或 false"));
        }
    } else if INTEGER_WORLD_SETTINGS.contains(&key) {
        let number: u64 = value
            .parse()
            .map_err(|_| format!("世界配置变量 {key} 必须为非负整数"))?;
        if number > 1_000_000 {
            return Err(format!("世界配置变量 {key} 超出允许范围"));
        }
    } else if NUMBER_WORLD_SETTINGS.contains(&key) {
        let number: f64 = value
            .parse()
            .map_err(|_| format!("世界配置变量 {key} 必须为数字"))?;
        if !number.is_finite() || !(0.0..=1_000_000.0).contains(&number) {
            return Err(format!("世界配置变量 {key} 超出允许范围"));
        }
    }
    match key {
        "SERVER_NAME" if value.trim().is_empty() || value.chars().count() > 128 => {
            return Err("服务器名称长度无效".into());
        }
        "SERVER_PASSWORD" if value.chars().count() > 128 => {
            return Err("服务器密码不能超过 128 个字符".into());
        }
        "PLAYERS" if !(1..=32).contains(&value.parse::<u64>().unwrap_or_default()) => {
            return Err("玩家数量必须在 1 到 32 之间".into());
        }
        "BASE_CAMP_WORKER_MAX_NUM"
            if !(1..=50).contains(&value.parse::<u64>().unwrap_or_default()) =>
        {
            return Err("每个基地的帕鲁数量必须在 1 到 50 之间".into());
        }
        "BASE_CAMP_MAX_NUM_IN_GUILD"
            if !(1..=10).contains(&value.parse::<u64>().unwrap_or_default()) =>
        {
            return Err("每个公会的基地数量必须在 1 到 10 之间".into());
        }
        "DEATH_PENALTY" if !["None", "Item", "ItemAndEquipment", "All"].contains(&value) => {
            return Err("死亡惩罚配置无效".into());
        }
        "DIFFICULTY" if !["None", "Normal", "Difficult"].contains(&value) => {
            return Err("难度配置无效".into());
        }
        "RANDOMIZER_TYPE" if !["", "None", "Region", "All"].contains(&value) => {
            return Err("随机化配置无效".into());
        }
        "CROSSPLAY_PLATFORMS"
            if value.is_empty()
                || !value.chars().all(|character| {
                    character.is_ascii_alphanumeric() || "(),".contains(character)
                }) =>
        {
            return Err("跨平台配置无效".into());
        }
        _ => {}
    }
    Ok(())
}

fn world_setting_env_value(key: &str, value: &str) -> String {
    if STRING_WORLD_SETTINGS.contains(&key) {
        dotenv_quote(value)
    } else {
        value.to_string()
    }
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

fn env_string_optional(contents: &str, key: &str) -> Option<String> {
    env_string(contents, key).ok()
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

fn upsert_env_value(contents: &mut String, key: &str, value: &str) {
    if set_env_value(contents, key, value).is_ok() {
        return;
    }
    if !contents.ends_with('\n') {
        contents.push('\n');
    }
    contents.push_str(&format!("{key}={value}\n"));
}

#[cfg(test)]
mod tests {
    use super::{
        dotenv_quote, env_string, inspection_flag, inspection_value, parse_memory_usage,
        save_world_script, server_snapshot_script, set_env_value, upgrade_compose_script,
        validate_data_directory, validate_player_message, validate_world_settings,
        COMPOSE_TEMPLATE, ENV_TEMPLATE, WORLD_SETTING_DEFAULTS,
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
        assert_eq!(env_string(contents, "IS_PVP").unwrap(), "false");
    }

    #[test]
    fn rejects_non_finite_world_rates() {
        let mut values = WORLD_SETTING_DEFAULTS
            .iter()
            .map(|(key, value)| ((*key).to_string(), (*value).to_string()))
            .collect::<std::collections::BTreeMap<_, _>>();
        values.insert("EXP_RATE".into(), "NaN".into());
        let settings = WorldSettingsInput { values };
        assert!(validate_world_settings(&settings).is_err());
    }

    #[test]
    fn world_setting_defaults_match_public_templates() {
        let values = WORLD_SETTING_DEFAULTS
            .iter()
            .map(|(key, value)| ((*key).to_string(), (*value).to_string()))
            .collect::<std::collections::BTreeMap<_, _>>();
        let validation = validate_world_settings(&WorldSettingsInput { values });
        assert!(validation.is_ok(), "{validation:?}");
        for (key, _) in WORLD_SETTING_DEFAULTS {
            assert!(
                ENV_TEMPLATE
                    .lines()
                    .any(|line| line.starts_with(&format!("{key}="))),
                ".env.example is missing {key}"
            );
            assert!(
                COMPOSE_TEMPLATE.contains(&format!("      {key}:")),
                "compose.yaml is missing {key}"
            );
        }
    }

    #[test]
    fn validates_broadcast_messages_by_character_count() {
        assert!(validate_player_message(&"帕".repeat(512)).is_ok());
        assert!(validate_player_message(&"帕".repeat(513)).is_err());
        assert!(validate_player_message("line one\nline two").is_err());
    }

    #[cfg(unix)]
    #[test]
    fn server_snapshot_command_has_valid_shell_syntax() {
        for script in [
            server_snapshot_script(),
            save_world_script(),
            upgrade_compose_script(),
        ] {
            let status = std::process::Command::new("sh")
                .args(["-n", "-c", &script])
                .status()
                .unwrap();
            assert!(status.success());
        }
    }

    #[test]
    fn save_world_preserves_rest_cli_failures() {
        let script = save_world_script();
        assert!(script.contains("save_exit=$?"));
        assert!(script.contains("exit \"$save_exit\""));
        assert!(script.contains("PALDECK_SAVE_VERIFIED=%s"));
    }
}
