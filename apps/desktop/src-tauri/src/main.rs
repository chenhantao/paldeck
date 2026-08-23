#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if paldeck_lib::serve_ssh_askpass() {
        return;
    }
    paldeck_lib::run();
}
