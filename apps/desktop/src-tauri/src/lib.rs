mod commands;
mod models;
mod remote;

use commands::{
    check_connection, compose_action, initialize_server, inspect_environment, inspect_server,
    list_backups, online_players, player_action, probe_connection, read_env, read_logs,
    read_world_settings, server_action, server_snapshot, write_env, write_world_settings,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            check_connection,
            probe_connection,
            inspect_environment,
            initialize_server,
            inspect_server,
            server_snapshot,
            online_players,
            player_action,
            list_backups,
            compose_action,
            server_action,
            read_logs,
            read_env,
            write_env,
            read_world_settings,
            write_world_settings
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Paldeck");
}
