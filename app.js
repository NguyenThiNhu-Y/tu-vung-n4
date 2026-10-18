'use strict';

// ===== Cấu hình =====
const LEARN_DAYS = 22;          // số ngày học từ mới
const TOTAL_DAYS = 30;          // tổng số ngày (8 ngày cuối ôn tổng)
const INTERVALS = [0, 1, 3, 7, 14, 30]; // box -> số ngày tới lần ôn sau
const STORE_KEY = 'n4vocab.v1';
const PAIR_CAT = 'Cặp tha động từ - tự động từ';

// ===== Tiện ích ngày tháng (theo giờ địa phương) =====
const pad = n => String(n).padStart(2, '0');
const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const todayStr = () => fmt(new Date());
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return fmt(d); };
const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const isKanji = c => c >= '一' && c <= '鿿';
const hasKanji = w => [...w.kanji].some(isKanji);
const fold = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();

// ===== Chuẩn bị dữ liệu =====
// Thứ tự học: các chủ đề -> Katakana -> danh từ -> tính từ -> động từ -> cặp tự/tha -> phó từ
const CATS = [];
VOCAB.forEach(w => { if (!CATS.includes(w.cat)) CATS.push(w.cat); });
CATS.splice(CATS.indexOf('Katakana'), 1);
CATS.splice(CATS.filter(c => c.startsWith('Chủ đề')).length, 0, 'Katakana');
const WORDS = CATS.flatMap(c => VOCAB.filter(w => w.cat === c));

WORDS.forEach(w => {
  w.hv = [...w.kanji].filter(c => HANVIET[c]).map(c => HANVIET[c]).join(' ');
  w.search = fold([w.kana, w.kanji, w.mean, w.hv, w.note].join(' '));
});

// Cặp tự/tha động từ: 2 từ liên tiếp là một cặp
const pairWords = WORDS.filter(w => w.cat === PAIR_CAT);
pairWords.forEach((w, i) => { w.partner = pairWords[i ^ 1]; });

// Chia vào 22 ngày, không tách đôi cặp tự/tha
(function assignDays() {
  const units = [];
  for (let i = 0; i < WORDS.length; i++) {
    const w = WORDS[i];
    if (w.cat === PAIR_CAT && w.partner === WORDS[i + 1]) { units.push([w, WORDS[i + 1]]); i++; }
    else units.push([w]);
  }
  let count = 0;
  units.forEach(u => {
    const day = Math.min(LEARN_DAYS, Math.floor(count * LEARN_DAYS / WORDS.length) + 1);
    u.forEach(w => { w.day = day; });
    count += u.length;
  });
})();
const DAY_WORDS = Array.from({ length: LEARN_DAYS + 1 }, (_, d) => WORDS.filter(w => w.day === d));

// Chỉ mục chữ Hán -> các từ chứa chữ đó
const KANJI_INDEX = {};
WORDS.forEach(w => new Set([...w.kanji].filter(isKanji)).forEach(c => (KANJI_INDEX[c] ||= []).push(w)));

