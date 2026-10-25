'use strict';
// ===== Đọc hiểu 読解 (問題4 短文 · 問題5 中文 · 問題6 情報検索) =====
// Dữ liệu READING (reading/*.jsonl -> data.js). Markup trong văn bản:
//   {漢字|よみ} furigana in sẵn trong đề · [漢字|よみ] furigana hỗ trợ (bật/tắt) · __x__ gạch chân
//   dòng "# " tiêu đề · "> " căn phải · "|a|b|" hàng bảng
const RD = (typeof READING === 'undefined' ? [] : READING).slice()
  .sort((a, b) => (a.exam < b.exam ? 1 : a.exam > b.exam ? -1 : 0) || a.part - b.part || a.set - b.set);
const RD_PART = {
  4: { name: '問題4 短文', vi: 'Đoạn ngắn', mins: 4,
       desc: 'Thư, email, ghi chú, đoạn văn ngắn — mỗi bài 1 câu hỏi. Mục tiêu ~3–4 phút/bài.',
       instr: '問題4　つぎの　文章を　読んで、質問に　答えて　ください。答えは、１・２・３・４から　いちばん　いい　ものを　一つ　えらんで　ください。' },
  5: { name: '問題5 中文', vi: 'Đoạn trung bình', mins: 9,
       desc: 'Một bài văn dài hơn (thường là bài viết của du học sinh) — 3–4 câu hỏi theo thứ tự đoạn văn. Mục tiêu ~8–10 phút.',
       instr: '問題5　つぎの　文章を　読んで、質問に　答えて　ください。答えは、１・２・３・４から　いちばん　いい　ものを　一つ　えらんで　ください。' },
  6: { name: '問題6 情報検索', vi: 'Tìm thông tin', mins: 7,
       desc: 'Thông báo, tờ rơi, bảng giờ/giá — tìm đúng thông tin theo điều kiện trong câu hỏi. Mục tiêu ~6–8 phút.',
       instr: '問題6　つぎの　ページを　見て、下の　質問に　答えて　ください。答えは、１・２・３・４から　いちばん　いい　ものを　一つ　えらんで　ください。' },
};
const KIND_INFO = {
  detail: ['Hỏi chi tiết', 'Tìm từ khoá của câu hỏi trong bài rồi đọc kỹ câu chứa nó. So từng lựa chọn với đúng câu đó, không đoán theo cảm giác.'],
  reason: ['Hỏi lý do (どうして・なぜ)', 'Tìm 〜から・〜ので・〜ため・〜て gần chỗ được hỏi. Lý do có khi nằm ở câu ngay TRƯỚC hoặc ngay SAU.'],
  reference: ['Từ chỉ thị (それ・この・そこ…)', 'それ/この/そう… gần như luôn chỉ điều vừa nói ở câu NGAY TRƯỚC. Thử đặt đáp án vào chỗ đó xem câu có hợp nghĩa không.'],
  underline: ['Phần gạch chân', 'Đọc câu trước và câu sau phần gạch chân — bài thường giải thích lại ý đó bằng từ khác ngay bên cạnh.'],
  main: ['Ý chính / người viết muốn nói gì', 'Xem đoạn CUỐI và các câu có 〜と思います・〜たいです・〜ほうがいい・〜が大切です. Ý quan trọng hay đứng sau でも・しかし.'],
  search: ['Tìm thông tin', 'Gạch điều kiện trong câu hỏi (ngày, giờ, giá, ai, mấy người…), chỉ dò hàng/cột liên quan, và đọc kỹ dòng ※ chú thích.'],
  action: ['Phải làm gì', 'Tìm 〜てください・〜てくれませんか・〜なければなりません・〜ましょう — thường ở cuối thư/thông báo. Chú ý AI là người phải làm.'],
  truefalse: ['Chọn câu đúng với nội dung', 'Kiểm tra lần lượt từng lựa chọn với bài; câu sai thường chỉ lệch một chi tiết nhỏ (thời gian, người, số lượng).'],
};
const GUIDE_HTML = `
<h3>🧭 Cách làm bài đọc hiểu N4</h3>
<details open><summary><b>1. Phần đọc N4 gồm gì? Phân bổ thời gian ra sao?</b></summary>
<ul>
  <li>Đọc hiểu nằm chung giờ với Ngữ pháp (言語知識（文法）・読解, khoảng 55–60 phút). Làm Ngữ pháp nhanh (~15–20 phút) để dành <b>~35 phút</b> cho bài đọc.</li>
  <li><b>問題4 短文</b> — 3–4 đoạn ngắn (thư, email, ghi chú), mỗi đoạn 1 câu: <b>~3–4 phút/đoạn</b>.</li>
  <li><b>問題5 中文</b> — 1 bài dài (~400–500 chữ), 3–4 câu: <b>~8–10 phút</b>.</li>
  <li><b>問題6 情報検索</b> — tờ thông báo / bảng, 1–2 câu: <b>~6–8 phút</b>.</li>
  <li>Bài nào quá giờ thì <b>chọn đáp án hợp lý nhất rồi đi tiếp</b> — không bỏ trống, không sa lầy một câu.</li>
</ul></details>
<details open><summary><b>2. Quy trình 4 bước cho mọi bài</b></summary>
<ol>
  <li><b>Đọc câu dẫn và CÂU HỎI trước</b> (dòng 「これは…メールです」 và câu hỏi bên dưới). Biết mình cần tìm gì thì đọc nhanh hơn rất nhiều. Gạch từ khoá trong câu hỏi: ai? khi nào? làm gì? vì sao?</li>
  <li><b>Đọc lướt cả bài một lượt</b> để nắm: ai viết cho ai, chuyện gì, kết luận gì. Gặp từ lạ thì <b>bỏ qua</b>, đoán theo ngữ cảnh — đừng dừng lại.</li>
  <li><b>Quay lại chỗ chứa từ khoá</b>, đọc kỹ câu đó cùng câu trước và câu sau. Đáp án gần như luôn nằm ở đây.</li>
  <li><b>Loại trừ</b>: so từng lựa chọn với bài. Lựa chọn sai thường: dùng đúng từ trong bài nhưng sai ý, sai người, sai thời điểm, hoặc “đúng nhưng không phải điều câu hỏi hỏi”.</li>
</ol></details>
<details><summary><b>3. Mẹo riêng cho từng dạng</b></summary>
<ul>
  <li><b>短文 (thư, email, memo)</b>: câu hỏi hay là “người nhận phải làm gì?”. Tìm 〜てください・〜てくれませんか・〜ましょう ở <b>cuối</b> bài. Chú ý ai làm cho ai: 〜てもらう / 〜てくれる / 〜てあげる.</li>
  <li><b>中文 (bài dài)</b>: các câu hỏi đi <b>theo thứ tự đoạn văn</b> — câu 1 ở đầu bài, câu cuối ở cuối bài. Phần <u>gạch chân</u>: đọc ngay câu trước/sau. Câu cuối thường hỏi ý chính → đọc kỹ đoạn cuối.</li>
  <li><b>情報検索 (thông báo, bảng)</b>: <b>KHÔNG</b> đọc hết tờ thông báo. Đọc câu hỏi, gạch điều kiện (thứ mấy, mấy giờ, bao nhiêu tiền, ai được tham gia…), rồi chỉ dò phần bảng liên quan. Luôn đọc dòng <b>※</b> (chú thích) và các từ 〜以上・〜以下・〜まで・〜から・〜以外.</li>
</ul></details>
<details><summary><b>4. Những từ “tín hiệu” nên để ý</b></summary>
<table class="sig-table">
  <tr><td class="jp">でも・しかし・けれども・が</td><td>Ý quan trọng nằm <b>sau</b> từ này.</td></tr>
  <tr><td class="jp">〜から・〜ので・〜ため（に）・〜て</td><td>Lý do → trả lời câu hỏi どうして／なぜ.</td></tr>
  <tr><td class="jp">だから・それで・そのため</td><td>Kết quả của điều vừa nói.</td></tr>
  <tr><td class="jp">それ・これ・その〜・この〜・そう</td><td>Chỉ điều vừa nói ở câu ngay trước.</td></tr>
  <tr><td class="jp">〜と思います・〜たいです・〜ほうがいい</td><td>Ý kiến / mong muốn của người viết → câu hỏi ý chính.</td></tr>
  <tr><td class="jp">〜てください・〜なければなりません・〜ないでください</td><td>Việc phải làm / không được làm.</td></tr>
  <tr><td class="jp">〜前に・〜後で・〜までに・〜てから</td><td>Thứ tự thời gian — bẫy hay gặp.</td></tr>
  <tr><td class="jp">〜かもしれません・〜はずです・〜そうです</td><td>Mức độ chắc chắn — đừng nhầm “có thể” thành “chắc chắn”.</td></tr>
</table></details>
<details><summary><b>5. Cách luyện với app này (mỗi ngày 1–2 bài)</b></summary>
<ol>
  <li><b>Lần 1 — như thi thật:</b> tắt “Furigana hỗ trợ”, để ý đồng hồ (mục tiêu hiện cạnh giờ), làm rồi Nộp bài.</li>
  <li><b>Xem chữa:</b> chỗ <mark>tô vàng</mark> trong bài là căn cứ của đáp án — tự hỏi “vì sao mình không thấy chỗ này?”. Đọc giải thích từng lựa chọn sai.</li>
  <li><b>Lần 2 — đọc kỹ:</b> bật furigana, xem bản dịch, học các từ trong mục “Từ vựng của bài”. Bấm 🔊 nghe bài và đọc nhẩm theo để quen nhịp câu tiếng Nhật.</li>
  <li><b>Vài ngày sau</b>, bấm “🔁 Làm lại bài sai” để làm lại những bài từng sai (app tự nhắc theo lịch 1 → 3 → 7 → 14 ngày).</li>
</ol></details>`;

