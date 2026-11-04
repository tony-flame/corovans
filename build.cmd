@echo off
rem Запуск «Корованов» в своём окне через WebView2 — без Electron.
rem
rem Первый запуск создаёт .venv и ставит pywebview (~5 МБ колёс).
rem Дальше запускается сразу, pythonw без лишней консоли не глушит
rem stderr: он всё равно нужен для отладки через COROVANS_DEBUG=1.

setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\pythonw.exe" (
  echo Первый запуск: создаю окружение и ставлю pywebview...
  python -m venv .venv
  if errorlevel 1 (
    echo Не найден python. Установите Python 3.9+ и повторите.
    pause
    exit /b 1
  )
  ".venv\Scripts\python.exe" -m pip install --quiet --disable-pip-version-check "pywebview>=5.0" "pythonnet>=3.0,<3.1"
  if errorlevel 1 (
    echo Не удалось поставить зависимости.
    pause
    exit /b 1
  )
)

start "" ".venv\Scripts\pythonw.exe" "desktop\main.py"
exit /b 0
