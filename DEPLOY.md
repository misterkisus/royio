# Деплой РОЙ.IO под `/roy` (рядом с `/` и `/kazik`)

Сервер уже mount-agnostic: тот же код работает и на `localhost:3000`, и под `/roy/` за
реверс-прокси, который срезает префикс. Проверено end-to-end тестом `tests/subpath-proxy.test.mjs`
(статика + ES-модули + WebSocket через `/roy/`).

Схема: **nginx** (реверс-прокси на 45.114.61.202) → **pm2** запускает `server.js` на `127.0.0.1:3007`.

---

## 1. Залить код на сервер

**Вариант A — git (рекомендую).** Запушь проект в свой GitHub/GitLab, затем на сервере:
```bash
cd /var/www            # или где лежат твои сайты
git clone <repo-url> roy
cd roy
```

**Вариант B — scp/rsync с Windows** (из папки проекта, в PowerShell):
```powershell
scp -r "c:\Users\kisus\Downloads\рой\*" user@45.114.61.202:/var/www/roy/
# либо WinSCP — перетащить всё, КРОМЕ node_modules
```
> `node_modules` не копируй — поставится на сервере. `roy-io-v2.html` (старый прототип) не нужен.

## 2. Установить зависимости и запустить через pm2

На сервере, в папке проекта:
```bash
npm install --omit=dev          # ставится только ws
pm2 start ecosystem.config.cjs  # имя процесса: roy, порт 3007, fork-режим
pm2 save                        # чтобы поднялся после ребута
pm2 logs roy --lines 20         # должно быть: "РОЙ.IO сервер на http://localhost:3007"
```
Если порт 3007 занят — поменяй `PORT` в `ecosystem.config.cjs` и в nginx-конфиге, затем `pm2 restart roy`.

> ⚠️ Только `fork`, одна инстанция. Игра хранит состояние (лобби, рои) в памяти процесса —
> `cluster`/несколько инстанций разорвут общее состояние.

## 3. Настроить nginx

Открой конфиг сайта (обычно `/etc/nginx/sites-available/...` или `/etc/nginx/conf.d/...`),
тот самый `server { ... }`, где уже есть `location /` и `location /kazik`.

1. Вставь два `location`-блока из [`deploy/nginx-roy.conf`](deploy/nginx-roy.conf) внутрь этого `server {}`.
2. Убедись, что в `http {}` есть `map $http_upgrade $connection_upgrade { ... }` (см. комментарий
   в том же файле). **Если он уже есть — не дублируй.** Проверить:
   ```bash
   grep -R "connection_upgrade" /etc/nginx/
   ```
3. Применить:
   ```bash
   sudo nginx -t            # проверка синтаксиса
   sudo systemctl reload nginx
   ```

## 4. Проверить

Открой **http://45.114.61.202/roy/** (со слешом на конце — без него редиректнёт автоматически).
Должно появиться меню «РОЙ», в строке статуса — `ЛОББИ #1 · ИГРОКОВ 0/9 · АРЕНА ЖИВА`.
Жми «ВЫПУСТИТЬ РОЙ» — займёшь место бота. Открой вторую вкладку — увидишь второго живого игрока.

Быстрый smoke с самого сервера:
```bash
curl -sI http://127.0.0.1:3007/ | head -1                 # 200 (приложение живо)
curl -sI http://45.114.61.202/roy/ | head -1              # 200 (через nginx)
curl -s  http://45.114.61.202/roy/src/shared/constants.js | head -1   # JS отдаётся
```

## Обновление версии
```bash
cd /var/www/roy && git pull        # или перезалить файлы
npm install --omit=dev
pm2 restart roy
```

---

### Если прокси не nginx
- **Caddy:** `handle_path /roy/* { reverse_proxy 127.0.0.1:3007 }` (`handle_path` сам срезает префикс; reverse_proxy в Caddy проксирует websockets из коробки).
- **Apache:** нужен `mod_proxy`, `mod_proxy_http`, `mod_proxy_wstunnel`:
  ```apache
  ProxyPass        /roy/ http://127.0.0.1:3007/
  ProxyPassReverse /roy/ http://127.0.0.1:3007/
  # websocket:
  ProxyPass        /roy/ ws://127.0.0.1:3007/   # для Upgrade-запросов (через mod_rewrite по Upgrade-заголовку)
  ```
- **Node-гейтвей (express):** `app.use('/roy', createProxyMiddleware({ target:'http://127.0.0.1:3007', ws:true, pathRewrite:{'^/roy':''} }))`.

Главное в любом прокси: (1) срезать префикс `/roy`, (2) пробрасывать `Upgrade`/`Connection` для WebSocket.
