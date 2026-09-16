(function () {
  const grades = ['A', 'B+', 'B', 'C'];
  const state = {
    sb: null,
    session: null,
    attendances: [],
    matches: [],
    players: [],
    tab: 'rotasi',
    editingMatchId: null
  };

  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const gradeValue = (grade) => grades.indexOf(grade);
  const playerName = (id) => state.players.find((player) => player.id === id)?.name || 'Pemain';
  const playerGrade = (id) => state.players.find((player) => player.id === id)?.grade || 'C';
  const waitAt = (row) => new Date(row.wait_started_at || row.checked_in_at || Date.now()).getTime();
  const minTime = (iso) => new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  function getClient() {
    const supabaseGlobal = window.supabase || supabase;
    return supabaseGlobal.createClient(NEXA_CONFIG.supabaseUrl, NEXA_CONFIG.supabaseAnonKey);
  }

  function getMatchPlayers(match) {
    return (match.teams || []).flat().map((player) => player.id);
  }

  function attendanceByPlayer(id) {
    return state.attendances.find((row) => row.player_id === id || row.players?.id === id);
  }

  function requestsFor(player) {
    let opponents = [];
    try {
      const parsed = JSON.parse(player.opponent_request || '[]');
      opponents = Array.isArray(parsed) ? parsed : [];
    } catch {
      opponents = [];
    }
    return {
      partner: player.partner_request || null,
      opponents
    };
  }

  function waitMinutes(row) {
    return Math.max(0, Math.round((Date.now() - waitAt(row)) / 60000));
  }

  function renderShell() {
    $('#app').classList.remove('hide');
    $('#app').innerHTML = `
      <style>
        .nexa5{display:grid;gap:12px}
        .nexa5 .top{display:grid;gap:8px}
        .nexa5 .tabs{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
        .nexa5 .tabs button{background:#e6f6f8;color:#0f6170}
        .nexa5 .tabs button.active{background:#007c91;color:#fff}
        .nexa5 .grid{display:grid;gap:10px}
        .nexa5 .card2{background:#fff;border:1px solid #d9e2ec;border-radius:10px;padding:12px}
        .nexa5 .line{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
        .nexa5 .grow{flex:1;min-width:150px}
        .nexa5 .small{font-size:12px;color:#627d98}
        .nexa5 .pill{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:4px 8px;background:#e6fffb;color:#006b78;font-size:12px;font-weight:800}
        .nexa5 .danger{background:#fff3ed;color:#c2410c}
        .nexa5 .ghost{background:#f8fafc;color:#102a43;border:1px solid #cbd5e1}
        .nexa5 .match{border:1px solid #d9e2ec;border-radius:10px;padding:12px;margin-top:10px}
        .nexa5 .score{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px}
        .nexa5 input,.nexa5 select{width:100%;min-height:42px}
        .nexa5 button{min-height:42px}
        .nexa5 .bottomBar{position:sticky;bottom:0;background:#eef4f8;padding:10px 0}
        @media(max-width:520px){.nexa5 .tabs{grid-template-columns:repeat(2,1fr)}.nexa5 .score{grid-template-columns:1fr}}
      </style>
      <div class="nexa5">
        <div class="card2 top">
          <div class="line">
            <select id="nexaCourts" class="grow">
              <option value="3">3 lapangan aktif</option>
              <option value="4">4 lapangan aktif</option>
            </select>
            <button id="newSession">Sesi baru</button>
          </div>
          <div id="qrBox" class="small"></div>
        </div>

        <div class="tabs">
          <button data-tab="rotasi">Rotasi</button>
          <button data-tab="pemain">Pemain</button>
          <button data-tab="bola">Bola</button>
          <button data-tab="riwayat">Riwayat</button>
          <button data-tab="statistik">Statistik</button>
        </div>

        <div id="nexaContent"></div>
      </div>
    `;

    $('#newSession').addEventListener('click', newSession);
    $('#nexaCourts').addEventListener('change', updateCourts);
    document.querySelectorAll('[data-tab]').forEach((button) => {
      button.addEventListener('click', () => {
        state.tab = button.dataset.tab;
        render();
      });
    });
  }

  function render() {
    if (!$('#nexaContent')) return;
    document.querySelectorAll('[data-tab]').forEach((button) => {
      button.classList.toggle('active', button.dataset.tab === state.tab);
    });
    if (state.session) {
      $('#nexaCourts').value = state.session.courts;
      const url = new URL('checkin.html?session=' + state.session.id, location.href).href;
      $('#qrBox').innerHTML = `
        <b>QR absensi sesi ini</b><br>
        <img alt="QR absensi" style="width:150px;margin-top:8px;border-radius:8px" src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}">
        <div>${esc(url)}</div>
      `;
    }

    if (state.tab === 'rotasi') renderRotation();
    if (state.tab === 'pemain') renderPlayers();
    if (state.tab === 'bola') renderBalls();
    if (state.tab === 'riwayat') renderHistory();
    if (state.tab === 'statistik') renderStatistics();
  }

  function renderStatistics() {
    const rows = [...state.players].sort((a, b) => (b.wins || 0) - (a.wins || 0) || (b.games || 0) - (a.games || 0) || a.name.localeCompare(b.name));
    $('#nexaContent').innerHTML = `<div class="card2"><b>Statistik pemain</b><p class="small">Akumulasi seluruh sesi yang tersimpan di sistem.</p><div class="grid">${rows.length ? rows.map((p) => `<div class="line" style="border:1px solid #d9e2ec;border-radius:8px;padding:9px"><span class="pill">${esc(p.grade || 'C')}</span><div class="grow"><b>${esc(p.name)}</b><div class="small">${p.games || 0} match · ${p.wins || 0} menang · ${Math.max(0, (p.games || 0) - (p.wins || 0))} kalah</div></div><b>${p.balls || 0} bola</b></div>`).join('') : '<p class="small">Belum ada data pemain.</p>'}</div></div>`;
  }

  function renderRotation() {
    const playing = state.attendances.filter((row) => row.status === 'playing').length / 4;
    const waiting = state.attendances
      .filter((row) => row.status === 'active')
      .sort((a, b) => waitAt(a) - waitAt(b));
    const content = $('#nexaContent');
    content.innerHTML = `
      <div class="card2">
        <div class="line">
          <div class="grow">
            <b>${waiting.length} menunggu</b>
            <div class="small">${playing} match sedang main dari batas ${state.session?.courts || 3}</div>
          </div>
            <button id="generateTop">Buat match berikut</button>
            <button class="ghost" id="manualTop">Buat match manual</button>
        </div>
        ${renderPlayingMatches()}
      </div>
      <div class="card2">
        <b>Antrian duduk / istirahat</b>
        <div class="grid" style="margin-top:10px">
          ${waiting.length ? waiting.map(renderAttendanceRow).join('') : '<p class="small">Belum ada pemain menunggu.</p>'}
        </div>
      </div>
      <div class="bottomBar"><button id="generateBottom" style="width:100%">Buat match berikut</button></div>
    `;
    $('#generateTop').addEventListener('click', generateMatch);
    $('#generateBottom').addEventListener('click', generateMatch);
    $('#manualTop').addEventListener('click', renderManualForm);
    attachMatchActions();
  }

  function renderManualForm() {
    const active = state.attendances.filter((row) => row.status === 'active').map((row) => row.players).sort((a,b) => a.name.localeCompare(b.name));
    if (active.length < 4) return alert('Minimal 4 pemain berstatus aktif/menunggu.');
    const optionHtml = active.map((p) => `<option value="${p.id}">${esc(p.name)} - ${esc(p.grade)}</option>`).join('');
    const old = document.querySelector('[data-manual-form]');
    if (old) { old.remove(); return; }
    const card = document.createElement('div');
    card.className = 'card2'; card.dataset.manualForm = '1';
    card.innerHTML = `<b>Buat match manual</b><div class="small" style="margin:6px 0">Pilih urutan: Tim 1 pemain 1, Tim 1 pemain 2, Tim 2 pemain 1, Tim 2 pemain 2.</div><div class="score">${[0,1,2,3].map((i) => `<select data-manual-player="${i}">${optionHtml}</select>`).join('')}</div><button id="saveManual" style="width:100%;margin-top:10px">Simpan match manual</button>`;
    $('#nexaContent').prepend(card);
    $('#saveManual').addEventListener('click', saveManualMatch);
  }

  async function saveManualMatch() {
    const activePlaying = state.matches.filter((match) => match.status === 'playing').length;
    if (activePlaying >= state.session.courts) return alert('Semua slot match sedang berjalan.');
    const ids = [...document.querySelectorAll('[data-manual-player]')].map((s) => s.value);
    if (new Set(ids).size !== 4) return alert('Pilih 4 pemain yang berbeda.');
    const teams = [ids.slice(0,2).map((id) => ({ id, name: playerName(id), grade: playerGrade(id) })), ids.slice(2).map((id) => ({ id, name: playerName(id), grade: playerGrade(id) }))];
    const { error } = await state.sb.from('matches').insert({ session_id: state.session.id, court: state.matches.length + 1, teams, status: 'playing' });
    if (error) return alert(error.message);
    await Promise.all(ids.map((id) => { const a = attendanceByPlayer(id); return a ? state.sb.from('attendance').update({ status: 'playing' }).eq('id', a.id) : null; }));
    await refresh();
  }

  function renderAttendanceRow(row) {
    const player = row.players;
    const req = requestsFor(player);
    const details = [];
    if (req.partner) details.push('Partner: ' + playerName(req.partner));
    if (req.opponents.length) details.push('Lawan: ' + req.opponents.map(playerName).join(', '));
    return `
      <div class="line" style="border:1px solid #d9e2ec;border-radius:8px;padding:9px">
        <span class="pill">${esc(player.grade)}</span>
        <div class="grow"><b>${esc(player.name)}</b><div class="small">Menunggu ${waitMinutes(row)} menit${details.length ? ' · ' + esc(details.join(' · ')) : ''}</div></div>
        <button class="danger" data-home="${row.id}">Pulang</button>
      </div>
    `;
  }

  function renderPlayingMatches() {
    const playing = state.matches.filter((match) => match.status === 'playing');
    if (!playing.length) return '<p class="small">Belum ada match aktif.</p>';
    return playing.map((match, index) => renderMatchCard(match, index + 1)).join('');
  }

  function renderMatchCard(match, number) {
    const teamA = match.teams[0];
    const teamB = match.teams[1];
    const isEditing = state.editingMatchId === match.id;
    if (isEditing) return renderEditMatch(match, number);
    return `
      <div class="match" data-match-card="${match.id}">
        <div class="line">
          <b class="grow">Match ${number}</b>
          <button class="ghost" data-edit="${match.id}">Edit</button>
          <button class="danger" data-delete="${match.id}">Hapus</button>
        </div>
        <div style="margin-top:8px">
          <b>${teamA.map((p) => esc(p.name)).join(' + ')}</b>
          <div class="small">vs</div>
          <b>${teamB.map((p) => esc(p.name)).join(' + ')}</b>
        </div>
        <div class="score">
          <label>Skor tim 1<input inputmode="numeric" id="scoreA-${match.id}" placeholder="30"></label>
          <label>Skor tim 2<input inputmode="numeric" id="scoreB-${match.id}" placeholder="28"></label>
          <label>Bola<input inputmode="numeric" id="balls-${match.id}" placeholder="3"></label>
        </div>
        <button data-finish="${match.id}" style="width:100%;margin-top:10px">Simpan skor dan bola</button>
      </div>
    `;
  }

  function renderEditMatch(match, number) {
    const selected = getMatchPlayers(match);
    const options = state.attendances
      .filter((row) => row.status === 'active' || selected.includes(row.players.id))
      .map((row) => row.players)
      .sort((a, b) => a.name.localeCompare(b.name));
    const select = (idx) => `
      <select data-edit-player="${idx}">
        ${options.map((player) => `<option value="${player.id}" ${selected[idx] === player.id ? 'selected' : ''}>${esc(player.name)} - ${esc(player.grade)}</option>`).join('')}
      </select>
    `;
    return `
      <div class="match">
        <b>Ubah Match ${number}</b>
        <div class="score">${select(0)}${select(1)}${select(2)}${select(3)}</div>
        <div class="small" style="margin-top:8px">Urutan: Tim 1 pemain 1, Tim 1 pemain 2, Tim 2 pemain 1, Tim 2 pemain 2.</div>
        <div class="line" style="margin-top:10px">
          <button data-save-edit="${match.id}" class="grow">Simpan edit</button>
          <button data-cancel-edit class="ghost">Batal</button>
        </div>
      </div>
    `;
  }

  function renderPlayers() {
    const rows = [...state.attendances].sort((a, b) => {
      const order = { active: 0, playing: 1, home: 2 };
      return order[a.status] - order[b.status] || a.players.name.localeCompare(b.players.name);
    });
    $('#nexaContent').innerHTML = `
      <div class="card2">
        <b>Pemain sesi ini</b>
        <div class="grid" style="margin-top:10px">
          ${rows.length ? rows.map((row) => `
            <div class="line" style="border:1px solid #d9e2ec;border-radius:8px;padding:9px">
              <span class="pill">${esc(row.players.grade)}</span>
              <div class="grow"><b>${esc(row.players.name)}</b><div class="small">${row.status} · datang ${minTime(row.checked_in_at)}</div></div>
              ${row.status === 'home' ? `<button data-active="${row.id}">Datang lagi</button>` : `<button class="danger" data-home="${row.id}">Pulang</button>`}
            </div>
          `).join('') : '<p class="small">Belum ada pemain absen.</p>'}
        </div>
      </div>
    `;
    attachAttendanceActions();
  }

  function renderBalls() {
    const totals = new Map();
    state.matches.filter((match) => match.status === 'done').forEach((match) => {
      getMatchPlayers(match).forEach((id) => {
        totals.set(id, (totals.get(id) || 0) + (match.balls || 0));
      });
    });
    const rows = [...totals.entries()]
      .map(([id, balls]) => ({ id, balls, name: playerName(id), grade: playerGrade(id) }))
      .sort((a, b) => b.balls - a.balls || a.name.localeCompare(b.name));
    $('#nexaContent').innerHTML = `
      <div class="card2">
        <b>Total bola sesi ini</b>
        <p class="small">Ini hanya menghitung match di sesi yang sedang dibuka, tidak digabung sesi lain.</p>
        <div class="grid">
          ${rows.length ? rows.map((row) => `
            <div class="line" style="border:1px solid #d9e2ec;border-radius:8px;padding:9px">
              <span class="pill">${esc(row.grade)}</span>
              <div class="grow"><b>${esc(row.name)}</b></div>
              <b>${row.balls} bola</b>
            </div>
          `).join('') : '<p class="small">Belum ada match selesai di sesi ini.</p>'}
        </div>
      </div>
    `;
  }

  function renderHistory() {
    const rows = state.matches.filter((match) => match.status === 'done');
    const totalBalls = rows.reduce((sum, match) => sum + (Number(match.balls) || 0), 0);
    const attendanceCount = state.attendances.length;
    $('#nexaContent').innerHTML = `
      <div class="card2">
        <div class="line"><b class="grow">Laporan sesi ini</b><button class="ghost" id="exportSession">Export CSV</button></div>
        <div class="small" style="margin-top:8px">${attendanceCount} pemain hadir · ${rows.length} match selesai · ${totalBalls} bola tercatat</div>
        ${rows.length ? rows.map((match, index) => `
          <div class="match">
            <b>Match ${index + 1}</b>
            <div>${match.teams[0].map((p) => esc(p.name)).join(' + ')} vs ${match.teams[1].map((p) => esc(p.name)).join(' + ')}</div>
            <div class="small">Skor ${match.score_a} - ${match.score_b} · ${match.balls || 0} bola per pemain</div>
            <div class="line" style="margin-top:6px"><button class="ghost" data-edit-done="${match.id}">Edit hasil</button><button class="danger" data-cancel-done="${match.id}">Batalkan hasil</button></div>
          </div>
        `).join('') : '<p class="small">Belum ada match selesai.</p>'}
      </div>
    `;
    $('#exportSession').addEventListener('click', exportSession);
    document.querySelectorAll('[data-edit-done]').forEach((b) => b.addEventListener('click', () => editDoneMatch(b.dataset.editDone)));
    document.querySelectorAll('[data-cancel-done]').forEach((b) => b.addEventListener('click', () => cancelDoneMatch(b.dataset.cancelDone)));
  }

  function exportSession() {
    const lines = [['Match','Tim 1','Tim 2','Skor Tim 1','Skor Tim 2','Bola per pemain']];
    state.matches.filter((m) => m.status === 'done').forEach((m, i) => lines.push([i + 1, m.teams[0].map(p => p.name).join(' + '), m.teams[1].map(p => p.name).join(' + '), m.score_a, m.score_b, m.balls || 0]));
    const csv = lines.map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'pb-nexa-laporan-sesi.csv'; a.click(); URL.revokeObjectURL(a.href);
  }

  async function editDoneMatch(id) {
    const m = state.matches.find(x => x.id === id); if (!m) return;
    const scoreA = Number(prompt('Skor Tim 1:', m.score_a)); const scoreB = Number(prompt('Skor Tim 2:', m.score_b)); const balls = Number(prompt('Bola per pemain:', m.balls || 0));
    if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB) || scoreA === scoreB || !Number.isFinite(balls) || balls < 0) return alert('Data hasil tidak valid.');
    const delta = balls - (Number(m.balls) || 0);
    await Promise.all(getMatchPlayers(m).map(id => state.sb.from('players').select('balls').eq('id', id).single().then(({data}) => state.sb.from('players').update({ balls: (data?.balls || 0) + delta }).eq('id', id))));
    await state.sb.from('matches').update({ score_a: scoreA, score_b: scoreB, balls }).eq('id', id); await refresh();
  }

  async function cancelDoneMatch(id) {
    const m = state.matches.find(x => x.id === id); if (!m || !confirm('Batalkan hasil match ini? Match kembali menjadi aktif dan statistik bola dikurangi.')) return;
    await Promise.all(getMatchPlayers(m).map(pid => state.sb.from('players').select('balls').eq('id', pid).single().then(({data}) => state.sb.from('players').update({ balls: Math.max(0, (data?.balls || 0) - (Number(m.balls) || 0)) }).eq('id', pid))));
    await state.sb.from('matches').update({ status: 'playing', score_a: null, score_b: null, balls: null, ended_at: null }).eq('id', id); await Promise.all(getMatchPlayers(m).map(pid => { const a = attendanceByPlayer(pid); return a ? state.sb.from('attendance').update({ status: 'playing' }).eq('id', a.id) : null; })); await refresh();
  }

  function attachAttendanceActions() {
    document.querySelectorAll('[data-home]').forEach((button) => {
      button.addEventListener('click', () => setAttendanceStatus(button.dataset.home, 'home'));
    });
    document.querySelectorAll('[data-active]').forEach((button) => {
      button.addEventListener('click', () => setAttendanceStatus(button.dataset.active, 'active'));
    });
  }

  function attachMatchActions() {
    attachAttendanceActions();
    document.querySelectorAll('[data-finish]').forEach((button) => {
      button.addEventListener('click', () => finishMatch(button.dataset.finish));
    });
    document.querySelectorAll('[data-delete]').forEach((button) => {
      button.addEventListener('click', () => deleteMatch(button.dataset.delete));
    });
    document.querySelectorAll('[data-edit]').forEach((button) => {
      button.addEventListener('click', () => {
        state.editingMatchId = button.dataset.edit;
        render();
      });
    });
    document.querySelectorAll('[data-cancel-edit]').forEach((button) => {
      button.addEventListener('click', () => {
        state.editingMatchId = null;
        render();
      });
    });
    document.querySelectorAll('[data-save-edit]').forEach((button) => {
      button.addEventListener('click', () => saveEditMatch(button.dataset.saveEdit));
    });
  }

  async function refresh() {
    if (!state.session) return;
    const [{ data: attendances }, { data: matches }, { data: players }] = await Promise.all([
      state.sb.from('attendance').select('*,players(*)').eq('session_id', state.session.id).order('checked_in_at'),
      state.sb.from('matches').select('*').eq('session_id', state.session.id).order('created_at'),
      state.sb.from('players').select('*').order('name')
    ]);
    state.attendances = attendances || [];
    state.matches = matches || [];
    state.players = players || [];
    render();
  }

  async function loadActiveSession() {
    const { data } = await state.sb.from('sessions').select('*').eq('active', true).order('created_at', { ascending: false }).limit(1);
    state.session = data?.[0] || null;
    if (!state.session) await newSession();
    else await refresh();
  }

  async function newSession() {
    if (state.session) await state.sb.from('sessions').update({ active: false, closed_at: new Date().toISOString() }).eq('id', state.session.id);
    const { data, error } = await state.sb.from('sessions').insert({ courts: +($('#nexaCourts')?.value || 3) }).select('*').single();
    if (error) return alert(error.message);
    state.session = data;
    await refresh();
  }

  async function updateCourts() {
    if (!state.session) return;
    await state.sb.from('sessions').update({ courts: +$('#nexaCourts').value }).eq('id', state.session.id);
    state.session.courts = +$('#nexaCourts').value;
    render();
  }

  async function setAttendanceStatus(attendanceId, status) {
    const payload = { status };
    if (status === 'home') payload.left_at = new Date().toISOString();
    if (status === 'active') {
      payload.left_at = null;
      payload.wait_started_at = new Date().toISOString();
    }
    await state.sb.from('attendance').update(payload).eq('id', attendanceId);
    await refresh();
  }

  function combinations(items, size) {
    const result = [];
    function walk(start, combo) {
      if (combo.length === size) {
        result.push(combo);
        return;
      }
      for (let i = start; i <= items.length - (size - combo.length); i += 1) {
        walk(i + 1, combo.concat(items[i]));
      }
    }
    walk(0, []);
    return result;
  }

  function teamOptions(four) {
    return [
      [[four[0], four[1]], [four[2], four[3]]],
      [[four[0], four[2]], [four[1], four[3]]],
      [[four[0], four[3]], [four[1], four[2]]]
    ];
  }

  function requestScore(teams) {
    let score = 0;
    teams.forEach((team, teamIndex) => {
      team.forEach((row) => {
        const req = requestsFor(row.players);
        if (req.partner && team.some((mate) => mate.players.id === req.partner)) score += 30;
        req.opponents.forEach((opponentId) => {
          if (teams[1 - teamIndex].some((opp) => opp.players.id === opponentId)) score += 18;
        });
      });
    });
    return score;
  }

  function matchScore(teams, oldestIds) {
    const flat = teams.flat();
    const maxDiff = Math.max(...flat.map((row) => gradeValue(row.players.grade))) - Math.min(...flat.map((row) => gradeValue(row.players.grade)));
    if (maxDiff > 1) return -99999;

    const pairPenalty = teams.reduce((sum, team) => {
      return sum + Math.abs(gradeValue(team[0].players.grade) - gradeValue(team[1].players.grade)) * 8;
    }, 0);
    const balancePenalty = Math.abs(
      teams[0].reduce((sum, row) => sum + gradeValue(row.players.grade), 0) -
      teams[1].reduce((sum, row) => sum + gradeValue(row.players.grade), 0)
    ) * 12;
    const waitBonus = flat.reduce((sum, row) => sum + Math.min(90, waitMinutes(row)), 0);
    const oldestBonus = flat.reduce((sum, row) => sum + (oldestIds.includes(row.players.id) ? 80 : 0), 0);
    const sameGradeBonus = maxDiff === 0 ? 80 : 0;
    return waitBonus + oldestBonus + sameGradeBonus + requestScore(teams) - pairPenalty - balancePenalty;
  }

  function pickBestMatch() {
    const waiting = state.attendances
      .filter((row) => row.status === 'active')
      .sort((a, b) => waitAt(a) - waitAt(b));
    if (waiting.length < 4) return null;

    const pool = waiting.slice(0, 12);
    const oldestIds = waiting.slice(0, 4).map((row) => row.players.id);
    let best = null;
    let bestScore = -Infinity;

    combinations(pool, 4).forEach((four) => {
      teamOptions(four).forEach((teams) => {
        const score = matchScore(teams, oldestIds);
        if (score > bestScore) {
          best = teams;
          bestScore = score;
        }
      });
    });

    return best;
  }

  async function generateMatch() {
    const activePlaying = state.matches.filter((match) => match.status === 'playing').length;
    if (activePlaying >= state.session.courts) {
      alert('Semua slot match sedang berjalan. Selesaikan match dulu sebelum generate lagi.');
      return;
    }

    const teams = pickBestMatch();
    if (!teams) {
      alert('Belum ada 4 pemain yang cocok untuk dibuatkan match.');
      return;
    }

    const payloadTeams = teams.map((team) => team.map((row) => ({
      id: row.players.id,
      name: row.players.name,
      grade: row.players.grade
    })));
    const currentNumber = state.matches.length + 1;
    const { error } = await state.sb.from('matches').insert({
      session_id: state.session.id,
      court: currentNumber,
      teams: payloadTeams,
      status: 'playing'
    });
    if (error) return alert(error.message);

    await Promise.all(teams.flat().map((row) => {
      return state.sb.from('attendance').update({ status: 'playing' }).eq('id', row.id);
    }));
    await refresh();
  }

  async function finishMatch(matchId) {
    const match = state.matches.find((row) => row.id === matchId);
    const scoreA = Number($('#scoreA-' + matchId).value);
    const scoreB = Number($('#scoreB-' + matchId).value);
    const balls = Number($('#balls-' + matchId).value);
    if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB) || scoreA === scoreB || !Number.isFinite(balls) || balls < 0) {
      alert('Isi skor tim 1, skor tim 2, dan jumlah bola dengan benar.');
      return;
    }

    const winner = scoreA > scoreB ? 0 : 1;
    const now = new Date().toISOString();
    for (let teamIndex = 0; teamIndex < match.teams.length; teamIndex += 1) {
      for (const matchPlayer of match.teams[teamIndex]) {
        const player = state.players.find((row) => row.id === matchPlayer.id);
        const attendance = attendanceByPlayer(matchPlayer.id);
        if (!player || !attendance) continue;

        const ownAvg = match.teams[teamIndex].reduce((sum, item) => sum + gradeValue(item.grade), 0) / 2;
        const oppAvg = match.teams[1 - teamIndex].reduce((sum, item) => sum + gradeValue(item.grade), 0) / 2;
        const facingStronger = oppAvg < ownAvg;
        const delta = teamIndex === winner ? (facingStronger ? 2 : 1) : (facingStronger ? -1 : -2);
        let rating = (player.rating || 0) + delta;
        let grade = player.grade;
        const gradeIndex = gradeValue(grade);

        if (rating >= 6 && gradeIndex > 0) {
          grade = grades[gradeIndex - 1];
          rating = 0;
        }
        if (rating <= -6 && gradeIndex < grades.length - 1) {
          grade = grades[gradeIndex + 1];
          rating = 0;
        }

        await state.sb.from('players').update({
          games: (player.games || 0) + 1,
          wins: (player.wins || 0) + (teamIndex === winner ? 1 : 0),
          balls: (player.balls || 0) + balls,
          rating,
          grade
        }).eq('id', player.id);
        await state.sb.from('attendance').update({
          status: 'active',
          wait_started_at: now
        }).eq('id', attendance.id);
      }
    }

    await state.sb.from('matches').update({
      status: 'done',
      score_a: scoreA,
      score_b: scoreB,
      balls,
      ended_at: now
    }).eq('id', matchId);
    await refresh();
  }

  async function deleteMatch(matchId) {
    const match = state.matches.find((row) => row.id === matchId);
    if (!match) return;
    if (!confirm('Hapus match ini dan kembalikan pemain ke antrian?')) return;

    await Promise.all(getMatchPlayers(match).map((playerId) => {
      const attendance = attendanceByPlayer(playerId);
      if (!attendance) return Promise.resolve();
      return state.sb.from('attendance').update({ status: 'active' }).eq('id', attendance.id);
    }));
    await state.sb.from('matches').delete().eq('id', matchId);
    await refresh();
  }

  async function saveEditMatch(matchId) {
    const match = state.matches.find((row) => row.id === matchId);
    const ids = [...document.querySelectorAll('[data-edit-player]')].map((select) => select.value);
    if (new Set(ids).size !== 4) {
      alert('Pemain dalam satu match tidak boleh sama.');
      return;
    }

    const oldIds = getMatchPlayers(match);
    const nextTeams = [
      ids.slice(0, 2).map((id) => ({ id, name: playerName(id), grade: playerGrade(id) })),
      ids.slice(2, 4).map((id) => ({ id, name: playerName(id), grade: playerGrade(id) }))
    ];
    const removedIds = oldIds.filter((id) => !ids.includes(id));
    const addedIds = ids.filter((id) => !oldIds.includes(id));

    await Promise.all(removedIds.map((id) => {
      const attendance = attendanceByPlayer(id);
      if (!attendance) return Promise.resolve();
      return state.sb.from('attendance').update({ status: 'active' }).eq('id', attendance.id);
    }));
    await Promise.all(addedIds.map((id) => {
      const attendance = attendanceByPlayer(id);
      if (!attendance) return Promise.resolve();
      return state.sb.from('attendance').update({ status: 'playing' }).eq('id', attendance.id);
    }));
    await state.sb.from('matches').update({ teams: nextTeams }).eq('id', matchId);
    state.editingMatchId = null;
    await refresh();
  }

  async function boot() {
    if (!window.NEXA_CONFIG || !NEXA_CONFIG.supabaseUrl.startsWith('http')) return;
    state.sb = getClient();
    const { data } = await state.sb.auth.getUser();
    if (!data?.user) return;
    renderShell();
    await loadActiveSession();
    state.sb.channel('nexa-phase-5')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, refresh)
      .subscribe();
  }

  setTimeout(boot, 1200);
}());
