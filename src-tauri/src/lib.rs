mod commands;
use commands::{aws_install, credentials, instances, session};

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            aws_install::check_dependencies,
            aws_install::install_aws_cli,
            aws_install::install_ssm_plugin,
            credentials::save_credentials,
            credentials::load_credentials,
            instances::load_instances,
            instances::get_instances_file_path,
            session::start_session,
            session::stop_session,
            session::get_session_status,
            session::open_forwarded_view,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if window.label() == "main" {
                    session::stop_session_static();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
