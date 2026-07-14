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

/// Start a one-shot TCP server on the given port.
///
/// Runs in a background thread.  When the OAuth provider's redirect lands
/// (e.g. Edge navigating to http://127.0.0.1:14987?code=…), we parse the
/// URL and emit `oauth:callback` exactly like `open_oauth_window` does via
/// `on_navigation`.  This handles the case where Google detects WebView2 and
/// opens the sign-in completion in the default system browser instead of the
/// in-app popup.
///
/// Returns the port actually bound (may differ from `port` if that port was busy).
#[tauri::command]
fn start_oauth_server(app: tauri::AppHandle, port: u16) -> Result<u16, String> {
    use std::io::{Read, Write};
    use std::net::TcpListener;

    // Try the requested port; fall back to a random OS-assigned port if busy.
    let listener = TcpListener::bind(format!("127.0.0.1:{port}"))
        .or_else(|_| TcpListener::bind("127.0.0.1:0"))
        .map_err(|e| format!("bind: {e}"))?;

    let actual_port = listener.local_addr().map_err(|e| e.to_string())?.port();

    std::thread::spawn(move || {
        if let Ok((mut stream, _)) = listener.accept() {
            let mut buf = [0u8; 4096];
            let n = stream.read(&mut buf).unwrap_or(0);
            let raw = std::str::from_utf8(&buf[..n]).unwrap_or("");
            let path = raw
                .lines()
                .next()
                .and_then(|l| l.split_whitespace().nth(1))
                .unwrap_or("/");

            let _ = stream.write_all(
                b"HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\
                  Connection: close\r\n\r\n\
                  <html><body style=\"font-family:system-ui;padding:40px\">\
                  <h2>Connected!</h2><p>You can close this tab and return to Bozz.</p>\
                  </body></html>",
            );

            let query = path.splitn(2, '?').nth(1).unwrap_or("");
            let callback_url = format!("http://127.0.0.1:{actual_port}?{query}");
            let _ = app.emit("oauth:callback", callback_url);
        }
    });

    Ok(actual_port)
}

/// Opens a popup WebviewWindow for OAuth sign-in.
///
/// `on_navigation` intercepts the redirect to the loopback URI before any TCP
/// connection, emitting `oauth:callback`.  Call `start_oauth_server` first so
/// that if Google detects WebView2 and opens Edge, the system-browser redirect
/// is also caught.
#[tauri::command]
fn open_oauth_window(
    app: tauri::AppHandle,
    url: String,
    redirect_prefix: String,
) -> Result<(), String> {
    let handle = app.clone();
    let prefix = redirect_prefix.clone();

    // Close any previous OAuth window that was left open.
    if let Some(prev) = app.get_webview_window("oauth") {
        let _ = prev.close();
    }

    WebviewWindowBuilder::new(
        &app,
        "oauth",
        WebviewUrl::External(url.parse::<url::Url>().map_err(|e| e.to_string())?),
    )
    .title("Sign in")
    .inner_size(520.0, 700.0)
    .center()
    .always_on_top(true)
    // Use an Edge-compatible UA so Google doesn't detect WebView2.
    .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0")
    .on_navigation(move |nav_url| {
        if nav_url.as_str().starts_with(prefix.as_str()) {
            let _ = handle.emit("oauth:callback", nav_url.to_string());
            false // cancel — we have what we need
        } else {
            true // allow all other navigation (Google's login pages, etc.)
        }
    })
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Loopback OAuth listener.
///
/// Binds 127.0.0.1 on the given port (or a random port when None), emits
/// `oauth:port`, then waits (up to 5 min) for the OAuth provider to redirect
/// back. Returns the parsed query parameters.
///
/// Uses only std::net — no third-party HTTP crate required.
#[tauri::command]
async fn oauth_run(app: tauri::AppHandle, port: Option<u16>) -> Result<std::collections::HashMap<String, String>, String> {
    use std::collections::HashMap;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::time::Duration;

    let addr = format!("127.0.0.1:{}", port.unwrap_or(0));
    let listener = TcpListener::bind(&addr).map_err(|e| format!("bind {addr}: {e}"))?;
    listener.set_nonblocking(false).ok();

    let bound_port = listener.local_addr().map_err(|e| e.to_string())?.port();
    app.emit("oauth:port", bound_port).map_err(|e| e.to_string())?;

    // Accept one connection within 5 minutes.
    listener
        .set_nonblocking(false)
        .map_err(|e| e.to_string())?;
    // Use a background thread so we can honour the timeout without blocking Tokio.
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let result = listener.accept();
        let _ = tx.send(result);
    });

    let (mut stream, _) = rx
        .recv_timeout(Duration::from_secs(300))
        .map_err(|_| "OAuth timed out — no redirect received".to_string())?
        .map_err(|e| e.to_string())?;

    // Read just enough to grab the request line.
    let mut buf = [0u8; 4096];
    let n = stream.read(&mut buf).unwrap_or(0);
    let raw = std::str::from_utf8(&buf[..n]).unwrap_or("");
    // First line: "GET /path?query HTTP/1.1"
    let path = raw
        .lines()
        .next()
        .and_then(|l| l.split_whitespace().nth(1))
        .unwrap_or("/");

    let html = b"HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n\
        <html><body style=\"font-family:system-ui;padding:40px;color:#333\">\
        <h2>Connected!</h2><p>You can close this tab and return to Bozz.</p>\
        </body></html>";
    let _ = stream.write_all(html);

    // Parse query string from the path.
    let query = path.splitn(2, '?').nth(1).unwrap_or("");
    let mut out = HashMap::new();
    for pair in query.split('&').filter(|s| !s.is_empty()) {
        let mut parts = pair.splitn(2, '=');
        let k = parts.next().unwrap_or("").replace('+', " ");
        let v = parts.next().unwrap_or("").replace('+', " ");
        let k = urlencoding_decode(&k);
        let v = urlencoding_decode(&v);
        out.insert(k, v);
    }
    Ok(out)
}