// ===== Lưu trữ =====
let state = load();
function load() {
  let s;
  try { s = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { s = null; }
  s ||= {};
  s.cards ||= {};
  s.settings ||= {};
  s.settings.start ||= todayStr();
  s.settings.exam ||= addDays(s.settings.start, TOTAL_DAYS);
  return s;
}
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
const card = w => state.cards[w.id];
const ensureCard = w => (state.cards[w.id] ||= { box: 0, due: null, right: 0, wrong: 0, learned: false });
const isLearned = w => !!card(w)?.learned;
const isWeak = w => { const c = card(w); return !!c && c.wrong > 0 && c.box < 4; };
const isDue = w => { const c = card(w); return !!c && c.learned && c.due && c.due <= todayStr(); };

function currentDay() {
  return Math.max(1, Math.min(TOTAL_DAYS, diffDays(state.settings.start, todayStr()) + 1));
}
function firstIncompleteDay() {
  for (let d = 1; d <= LEARN_DAYS; d++) if (DAY_WORDS[d].some(w => !isLearned(w))) return d;
  return null;
}

// ===== Phát âm =====
let jaVoice = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices();
  jaVoice = vs.find(v => v.lang === 'ja-JP') || vs.find(v => v.lang.startsWith('ja')) || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function speak(w) {
  speakText(w.kana.replace(/\(する\)/, 'する').replace(/・/g, '、'));
}
function speakText(text) {
  if (!('speechSynthesis' in window)) return toast('Trình duyệt không hỗ trợ đọc phát âm');
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP';
  if (jaVoice) u.voice = jaVoice;
  u.rate = 0.9;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

// Câu ví dụ: {漢字|よみ} = furigana, [..] = từ đang học
function exHtml(ex, blank) {
  return esc(ex)
    .replace(/\{([^{}|]*)\|([^{}|]*)\}/g, '<ruby>$1<rt>$2</rt></ruby>')
    .replace(/\[(.*?)\]/, blank ? '<span class="blank">（　？　）</span>' : '<mark>$1</mark>');
}
const exSpeech = ex => ex.replace(/\{[^{}|]*\|([^{}|]*)\}/g, '$1').replace(/[[\]]/g, '');
function exBlock(w) {
  if (!w.ex) return '';
  return `<div class="ex-jp">${exHtml(w.ex)} <button class="speak-ex" data-ex="${esc(w.id)}" title="Nghe câu">🔊</button></div>
    <div class="ex-vi">${esc(w.exVi)}</div>`;
}
// Nút 🔊 cạnh câu ví dụ (dùng chung cho thẻ, quiz, danh sách)
document.addEventListener('click', e => {
  const b = e.target.closest('.speak-ex');
  if (!b) return;
  e.stopPropagation();
  const w = WORDS.find(x => x.id === b.dataset.ex);
  if (w) speakText(exSpeech(w.ex));
}, true);

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.add('hidden'), 2200);
}

// ===== Điều hướng =====
let currentView = 'home';
function showView(name) {
  currentView = name;
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  $('view-' + name).classList.remove('hidden');
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  if (name === 'home') renderHome();
  if (name === 'plan') renderPlan();
  if (name === 'list') renderList();
  if (name === 'settings') renderSettings();
  if (name === 'quiz') resetQuiz();
  window.scrollTo(0, 0);
}
document.querySelectorAll('nav button').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
$('homeLink').addEventListener('click', () => showView('home'));

// ===== Trang chủ =====
function renderHome() {
  const learned = WORDS.filter(isLearned).length;
  const due = WORDS.filter(isDue).length;
  const weak = WORDS.filter(isWeak).length;
  $('statSeen').textContent = learned;
  $('statTotal').textContent = WORDS.length;
  $('statDue').textContent = due;
  $('statWeak').textContent = weak;
  $('progressBar').style.width = (learned / WORDS.length * 100) + '%';

  const left = diffDays(todayStr(), state.settings.exam);
  const day = currentDay();
  $('countdown').textContent = left > 0
    ? `Ngày ${day}/${TOTAL_DAYS} theo lịch · còn ${left} ngày nữa là thi 頑張って！`
    : left === 0 ? 'Hôm nay thi rồi! Bình tĩnh, bạn làm được 💪' : 'Đã qua ngày thi — cập nhật ngày thi trong ⚙︎ nếu cần.';

  const items = [];
  const next = firstIncompleteDay();
  if (next) {
    const remain = DAY_WORDS[next].filter(w => !isLearned(w)).length;
    const behind = day <= LEARN_DAYS ? day - next : LEARN_DAYS - next + 1;
    const lag = behind > 0 ? ` · <b style="color:var(--bad)">đang chậm ${behind} ngày</b>` : behind < 0 ? ' · đang vượt lịch 👍' : '';
    items.push(todoItem(`📖 Học từ mới — Ngày ${next}`,
      `${remain} từ: ${dayCats(next)}${lag}`, 'Học', () => startNew(next)));
  } else {
    items.push(todoItem('🎉 Đã học hết 806 từ!', 'Giờ chỉ cần ôn tập đều và làm quiz “Từ hay sai”.', 'Quiz', () => showView('quiz')));
  }
  items.push(todoItem('🔁 Ôn tập', due ? `${due} từ đến hạn ôn hôm nay` : 'Không có từ nào cần ôn — tốt lắm!',
    'Ôn', () => startReview(), !due));
  items.push(todoItem('📝 Quiz kiểu JLPT', weak ? `${weak} từ hay sai đang chờ bạn` : 'Kiểm tra nghĩa, cách đọc và chữ Hán',
    'Làm', () => showView('quiz')));
  const box = $('todoBox');
  box.innerHTML = '';
  items.forEach(i => box.appendChild(i));
}
function todoItem(title, desc, btnText, onClick, disabled) {
  const el = document.createElement('div');
  el.className = 'todo-item';
  el.innerHTML = `<div><b>${title}</b><p class="muted">${desc}</p></div>`;
  const b = document.createElement('button');
  b.className = 'btn primary';
  b.textContent = btnText;
  b.disabled = !!disabled;
  b.addEventListener('click', onClick);
  el.appendChild(b);
  return el;
}
function dayCats(d) {
  return [...new Set(DAY_WORDS[d].map(w => w.cat.replace('Chủ đề: ', '')))].join(', ');
}

