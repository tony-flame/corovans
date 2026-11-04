#!/usr/bin/env python3
# Запуск «Корованов» в отдельном окне через WebView2, без Electron.
#
# Почему так, а не file:// — ES-модули в Chromium блокируются по CORS
# на файловой схеме. Electron решал это протоколом app://, здесь —
# обычным HTTP-сервером на 127.0.0.1 со случайным портом.
#
# Почему pywebview, а не Qt: на Windows pywebview работает через
# WebView2 (Edge), который уже есть в системе. QtWebEngine — это
# тот же Chromium весом 80+ МБ, то есть та же проблема, что с Electron.
#
# Заголовки Cache-Control: no-store обязательны: без них WebView2
# кеширует ES-модули, и правки в src/*.js не доезжают до игрока.

import json
import os
import socket
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import webview

APP_NAME = "Корованы: Тёмная дорога"


def game_root():
    """Где лежат index.html, src/ и styles.css.

    Три режима, и перепутать их легко:
      • Nuitka onefile — данные распакованы рядом с main.py во временной
        папке. У Nuitka НЕТ sys.frozen, поэтому старый вариант
        (parent.parent) уходил на уровень выше и игра не находила
        index.html.
      • PyInstaller — sys._MEIPASS.
      • Обычный запуск из исходников — на папку выше desktop/.
    """
    here = Path(__file__).resolve().parent

    if "__compiled__" in globals():  # Nuitka
        return here
    if getattr(sys, "frozen", False):  # PyInstaller
        return Path(getattr(sys, "_MEIPASS", here))
    return here.parent


ROOT = game_root()


class GameHandler(SimpleHTTPRequestHandler):
    """Статика игры с отключённым кешем.

    SimpleHTTPRequestHandler кеширует по Last-Modified, и WebView2
    держит старые модули. Здесь кеш выключен так же, как в
    scripts/serve.mjs — иначе отладка превращается в угадайку.
    """

    def __init__(self, *args, directory=None, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # В релизе консоль не нужна; при --debug печатаем.
        if os.environ.get("COROVANS_DEBUG"):
            sys.stderr.write("[server] " + (fmt % args) + "\n")


def pick_port():
    """Свободный порт. Случайный, чтобы две копии игры не конфликтовали."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def start_server(port):
    server = ThreadingHTTPServer(("127.0.0.1", port), GameHandler)
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def configure_webview2(window):
    """Настройки WebView2, без которых играть нельзя или неудобно.

    pywebview не даёт доступа к CoreWebView2Settings напрямую, поэтому
    лезем через pythonnet. Если что-то не сработает — игра всё равно
    запустится, просто с поведением по умолчанию.
    """
    try:
        import clr  # pythonnet

        core = window.native
        # Убираем меню «Печать», «Сохранить как» и прочее из контекстного меню.
        settings = core.CoreWebView2.Settings
        settings.AreDefaultContextMenusEnabled = False
        settings.AreDevToolsEnabled = bool(os.environ.get("COROVANS_DEBUG"))
        settings.IsStatusBarEnabled = False
        # Зум колесом ломает пиксельный масштаб 1:1.
        settings.IsZoomControlEnabled = False
        # Автовоспроизведение звука: игра создаёт AudioContext по клику,
        # но политика WebView2 строже браузерной.
        try:
            settings.IsGeneralAutofillEnabled = False
            settings.IsPasswordAutosaveEnabled = False
        except Exception:
            pass
    except Exception as exc:
        if os.environ.get("COROVANS_DEBUG"):
            print(f"[warn] настройки WebView2 не применились: {exc}", file=sys.stderr)


def main():
    if not (ROOT / "index.html").exists():
        print(f"index.html не найден в {ROOT}", file=sys.stderr)
        print("Запустите из папки проекта или пересоберите exe.", file=sys.stderr)
        return 1

    port = pick_port()
    start_server(port)
    url = f"http://127.0.0.1:{port}/index.html"

    window = webview.create_window(
        APP_NAME,
        url,
        # Чуть больше буфера игры: рамка окна отнимает пиксели, а canvas
        # должен влезать целиком, иначе applyCanvasScale даст scale=1
        # и картинка обрежется.
        width=1300,
        height=790,
        min_size=(900, 560),
        background_color="#000000",
    )

    webview.start(
        configure_webview2,
        window,
        debug=bool(os.environ.get("COROVANS_DEBUG")),
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
