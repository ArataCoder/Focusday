# Проверка пути от клона до запуска

Дата: 2026-11-09. Исходный коммит: `ad66620` (1.3.5).

## Среда и границы проверки

Свежий checkout без `node_modules`, lockfile и выполненного проектного setup.
Среда: Ubuntu 24.04, Node.js 24.22.2, npm 11.19.1; Git и Node уже предоставлены
runner-ом. Это не проверка установки ОС, Git или Node на физически чистый ПК.
Rust/Cargo, Windows Build Tools, Android SDK и Xcode отсутствуют.
Все команды выполнялись из корня репозитория. Сначала прочитаны README,
TAURI_GUIDE, RELEASE_GUIDE и MOBILE_BUILD, затем выполнены доступные локальные
шаги; Windows/mobile и публикация релиза не имитировались как успешные.

## Исходный путь: выполненные команды

| Шаг | Фактический результат | Исправление / вывод |
| --- | --- | --- |
| README → начало установки | Нет команд clone, установки зависимостей или ссылок на setup | Добавлен самостоятельный путь Git + Node → клон → веб-сборка → тесты, ссылки на платформенные инструкции. |
| Проверка инструментов | Node/npm есть; `cargo`, `rustc`, `rustup` не найдены | Отделены минимальные веб-требования от Windows MSVC/SDK/WebView2. |
| `npm install` (старое руководство) | Успех; создан отсутствовавший `package-lock.json`; предупреждение об одной moderate уязвимости esbuild | Lockfile включён в репозиторий, чистая установка и CI используют `npm ci`. Без lockfile зависимости разрешались заново при каждом клоне. |
| `npm test` | Успех: 17/17 | README теперь содержит команду и ожидаемый результат; устаревшее число тестов удалено. |
| `npm run build` | Exit 1: `failed to run 'cargo metadata' … No such file or directory (os error 2)` | Это Tauri, не веб-сборка. Добавлены явные требования и веб-альтернатива; текущие NSIS/MSI предназначены для Windows. |
| `npm run test:e2e` | Bundle успешен; затем exit 1: `browserType.launch: Executable doesn't exist … chromium_headless_shell` | Добавлен обязательный `npx playwright install --with-deps chromium`, права root/sudo на Linux и повторная установка после обновления Playwright. |
| `npm run icon` (из Tauri guide) | Успех, но перегенерирует уже включённые иконки и создаёт дополнительные файлы | Помечен необязательным. Все результаты пробной перегенерации удалены/восстановлены, в PR нет изменений иконок. |

Предупреждения npm `Unknown env config "store-dir"` и `allowScripts` относятся
к конфигурации runner-а; install, bundle и тесты завершились успешно без
изменения глобальных настроек. Не переносим эту конфигурацию в setup проекта.

## Пробелы, установленные чтением исходников и конфигурации

- `pwa:serve` вызывал незадекларированный `npx serve` и не собирал JavaScript.
  Теперь сервер — devDependency в lockfile, а команда сначала выполняет bundle.
  В README указан `/focusday.html`, поскольку `src/index.html` отсутствует.
  Для добавленного serve требуется patch-override `compression >=1.8.2`:
  serve 14.2.7 закрепляет уязвимый compression 1.8.1
  ([GHSA-vc2v-76pw-4v95](https://github.com/advisories/GHSA-vc2v-76pw-4v95)).
- `.gitignore` отсутствовал: установка оставляла `node_modules/` в untracked.
  Добавлены исключения npm-зависимостей и Rust target.
- Windows guide пропускал Git/клон/рабочую директорию, предлагал 1.0.0 в имени
  установщика и обещал hot-reload без esbuild watch. WebView2 описывался только
  как задача установщика. Исправлены эти шаги и подсказка при отсутствии Cargo.
- Release guide предлагал копировать архив 1.3.3 поверх проекта 1.3.5 и обещал
  draft с фиксированным тегом при ручном запуске по ветке. В workflow `tagName`
  задан только для tag ref. Теперь различаются artifact, tag release и PR-тесты;
  исправлены пути артефактов и список файлов с версиями.
- Mobile guide не включал исходный клон/Node/npm и полные iOS prerequisites.
  Добавлены ссылки на требования Tauri v2 и версии Android SDK из workflow.
  `src-tauri/gen/android` отсутствует: прямо указано, что Actions требует
  предварительного `android:init` на машине с SDK и коммита проекта.

## Повторная проверка исправленного пути

- `npx playwright install --with-deps chromium` — успешная установка Chromium
  и системных библиотек; использован браузер Playwright, не системный Chrome.
- `npm ci` — успешная установка по lockfile.
- `npm run bundle` — успешная генерация `src/focusday.js`.
- `npm run test:all` — 17 unit-тестов и все три E2E-набора успешны:
  интерфейс, PWA с offline-перезапуском, протокол окна котика с mock Tauri.
- `npm run pwa:serve` — сначала bundle, затем HTTP-сервер на порту 3000;
  `/focusday.html` возвращает 200, приложение инициализируется в Chromium без
  `pageerror`. Это локальный preview, не проверка внешнего Cloudflare deploy.

Исходное предупреждение `npm audit` о moderate esbuild остаётся: проект
использует 0.24.2. Аудит setup не обновляет несвязанные версии сборщика;
не запускайте `npm audit fix --force` как шаг установки. Новая зависимость
сервера не должна добавлять уязвимости сверх этого исходного предупреждения.

**Не проверено:** Windows dev/EXE/MSI/NSIS и WebView2, GitHub Release,
Android/iOS, подпись и установка на телефоны, внешний HTTPS-деплой.
Успех браузерных mock-тестов не доказывает работу нативных окон или хоткеев.