// ===== Lịch 30 ngày =====
function renderPlan() {
  const grid = $('planGrid');
  grid.innerHTML = '';
  const today = currentDay();
  for (let d = 1; d <= TOTAL_DAYS; d++) {
    const el = document.createElement('div');
    el.className = 'day' + (d === today ? ' today' : '');
    const date = addDays(state.settings.start, d - 1).split('-').reverse().slice(0, 2).join('/');
    if (d <= LEARN_DAYS) {
      const ws = DAY_WORDS[d];
      const done = ws.filter(isLearned).length;
      if (done === ws.length) el.classList.add('done');
      el.innerHTML = `<b>Ngày ${d}</b> <span class="muted">${date}</span><br>${ws.length} từ · ${esc(dayCats(d))}
        <div class="bar"><div style="width:${done / ws.length * 100}%"></div></div>`;
      el.addEventListener('click', () => startNew(d));
    } else {
      el.classList.add('review');
      const tasks = ['Quiz: Danh từ + Katakana', 'Quiz: Động từ', 'Quiz: Tính từ + Phó từ', 'Quiz: Tất cả 806 từ',
        'Quiz: Từ hay sai', 'Làm đề thi thử', 'Quiz: Từ hay sai', 'Ôn nhẹ, ngủ sớm 😴'][d - LEARN_DAYS - 1];
      el.innerHTML = `<b>Ngày ${d}</b> <span class="muted">${date}</span><br>Ôn tổng · ${tasks}`;
    }
    grid.appendChild(el);
  }
}