fn urlencoding_decode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '%' {
            let h: String = chars.by_ref().take(2).collect();
            if let Ok(b) = u8::from_str_radix(&h, 16) {
                out.push(b as char);
            } else {
                out.push('%');
                out.push_str(&h);
            }
        } else {
            out.push(c);
        }
    }
    out
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

/// XOAUTH2 SASL authenticator for OAuth-based IMAP. The `imap` crate base64-encodes
/// whatever bytes we return; XOAUTH2 carries the whole credential in the initial
/// client response, so the server challenge is ignored.
struct XOAuth2 {
    user: String,
    access_token: String,
}

impl imap::Authenticator for XOAuth2 {
    type Response = String;
    fn process(&self, _challenge: &[u8]) -> Self::Response {
        // Format: "user=<addr>^Aauth=Bearer <token>^A^A"  (^A = Ctrl-A = 0x01)
        format!(
            "user={}\u{0001}auth=Bearer {}\u{0001}\u{0001}",
            self.user, self.access_token
        )
    }
}

/// Fetch the most recent inbox messages over IMAP/TLS using an OAuth access token
/// (XOAUTH2) instead of a password. This is how Bozz reads Outlook.com / Microsoft
/// 365 mail: Microsoft is retiring basic auth, so password IMAP no longer works —
/// but IMAP over OAuth does. Desktop-only (needs raw TLS sockets). Blocking I/O.
#[tauri::command]
fn imap_fetch_xoauth2(
    host: String,
    port: u16,
    username: String,
    access_token: String,
) -> Result<Vec<serde_json::Value>, String> {
    use native_tls::TlsConnector;

    let tls = TlsConnector::new().map_err(|e| format!("TLS build failed: {e}"))?;

    let client = imap::connect((host.as_str(), port), &host, &tls)
        .map_err(|e| format!("IMAP connect failed: {e}"))?;

    let auth = XOAuth2 { user: username, access_token };
    let mut session = client
        .authenticate("XOAUTH2", &auth)
        .map_err(|(e, _)| format!("Outlook sign-in failed (XOAUTH2): {e}"))?;

    let mailbox = session.select("INBOX").map_err(|e| e.to_string())?;
    let total = mailbox.exists;

    if total == 0 {
        let _ = session.logout();
        return Ok(vec![]);
    }

    let start = total.saturating_sub(29).max(1);
    let seq = format!("{start}:{total}");

    let messages = session
        .fetch(&seq, "(FLAGS ENVELOPE INTERNALDATE)")
        .map_err(|e| e.to_string())?;

    let mut results: Vec<serde_json::Value> = Vec::new();

    for msg in messages.iter().rev() {
        let flags = msg.flags();
        let unread = !flags.iter().any(|f| *f == imap::types::Flag::Seen);

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
                    let name = decode_imap_bytes(addr.name.as_deref().unwrap_or(b""));
                    let mbox = std::str::from_utf8(addr.mailbox.as_deref().unwrap_or(b""))
                        .unwrap_or("")
                        .to_string();
                    let host_part = std::str::from_utf8(addr.host.as_deref().unwrap_or(b""))
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
// Returns true if a backup was created, false if skipped (no store file yet).
async fn create_backup(app_handle: tauri::AppHandle, date: String) -> Result<bool, String> {
    use std::fs;

    let app_data = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let store_path = app_data.join("dashboard.json");
    if !store_path.exists() {
        return Ok(false);
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

    Ok(true)
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
        .plugin(tauri_plugin_notification::init())
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
            create_backup, secret_set, secret_get, secret_delete,
            oauth_run, open_oauth_window, start_oauth_server, imap_fetch, imap_fetch_xoauth2
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
