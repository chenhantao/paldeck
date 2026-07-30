mod commands;
mod models;
mod remote;

use commands::{
    check_connection, compose_action, initialize_server, inspect_environment, inspect_server,
    probe_connection, read_env, read_logs, server_action, write_env,
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
            compose_action,
            server_action,
            read_logs,
            read_env,
            write_env
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Paldeck");
}