// ===== Flashcard =====
let session = null;
function startNew(d) {
  let ws = DAY_WORDS[d].filter(w => !isLearned(w));
  let title = `Ngày ${d} — từ mới`;
  if (!ws.length) { ws = DAY_WORDS[d].slice(); title = `Ngày ${d} — học lại`; }
  startSession(ws, 'new', title);
}
function startReview() {
  const ws = shuffle(WORDS.filter(isDue));
  if (!ws.length) return toast('Không có từ nào cần ôn hôm nay');
  startSession(ws, 'review', 'Ôn tập');
}
function startSession(words, mode, title) {
  session = { queue: words.slice(), total: words.length, done: 0, failed: new Set(), mode, title,
    history: [], view: null };
  showView('study');
  showCard();
}
// Cách hiển thị mặt trước: 'kana' = hiragana to + chữ Hán nhỏ, 'kanaOnly', 'kanji'
const frontMode = () => state.settings.front || 'kana';
const kanaFirst = () => frontMode() !== 'kanji';
function wordLabel(w) {
  if (!hasKanji(w)) return esc(w.kana);
  return kanaFirst() ? `${esc(w.kana)} (${esc(w.kanji)})` : `${esc(w.kanji)} (${esc(w.kana)})`;
}
function fillCard(w) {
  session.shown = w;
  $('cardCat').textContent = w.cat + (w.note === 'を' ? ' · tha động từ' : w.note === 'が' ? ' · tự động từ' : '');
  const k = hasKanji(w), mode = frontMode();
  let main = w.kana, sub = '', back = '';
  if (k && mode === 'kanji') { main = w.kanji; back = w.kana; }
  else if (k && mode === 'kana') sub = w.kanji;
  else if (k) back = w.kanji;
  $('cardWord').textContent = main;
  $('cardKanaFront').textContent = sub;
  $('cardKana').textContent = back;
  $('cardMean').textContent = w.mean;
  $('cardHV').textContent = w.hv ? 'Hán Việt: ' + w.hv : '';
  $('cardEx').innerHTML = exBlock(w);
  $('cardNote').innerHTML = noteHtml(w);
  $('cardRelated').innerHTML = relatedHtml(w);
  $('cardRelated').classList.toggle('hidden', !$('cardRelated').innerHTML);
}
function updateStudyHead() {
  $('studyTitle').textContent = session.title;
  $('studyCount').textContent = `${session.done}/${session.total} · còn ${session.queue.length} thẻ`;
  $('studyBar').style.width = (session.done / session.total * 100) + '%';
  $('prevBtn').disabled = session.view === 0 || !session.history.length;
  $('nextBtn').textContent = session.view === null ? 'Bỏ qua ▶' : 'Sau ▶';
  $('nextBtn').disabled = session.view === null && session.queue.length < 2;
  $('reviewBanner').classList.toggle('hidden', session.view === null);
}
function showCard() {
  const w = session.queue[0];
  if (!w) return finishSession();
  session.view = null;
  session.flipped = false;
  fillCard(w);
  $('cardBack').classList.add('hidden');
  $('flipActions').classList.remove('hidden');
  $('gradeActions').classList.add('hidden');
  updateStudyHead();
}
// Xem lại thẻ đã học (chỉ xem, không chấm lại)
function showHistoryCard() {
  fillCard(session.history[session.view]);
  $('cardBack').classList.remove('hidden');
  $('flipActions').classList.add('hidden');
  $('gradeActions').classList.add('hidden');
  updateStudyHead();
}
function prevCard() {
  if (!session || !session.history.length) return;
  if (session.view === null) session.view = session.history.length - 1;
  else if (session.view > 0) session.view--;
  else return;
  showHistoryCard();
}
function nextCard() {
  if (!session) return;
  if (session.view !== null) {
    session.view++;
    if (session.view >= session.history.length) return showCard();
    return showHistoryCard();
  }
  if (session.queue.length < 2) return;
  session.queue.push(session.queue.shift()); // bỏ qua: đưa thẻ xuống cuối
  toast('Đã bỏ qua — thẻ này sẽ quay lại cuối lượt');
  showCard();
}
function noteHtml(w) {
  if (w.partner) {
    const kind = w.note === 'を' ? 'Tha động từ: 〜<b>を</b> ' + w.kana : 'Tự động từ: 〜<b>が</b> ' + w.kana;
    const p = w.partner;
    return `${kind}<br>Cặp với: <span class="chip">${wordLabel(p)} <i>${esc(p.mean)}</i></span>`;
  }
  if (w.cat === 'Katakana' && w.note) return 'Từ gốc: ' + esc(w.note);
  return '';
}
function relatedHtml(w) {
  const out = [];
  new Set([...w.kanji].filter(c => HANVIET[c])).forEach(c => {
    const others = (KANJI_INDEX[c] || []).filter(o => o !== w).slice(0, 6);
    if (!others.length) return;
    out.push(`<div class="grp"><span class="k">${c}</span><b>${HANVIET[c]}</b>: ` +
      others.map(o => `<span class="chip">${esc(o.kanji)} <small>${esc(o.kana)}</small> <i>${esc(o.mean.split(/[,;(]/)[0])}</i></span>`).join('') + '</div>');
  });
  return out.join('');
}
function flip() {
  if (!session || session.view !== null || session.flipped) return;
  session.flipped = true;
  $('cardBack').classList.remove('hidden');
  $('flipActions').classList.add('hidden');
  $('gradeActions').classList.remove('hidden');
  if (state.settings.autoSpeak) speak(session.queue[0]);
}
function grade(ok) {
  if (!session || session.view !== null || !session.flipped) return;
  const w = session.queue.shift();
  const c = ensureCard(w);
  if (ok) {
    if (session.failed.has(w.id) || !c.learned) c.box = 1;
    else c.box = Math.min(c.box + 1, INTERVALS.length - 1);
    c.learned = true;
    c.due = addDays(todayStr(), INTERVALS[c.box]);
    c.right++;
    session.done++;
  } else {
    c.wrong++;
    session.failed.add(w.id);
    session.queue.splice(Math.min(4, session.queue.length), 0, w); // gặp lại sau ~4 thẻ
  }
  session.history.push(w);
  save();
  showCard();
}
function finishSession() {
  const failed = session.failed.size;
  toast(`Xong ${session.total} thẻ! ${failed ? failed + ' từ phải lặp lại — tối nay ôn lại nhé.' : 'Không sai từ nào 🎉'}`);
  session = null;
  showView('home');
}
$('flipBtn').addEventListener('click', flip);
$('card').addEventListener('click', e => { if (!e.target.closest('button')) flip(); });
$('againBtn').addEventListener('click', () => grade(false));
$('goodBtn').addEventListener('click', () => grade(true));
$('prevBtn').addEventListener('click', prevCard);
$('nextBtn').addEventListener('click', nextCard);
$('speakBtn').addEventListener('click', () => session && speak(session.shown));