const rdQid = (p, q) => `R|${p.exam}|${p.part}|${p.set}|${q.no}`;
const rdLabel = p => `${examLabel(p.exam)} · ${RD_PART[p.part].name}${p.part === 4 || RD.some(o => o !== p && o.exam === p.exam && o.part === p.part) ? ` (${p.set})` : ''}`;
function rdStatus(p) {
  const st = p.qs.map(q => qstat(rdQid(p, q)));
  if (st.every(s => !s)) return 'new';
  if (p.qs.some(q => isQDue(rdQid(p, q)))) return 'due';
  return st.every(s => s && s.box > 0) ? 'done' : 'due';
}

// ----- Hiển thị văn bản có markup -----
const RUBY_RE = /\{([^{}|]*)\|([^{}|]*)\}|\[([^\[\]|]*)\|([^\[\]|]*)\]|__/g;
function rdTokens(str) {
  const out = [];
  let ul = false, last = 0, m;
  const plainChars = s => [...s].forEach(ch => out.push({ plain: ch, say: ch, html: esc(ch), ul }));
  RUBY_RE.lastIndex = 0;
  while ((m = RUBY_RE.exec(str))) {
    plainChars(str.slice(last, m.index));
    last = RUBY_RE.lastIndex;
    if (m[0] === '__') { ul = !ul; continue; }
    const aid = m[1] === undefined;
    const base = aid ? m[3] : m[1], read = aid ? m[4] : m[2];
    out.push({ plain: base, say: read, ul, html: `<ruby${aid ? ' class="aid"' : ''}>${esc(base)}<rt>${esc(read)}</rt></ruby>` });
  }
  plainChars(str.slice(last));
  return out;
}
// Tách ô bảng theo "|" nằm ngoài {..|..} và [..|..]
function rdCells(line) {
  const cells = [];
  let cur = '', depth = 0;
  for (const ch of line.replace(/^\||\|$/g, '')) {
    if (ch === '{' || ch === '[') depth++;
    if (ch === '}' || ch === ']') depth--;
    if (ch === '|' && depth === 0) { cells.push(cur); cur = ''; } else cur += ch;
  }
  cells.push(cur);
  return cells;
}
// Trả về { html, plain, say } — ranges: [{s, e}] vị trí (theo văn bản thuần) cần tô vàng
function rdRender(text, ranges = []) {
  let off = 0, plain = '', say = '', html = '', table = null;
  const span = toks => toks.map(t => {
    const s = off, e = off + t.plain.length;
    off = e; plain += t.plain; say += t.say;
    let h = t.html;
    if (ranges.some(r => r.s < e && r.e > s)) h = `<mark class="ev">${h}</mark>`;
    return t.ul ? `<u class="ul">${h}</u>` : h;
  }).join('');
  const flush = () => { if (table) { html += `<table class="rd-table">${table}</table>`; table = null; } };
  text.split('\n').forEach((line, i) => {
    if (i) { off++; plain += '\n'; say += '\n'; }
    if (line.startsWith('|')) {
      const first = !table;
      table ||= '';
      table += '<tr>' + rdCells(line).map(c => `<${first ? 'th' : 'td'}>${span(rdTokens(c))}</${first ? 'th' : 'td'}>`).join('') + '</tr>';
      return;
    }
    flush();
    if (line.startsWith('# ')) html += `<div class="rd-h">${span(rdTokens(line.slice(2)))}</div>`;
    else if (line.startsWith('> ')) html += `<div class="rd-right">${span(rdTokens(line.slice(2)))}</div>`;
    else html += `<p>${span(rdTokens(line)) || '&nbsp;'}</p>`;
  });
  flush();
  return { html, plain, say };
}
const rdInline = s => rdRender(s || '').html.replace(/^<p>|<\/p>$/g, '').replace(/<\/p><p>/g, '<br>');
function rdRanges(p, qs) {
  const plain = rdRender(p.passage).plain;
  const out = [];
  qs.forEach(q => (q.ev || []).forEach(e => { const s = plain.indexOf(e); if (s >= 0) out.push({ s, e: s + e.length }); }));
  return out;
}

