// Job OS desktop shell (Phase 12, Tauri v2). Wraps the Next.js UI in a native
// macOS window. In production builds it spawns the Next.js standalone server
// as a child process and waits for :3000 before showing the window.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::net::TcpStream;
use std::process::{Command, Stdio};
use std::thread;
use std::time::Duration;

/// Poll localhost until the Next.js server accepts connections.
fn wait_for_port(port: u16, attempts: u32) -> bool {
    for _ in 0..attempts {
        if TcpStream::connect(("127.0.0.1", port)).is_ok() {
            return true;
        }
        thread::sleep(Duration::from_millis(500));
    }
    false
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(not(debug_assertions))]
            {
                if let Ok(resource_dir) = app.path().resource_dir() {
                    let server_dir = resource_dir.join("standalone");
                    let server_js = server_dir.join("server.js");
                    if server_js.exists() {
                        let _child = Command::new("node")
                            .arg("server.js")
                            .current_dir(&server_dir)
                            .env("PORT", "3000")
                            .env("HOSTNAME", "127.0.0.1")
                            .env("JOB_OS_DESKTOP", "1")
                            .stdout(Stdio::null())
                            .stderr(Stdio::null())
                            .spawn();

                        if !wait_for_port(3000, 60) {
                            eprintln!("Job OS: Next.js sidecar failed to start on :3000");
                        }
                    } else {
                        eprintln!(
                            "Job OS: standalone server missing at {}",
                            server_js.display()
                        );
                    }
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the Job OS desktop shell");
}