// ===== Quiz =====
let quiz = null;
function resetQuiz() {
  quiz = null;
  $('quizSetup').classList.remove('hidden');
  $('quizRun').classList.add('hidden');
  $('quizDone').classList.add('hidden');
  $('quizMsg').textContent = '';
}
function quizPool(scope) {
  if (scope === 'all') return WORDS;
  if (scope === 'weak') return WORDS.filter(isWeak);
  if (scope === 'today') {
    const d = firstIncompleteDay() || Math.min(currentDay(), LEARN_DAYS);
    return DAY_WORDS[d];
  }
  return WORDS.filter(isLearned);
}
const QUIZ_FIELD = {
  mean: o => o.mean,
  read: o => o.kana,
  write: o => o.kanji,
  fill: o => o.kanji || o.kana,
};
function makeQuestion(w, type) {
  const types = hasKanji(w) ? ['mean', 'read', 'write'] : ['mean'];
  if (w.ex) types.push('fill');
  if (type === 'mix' || !types.includes(type)) type = types[Math.floor(Math.random() * types.length)];
  const get = QUIZ_FIELD[type];
  const sameCat = shuffle(WORDS.filter(o => o.cat === w.cat));
  const others = shuffle(WORDS.slice());
  const opts = [get(w)];
  const optWords = [w];
  for (const o of [...sameCat, ...others]) {
    if (opts.length === 4) break;
    if (o === w || opts.includes(get(o))) continue;
    if ((type === 'read' || type === 'write') && !hasKanji(o)) continue;
    if (type === 'fill' && o.kana === w.kana) continue;
    if (type === 'write' && o.kana === w.kana) continue;   // tránh 2 đáp án cùng cách đọc
    if (type === 'read' && o.kanji === w.kanji) continue;
    if (type === 'mean' && o.mean.split(',')[0] === w.mean.split(',')[0]) continue;
    opts.push(get(o));
    optWords.push(o);
  }
  const ask = {
    mean: 'Từ này nghĩa là gì?',
    read: 'Chữ Hán này đọc là gì?',
    write: `Chữ Hán đúng của từ này là gì? (nghĩa: ${w.mean})`,
    fill: 'Chọn từ thích hợp điền vào chỗ trống',
  }[type];
  const q = { mean: hasKanji(w) && !kanaFirst() ? w.kanji : w.kana, read: w.kanji, write: w.kana, fill: '' }[type];
  const sub = type === 'mean' && hasKanji(w) && frontMode() === 'kana' ? w.kanji : '';
  const order = shuffle(opts.map((_, i) => i));
  return { w, type, ask, q, sub, answer: get(w), options: order.map(i => opts[i]), optWords: order.map(i => optWords[i]) };
}
$('quizStart').addEventListener('click', () => {
  const pool = quizPool($('quizScope').value);
  const type = $('quizType').value;
  let usable = pool;
  if (type === 'read' || type === 'write') usable = pool.filter(hasKanji);
  if (type === 'fill') usable = pool.filter(w => w.ex);
  if (usable.length < 1) {
    $('quizMsg').textContent = $('quizScope').value === 'weak'
      ? 'Chưa có từ hay sai nào. Học thêm rồi quay lại nhé!'
      : 'Chưa có từ nào trong phạm vi này — hãy học vài từ trước, hoặc chọn “Tất cả 806 từ”.';
    return;
  }
  const n = Math.min(Number($('quizNum').value), usable.length);
  startQuiz(shuffle(usable.slice()).slice(0, n), type);
});
function startQuiz(words, type) {
  quiz = { qs: words.map(w => makeQuestion(w, type)), i: 0, score: 0, wrong: [], type };
  $('quizSetup').classList.add('hidden');
  $('quizDone').classList.add('hidden');
  $('quizRun').classList.remove('hidden');
  showQuestion();
}
function showQuestion() {
  const q = quiz.qs[quiz.i];
  quiz.answered = false;
  $('quizProgress').textContent = `Câu ${quiz.i + 1}/${quiz.qs.length}`;
  $('quizScore').textContent = `Đúng ${quiz.score}`;
  $('quizBar').style.width = (quiz.i / quiz.qs.length * 100) + '%';
  $('quizAsk').textContent = q.ask;
  if (q.type === 'fill') $('quizQ').innerHTML = exHtml(q.w.ex, true);
  else $('quizQ').innerHTML = esc(q.q) + (q.sub ? `<div class="jp-kana">${esc(q.sub)}</div>` : '');
  $('quizQ').classList.toggle('jp-sent', q.type === 'fill');
  const box = $('quizChoices');
  box.innerHTML = '';
  q.options.forEach((opt, idx) => {
    const b = document.createElement('button');
    b.className = 'choice' + (q.type === 'mean' ? '' : ' jp');
    const ow = q.optWords[idx];
    b.innerHTML = q.type === 'fill' && hasKanji(ow)
      ? (kanaFirst() ? `${idx + 1}. ${esc(ow.kana)} <small class="opt-kana">${esc(opt)}</small>`
                     : `${idx + 1}. ${esc(opt)} <small class="opt-kana">${esc(ow.kana)}</small>`)
      : `${idx + 1}. ${esc(opt)}`;
    b.addEventListener('click', () => answer(idx));
    box.appendChild(b);
  });
  $('quizExplain').classList.add('hidden');
  $('quizNext').classList.add('hidden');
}
function answer(idx) {
  if (!quiz || quiz.answered) return;
  quiz.answered = true;
  const q = quiz.qs[quiz.i];
  const ok = q.options[idx] === q.answer;
  [...$('quizChoices').children].forEach((b, i) => {
    if (q.options[i] === q.answer) b.classList.add('correct');
    else if (i === idx) b.classList.add('wrong');
  });
  const c = ensureCard(q.w);
  if (ok) { quiz.score++; c.right++; }
  else {
    c.wrong++;
    quiz.wrong.push(q.w);
    if (c.learned) { c.box = 1; c.due = todayStr(); } // sai thì đưa vào ôn lại ngay hôm nay
  }
  save();
  const w = q.w;
  $('quizExplain').innerHTML = `${ok ? '✅ Chính xác!' : '❌ Sai rồi.'} <span class="jp"><b>${wordLabel(w)}</b></span>
    — ${esc(w.mean)}${w.hv ? ` · <span style="color:var(--accent)">${w.hv}</span>` : ''}
    ${w.ex ? '<div class="example">' + exBlock(w) + '</div>' : ''}`;
  $('quizExplain').classList.remove('hidden');
  $('quizNext').classList.remove('hidden');
  $('quizScore').textContent = `Đúng ${quiz.score}`;
}
function nextQuestion() {
  if (!quiz || !quiz.answered) return;
  quiz.i++;
  if (quiz.i < quiz.qs.length) return showQuestion();
  $('quizRun').classList.add('hidden');
  const pct = Math.round(quiz.score / quiz.qs.length * 100);
  const done = $('quizDone');
  done.innerHTML = `<div class="result-big">${quiz.score}/${quiz.qs.length} (${pct}%)</div>
    <p style="text-align:center">${pct >= 90 ? 'Xuất sắc! 🎉' : pct >= 70 ? 'Khá tốt, cố thêm chút nữa! 💪' : 'Không sao, ôn lại các từ sai rồi làm lại nhé!'}</p>
    ${quiz.wrong.length ? '<h3>Các từ làm sai</h3><div class="wrong-list">' + quiz.wrong.map(w =>
      `<div><b style="font-family:var(--jp)">${wordLabel(w)}</b> — ${esc(w.mean)}</div>`).join('') + '</div>' : ''}
    <div class="actions">
      ${quiz.wrong.length ? '<button class="btn bad" id="retryWrong">Làm lại câu sai</button>' : ''}
      <button class="btn primary" id="quizAgain">Quiz mới</button>
    </div>`;
  done.classList.remove('hidden');
  const wrong = quiz.wrong.slice(), type = quiz.type;
  $('quizAgain').addEventListener('click', resetQuiz);
  if (wrong.length) $('retryWrong').addEventListener('click', () => startQuiz(shuffle(wrong), type));
}
$('quizNext').addEventListener('click', nextQuestion);

