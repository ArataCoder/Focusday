# Focusday → Windows EXE на Tauri v2 (пошагово)

## 0. Что получится
`Focusday_1.3.5_x64-setup.exe` (NSIS) и `.msi`, ~8–12 МБ. Внутри: главное окно, плавающий виджет поверх всех окон, spotlight-окно быстрого захвата (Ctrl+Alt+Space), иконка в трее, нативные уведомления Windows.

Для веб-сборки и тестов без Rust начните с [README](../README.md#быстрый-старт-от-клона-до-тестов).
Ниже — **Windows 10/11**, не Linux/macOS. Проверка этого пути на Windows
в журнале аудита отмечена отдельно от выполненных веб-тестов.

## 1. Установить инструменты (один раз)
1. **Microsoft C++ Build Tools** → https://visualstudio.microsoft.com/visual-cpp-build-tools/ → отметить «Desktop development with C++».
2. **WebView2 Runtime** — проверьте наличие; если его нет, установите [Evergreen Bootstrapper](https://developer.microsoft.com/en-us/microsoft-edge/webview2/). Загрузка WebView2 установщиком приложения не заменяет эту зависимость для `npm run dev`.
3. **Rust**: https://rustup.rs → `rustup-init.exe` → в новом терминале: `rustup default stable-msvc`.
4. **Git** (https://git-scm.com/downloads) и **Node.js 24 LTS с npm** (https://nodejs.org). После установки инструментов откройте новый терминал.
5. Проверка: `git --version`, `rustc -V`, `cargo -V`, `node -v`, `npm -v`.

Актуальные [требования Tauri v2](https://v2.tauri.app/start/prerequisites/#windows).
Build Tools должны включать MSVC и Windows SDK (workload «Desktop development with C++»).

## 2. Клонировать и установить зависимости

Если клон уже есть, перейдите в его корень вместо повторного клонирования.
Все следующие команды выполняются рядом с `package.json`.

```sh
git clone https://github.com/ArataCoder/Focusday.git
cd Focusday
npm ci
npm test
```

## Структура проекта

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

## 3. Иконки (необязательно)
Иконки уже включены в репозиторий; для обычной сборки этот шаг пропустите.
Для замены положи квадратную PNG 1024×1024 как `app-icon.png` в корень и выполни:
```
npm run icon        # = tauri icon app-icon.png → создаст src-tauri/icons/*
```

## 4. Запуск и сборка
```
npm run dev         # окно приложения; первая компиляция Rust может занять несколько минут
npm run build       # релиз
```
Обе команды сначала выполняют `npm run bundle`. При правках JS запустите
`npm run bundle:watch` во втором терминале; не рассчитывайте на автоматическую
пересборку модулей самим Tauri.

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
- Напоминание котика после 15 минут простоя: логика в `src/js/`, нативный idle — через `focusday-desktop-bridge.js`.
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
- `cargo metadata … No such file or directory` → установите Rust и откройте новый терминал; проверьте `cargo -V`.
- `link.exe not found` → не установлены C++ Build Tools.
- Белая вспышка при старте → уже стоит `"backgroundColor": "#07080b"`.
- Хоткей не срабатывает → комбинация занята другой программой; поменяй в `lib.rs`.
- SmartScreen «неизвестный издатель» → нужен сертификат подписи кода (`bundle.windows.certificateThumbprint`); для себя — «Подробнее → Выполнить в любом случае».
