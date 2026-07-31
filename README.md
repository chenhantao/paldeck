# Paldeck

English | [简体中文](README.zh-CN.md)

Paldeck is an open-source deployment toolkit and desktop management client for
Palworld dedicated servers. The server runs with Docker Compose, while the
desktop client performs allowlisted management operations over SSH.

> [!IMPORTANT]
> Paldeck is still in early development. The first-time setup flow and basic
> Compose operations use the real backend; dashboard metrics, players,
> backups, and parts of the world settings still use demonstration data.

## Features

- Deploy a Palworld dedicated server with Docker Compose
- Configure common server, network, backup, and world options through `.env`
- Manage servers from a cross-platform Tauri 2, React, and Rust desktop client
- Inspect Linux, amd64, Docker, and Compose during first-time setup
- Reuse an OpenSSH configuration or connect with a server username and password
- Reopen deployments carrying a Paldeck management marker, or safely create a new one
- Validate remote paths and Compose operations against strict allowlists
- Store deployment files in `~/.palworld` for the remote account by default
- Bind the Palworld REST API to the server loopback interface by default

## Repository layout

```text
.
├── .env.example                 # Public server configuration template
├── compose.yaml                 # Palworld Docker Compose service
├── apps/
│   └── desktop/
│       ├── src/                 # React + TypeScript frontend
│       └── src-tauri/           # Tauri/Rust desktop backend
├── .github/                     # CI, issue, and dependency update configuration
└── package.json                 # npm workspace entry point
```

## Deploying the server

The target host must run `x86_64/amd64` Linux and have Docker Engine and the
Docker Compose plugin installed.

```bash
cp .env.example .env
```

Edit `.env` and, at minimum, replace `ADMIN_PASSWORD` with a strong password.
Validate the resolved configuration before deployment:

```bash
docker compose config
```

Start the server after reviewing the result:

```bash
docker compose up -d
```

Server saves, configuration, and backups are stored in the deployment-local
directory selected by `PALWORLD_DATA_DIR` (`./palworld` by default). It must
remain a safe relative subdirectory beneath the deployment root. Git does not
track the default directory.

## Desktop development

Development requires Node.js 22+, npm, stable Rust, and the system
dependencies required by Tauri 2.

```bash
npm install
npm run dev
```

`npm run dev` starts only the browser preview and does not run SSH or Docker
commands. Start the Tauri desktop window with:

```bash
npm run tauri -- dev
```

Only the Tauri desktop runtime invokes the Rust backend and attempts SSH
connections.

On first launch, the desktop client opens the setup wizard:

1. Choose an OpenSSH configuration/key or username-and-password login.
2. For password login, verify the server's SHA256 host-key fingerprint on the
   first connection.
3. Inspect the remote system, architecture, Docker permissions, and Compose
   plugin.
4. Reopen a valid Paldeck-managed deployment, or initialize a directory that
   does not exist or is completely empty.
5. Choose a safe data subdirectory, write the management marker, generate
   `.env`, validate the Compose files, and optionally start the server.

Username-and-password login still uses the SSH protocol. The password remains
only in the current application session and is never written to browser
storage or local configuration. The public server host key and other
non-sensitive connection details may be persisted.

Common checks:

```bash
npm run check
npm run build
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
```

## Downloading development builds

Every push to `develop` triggers unsigned native builds on GitHub-hosted
Windows, macOS, and Linux runners. When the workflow completes, open
**Actions → Development builds → the relevant run → Artifacts** and download:

- `Paldeck-windows-x64-development`: an NSIS installer and portable-preview ZIP
- `Paldeck-macos-arm64-development`: an unsigned Apple Silicon `.app` ZIP
- `Paldeck-linux-x64-development`: AppImage and Debian packages

Development artifacts are retained for 14 days and do not create a GitHub
Release. The Windows portable preview packages the plain Tauri executable; the
target computer still needs Microsoft Edge WebView2 Runtime, and Tauri does
not guarantee a fully portable mode. None of the development packages are
code-signed, so the operating system may display origin or security warnings.

Formal releases will be published separately from version tags on `master`;
development-branch artifacts will not be promoted as releases.

## Security boundaries

- Never commit `.env`, SSH private keys, server addresses, passwords, or real
  game saves.
- The Rust layer validates SSH hosts, password-login parameters, and remote
  paths.
- Password login pins the server public host key after first confirmation and
  rejects later key changes.
- Compose and server operations use fixed allowlists and do not expose an
  arbitrary remote command interface.
- SSH uses batch mode where applicable and enforces connection and operation
  timeouts.
- Initialization writes `.paldeck-managed` only after validation succeeds and
  records the SHA-256 digest of the installed Compose template.
  A non-empty directory without that marker is refused and left untouched.
- Remote paths reject traversal and non-canonical forms. The custom data path
  must start with `./`, remain below the deployment directory, use a restricted
  character set, and must not traverse symbolic links.
- Compose operations explicitly use the managed directory, `.env`, and
  `compose.yaml`. Before every managed operation, Paldeck verifies the recorded
  Compose digest and the resolved `PALWORLD_DATA_DIR` boundary.
- `.env` updates are written to a temporary file, validated through Compose,
  and then replaced atomically.
- Do not expose the Palworld REST API directly to the public internet.

Do not report security issues through a public issue. See
[SECURITY.md](SECURITY.md).

## Contributing

Bug reports, feature proposals, and pull requests are welcome. Read
[CONTRIBUTING.md](CONTRIBUTING.md) and
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before contributing.

## Disclaimer

Paldeck is an unofficial community project and is not affiliated with,
endorsed by, or sponsored by Pocketpair, Inc. Palworld and related names and
materials belong to their respective rights holders.

The application icon uses the official PALWORLD wordmark to identify the
compatible game. The wordmark is not included under this project's MIT
License. See [TRADEMARKS.md](TRADEMARKS.md).

## License

This project is released under the [MIT License](LICENSE).