// ----- Trang danh sách -----
let rdTab = 0;
function renderReadHome() {
  $('readRun').classList.add('hidden');
  $('readHome').classList.remove('hidden');
  const nq = RD.reduce((n, p) => n + p.qs.length, 0);
  const st = RD.map(rdStatus);
  const doneQ = RD.reduce((n, p) => n + p.qs.filter(q => qstat(rdQid(p, q))).length, 0);
  const rightQ = RD.reduce((n, p) => n + p.qs.filter(q => (qstat(rdQid(p, q))?.box || 0) > 0).length, 0);
  $('readStats').textContent = RD.length
    ? `${RD.length} bài · ${nq} câu từ ${new Set(RD.map(p => p.exam)).size} đề · đã làm ${st.filter(s => s !== 'new').length} bài` +
      (doneQ ? ` · lần gần nhất đúng ${rightQ}/${doneQ} câu` : '')
    : 'Chưa có dữ liệu bài đọc.';
  const next = rdNextList()[0];
  $('readNextInfo').textContent = next ? rdLabel(next) : 'Đã làm hết — làm lại bài sai nhé';
  const due = RD.filter((p, i) => st[i] === 'due');
  $('readRetryInfo').textContent = due.length ? `${due.length} bài cần làm lại` : 'Chưa có bài nào cần làm lại';
  document.querySelectorAll('#readTabs button').forEach(b => b.classList.toggle('active', Number(b.dataset.p) === rdTab));
  $('readTabDesc').textContent = rdTab ? RD_PART[rdTab].desc : 'Bấm vào một bài để làm. Xanh = lần gần nhất đúng hết · Cam = có câu sai, nên làm lại · Viền nét đứt = chưa làm.';
  const exams = [...new Set(RD.map(p => p.exam))];
  $('readList').innerHTML = exams.map(ex => {
    const ps = RD.filter(p => p.exam === ex && (!rdTab || p.part === rdTab));
    if (!ps.length) return '';
    return `<div class="rd-exam"><div class="rd-exam-head"><b>${esc(examLabel(ex))}</b>
        <button class="btn small" data-rexam="${esc(ex)}">Làm cả ${rdTab ? RD_PART[rdTab].name : 'phần đọc'}</button></div>
      <div class="book-grid">${ps.map(p => {
        const s = rdStatus(p);
        return `<button class="book-test rd-${s}${s === 'done' ? ' done' : s === 'due' ? ' tried' : ''}" data-ri="${RD.indexOf(p)}">
          <b>${esc(RD_PART[p.part].name.split(' ')[0])}${p.part === 4 || ps.filter(o => o.part === p.part).length > 1 ? ` (${p.set})` : ''}</b>
          <span>${esc(RD_PART[p.part].vi)} · ${p.qs.length} câu</span></button>`;
      }).join('')}</div></div>`;
  }).join('');
}
function rdNextList() {
  const fresh = RD.filter(p => rdStatus(p) === 'new');
  return rdTab ? fresh.filter(p => p.part === rdTab) : fresh;
}
$('readTabs').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (b) { rdTab = Number(b.dataset.p); renderReadHome(); } });
$('readGuideBtn').addEventListener('click', () => {
  $('readGuide').innerHTML = GUIDE_HTML;
  $('readGuide').classList.toggle('hidden');
});
$('readNext').addEventListener('click', () => {
  const list = rdNextList();
  if (!list.length) return toast('Bạn đã làm hết các bài ở mục này 🎉');
  startRead([list[0]], 'next');
});
$('readRetry').addEventListener('click', () => {
  const list = shuffle(RD.filter(p => rdStatus(p) === 'due'));
  if (!list.length) return toast('Chưa có bài nào cần làm lại');
  startRead(list);
});
$('readList').addEventListener('click', e => {
  const ex = e.target.closest('[data-rexam]');
  if (ex) return startRead(RD.filter(p => p.exam === ex.dataset.rexam && (!rdTab || p.part === rdTab)));
  const b = e.target.closest('[data-ri]');
  if (b) startRead([RD[b.dataset.ri]]);
});

