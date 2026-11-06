// Focusday 1.3 — Tauri 2. Десктоп (Windows/macOS/Linux) + задел под Android/iOS:
// всё, что существует только на ПК (трей, оверлеи поверх окон, глобальные клавиши), — под #[cfg(desktop)].
#[cfg(desktop)]
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, LogicalSize, PhysicalPosition, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};
#[cfg(desktop)]
use tauri::{AppHandle, Manager};

const OVERLAY_W: f64 = 360.0;
const OVERLAY_H: f64 = 184.0;
const QUICK_W: f64 = 620.0;
const QUICK_H: f64 = 92.0;
/// Окно котика: маленькое (сидит) и большое (с пузырём «Ты ещё в потоке?»).
const BUDDY_SMALL: (f64, f64) = (132.0, 132.0);
const BUDDY_LARGE: (f64, f64) = (340.0, 250.0);

/// Ставит окно в правый нижний угол рабочей области (над панелью задач).
/// `logical` — желаемый размер окна (после set_size outer_size может обновиться не сразу),
/// `lift` — насколько поднять окно (логические px), чтобы котик не перекрывал виджет.
#[cfg(desktop)]
fn dock_bottom_right_sized(win: &WebviewWindow, logical: Option<(f64, f64)>, lift: f64) -> tauri::Result<()> {
    let monitor = win.current_monitor()?.or(win.primary_monitor()?);
    if let Some(m) = monitor {
        let area = m.work_area(); // без панели задач Windows
        let k = m.scale_factor();
        let (w, h) = match logical {
            Some((w, h)) => ((w * k) as i32, (h * k) as i32),
            None => { let s = win.outer_size()?; (s.width as i32, s.height as i32) }
        };
        let margin = (12.0 * k) as i32;
        let x = area.position.x + area.size.width as i32 - w - margin;
        let y = area.position.y + area.size.height as i32 - h - margin - (lift * k) as i32;
        win.set_position(PhysicalPosition::new(x, y))?;
    }
    Ok(())
}
#[cfg(desktop)]
fn dock_bottom_right(win: &WebviewWindow) -> tauri::Result<()> { dock_bottom_right_sized(win, None, 0.0) }

/// Плавающий виджет «Ты всё ещё делаешь задачу?»: поверх всех окон, без рамки, прозрачный,
/// не в панели задач и НЕ крадёт фокус у программы, в которой ты работаешь.
#[cfg(desktop)]
#[tauri::command]
fn open_overlay(app: AppHandle) -> Result<(), String> {
    let win = match app.get_webview_window("overlay") {
        Some(w) => w,
        None => WebviewWindowBuilder::new(&app, "overlay", WebviewUrl::App("overlay.html".into()))
            .title("Focusday widget")
            .inner_size(OVERLAY_W, OVERLAY_H)
            .resizable(false)
            .decorations(false)
            .transparent(true)
            .shadow(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .focused(false)
            .visible(false)
            .build()
            .map_err(|e| e.to_string())?,
    };
    dock_bottom_right(&win).map_err(|e| e.to_string())?;
    win.show().map_err(|e| e.to_string())?;
    win.set_always_on_top(true).map_err(|e| e.to_string())?; // повторно — после show
    Ok(())
}

/* ── Синхронизация через папку (OneDrive / Google Drive Desktop / Dropbox / Syncthing) ──
   Пишем ЗАШИФРОВАННЫЙ файл атомарно: tmp → rename, чтобы облако не схватило полузаписанный файл. */
fn safe_name(name: &str) -> Result<(), String> {
    let ok = !name.is_empty()
        && !name.contains("..")
        && name.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'));
    if ok { Ok(()) } else { Err("invalid file name".into()) }
}

#[tauri::command]
fn sync_write(dir: String, name: String, content: String) -> Result<(), String> {
    safe_name(&name)?;
    let path = std::path::Path::new(&dir).join(&name);
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, content).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string()) // на Windows заменяет существующий файл
}

