use crate::commands::credentials::get_credentials;
use serde::Serialize;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{Manager, Url, WebviewUrl, WebviewWindowBuilder};

static SSM_CHILD: Mutex<Option<Child>> = Mutex::new(None);
static SESSION_STATUS: Mutex<SessionStatus> = Mutex::new(SessionStatus::Stopped);

#[derive(Serialize, Clone, PartialEq, Debug)]
#[serde(rename_all = "lowercase")]
pub enum SessionStatus {
    Stopped,
    Starting,
    Running,
    Error,
}

#[tauri::command]
pub fn start_session(instance_id: String) -> Result<(), String> {
    stop_session_static();

    *SESSION_STATUS.lock().unwrap() = SessionStatus::Starting;

    let creds = get_credentials().ok_or("No credentials stored. Please restart the app.")?;

    let mut cmd = Command::new("aws");
    cmd.args([
        "ssm",
        "start-session",
        "--target",
        &instance_id,
        "--document-name",
        "AWS-StartPortForwardingSession",
        "--parameters",
        "portNumber=443,localPortNumber=1443",
    ])
    .env("AWS_ACCESS_KEY_ID", &creds.key_id)
    .env("AWS_SECRET_ACCESS_KEY", &creds.secret)
    .env("AWS_DEFAULT_REGION", &creds.region)
    .stdout(Stdio::null())
    .stderr(Stdio::null());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let child = cmd.spawn().map_err(|e| {
        *SESSION_STATUS.lock().unwrap() = SessionStatus::Error;
        format!("Failed to spawn aws: {}", e)
    })?;

    *SSM_CHILD.lock().unwrap() = Some(child);

    std::thread::spawn(|| {
        for _ in 0..30 {
            std::thread::sleep(std::time::Duration::from_millis(500));

            // Check if process exited unexpectedly
            {
                let mut guard = SSM_CHILD.lock().unwrap();
                if let Some(child) = guard.as_mut() {
                    if let Ok(Some(_)) = child.try_wait() {
                        drop(guard);
                        *SESSION_STATUS.lock().unwrap() = SessionStatus::Error;
                        return;
                    }
                }
            }

            if is_port_open(1443) {
                *SESSION_STATUS.lock().unwrap() = SessionStatus::Running;
                return;
            }
        }
        *SESSION_STATUS.lock().unwrap() = SessionStatus::Error;
    });

    Ok(())
}

fn is_port_open(port: u16) -> bool {
    std::net::TcpStream::connect_timeout(
        &std::net::SocketAddr::from(([127, 0, 0, 1], port)),
        std::time::Duration::from_millis(200),
    )
    .is_ok()
}

pub fn stop_session_static() {
    if let Some(mut child) = SSM_CHILD.lock().unwrap().take() {
        let _ = child.kill();
        let _ = child.wait();
    }
    *SESSION_STATUS.lock().unwrap() = SessionStatus::Stopped;
}

#[tauri::command]
pub fn stop_session() -> Result<(), String> {
    stop_session_static();
    Ok(())
}

#[tauri::command]
pub fn get_session_status() -> SessionStatus {
    // Check if process exited unexpectedly
    let mut guard = SSM_CHILD.lock().unwrap();
    if let Some(child) = guard.as_mut() {
        if let Ok(Some(_)) = child.try_wait() {
            drop(guard);
            stop_session_static();
            return SessionStatus::Error;
        }
    }
    drop(guard);
    SESSION_STATUS.lock().unwrap().clone()
}

#[tauri::command]
pub fn open_forwarded_view(app: tauri::AppHandle) -> Result<(), String> {
    // Close existing window if open
    if let Some(w) = app.get_webview_window("forwarded-view") {
        let _ = w.close();
    }

    let url: Url = "https://localhost:1443".parse().unwrap();

    WebviewWindowBuilder::new(&app, "forwarded-view", WebviewUrl::External(url))
        .title("localhost:1443")
        .inner_size(1280.0, 900.0)
        .center()
        .additional_browser_args("--ignore-certificate-errors --unsafely-treat-insecure-origin-as-secure=https://localhost:1443")
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serial_test::serial;

    #[test]
    fn session_status_serializes_to_lowercase() {
        assert_eq!(serde_json::to_string(&SessionStatus::Stopped).unwrap(), "\"stopped\"");
        assert_eq!(serde_json::to_string(&SessionStatus::Starting).unwrap(), "\"starting\"");
        assert_eq!(serde_json::to_string(&SessionStatus::Running).unwrap(), "\"running\"");
        assert_eq!(serde_json::to_string(&SessionStatus::Error).unwrap(), "\"error\"");
    }

    #[test]
    fn session_status_equality() {
        assert_eq!(SessionStatus::Stopped, SessionStatus::Stopped);
        assert_ne!(SessionStatus::Running, SessionStatus::Stopped);
        assert_ne!(SessionStatus::Starting, SessionStatus::Error);
    }

    #[test]
    fn session_status_clone() {
        let s = SessionStatus::Running;
        assert_eq!(s.clone(), SessionStatus::Running);
    }

    #[test]
    fn is_port_open_returns_false_for_unused_port() {
        assert!(!is_port_open(19997));
    }

    #[test]
    fn is_port_open_returns_true_when_listener_present() {
        use std::net::TcpListener;
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        assert!(is_port_open(port));
    }

    #[test]
    #[serial]
    fn get_session_status_returns_stopped_after_reset() {
        stop_session_static();
        assert_eq!(get_session_status(), SessionStatus::Stopped);
    }

    #[test]
    #[serial]
    fn get_session_status_reflects_running_when_set() {
        stop_session_static();
        *SESSION_STATUS.lock().unwrap() = SessionStatus::Running;
        assert_eq!(get_session_status(), SessionStatus::Running);
        stop_session_static();
    }

    #[test]
    #[serial]
    fn stop_session_static_resets_running_to_stopped() {
        *SESSION_STATUS.lock().unwrap() = SessionStatus::Running;
        stop_session_static();
        assert_eq!(SESSION_STATUS.lock().unwrap().clone(), SessionStatus::Stopped);
    }

    #[test]
    #[serial]
    fn get_session_status_detects_exited_child_as_error() {
        stop_session_static();
        *SESSION_STATUS.lock().unwrap() = SessionStatus::Starting;

        // Spawn a process that exits immediately
        let child = std::process::Command::new("cmd")
            .args(["/c", "exit", "0"])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
            .expect("failed to spawn cmd");

        *SSM_CHILD.lock().unwrap() = Some(child);

        // Wait until child has exited
        std::thread::sleep(std::time::Duration::from_millis(200));

        assert_eq!(get_session_status(), SessionStatus::Error);
        stop_session_static();
    }
}
