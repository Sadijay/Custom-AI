use std::process::Command;

#[tauri::command]
fn open_app(name: &str) -> Result<String, String> {
    match Command::new("cmd")
        .args(["/C", "start", "", name])
        .spawn() {
        Ok(_) => Ok(format!("Successfully opened {}", name)),
        Err(e) => Err(format!("Failed to open {}: {}", name, e)),
    }
}

#[tauri::command]
fn close_app(name: &str) -> Result<String, String> {
    let mut exe_name = name.to_string();
    if !exe_name.ends_with(".exe") && !exe_name.ends_with(".msix") {
        exe_name.push_str(".exe");
    }
    match Command::new("taskkill")
        .args(["/F", "/IM", &exe_name])
        .output() {
        Ok(out) => {
            if out.status.success() {
                Ok(format!("Successfully closed {}", name))
            } else {
                Err(format!("Failed to find or close {}", name))
            }
        },
        Err(e) => Err(format!("Error closing app: {}", e)),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--minimized"])))
        .invoke_handler(tauri::generate_handler![open_app, close_app])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