#[tauri::command]
fn sync_read(dir: String, name: String) -> Result<Option<String>, String> {
    safe_name(&name)?;
    let path = std::path::Path::new(&dir).join(&name);
    if !path.exists() {
        return Ok(None);
    }
    std::fs::read_to_string(path).map(Some).map_err(|e| e.to_string())
}

/* ── Котик-компаньон (body doubling) ─────────────────────────────────────────
   Отдельное прозрачное окно поверх ВСЕХ программ: пока ты в Word/браузере, котик сидит в углу экрана.
   mode: "hidden" | "small" | "large". Окно не крадёт фокус и не видно в панели задач. */
#[cfg(desktop)]
// WebviewWindowBuilder в синхронной команде может зависнуть на Windows/WebView2.
#[tauri::command]
async fn buddy(app: AppHandle, mode: String) -> Result<(), String> {
    let existing = app.get_webview_window("buddy");
    if mode == "hidden" {
        if let Some(w) = existing { w.hide().map_err(|e| e.to_string())?; }
        return Ok(());
    }
    let size = if mode == "large" { BUDDY_LARGE } else { BUDDY_SMALL };
    let is_new = existing.is_none();
    let win = match existing {
        Some(w) => w,
        None => WebviewWindowBuilder::new(&app, "buddy", WebviewUrl::App("buddy.html".into()))
            .title("Focusday — котик")
            .inner_size(size.0, size.1)
            .resizable(false)
            .decorations(false)
            .transparent(true)
            .shadow(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .focused(false)
            .visible(false)
            .build()
            .map_err(|e| e.to_string())?,
    };
    // Держим правый нижний угол (самого котика) на месте при смене размера.
    // Координаты и рабочая область монитора — физические пиксели.
    let previous = if is_new { None } else {
        Some((win.outer_position().map_err(|e| e.to_string())?,
              win.outer_size().map_err(|e| e.to_string())?))
    };
    let monitor = win.current_monitor().map_err(|e| e.to_string())?
        .or(win.primary_monitor().map_err(|e| e.to_string())?);
    win.set_size(LogicalSize::new(size.0, size.1)).map_err(|e| e.to_string())?;
    if is_new {
        // При первом запуске размещаем над виджетом таймера, если он открыт.
        let lift = match app.get_webview_window("overlay") {
            Some(o) if o.is_visible().unwrap_or(false) => OVERLAY_H,
            _ => 0.0,
        };
        dock_bottom_right_sized(&win, Some(size), lift).map_err(|e| e.to_string())?;
    } else if let (Some((pos, old)), Some(m)) = (previous, monitor) {
        let area = m.work_area();
        let width = (size.0 * m.scale_factor()).round() as i64;
        let height = (size.1 * m.scale_factor()).round() as i64;
        let left = area.position.x as i64;
        let top = area.position.y as i64;
        let right = (left + area.size.width as i64 - width).max(left);
        let bottom = (top + area.size.height as i64 - height).max(top);
        let x = (pos.x as i64 + old.width as i64 - width).clamp(left, right);
        let y = (pos.y as i64 + old.height as i64 - height).clamp(top, bottom);
        win.set_position(PhysicalPosition::new(x as i32, y as i32)).map_err(|e| e.to_string())?;
    }
    if !win.is_visible().unwrap_or(false) { win.show().map_err(|e| e.to_string())?; }
    win.set_always_on_top(true).map_err(|e| e.to_string())?;
    Ok(())
}

/// Мягко подсветить Focusday в панели задач (мигание кнопки), когда котик будит. Фокус не отбираем.
#[cfg(desktop)]
#[tauri::command]
fn attention(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.request_user_attention(Some(tauri::UserAttentionType::Informational));
    }
    Ok(())
}

/* ── Системный простой ───────────────────────────────────────────────────────
   Windows: GetLastInputInfo — время последнего ввода мыши/клавиатуры В ЛЮБОЙ программе
   (не только в Focusday). Другие ОС: None → котик просто сидит рядом и не будит. */
