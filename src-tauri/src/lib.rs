use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WebviewUrl, WebviewWindowBuilder,
};

const KEYCHAIN_SERVICE: &str = "bozz";

#[tauri::command]
fn secret_set(account: String, value: String) -> Result<(), String> {
    keyring::Entry::new(KEYCHAIN_SERVICE, &account)
        .map_err(|e| e.to_string())?
        .set_password(&value)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn secret_get(account: String) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(KEYCHAIN_SERVICE, &account).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(s) => Ok(Some(s)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn secret_delete(account: String) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYCHAIN_SERVICE, &account).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

/// Loopback OAuth listener.
///
/// Binds a localhost port (random when `port` is `None`, fixed otherwise),
/// emits `oauth:port` so the webview can build the redirect URI, then blocks
/// (with timeout) waiting for the provider to redirect back.
/// Returns the parsed query string.
#[tauri::command]
async fn oauth_run(app: tauri::AppHandle, port: Option<u16>) -> Result<std::collections::HashMap<String, String>, String> {
    use std::collections::HashMap;
    use std::time::Duration;
    use tiny_http::{Header, Response, Server};

    let addr = format!("127.0.0.1:{}", port.unwrap_or(0));
    let server = Server::http(addr).map_err(|e| e.to_string())?;
    let port = match server.server_addr() {
        tiny_http::ListenAddr::IP(a) => a.port(),
    };
    app.emit("oauth:port", port).map_err(|e| e.to_string())?;

    let req = server
        .recv_timeout(Duration::from_secs(300))
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "OAuth timed out".to_string())?;

    let url = req.url().to_string();
    let html = "<html><body style=\"font-family:system-ui;padding:40px;color:#333\">\
                <h2>Connected.</h2><p>You can close this tab and return to Bozz.</p>\
                </body></html>";
    let _ = req.respond(
        Response::from_string(html)
            .with_header(Header::from_bytes(&b"Content-Type"[..], &b"text/html; charset=utf-8"[..]).unwrap()),
    );

    let parsed = url::Url::parse(&format!("http://127.0.0.1{url}")).map_err(|e| e.to_string())?;
    let mut out: HashMap<String, String> = HashMap::new();
    for (k, v) in parsed.query_pairs() {
        out.insert(k.into_owned(), v.into_owned());
    }
    Ok(out)
}

/// Fetch the most recent inbox messages over IMAP/TLS.
/// Runs on a blocking thread (IMAP is synchronous I/O).
#[tauri::command]
fn imap_fetch(
    host: String,
    port: u16,
    username: String,
    password: String,
) -> Result<Vec<serde_json::Value>, String> {
    use native_tls::TlsConnector;

    let tls = TlsConnector::new().map_err(|e| format!("TLS build failed: {e}"))?;

    let client = imap::connect((host.as_str(), port), &host, &tls)
        .map_err(|e| format!("IMAP connect failed: {e}"))?;

    let mut session = client
        .login(&username, &password)
        .map_err(|(e, _)| format!("Login failed: {e}"))?;

    let mailbox = session.select("INBOX").map_err(|e| e.to_string())?;
    let total = mailbox.exists;

    if total == 0 {
        let _ = session.logout();
        return Ok(vec![]);
    }

    // Fetch the last 30 messages (newest = highest sequence numbers)
    let start = total.saturating_sub(29).max(1);
    let seq = format!("{start}:{total}");

    let messages = session
        .fetch(&seq, "(FLAGS ENVELOPE INTERNALDATE)")
        .map_err(|e| e.to_string())?;

    let mut results: Vec<serde_json::Value> = Vec::new();

    for msg in messages.iter().rev() {
        let flags = msg.flags();
        let unread = !flags.iter().any(|f| *f == imap::types::Flag::Seen);

        // INTERNALDATE → unix ms
        let date_ms: i64 = msg
            .internal_date()
            .map(|d| d.timestamp_millis())
            .unwrap_or(0);

        let (subject, from_name, from_email) = if let Some(env) = msg.envelope() {
            let subject = decode_imap_bytes(env.subject.as_deref().unwrap_or(b"(no subject)"));

            let (from_name, from_email) = env
                .from
                .as_ref()
                .and_then(|addrs| addrs.first())
                .map(|addr| {
                    let name =
                        decode_imap_bytes(addr.name.as_deref().unwrap_or(b""));
                    let mbox =
                        std::str::from_utf8(addr.mailbox.as_deref().unwrap_or(b""))
                            .unwrap_or("")
                            .to_string();
                    let host_part =
                        std::str::from_utf8(addr.host.as_deref().unwrap_or(b""))
                            .unwrap_or("")
                            .to_string();
                    let email = if mbox.is_empty() {
                        String::new()
                    } else {
                        format!("{mbox}@{host_part}")
                    };
                    (name, email)
                })
                .unwrap_or_default();

            (subject, from_name, from_email)
        } else {
            (String::from("(no subject)"), String::new(), String::new())
        };

        results.push(serde_json::json!({
            "id": format!("imap:{}", msg.message),
            "subject": subject,
            "fromName": from_name,
            "fromEmail": from_email,
            "dateMs": date_ms,
            "unread": unread,
        }));
    }

    let _ = session.logout();
    Ok(results)
}