// ===== Danh sách =====
$('listCat').innerHTML = '<option value="">Tất cả nhóm</option>' + CATS.map(c => `<option>${esc(c)}</option>`).join('');
['search', 'listCat', 'listFilter'].forEach(id => $(id).addEventListener('input', renderList));
function statusBadge(w) {
  const c = card(w);
  if (!c || !c.learned) return isWeak(w) ? '<span class="badge b1">Hay sai</span>' : '<span class="badge b0">Chưa học</span>';
  if (isWeak(w)) return '<span class="badge b1">Hay sai</span>';
  if (c.box >= 3) return '<span class="badge b3">Thuộc</span>';
  return '<span class="badge b2">Đang học</span>';
}
function renderList() {
  const q = fold($('search').value.trim());
  const cat = $('listCat').value;
  const f = $('listFilter').value;
  const rows = WORDS.filter(w =>
    (!cat || w.cat === cat) &&
    (!q || w.search.includes(q)) &&
    (f === 'all' || (f === 'new' && !isLearned(w)) || (f === 'seen' && isLearned(w)) || (f === 'weak' && isWeak(w))));
  $('listCount').textContent = `${rows.length} từ`;
  let html = '', lastCat = '';
  rows.forEach(w => {
    if (w.cat !== lastCat) { html += `<tr class="cat"><td colspan="4">${esc(w.cat)}</td></tr>`; lastCat = w.cat; }
    const jp = !hasKanji(w) ? esc(w.kana)
      : kanaFirst() ? `${esc(w.kana)}<small>${esc(w.kanji)}</small>` : `${esc(w.kanji)}<small>${esc(w.kana)}</small>`;
    html += `<tr><td class="jp">${jp}</td>
      <td>${esc(w.mean)}${w.hv ? `<br><span class="hvs">${w.hv}</span>` : ''}${w.cat === 'Katakana' && w.note ? `<br><span class="muted">${esc(w.note)}</span>` : ''}
        ${w.ex ? `<div class="example small">${exBlock(w)}</div>` : ''}</td>
      <td>${statusBadge(w)}<br><span class="muted">Ngày ${w.day}</span></td>
      <td><button data-id="${esc(w.id)}" title="Nghe">🔊</button></td></tr>`;
  });
  $('listBody').innerHTML = html;
}
$('listBody').addEventListener('click', e => {
  const id = e.target.dataset?.id;
  if (id) speak(WORDS.find(w => w.id === id));
});