#[cfg(windows)]
fn system_idle_secs() -> Option<u64> {
    use windows_sys::Win32::System::SystemInformation::GetTickCount;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};
    let mut info = LASTINPUTINFO { cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32, dwTime: 0 };
    // SAFETY: передаём указатель на корректно инициализированную структуру с заполненным cbSize.
    let ok = unsafe { GetLastInputInfo(&mut info) };
    if ok == 0 {
        return None;
    }
    let now = unsafe { GetTickCount() };
    Some((now.wrapping_sub(info.dwTime) / 1000) as u64) // wrapping_sub — переживает переполнение через 49.7 дня
}
#[cfg(not(windows))]
fn system_idle_secs() -> Option<u64> { None }

#[tauri::command]
fn idle_seconds() -> Option<u64> { system_idle_secs() }

/// Spotlight-окно быстрого захвата (глобально Ctrl+Alt+Space).
#[cfg(desktop)]
fn toggle_quick(app: &AppHandle) -> tauri::Result<()> {
    let win = match app.get_webview_window("quick") {
        Some(w) => w,
        None => WebviewWindowBuilder::new(app, "quick", WebviewUrl::App("quick.html".into()))
            .title("Focusday — быстрый захват")
            .inner_size(QUICK_W, QUICK_H)
            .resizable(false)
            .decorations(false)
            .transparent(true)
            .shadow(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .center()
            .visible(false)
            .build()?,
    };
    if win.is_visible()? {
        win.hide()?;
    } else {
        win.center()?;
        win.show()?;
        win.set_focus()?;
    }
    Ok(())
}

#[cfg(desktop)]
fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

/// Десктоп: трей, глобальные клавиши. Вызывается из setup().
#[cfg(desktop)]
fn desktop_setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // ── Глобальная горячая клавиша: работает, даже когда Focusday свёрнут ──
    {
        use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};
        let quick = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::Space);
        let widget = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyF);
        app.handle().plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcuts([quick, widget])?
                .with_handler(move |app, sc, event| {
                    if event.state() != ShortcutState::Pressed {
                        return;
                    }
                    if sc == &quick {
                        let _ = toggle_quick(app);
                    } else if sc == &widget {
                        let _ = open_overlay(app.clone());
                    }
                })
                .build(),
        )?;
    }

    // ── Трей: закрытие окна сворачивает в трей, таймер продолжает идти ──
    let show = MenuItemBuilder::with_id("show", "Открыть Focusday").build(app)?;
    let widget = MenuItemBuilder::with_id("widget", "Плавающий виджет").build(app)?;
    let quick = MenuItemBuilder::with_id("quick", "Быстрая задача  Ctrl+Alt+Space").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Выйти").build(app)?;
    let menu = MenuBuilder::new(app)
        .items(&[&show, &widget, &quick])
        .separator()
        .item(&quit)
        .build()?;
    TrayIconBuilder::with_id("main-tray")
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("Focusday")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => show_main(app),
            "widget" => { let _ = open_overlay(app.clone()); }
            "quick" => { let _ = toggle_quick(app); }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                show_main(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    #[cfg(desktop)]
    let builder = builder
        // Второй запуск EXE просто разворачивает уже открытое окно (данные не раздваиваются).
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
        .invoke_handler(tauri::generate_handler![open_overlay, buddy, attention, idle_seconds, sync_write, sync_read])
        .setup(|app| desktop_setup(app))
        .on_window_event(|window, event| {
            // Крестик главного окна = свернуть в трей (а не убить таймер фокуса).
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                    let _ = window.emit("focusday://hidden-to-tray", ());
                }
            }
        });

    // Android / iOS: без трея, оверлеев и глобальных клавиш. Синхронизация — через облако (E2E) в JS.
    #[cfg(mobile)]
    let builder = builder.invoke_handler(tauri::generate_handler![idle_seconds, sync_write, sync_read]);

    builder
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running Focusday");
}