// ----- Làm bài -----
let rd = null;
function startRead(list, mode) {
  rd = { list, i: 0, mode };
  $('readHome').classList.add('hidden');
  $('readRun').classList.remove('hidden');
  $('readFuri').checked = state.settings.readFuri !== false;
  showPassage();
}
function showPassage() {
  const p = rd.list[rd.i];
  if (rd.timer) clearInterval(rd.timer);
  Object.assign(rd, { p, picks: p.qs.map(() => null), graded: false, start: Date.now(), showVi: false });
  $('readName').textContent = rdLabel(p) + (rd.list.length > 1 ? ` · bài ${rd.i + 1}/${rd.list.length}` : '');
  $('readInstr').textContent = RD_PART[p.part].instr;
  $('readTip').classList.add('hidden');
  $('readTip').innerHTML = `💡 ${esc(p.tip)}`;
  $('readSubmit').classList.remove('hidden');
  $('readAfter').classList.add('hidden');
  renderRead();
  const tick = () => {
    const s = Math.floor((Date.now() - rd.start) / 1000), lim = RD_PART[p.part].mins * 60;
    $('readTimer').textContent = `${fmtTime(s)} / ${RD_PART[p.part].mins}:00`;
    $('readTimer').classList.toggle('over', s > lim);
  };
  tick();
  rd.timer = setInterval(tick, 1000);
  window.scrollTo(0, 0);
}
function applyFuri() {
  ['readBody', 'readQs'].forEach(id => $(id).classList.toggle('aid-off', !$('readFuri').checked));
}
function renderRead() {
  const p = rd.p, g = rd.graded;
  const ranges = g ? rdRanges(p, p.qs) : [];
  $('readBody').innerHTML = `${p.intro ? `<p class="rd-intro">${rdInline(p.intro)}</p>` : ''}
    <div class="rd-passage${p.part === 6 ? ' rd-info' : ''}">${rdRender(p.passage, ranges).html}</div>
    ${g && rd.showVi ? `<div class="rd-vi"><b>📘 Bản dịch</b>${p.vi.split('\n').map(l => `<p>${esc(l)}</p>`).join('')}</div>` : ''}`;
  $('readQs').innerHTML = p.qs.map((q, i) => {
    const opts = q.options.map((o, j) => {
      let cls = 'm1-opt sent';
      if (rd.picks[i] === j) cls += ' picked';
      if (g && j === q.answer - 1) cls += ' correct';
      else if (g && rd.picks[i] === j) cls += ' wrong';
      return `<button class="${cls}" data-q="${i}" data-o="${j}" ${g ? 'disabled' : ''}><b>${j + 1}</b> ${rdInline(o)}</button>`;
    }).join('');
    return `<div class="m1-q rd-q"><div class="m1-sent"><span class="m1-no">${q.no}</span>${rdInline(q.q)}</div>
      <div class="m1-opts vertical">${opts}</div>${g ? `<div class="m1-explain">${rdExplain(p, q, i)}</div>` : ''}</div>`;
  }).join('');
  applyFuri();
}
function rdExplain(p, q, i) {
  const pick = rd.picks[i];
  const res = pick === null ? '⚪ Chưa làm.' : pick === q.answer - 1 ? '✅ Đúng.' : '❌ Sai.';
  const k = KIND_INFO[q.kind];
  return `${res} Đáp án: <b>${q.answer}</b>
    ${k ? `<div class="rd-kind"><span class="badge b2">${esc(k[0])}</span> ${esc(k[1])}</div>` : ''}
    <div class="xp"><div class="xp-vi">🇻🇳 ${esc(q.xp.vi)}</div>
      <div class="rd-ev">📍 Căn cứ trong bài: ${q.ev.map(e => `<mark class="ev jp">${esc(e)}</mark>`).join(' … ')}</div>
      <div class="xp-why">💡 ${nl2br(esc(q.xp.why))}</div>
      <ul class="xp-opts">${q.xp.opts.map((o, j) => { const ok = j === q.answer - 1;
        return `<li class="${ok ? 'ok' : 'bad'}${pick === j ? ' picked' : ''}"><b>${ok ? '✓' : '✗'} ${j + 1}.</b> ${esc(o.replace(/^[✓✗]\s*/, ''))}</li>`; }).join('')}</ul></div>`;
}
$('readQs').addEventListener('click', e => {
  const b = e.target.closest('.m1-opt');
  if (!b || !rd || rd.graded) return;
  rd.picks[b.dataset.q] = Number(b.dataset.o);
  b.parentElement.querySelectorAll('.m1-opt').forEach(x => x.classList.toggle('picked', x === b));
});
$('readFuri').addEventListener('change', () => {
  state.settings.readFuri = $('readFuri').checked;
  save();
  applyFuri();
});
$('readTipBtn').addEventListener('click', () => $('readTip').classList.toggle('hidden'));
$('readSpeak').addEventListener('click', () => {
  if (!('speechSynthesis' in window)) return toast('Trình duyệt không hỗ trợ đọc phát âm');
  if (speechSynthesis.speaking) { speechSynthesis.cancel(); return; }
  const text = rdRender(rd.p.passage).say;
  // Chia theo câu để trình duyệt không cắt ngang bài dài
  text.split(/(?<=[。！？\n])/).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean).forEach(s => {
    const u = new SpeechSynthesisUtterance(s);
    u.lang = 'ja-JP';
    if (jaVoice) u.voice = jaVoice;
    u.rate = 0.9;
    speechSynthesis.speak(u);
  });
});
$('readQuit').addEventListener('click', () => {
  if (rd && !rd.graded && rd.picks.some(x => x !== null) && !confirm('Thoát bài đang làm? Kết quả sẽ không được lưu.')) return;
  rdStop();
  renderReadHome();
});
function rdStop() {
  if (rd?.timer) clearInterval(rd.timer);
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  rd = null;
}
$('readSubmit').addEventListener('click', () => {
  if (!rd || rd.graded) return;
  const left = rd.picks.filter(x => x === null).length;
  if (left && !confirm(`Còn ${left} câu chưa chọn. Vẫn nộp bài?`)) return;
  clearInterval(rd.timer);
  rd.graded = true;
  const secs = Math.floor((Date.now() - rd.start) / 1000);
  const p = rd.p;
  let score = 0;
  p.qs.forEach((q, i) => {
    const ok = rd.picks[i] === q.answer - 1;
    if (ok) score++;
    recordQ({ qid: rdQid(p, q) }, ok);
  });
  (state.examLog ||= []).push({ name: `Đọc hiểu · ${rdLabel(p)}`, date: todayStr(), n: p.qs.length, score, secs });
  state.examLog = state.examLog.slice(-15);
  save();
  rd.score = score;
  rd.secs = secs;
  $('readSubmit').classList.add('hidden');
  renderRead();
  renderReadAfter();
  window.scrollTo(0, 0);
});
function renderReadAfter() {
  const p = rd.p, lim = RD_PART[p.part].mins * 60;
  const more = rd.i + 1 < rd.list.length;
  $('readAfter').innerHTML = `<div class="rd-result">${rd.score === p.qs.length ? '🎉' : rd.score ? '💪' : '📚'}
      Đúng <b>${rd.score}/${p.qs.length}</b> · ${fmtTime(rd.secs)} ${rd.secs > lim ? `<span class="bad-text">(quá mục tiêu ${RD_PART[p.part].mins} phút — luyện đọc lướt + đọc câu hỏi trước nhé)</span>` : '<span class="good-text">(trong thời gian mục tiêu)</span>'}</div>
    <p class="muted">Chỗ <mark class="ev">tô vàng</mark> trong bài là căn cứ của đáp án. Xem lại vì sao mình bỏ sót chỗ đó.</p>
    <div class="actions">
      <button class="btn" id="rdVi">${rd.showVi ? 'Ẩn bản dịch' : '📘 Xem bản dịch'}</button>
      <button class="btn" id="rdAgain">↺ Làm lại bài này</button>
      <button class="btn primary" id="rdNextBtn">${more ? 'Bài tiếp ▶' : rd.mode === 'next' ? 'Bài mới tiếp theo ▶' : 'Về danh sách'}</button>
    </div>
    ${p.vocab.length ? `<h4>📝 Từ vựng của bài</h4><table class="vocab-table rd-vocab">${p.vocab.map(v =>
      `<tr><td class="jp">${esc(v.w)}<small>${esc(v.r)}</small></td><td>${esc(v.m)}</td></tr>`).join('')}</table>` : ''}
    ${p.note ? `<p class="muted">⚠️ ${esc(p.note)}</p>` : ''}`;
  $('readAfter').classList.remove('hidden');
  $('rdVi').addEventListener('click', () => { rd.showVi = !rd.showVi; renderRead(); renderReadAfter(); });
  $('rdAgain').addEventListener('click', showPassage);
  $('rdNextBtn').addEventListener('click', () => {
    if (more) { rd.i++; return showPassage(); }
    if (rd.mode === 'next') {
      const list = rdNextList();
      if (list.length) { rd.list = [list[0]]; rd.i = 0; return showPassage(); }
    }
    rdStop();
    renderReadHome();
  });
}

// ----- Gắn vào app chính -----
const _rdShowView = showView;
showView = function (name) {
  if (currentView === 'read' && name !== 'read' && rd) rdStop();
  _rdShowView(name);
  if (name === 'read') renderReadHome();
};
const _rdRenderHome = renderHome;
renderHome = function () {
  _rdRenderHome();
  if (!RD.length) return;
  const due = RD.filter(p => rdStatus(p) === 'due').length;
  const fresh = RD.filter(p => rdStatus(p) === 'new').length;
  $('todoBox').appendChild(todoItem('📖 Đọc hiểu 読解',
    due ? `${due} bài đọc cần làm lại` : fresh ? `Mỗi ngày 1–2 bài đọc · còn ${fresh} bài chưa làm` : 'Đã làm hết các bài đọc 🎉',
    due ? 'Làm lại' : 'Đọc', () => { showView('read'); (due ? $('readRetry') : $('readNext')).click(); }));
};
if (currentView === 'home') renderHome();