// ===== Cài đặt =====
function renderSettings() {
  $('setStart').value = state.settings.start;
  $('setExam').value = state.settings.exam;
  $('setFront').value = frontMode();
  $('setAutoSpeak').checked = !!state.settings.autoSpeak;
}
$('saveSettings').addEventListener('click', () => {
  if ($('setStart').value) state.settings.start = $('setStart').value;
  if ($('setExam').value) state.settings.exam = $('setExam').value;
  state.settings.front = $('setFront').value;
  state.settings.autoSpeak = $('setAutoSpeak').checked;
  save();
  toast('Đã lưu cài đặt');
});
$('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tien-do-n4-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});
$('importFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const s = JSON.parse(await file.text());
    if (!s.cards || !s.settings) throw new Error();
    state = s;
    save();
    renderSettings();
    toast('Đã nhập tiến độ');
  } catch (err) {
    toast('File không hợp lệ');
  }
  e.target.value = '';
});
$('resetBtn').addEventListener('click', () => {
  if (!confirm('Xoá toàn bộ tiến độ học? Không thể hoàn tác.')) return;
  localStorage.removeItem(STORE_KEY);
  state = load();
  save();
  toast('Đã xoá tiến độ');
  showView('home');
});

// ===== Phím tắt =====
document.addEventListener('keydown', e => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  if (currentView === 'study' && session) {
    if (e.code === 'Space' || e.key === 'Enter') {
      e.preventDefault();
      if (session.view !== null) nextCard();
      else session.flipped ? grade(true) : flip();
    }
    else if (e.key === '1') grade(false);
    else if (e.key === '2') grade(true);
    else if (e.key === 's') speak(session.shown);
    else if (e.key === 'ArrowLeft') prevCard();
    else if (e.key === 'ArrowRight') nextCard();
  } else if (currentView === 'quiz' && quiz && !$('quizRun').classList.contains('hidden')) {
    if (/^[1-4]$/.test(e.key)) answer(Number(e.key) - 1);
    else if (e.key === 'Enter' || e.code === 'Space') { e.preventDefault(); nextQuestion(); }
  }
});

save();
showView('home');
