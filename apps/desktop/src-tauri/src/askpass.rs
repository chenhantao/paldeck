use std::io::{self, Write};

pub const MODE_ENV: &str = "PALDECK_INTERNAL_SSH_ASKPASS";
pub const SECRET_ENV: &str = "PALDECK_INTERNAL_SSH_PASSPHRASE";

pub fn serve_if_requested() -> bool {
    if std::env::var_os(MODE_ENV).as_deref() != Some(std::ffi::OsStr::new("1")) {
        return false;
    }

    if let Ok(passphrase) = std::env::var(SECRET_ENV) {
        let mut stdout = io::stdout().lock();
        let _ = stdout.write_all(passphrase.as_bytes());
        let _ = stdout.write_all(b"\n");
        let _ = stdout.flush();
    }
    true
}
