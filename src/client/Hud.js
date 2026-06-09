// On-screen HUD: leaderboard, kill feed, own stats + energy, lobby badge, control hints.
export class Hud {
  constructor() {
    this.boardRows = document.getElementById('boardRows');
    this.feedEl = document.getElementById('feed');
    this.mystats = document.getElementById('mystats');
    this.lobbyTag = document.getElementById('lobbyTag');
    this.condBtn = document.getElementById('condBtn');
    this.hintBar = document.getElementById('hintBar');
    this.menuHint = document.getElementById('menuHint');
    this.lobbyId = null;
    this._acc = 0;
    this._hintTimer = null;
    this.hintUsed = false;

    const touch = matchMedia('(pointer:coarse)').matches;
    this.menuHint.textContent = touch
      ? '📱 ПАЛЕЦ — НАПРАВЛЕНИЕ · КНОПКА СЖАТЬ — АТАКА'
      : '🖱 МЫШЬ — НАПРАВЛЕНИЕ · ЛКМ / ПРОБЕЛ — СЖАТЬ';
    this._touch = touch;
  }

  setLobby(id) { this.lobbyId = id; }

  addFeed(ev, selfId) {
    const row = document.createElement('div');
    const vn = ev.victimId === selfId ? '<span class="me">твой рой</span>' : ev.victimName;
    if (ev.byId != null) {
      const bn = ev.byId === selfId ? '<span class="me">ты</span>' : ev.byName;
      row.innerHTML = `<span class="k">${bn}</span> рассеял <span class="hot">${vn}</span>`;
    } else {
      row.innerHTML = `<span class="hot">${vn}</span> истаял`;
    }
    this.feedEl.prepend(row);
    while (this.feedEl.children.length > 5) this.feedEl.removeChild(this.feedEl.lastChild);
    setTimeout(() => row.remove(), 5800);
  }

  render(world, selfId, dt) {
    this._acc -= dt;
    if (this._acc > 0) return;
    this._acc = 0.25;

    const ranked = world.ranking();
    const self = selfId != null ? world.swarms.get(selfId) : null;
    let html = '';
    ranked.slice(0, 8).forEach((s, i) => {
      const tag = s.bot ? '<span class="bot"> бот</span>' : '';
      html += `<div class="brow ${s.id === selfId ? 'me' : ''}">
        <span class="nm">${i + 1}. ${s.name}${tag}</span><span>${s.n}</span></div>`;
    });
    if (self && ranked.indexOf(self) >= 8) {
      html += `<div class="brow me"><span class="nm">${ranked.indexOf(self) + 1}. ${self.name}</span><span>${self.n}</span></div>`;
    }
    this.boardRows.innerHTML = html;

    const humans = ranked.reduce((a, s) => a + (s.bot ? 0 : 1), 0);
    this.lobbyTag.textContent = `ЛОББИ #${this.lobbyId ?? '—'} · ИГРОКОВ ${humans}`;

    if (self) {
      const e = Math.max(0, Math.min(1, self.energy));
      this.mystats.innerHTML =
        `РОЙ <b>${self.n}</b> &nbsp; ЭНЕРГИЯ
         <div id="enWrap"><div id="enLabel">ЭНЕРГИЯ СЖАТИЯ</div>
         <div id="enBar"><div id="enFill" style="width:${(e * 100) | 0}%;
           background:${e < 0.25 ? 'var(--hot)' : 'var(--amber)'}"></div></div></div>`;
      const pct = (e * 100) | 0;
      this.condBtn.style.background = `linear-gradient(to top, rgba(255,195,77,.4) ${pct}%, rgba(255,195,77,.06) ${pct}%)`;
      this.condBtn.style.borderColor = e < 0.1 ? 'var(--hot)' : 'var(--amber)';
      this.condBtn.style.color = e < 0.1 ? 'var(--hot)' : 'var(--amber)';
    }
  }

  showHint() {
    this.hintBar.innerHTML = this._touch
      ? '👆 Веди пальцем в любом месте — рой летит в эту сторону<br>☄️ Держи кнопку <b style="color:var(--amber)">СЖАТЬ</b> — атака. Отпустил — рой кормится'
      : '🖱 Мышь — направление роя<br>☄️ Держи <b style="color:var(--amber)">ЛКМ или пробел</b> — сжатие для атаки';
    this.hintBar.style.display = 'block';
    clearTimeout(this._hintTimer);
    this._hintTimer = setTimeout(() => this.hideHint(), 9000);
  }
  hideHint() { this.hintBar.style.display = 'none'; }
}
