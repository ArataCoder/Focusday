# 1. Сборка и дистрибуция: один файл для друзей

## Итог сравнения
| | **Tauri v2** ✅ | Electron-builder | PyInstaller + pywebview (+ Inno Setup) |
|---|---|---|---|
| Размер установщика | **~4–10 МБ** | ~80–120 МБ | ~15–40 МБ |
| Размер на диске | ~10–15 МБ | ~250–350 МБ | ~40–80 МБ |
| ОЗУ в работе* | **~60–120 МБ** | ~150–300 МБ | ~80–150 МБ |
| Холодный старт | < 1 с | 1–3 с | 2–5 с (onefile распаковывается в temp) |
| Движок | системный WebView2 (Chromium) | свой Chromium + Node | системный WebView2 |
| Ложные срабатывания антивирусов | редко | редко | **часто** (onefile-упаковщик похож на дроппер) |
| Нативное: трей, хоткеи, окна поверх | плагины из коробки | из коробки | вручную (pystray, keyboard…) |
| Что нужно для сборки | Rust + Node (или GitHub Actions) | Node | Python |

\* Ориентировочно, включая процессы WebView2/Chromium. **Inno Setup — это не альтернатива, а только упаковщик-установщик** (Tauri использует NSIS, это то же самое по смыслу).
**Вывод:** Tauri — в 10–20 раз меньше файл и в 2 раза меньше памяти. Electron оправдан, только если нужен Node.js внутри приложения; Python — если основная логика уже на Python.

## Вариант А — собрать в облаке, без установки Rust (рекомендую)
1. Зарегистрируйся на github.com → New repository → `focusday` (можно Private).
2. Загрузи содержимое архива (кнопка «uploading an existing file», перетащи все папки, включая `.github`).
3. Вкладка **Actions** → «Release Windows» → **Run workflow**. Сначала пройдут автотесты (job `test`), затем соберётся EXE (job `build`).
4. Через ~8–12 минут: внизу страницы запуска → **Artifacts → Focusday-Windows.zip**. Внутри:
   - `Focusday_1.3.0_x64-setup.exe` — установщик (рекомендуется друзьям);
   - `Focusday_1.3.0_x64_en-US.msi` — для корпоративной установки;
   - `focusday.exe` — **portable**, запускается без установки.

## Вариант Б — собрать у себя
```
winget install Rustlang.Rustup OpenJS.NodeJS.LTS Microsoft.VisualStudio.2022.BuildTools
#   (в установщике Build Tools отметь «Desktop development with C++»)
npm install
npm test            # юнит-тесты (5 сек)
npm run build       # сам выполнит npm run bundle (src/js → src/focusday.js), потом tauri build
```
**Важно с v1.3:** исходники — модули в `src/js/`. Файл `src/focusday.js` собирается из них командой `npm run bundle` (или `npm run bundle:watch` во время правок). Правишь `src/js/*`, а не `focusday.js`.
Иконки уже сгенерированы (`src-tauri/icons`). Свою иконку: заменить `app-icon.png` → `npm run icon`.

## Что отправлять в Telegram
| Файл | Плюсы | Минусы |
|---|---|---|
| **`…-setup.exe`** | ярлык в Пуске, удаление через «Приложения», сам докачает WebView2 | нужен один клик «Установить» |
| `focusday.exe` (portable) | просто запустить, можно с флешки | нужен WebView2 (есть во всех Windows 11 и обновлённых Windows 10) |

Данные в обоих случаях лежат в `%LOCALAPPDATA%\app.focusday.desktop` — установка новой версии поверх **не стирает** задачи.

**Совет:** упакуй в `.zip` — Telegram и браузеры реже ругаются на zip, чем на голый exe.

## SmartScreen «Windows защитила ваш компьютер»
Появится у друзей, потому что файл не подписан. Инструкция для них: **«Подробнее» → «Выполнить в любом случае»**.
Убрать навсегда — подписать код: Azure Trusted Signing (~10 $/мес) или OV-сертификат (от ~70 $/год). Прописывается в `tauri.conf.json → bundle.windows.signCommand`.

## Обновления (следующий шаг)
`tauri-plugin-updater`: приложение само проверяет `latest.json` в GitHub Releases и обновляется одной кнопкой. Требует ключ подписи обновлений (`tauri signer generate`).

## Чек-лист релиза
- [ ] `version` в `tauri.conf.json` и `package.json` повышена
- [ ] `identifier` **не менялся** (иначе пропадут данные)
- [ ] Проверены: экспорт → удаление → импорт бэкапа
- [ ] Запуск на «чистой» Windows 10 (виртуалка / ПК друга)
- [ ] Хоткей Ctrl+Alt+Space не конфликтует (Telegram/PowerToys)
