# 8. Телефон: Android и iOS — реально ли и как

## Короткий ответ
* **Реально.** Focusday — веб-интерфейс + Tauri 2, а Tauri 2 собирает Android (APK/AAB) и iOS из того же кода. Rust-часть уже подготовлена: трей, оверлеи и глобальные клавиши отключаются на мобильных (`#[cfg(desktop)]`).
* **Самый быстрый путь — PWA** (5 минут, бесплатно, Android и iPhone): выложить `src/` на Cloudflare Pages → открыть на телефоне → «Добавить на главный экран». Работает офлайн (service worker), синхронизируется с ПК через Supabase.
* Нативный APK — когда захочется «настоящее приложение». iOS-приложение требует Mac — на Windows не собрать.

## Что работает на телефоне
| Функция | PWA | Tauri APK/iOS |
|---|---|---|
| Задачи, привычки, финансы, мысли, Q-строка | ✅ | ✅ |
| Фокус-таймер, звуки, цитаты, котик в углу | ✅ | ✅ |
| Синхронизация с ПК (Supabase, E2E) | ✅ | ✅ |
| Офлайн | ✅ | ✅ |
| Котик будит по простою | ❌ (нет системного idle на телефоне) | ❌ |
| Трей, окно поверх всех программ, Ctrl+Alt+Space | ❌ | ❌ (нет такого в мобильных ОС) |
| Таймер в фоне при выключенном экране | ⚠️ ОС может усыпить | ⚠️ уведомления — да |

## Путь 1 — PWA (рекомендую начать с него)
1. Залить на GitHub (уже есть для EXE) → dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git → репозиторий.
   Build command: `npm run bundle`, Output directory: `src`.
2. Получишь `https://focusday-xxx.pages.dev`.
3. Android (Chrome): ⋮ → «Установить приложение». iPhone (Safari): «Поделиться» → «На экран Домой».
4. Настройки → Синхронизация → тот же Supabase и пароль, что на ПК.

## Путь 2 — Android APK через Tauri 2
**Один раз поставить (Windows):**
1. Android Studio → SDK Manager: Android SDK Platform 34, Build-Tools, **NDK (Side by side)**, Command-line Tools.
2. Переменные среды: `JAVA_HOME` = `C:\Program Files\Android\Android Studio\jbr`, `ANDROID_HOME` = `%LOCALAPPDATA%\Android\Sdk`, `NDK_HOME` = `%ANDROID_HOME%\ndk\<версия>`.
3. `rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android`

**Сборка:**
```
npm install
npm run android:init        # один раз: создаст src-tauri/gen/android
npm run android:dev         # запуск на телефоне по USB (включи «Отладку по USB») или в эмуляторе
npm run android:apk-debug   # APK для себя: src-tauri/gen/android/app/build/outputs/apk/
npm run android:build       # релизный APK (нужно подписать — см. ниже)
```
Подпись релиза: `keytool -genkey -v -keystore focusday.jks -keyalg RSA -keysize 2048 -validity 10000 -alias focusday`, затем прописать keystore в `src-tauri/gen/android/app/build.gradle.kts` (раздел signingConfigs) — инструкция: v2.tauri.app/distribute/sign/android.
Без Android Studio локально: Actions → «Build Android APK» (`.github/workflows/android.yml`; сначала локально `android:init` и закоммитить `gen/android`).
Установка друзьям: отправить APK → «Разрешить установку из неизвестных источников». Google Play — разовые 25 $.

## Путь 3 — iOS
* Нужен **Mac** с Xcode (или облачный Mac: MacinCloud, GitHub Actions `macos-latest`).
* Бесплатный Apple ID — установка только на свой iPhone, приложение живёт 7 дней. Apple Developer Program (99 $/год) — TestFlight для друзей и App Store.
```
rustup target add aarch64-apple-ios aarch64-apple-ios-sim
npm run ios:init
npm run tauri ios dev       # симулятор или iPhone по кабелю
npm run ios:build
```
**Мой совет для iPhone:** PWA. Для 20 друзей это бесплатно и без ограничений Apple.

## Честно о статусе
Мобильная сборка подготовлена (cfg-разделение кода, зависимости только для ПК вынесены, скрипты, workflow), но в песочнице не компилировалась (нет Android SDK / Xcode). Возможные первые ошибки — версии NDK/Java; лечатся по сообщению `tauri android build`. Интерфейс уже адаптивный (проверен на 390 px), PWA-манифест и офлайн-кэш на месте.