/// Decode an IMAP byte slice: tries UTF-8, falls back to lossy UTF-8.
/// Does NOT decode RFC 2047 encoded-words (=?charset?…?=) — most modern
/// servers send plain UTF-8 in envelope data.
fn decode_imap_bytes(bytes: &[u8]) -> String {
    std::str::from_utf8(bytes)
        .map(|s| s.to_string())
        .unwrap_or_else(|_| String::from_utf8_lossy(bytes).into_owned())
}

#[tauri::command]
async fn create_backup(app_handle: tauri::AppHandle, date: String) -> Result<(), String> {
    use std::fs;

    let app_data = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let store_path = app_data.join("dashboard.json");
    if !store_path.exists() {
        return Ok(());
    }

    let backup_dir = app_data.join("backups");
    fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;

    let backup_path = backup_dir.join(format!("{date}.json"));
    fs::copy(&store_path, &backup_path).map_err(|e| e.to_string())?;

    let mut backups: Vec<_> = fs::read_dir(&backup_dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().is_some_and(|x| x == "json"))
        .collect();

    backups.sort_by_key(|e| e.path());
    while backups.len() > 7 {
        let _ = fs::remove_file(backups.remove(0).path());
    }

    Ok(())
}

/// Show the small floating quick-capture window, creating it on first use.
fn open_quick_capture(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("quickcapture") {
        let _ = w.show();
        let _ = w.set_focus();
        return;
    }
    let _ = WebviewWindowBuilder::new(
        app,
        "quickcapture",
        WebviewUrl::App("index.html?view=quickcapture".into()),
    )
    .title("Quick capture")
    .inner_size(520.0, 155.0)
    .decorations(false)
    .always_on_top(true)
    .resizable(false)
    .skip_taskbar(true)
    .center()
    .build();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
                let _ = w.unminimize();
            }
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", "Show Bozz", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .tooltip("Bozz")
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            // Global Ctrl+Shift+N → quick capture, even when unfocused.
            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::{
                    Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
                };
                let qc = Shortcut::new(Some(Modifiers::CONTROL), Code::KeyB);
                let handle = app.handle().clone();
                app.global_shortcut().on_shortcut(qc, move |_app, _sc, event| {
                    if event.state() == ShortcutState::Pressed {
                        open_quick_capture(&handle);
                    }
                })?;
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            // Only the main window minimises to tray; the quick-capture
            // window closes normally.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            create_backup, secret_set, secret_get, secret_delete, oauth_run, imap_fetch
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
