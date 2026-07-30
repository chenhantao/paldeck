mod commands;
mod models;
mod remote;

use commands::{
    check_connection, compose_action, inspect_server, read_env, read_logs, server_action, write_env,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            check_connection,
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
