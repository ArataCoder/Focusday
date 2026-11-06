# Focusday → Windows EXE на Tauri v2 (пошагово)

## 0. Что получится
`Focusday_1.0.0_x64-setup.exe` (NSIS) и `.msi`, ~8–12 МБ. Внутри: главное окно, плавающий виджет поверх всех окон, spotlight-окно быстрого захвата (Ctrl+Alt+Space), иконка в трее, нативные уведомления Windows.

## 1. Установить инструменты (один раз)
1. **Microsoft C++ Build Tools** → https://visualstudio.microsoft.com/visual-cpp-build-tools/ → отметить «Desktop development with C++».
2. **WebView2** — уже есть в Windows 10 (последние обновления) и 11. Инсталлятор сам докачает его, если нет.
3. **Rust**: https://rustup.rs → `rustup-init.exe` → в новом терминале: `rustup default stable-msvc`.
4. **Node.js LTS** (https://nodejs.org).
5. Проверка: `rustc -V`, `cargo -V`, `node -v`.

## 2. Структура проекта (уже готова в архиве)
```
focusday/
├─ package.json            ← @tauri-apps/cli
├─ src/                    ← фронтенд (frontendDist)
│  ├─ focusday.html / .css / .js
│  ├─ focusday-desktop-bridge.js   ← мост window.focusdayDesktop → Tauri
│  ├─ overlay.html / overlay.js    ← плавающий виджет
│  └─ quick.html / quick.js        ← быстрый захват
└─ src-tauri/
   ├─ Cargo.toml, build.rs, tauri.conf.json
   ├─ capabilities/default.json    ← права окон
   └─ src/main.rs, lib.rs          ← окна, трей, хоткеи
```

## 3. Иконки
Положи квадратную PNG 1024×1024 как `app-icon.png` в корень и выполни:
```
npm install
npm run icon        # = tauri icon app-icon.png → создаст src-tauri/icons/*
```

## 4. Запуск и сборка
```
npm run dev         # окно с hot-reload, первая компиляция Rust ~2–5 мин
npm run build       # релиз
```
Готовые файлы: `src-tauri/target/release/bundle/nsis/*.exe` и `…/bundle/msi/*.msi`.
Портативный EXE без установки: `src-tauri/target/release/focusday.exe` (нужен WebView2 в системе).

## 5. Как сделаны окна поверх всех (lib.rs)
```rust
WebviewWindowBuilder::new(&app, "overlay", WebviewUrl::App("overlay.html".into()))
    .inner_size(360.0, 184.0)
    .decorations(false)      // без рамки Windows
    .transparent(true)       // скруглённые углы и стеклянная тень рисует CSS
    .always_on_top(true)     // поверх всех окон
    .skip_taskbar(true)      // нет кнопки в панели задач
    .focused(false)          // НЕ отбирает фокус у Word/браузера
    .shadow(false)
```
- Позиция: `monitor.work_area()` → правый нижний угол над панелью задач (`dock_bottom_right`).
- «Выезд» сбоку — CSS-анимация `translateX(40px) → 0` с пружиной; при скрытии — обратная, затем `window.hide()`.
- Перетаскивание: атрибут `data-tauri-drag-region` + право `core:window:allow-start-dragging`.
- Напоминание «Ты всё ещё делаешь задачу?» каждые 5 мин — в `focusday-desktop-bridge.js` (`REMIND_MS`).
- Уведомления-тосты Windows (Action Center): `tauri-plugin-notification`; мост подменяет `window.Notification`, так что старый код работает без правок.
- Глобальные хоткеи: `Ctrl+Alt+Space` — быстрый захват, `Ctrl+Alt+F` — виджет (`tauri-plugin-global-shortcut`).

## 6. Связь окон (вместо Electron IPC)
| Было (Electron) | Стало (Tauri) |
|---|---|
| `ipcRenderer.send('focusday:state')` | `emit('focusday://state', state)` |
| `executeJavaScript('…click()')` | `emit('focusday://overlay-action','toggle')` → `onOverlayAction` |
| `ipcRenderer.send('focusday:open-overlay')` | `invoke('open_overlay')` (Rust-команда) |
Код приложения обращается только к `window.focusdayDesktop` — поэтому один и тот же `focusday.js` работает в браузере, Electron и Tauri.

## 7. Данные
`localStorage` в WebView2 хранится в `%LOCALAPPDATA%\app.focusday.desktop\EBWebView`. **Не меняй `identifier`** в `tauri.conf.json` после релиза — иначе приложение «забудет» данные. Перенос из Electron/браузера: Экспорт `.json` → Импорт в EXE.
Следующий шаг (по желанию): `tauri-plugin-store` — JSON-файл в AppData вместо localStorage.

## 8. Частые проблемы
- `link.exe not found` → не установлены C++ Build Tools.
- Белая вспышка при старте → уже стоит `"backgroundColor": "#07080b"`.
- Хоткей не срабатывает → комбинация занята другой программой; поменяй в `lib.rs`.
- SmartScreen «неизвестный издатель» → нужен сертификат подписи кода (`bundle.windows.certificateThumbprint`); для себя — «Подробнее → Выполнить в любом случае».
- Если остаёшься на Electron: в `preload.js` добавь `onOverlayAction: cb => ipcRenderer.on('focusday:overlay-action-forward', (_e,a)=>cb(a))`, а в `electron-main.js` вместо `executeJavaScript` — `mainWindow.webContents.send('focusday:overlay-action-forward', action)`.
