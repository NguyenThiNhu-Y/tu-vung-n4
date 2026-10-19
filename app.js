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
  if (name === 'exam') resetExam();
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
  const dueQ = ALL_ITEMS.filter(it => isQDue(it.qid)).length;
  items.push(todoItem('🗂 Luyện đề', dueQ ? `${dueQ} câu đề (sách + JLPT thật) đến hạn ôn lại` : 'Làm đề trộn tổng hợp hoặc một đề JLPT thật',
    dueQ ? 'Ôn' : 'Làm', () => { showView('exam'); if (dueQ) $('reviewWrong').click(); }));
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

// Ghi kết quả quiz/luyện đề: sai thì đưa vào ôn lại ngay hôm nay
function recordAnswer(w, ok) {
  const c = ensureCard(w);
  if (ok) c.right++;
  else {
    c.wrong++;
    if (c.learned) { c.box = 1; c.due = todayStr(); }
  }
}

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
  if (ok) quiz.score++;
  else quiz.wrong.push(q.w);
  recordAnswer(q.w, ok);
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

// ===== Luyện đề: 問題1 漢字読み =====
// Tách câu ví dụ thành phần trước / từ gạch chân / phần sau; chỉ dùng câu có chữ Hán trong [ ]
function parseBracket(w, needKanji) {
  if (!w.ex) return null;
  const m = w.ex.match(/^(.*)\[(.*?)\](.*)$/);
  if (!m || (needKanji && !m[2].includes('{'))) return null;
  const segs = [];
  m[2].replace(/\{([^{}|]*)\|([^{}|]*)\}|([^{]+)/g, (_, k, r, plain) => {
    segs.push(k ? { text: k, read: r, kanji: true } : { text: plain, read: plain, kanji: false });
    return '';
  });
  return { before: m[1], after: m[3], segs,
    target: segs.map(s => s.text).join(''), answer: segs.map(s => s.read).join('') };
}
WORDS.forEach(w => { w.m1 = parseBracket(w, true); w.m3 = parseBracket(w, false); });

// Tạo đáp án nhiễu kiểu JLPT: dấu゛゜, âm dài, っ, ゃゅょ, ん
const VOICE = {}, HANDAKU = {};
const VP = 'かがきぎくぐけげこごさざしじすずせぜそぞただてでとどはばひびふぶへべほぼ';
for (let i = 0; i < VP.length; i += 2) { VOICE[VP[i]] = VP[i + 1]; VOICE[VP[i + 1]] = VP[i]; }
'はぱひぴふぷへぺほぽ'.match(/../g).forEach(p => { HANDAKU[p[0]] = p[1]; HANDAKU[p[1]] = p[0]; });
const LONG_U = 'こそとのほもよろごぞどぼぽょくすつぬふむゆるぐずぶぷゅ';
const LONG_I = 'けせてねへめれげぜでべぺ';
const BEFORE_TSU = 'かきくけこさしすせそたちつてとぱぴぷぺぽ';
const I_ROW = 'きしちにひみりぎじびぴ';
const SMALL = { ゃ: 'や', ゅ: 'ゆ', ょ: 'よ', や: 'ゃ', ゆ: 'ゅ', よ: 'ょ' };
function kanaVariants(s) {
  const out = new Set();
  const put = (i, del, ins) => out.add(s.slice(0, i) + ins + s.slice(i + del));
  for (let i = 0; i < s.length; i++) {
    const c = s[i], next = s[i + 1], prev = s[i - 1];
    if (VOICE[c]) put(i, 1, VOICE[c]);
    if (HANDAKU[c]) put(i, 1, HANDAKU[c]);
    if (LONG_U.includes(c)) next === 'う' ? put(i + 1, 1, '') : put(i + 1, 0, 'う');
    if (LONG_I.includes(c)) next === 'い' ? put(i + 1, 1, '') : put(i + 1, 0, 'い');
    if (c === 'っ') put(i, 1, '');
    else if (i > 0 && BEFORE_TSU.includes(c) && !'っんうーゃゅょい'.includes(prev)) put(i, 0, 'っ');
    if (SMALL[c] && I_ROW.includes(prev)) put(i, 1, SMALL[c]);
    if (c === 'ん' && i > 0) put(i, 1, '');
  }
  out.delete(s);
  return [...out];
}
// Chỉ biến đổi phần cách đọc của chữ Hán, giữ nguyên okurigana. Trả về danh sách segs đã biến đổi
function segVariants(segs) {
  const res = [];
  segs.forEach((seg, j) => {
    if (!seg.kanji) return;
    kanaVariants(seg.read).forEach(v => res.push(segs.map((s, k) => k === j ? { ...s, read: v } : s)));
  });
  return res;
}
const joinRead = segs => segs.map(s => s.read).join('');
// Từ loại (nhóm "Tâm trạng" trộn nhiều loại nên phân loại riêng)
const MOOD_POS = { うれしい: 'a', たのしい: 'a', かなしい: 'a', さびしい: 'a', はずかしい: 'a', なつかしい: 'a',
  うらやましい: 'a', こわい: 'a', おどろく: 'v', おこる: 'v', びっくり: 'adv', がっかり: 'adv' };
const posGroup = w => MOOD_POS[w.kana] || (/^Động từ|^Cặp/.test(w.cat) ? 'v' : /^Tính từ/.test(w.cat) ? 'a' : /^Phó từ/.test(w.cat) ? 'adv' : 'n');
const allKanji = m => m.segs.every(s => s.kanji);
function makeM1(w) {
  const m = w.m1;
  const opts = [m.answer];
  const add = v => { if (v && !opts.includes(v) && opts.length < 4) opts.push(v); };
  // Danh từ ngắn (かみ, ゆび...): đề thật thường cho các từ thật cùng loại, cùng độ dài
  if (allKanji(m) && m.answer.length <= 3) {
    const near = o => o !== w && o.m1 && allKanji(o.m1) && posGroup(o) === posGroup(w) &&
      Math.abs(o.m1.answer.length - m.answer.length) <= 1;
    shuffle(WORDS.filter(o => near(o) && o.cat === w.cat)).forEach(o => add(o.m1.answer));
    shuffle(WORDS.filter(near)).forEach(o => add(o.m1.answer));
  }
  // Động từ/tính từ: đề thật hay cho các từ khác cùng đuôi chia (およがないで・いそがないで・さわがないで)
  const tail = m.segs[m.segs.length - 1].kanji ? '' : m.segs[m.segs.length - 1].text;
  const sameTail = tail ? shuffle(WORDS.filter(o => o !== w && o.m1 && posGroup(o) === posGroup(w) &&
    !o.m1.segs[o.m1.segs.length - 1].kanji && o.m1.segs[o.m1.segs.length - 1].text === tail)) : [];
  sameTail.slice(0, 2).forEach(o => add(o.m1.answer));
  // Bẫy kiểu JLPT: biến đổi 1 lần, chưa đủ thì 2 lần
  const lvl1 = shuffle(segVariants(m.segs));
  lvl1.slice(0, 3).forEach(sv => add(joinRead(sv)));
  for (const sv of lvl1) {
    if (opts.length >= 4) break;
    shuffle(segVariants(sv)).slice(0, 2).forEach(s2 => { const v = joinRead(s2); if (v !== m.answer) add(v); });
  }
  sameTail.forEach(o => add(o.m1.answer));
  // Vẫn thiếu: lấy cách đọc từ khác cùng loại
  shuffle(WORDS.filter(o => o.m1 && o !== w && posGroup(o) === posGroup(w) &&
    Math.abs(o.m1.answer.length - m.answer.length) <= 1)).forEach(o => add(o.m1.answer));
  shuffle(WORDS.filter(o => o.m1 && o !== w)).forEach(o => add(o.m1.answer));
  return { w, answer: m.answer, options: shuffle(opts), pick: null };
}
function sentPart(str, furi) {
  return furi ? esc(str).replace(/\{([^{}|]*)\|([^{}|]*)\}/g, '<ruby>$1<rt>$2</rt></ruby>')
              : esc(str).replace(/\{([^{}|]*)\|[^{}|]*\}/g, '$1');
}

// ===== Đề 問題2 表記 tự tạo: hiragana gạch chân -> chọn chữ Hán =====
// Đáp án nhiễu: thay 1 chữ Hán bằng chữ đồng âm Hán Việt (工/公/功), hoặc từ khác cùng okurigana
const HV_GROUPS = {};
Object.entries(HANVIET).forEach(([k, v]) => (HV_GROUPS[v] ||= []).push(k));
function makeM2(w) {
  const m = w.m1;
  const opts = [m.target];
  const add = v => { if (v && !opts.includes(v) && opts.length < 4) opts.push(v); };
  const swaps = [];
  m.segs.forEach((s, j) => {
    if (!s.kanji) return;
    [...s.text].forEach((c, ci) => (HV_GROUPS[HANVIET[c]] || []).filter(x => x !== c).forEach(x => {
      const text = [...s.text]; text[ci] = x;
      swaps.push(m.segs.map((t, k) => k === j ? text.join('') : t.text).join(''));
    }));
  });
  shuffle(swaps).forEach(add);
  const tail = m.segs[m.segs.length - 1].kanji ? '' : m.segs[m.segs.length - 1].text;
  const similar = o => o !== w && o.m1 && posGroup(o) === posGroup(w) &&
    (tail ? o.m1.segs[o.m1.segs.length - 1].text === tail : allKanji(o.m1) && o.m1.target.length === m.target.length);
  shuffle(WORDS.filter(similar)).forEach(o => add(o.m1.target));
  // Thiếu thì lấy từ cùng loại có đuôi chia giống (〜ました, 〜て...)
  const end = tail.slice(-2);
  shuffle(WORDS.filter(o => o !== w && o.m1 && posGroup(o) === posGroup(w) &&
    (end ? o.m1.target.endsWith(end) : allKanji(o.m1)))).forEach(o => add(o.m1.target));
  shuffle(WORDS.filter(o => o !== w && o.m1 && posGroup(o) === posGroup(w))).forEach(o => add(o.m1.target));
  return { answer: m.target, options: shuffle(opts) };
}

// ===== Đề 問題3 文脈規定 tự tạo: che từ trong câu ví dụ, chọn từ hợp ngữ cảnh (đáp án bằng hiragana) =====
function m3Tail(w) {
  const segs = w.m3.segs, last = segs[segs.length - 1];
  if (segs.some(s => s.kanji)) return last.kanji ? '' : last.text;
  return posGroup(w) === 'v' || posGroup(w) === 'a' ? w.m3.answer.slice(-2) : '';
}
function makeM3(w) {
  const m = w.m3, tail = m3Tail(w);
  const opts = [m.answer];
  const mainMean = x => x.mean.split(/[,;(]/)[0].trim();
  const add = o => { if (!opts.includes(o.m3.answer) && opts.length < 4 && mainMean(o) !== mainMean(w)) opts.push(o.m3.answer); };
  const base = WORDS.filter(o => o !== w && o.m3 && posGroup(o) === posGroup(w));
  const sameTail = o => m3Tail(o) === tail;
  // Ưu tiên từ khác chủ đề để tránh 2 đáp án cùng hợp nghĩa (かなしい/さびしい)
  shuffle(base.filter(o => o.cat !== w.cat && sameTail(o))).forEach(add);
  shuffle(base.filter(sameTail)).forEach(add);
  shuffle(base.filter(o => Math.abs(o.m3.answer.length - m.answer.length) <= 2)).forEach(add);
  shuffle(base).forEach(add);
  return { answer: m.answer, options: shuffle(opts) };
}
// Tìm từ vựng theo cách đọc (đề 問題3 dùng hiragana, có thể đã chia: ひろった -> ひろう)
// Chữ đứng sau gốc từ phải hợp với đuôi từ điển: さわらない -> さわる (ら), không phải さわぐ
const VERB_NEXT = { う: 'わいうえおっ', く: 'かきくけこい', ぐ: 'がぎぐげごい', す: 'さしすせそ', つ: 'たちつてとっ',
  ぬ: 'なにぬねのん', ぶ: 'ばびぶべぼん', む: 'まみむめもん', る: '' };
function findVocabKana(ans) {
  let best = null;
  WORDS.forEach(w => {
    const k = w.kana.replace('(する)', '').split('・')[0];
    const pos = posGroup(w);
    let len = 0;
    if (ans === k) len = k.length + 1;
    else if (w.kana.includes('(する)') && ans.startsWith(k) && /^[しすさせ]/.test(ans.slice(k.length))) len = k.length + 0.5;
    else if (pos === 'v' && VERB_NEXT[k.slice(-1)] !== undefined) {
      const stem = k.slice(0, -1), next = ans[stem.length];
      // る: nhóm 2 (たべる, おきる) chia tự do; nhóm 1 (おる, はいる...) phải là ら/り/る/れ/ろ/っ
      const ichidan = k.endsWith('る') && /[いきしちにひみりぎじびぴえけせてねへめれげぜでべぺ]$/.test(stem);
      const allow = k.endsWith('る') && !ichidan ? 'らりるれろっ' : VERB_NEXT[k.slice(-1)];
      if (stem && ans.startsWith(stem) && next && (allow === '' || allow.includes(next))) len = stem.length;
    } else if (pos === 'a' && k.endsWith('い')) {
      const stem = k.slice(0, -1);
      if (stem && ans.startsWith(stem) && /^(く|かった|かっ|け|さ)/.test(ans.slice(stem.length))) len = stem.length;
    }
    if (len && (!best || len > best.len)) best = { w, len };
  });
  return best?.w || null;
}

// ===== Đề trong sách (問題1, 2, 3) =====
const MONDAI_INFO = {
  1: { title: '問題1　漢字読み — Đọc chữ Hán',
       desc: 'Chọn cách viết <b>hiragana</b> đúng cho từ chữ Hán được gạch chân.',
       instr: '問題1　＿＿＿の　ことばは　ひらがなで　どう　かきますか。１・２・３・４から　いちばん　いい　ものを　ひとつ　えらんで　ください。' },
  2: { title: '問題2　表記 — Chọn chữ Hán',
       desc: 'Chọn cách viết <b>chữ Hán</b> đúng cho từ hiragana được gạch chân. Cẩn thận các chữ trông gần giống nhau!',
       instr: '問題2　＿＿＿の　ことばは　どう　かきますか。１・２・３・４から　いちばん　いい　ものを　ひとつ　えらんで　ください。' },
  3: { title: '問題3　文脈規定 — Điền từ vào câu',
       desc: 'Chọn từ thích hợp nhất để điền vào chỗ trống （　） — kiểm tra nghĩa và cách dùng từ.',
       instr: '問題3　（　）に　なにを　いれますか。１・２・３・４から　いちばん　いい　ものを　ひとつ　えらんで　ください。' },
  4: { title: '問題4　言い換え類義 — Chọn câu cùng nghĩa',
       desc: 'Chọn câu có nghĩa gần nhất với câu đề. Phần khác nhau giữa 4 câu được in đậm để dễ so sánh.',
       instr: '問題4　＿＿＿の　ぶんと　だいたい　おなじ　いみの　ぶんが　あります。１・２・３・４から　いちばん　いい　ものを　ひとつ　えらんで　ください。',
       noGen: true },
  5: { title: '問題5　用法 — Chọn câu dùng từ đúng',
       desc: 'Cho một từ và 4 câu đều dùng từ đó — chọn câu dùng <b>đúng nghĩa, đúng ngữ cảnh</b>.',
       instr: '問題5　つぎの　ことばの　つかいかたで　いちばん　いい　ものを　１・２・３・４から　ひとつ　えらんで　ください。',
       noGen: true },
  6: { title: '文法1　文法形式の判断 — Chọn ngữ pháp',
       desc: 'Chọn trợ từ / mẫu ngữ pháp đúng để điền vào chỗ trống （　）.',
       instr: '問題1　（　）に　何を　入れますか。１・２・３・４から　いちばん　いい　ものを　一つ　えらんで　ください。',
       noGen: true },
  8: { title: '文法3　文章の文法 — Đoạn văn',
       desc: 'Đọc đoạn văn và chọn từ / mẫu ngữ pháp hợp với mạch văn cho từng chỗ trống.',
       instr: '問題3　文章の　意味を　考えて、（　）に　入る　最も　よい　ものを　１・２・３・４から　一つ　えらんで　ください。',
       noGen: true },
  9: { title: 'Từ đồng nghĩa JLPT', desc: 'Các cặp đồng nghĩa đã từng ra trong đề JLPT N4.',
       instr: 'つぎの　ことばと　だいたい　おなじ　いみの　ものを　１・２・３・４から　ひとつ　えらんで　ください。',
       noGen: true },
  7: { title: '文法2　文の組み立て — Sắp xếp câu ★',
       desc: 'Sắp xếp 4 cụm từ vào 4 ô cho thành câu đúng, rồi chọn cụm nằm ở ô <b>★</b>. Mẹo: ghép các cụm hiển nhiên đi liền nhau trước.',
       instr: '問題2　★に　入る　ものは　どれですか。１・２・３・４から　いちばん　いい　ものを　一つ　えらんで　ください。',
       noGen: true },
};
const nl2br = html => html.replace(/\n/g, '<br>');
// 問題4: tìm phần khác nhau giữa 4 câu đáp án (bỏ phần đầu/cuối giống nhau)
function diffParts(opts) {
  let pre = 0, suf = 0;
  const minLen = Math.min(...opts.map(o => o.length));
  while (pre < minLen && opts.every(o => o[pre] === opts[0][pre])) pre++;
  while (suf < minLen - pre && opts.every(o => o[o.length - 1 - suf] === opts[0][opts[0].length - 1 - suf])) suf++;
  // không cắt giữa từ: phần đầu kết thúc ở dấu cách, phần cuối bắt đầu ở dấu cách
  while (pre > 0 && opts[0][pre - 1] !== ' ') pre--;
  while (suf > 0 && opts[0][opts[0].length - suf] !== ' ') suf--;
  return opts.map(o => ({ head: o.slice(0, pre), mid: o.slice(pre, o.length - suf), tail: o.slice(o.length - suf) }));
}
const BOOK_TESTS = [];
Object.entries(typeof MONDAI === 'undefined' ? {} : MONDAI).forEach(([mondai, list]) => list.forEach(q => {
  let t = BOOK_TESTS.find(x => x.test === q.test);
  if (!t) BOOK_TESTS.push(t = { mondai: Number(mondai), test: q.test, qs: [] });
  t.qs.push(q);
}));
// Tìm từ vựng ứng với phần chữ Hán (để giải thích nghĩa + đưa vào ôn tập)
function findVocab(target) {
  target = target.replace(/^[おご]/, '');
  let best = null;
  WORDS.forEach(w => {
    const k = w.kanji.replace('(する)', '').replace('(お)', '').replace(/^[おご]/, '');
    if (!k || !hasKanji(w)) return;
    const stem = k.replace(/[\u3040-\u309f]+$/, '');   // bỏ okurigana: 急ぐ -> 急
    // độ dài phần khớp: khớp cả từ ưu tiên hơn khớp gốc chữ Hán
    const len = target.startsWith(k) ? k.length + 0.5
      : stem && target.startsWith(stem) && /[\u4e00-\u9fff]/.test(stem) ? stem.length : 0;
    if (len && (!best || len > best.len)) best = { w, len };
  });
  return best?.w || null;
}
function bookQuestion(q, mondai) {
  const answer = q.options[q.answer - 1];
  if (mondai === 5) {
    const w = /[\u4e00-\u9fff]/.test(q.word) ? findVocab(q.word) : findVocabKana(q.word);
    return { mondai, xp: q.xp, w, mean: q.mean, note: q.note, word: q.word, target: q.word, answer,
      options: q.options.slice(), pick: null, circled: q.circled,
      optHtml: q.options.map(o => esc(o).replace(/\[(.*?)\]/, '<u class="m1-target">$1</u>')) };
  }
  if (mondai === 8) {
    return { mondai, xp: q.xp, w: null, note: q.note, passage: q.passage, blank: String(q.blank), answer,
      options: q.options.slice(), pick: null, circled: q.circled };
  }
  if (mondai === 7) {
    return { mondai, xp: q.xp, w: null, note: q.note, tokens: q.sentence.split(/(＿＿|★)/), order: q.order, answer,
      options: q.options.slice(), pick: null, circled: q.circled };
  }
  if (mondai === 6) {
    const parts = q.sentence.split('（　）');
    return { mondai, xp: q.xp, w: null, mean: q.mean, note: q.note, parts: parts.map(p => nl2br(esc(p))), answer,
      options: q.options.slice(), pick: null, circled: q.circled };
  }
  if (mondai === 3) {
    const [before, after] = q.sentence.split('（　）');
    return { mondai, xp: q.xp, w: findVocabKana(answer), mean: q.mean, note: q.note, before: esc(before), target: '', after: esc(after ?? ''),
      answer, options: q.options.slice(), pick: null, circled: q.circled };
  }
  const m = q.sentence.match(/^(.*)\[(.*?)\](.*)$/);
  if (mondai === 4) {
    const parts = diffParts(q.options);
    const target = m[2].trim();
    const w = /[\u4e00-\u9fff]/.test(target) ? findVocab(target) : findVocabKana(target.split(' ')[0]);
    return { mondai, xp: q.xp, w, mean: q.mean, note: q.note, before: esc(m[1]), target: m[2], after: esc(m[3]), answer,
      options: q.options.slice(), pick: null, circled: q.circled,
      optHtml: parts.map(p => `${esc(p.head)}<b class="diff">${esc(p.mid)}</b>${esc(p.tail)}`),
      answerMid: parts[q.answer - 1].mid };
  }
  const w = findVocab(mondai === 2 ? answer : m[2]);
  return { mondai, w, mean: q.mean, before: esc(m[1]), target: m[2], after: esc(m[3]), answer,
    options: q.options.slice(), pick: null, circled: q.circled };
}
function genQuestion(w, furi, mondai) {
  if (mondai === 3) {
    const g = makeM3(w);
    return { mondai, w, before: sentPart(w.m3.before, furi), target: '', after: sentPart(w.m3.after, furi),
      answer: g.answer, options: g.options, pick: null };
  }
  const g = mondai === 2 ? makeM2(w) : makeM1(w);
  return { mondai, w, before: sentPart(w.m1.before, furi), target: mondai === 2 ? w.m1.answer : w.m1.target,
    after: sentPart(w.m1.after, furi), answer: g.answer, options: g.options, pick: null };
}

// ===== Kho câu hỏi chung: đề sách + đề thi thật + từ đồng nghĩa =====
const PAST_EXAMS = [];
(typeof PAST === 'undefined' ? [] : PAST).forEach(q => {
  let e = PAST_EXAMS.find(x => x.exam === q.exam);
  if (!e) PAST_EXAMS.push(e = { exam: q.exam, qs: [] });
  e.qs.push(q);
});
PAST_EXAMS.sort((a, b) => (a.exam < b.exam ? -1 : 1));
PAST_EXAMS.forEach(e => e.qs.sort((a, b) => a.type - b.type || a.no - b.no));
const examLabel = code => /^\d{4}-\d{2}$/.test(code)
  ? (code === '2010-11' ? 'JLPT 2010–2011' : `JLPT ${Number(code.slice(5))}/${code.slice(0, 4)}`)
  : `Đề ${code}`;
const SYN = typeof SYNONYMS === 'undefined' ? [] : SYNONYMS;

// Câu hỏi từ đồng nghĩa: cho từ/câu A, chọn cách nói cùng nghĩa B
function synQuestion(p) {
  const others = shuffle(SYN.filter(o => o !== p && o.b !== p.b)).slice(0, 3);
  const pairs = shuffle([p, ...others]);
  return { mondai: 9, w: findVocab(p.a) || null, word: p.a, kana: p.a_kana, answer: p.b,
    options: pairs.map(o => o.b), pick: null,
    xp: { vi: `${p.a} ≈ ${p.b}: ${p.vi}`, why: `Cặp đồng nghĩa đã xuất hiện trong ${examLabel(p.exam)}.`,
      opts: pairs.map(o => `${o === p ? '✓' : '✗'} ${o.b}: ${o.vi}`) } };
}
function mkQ(item) {
  const o = item.mondai === 9 ? synQuestion(item.raw) : bookQuestion(item.raw, item.mondai);
  o.qid = item.qid; o.src = item.src;
  o.ai = item.mondai === 9 ? o.options.indexOf(o.answer) : item.raw.answer - 1;
  return o;
}
// Lựa chọn j có phải đáp án? (đề có thể in 2 lựa chọn trùng chữ nên ưu tiên so theo vị trí)
const isAns = (q, j) => (q.ai != null ? j === q.ai : q.options[j] === q.answer);
const ansNo = q => (q.ai != null ? q.ai : q.options.indexOf(q.answer)) + 1;
// Danh sách mọi câu hỏi (dạng "item" để tạo câu hỏi khi cần)
const ALL_ITEMS = [
  ...BOOK_TESTS.flatMap(t => t.qs.map(q => ({ qid: `B${t.mondai}|${t.test}|${q.no}`, mondai: t.mondai, raw: q, src: `Sách · ${t.test} · câu ${q.no}` }))),
  ...PAST_EXAMS.flatMap(e => e.qs.map(q => ({ qid: `P|${e.exam}|${q.type}|${q.no}`, mondai: q.type, raw: q, src: `${examLabel(e.exam)} · câu ${q.no}` }))),
  ...SYN.map(p => ({ qid: `S|${p.exam}|${p.no}`, mondai: 9, raw: p, src: `Đồng nghĩa · ${examLabel(p.exam)}` })),
];
const qstat = id => (state.qstats || {})[id];
const isQDue = id => { const s = qstat(id); return !!s && s.due && s.due <= todayStr(); };
// Ghi kết quả từng câu: đúng thì giãn lịch 1→3→7→14→30 ngày, sai thì quay lại ngay
function recordQ(q, ok) {
  if (!q.qid) return;
  const s = ((state.qstats ||= {})[q.qid] ||= { r: 0, w: 0, box: 0, due: null });
  if (ok) { s.r++; s.box = Math.min(s.box + 1, INTERVALS.length - 1); s.due = addDays(todayStr(), INTERVALS[s.box]); }
  else { s.w++; s.box = 0; s.due = todayStr(); }
}
// Đề trộn: ưu tiên câu đến hạn ôn → câu chưa làm (rải đều các dạng) → câu còn lại
function pickMix(n) {
  const due = shuffle(ALL_ITEMS.filter(it => isQDue(it.qid))).sort((a, b) => qstat(a.qid).box - qstat(b.qid).box);
  const picked = due.slice(0, Math.ceil(n * 0.6));
  const byM = {};
  shuffle(ALL_ITEMS.filter(it => !qstat(it.qid))).forEach(it => (byM[it.mondai] ||= []).push(it));
  const ms = shuffle(Object.keys(byM));
  for (let i = 0; picked.length < n && ms.some(m => byM[m].length); i++) {
    const m = ms[i % ms.length];
    if (byM[m].length) picked.push(byM[m].pop());
  }
  shuffle(ALL_ITEMS.filter(it => !picked.includes(it))).forEach(it => { if (picked.length < n) picked.push(it); });
  return picked.sort((a, b) => a.mondai - b.mondai);
}
function renderCombo() {
  const due = ALL_ITEMS.filter(it => isQDue(it.qid)).length;
  const seen = ALL_ITEMS.filter(it => qstat(it.qid)).length;
  $('mixTodayInfo').textContent = `${ALL_ITEMS.length} câu trong kho · đã làm ${seen}`;
  $('reviewWrongInfo').textContent = due ? `${due} câu đến hạn ôn` : 'Chưa có câu nào cần ôn';
  $('synInfo').textContent = `${SYN.length} cặp từ đã ra đề`;
  const best = state.bookBest || {};
  $('pastExams').innerHTML = PAST_EXAMS.length ? PAST_EXAMS.map((e, i) => {
    const b = best['past:' + e.exam];
    const cls = !b ? '' : b.score === e.qs.length ? ' done' : ' tried';
    return `<button class="book-test${cls}" data-pe="${i}"><b>${esc(examLabel(e.exam))}</b>
      <span>${b ? `Cao nhất ${b.score}/${e.qs.length}` : `${e.qs.length} câu`}</span></button>`;
  }).join('') : '<p class="muted">Chưa có đề thi thật.</p>';
}
$('mixToday').addEventListener('click', () => {
  const items = pickMix(Number($('mixNum').value) || 20);
  startExam(items.map(mkQ), 'Đề trộn tổng hợp', null, null);
});
$('reviewWrong').addEventListener('click', () => {
  const items = shuffle(ALL_ITEMS.filter(it => isQDue(it.qid))).slice(0, 40).sort((a, b) => a.mondai - b.mondai);
  if (!items.length) return toast('Chưa có câu nào cần ôn — làm thêm đề nhé!');
  startExam(items.map(mkQ), 'Ôn câu sai / đến hạn', null, null);
});
$('synQuiz').addEventListener('click', () => {
  if (!SYN.length) return toast('Chưa có dữ liệu từ đồng nghĩa');
  const items = shuffle(ALL_ITEMS.filter(it => it.mondai === 9)).slice(0, 20);
  startExam(items.map(mkQ), 'Từ đồng nghĩa JLPT', null, 9);
});
$('pastExams').addEventListener('click', e => {
  const b = e.target.closest('[data-pe]');
  if (!b) return;
  const ex = PAST_EXAMS[b.dataset.pe];
  const items = ALL_ITEMS.filter(it => it.qid.startsWith(`P|${ex.exam}|`));
  startExam(items.map(mkQ), `${examLabel(ex.exam)} · 文字・語彙 + 文法`, 'past:' + ex.exam, null);
});

let exam = null;
let examMondai = 1;
function resetExam() {
  if (exam?.timer) clearInterval(exam.timer);
  exam = null;
  $('examSetup').classList.remove('hidden');
  $('examPaper').classList.add('hidden');
  $('examResult').classList.add('hidden');
  $('examMsg').textContent = '';
  $('examFuri').checked = state.settings.examFuri !== false;
  examMondai = state.settings.examMondai || 1;
  document.querySelectorAll('.mondai-tabs button').forEach(b => b.classList.toggle('active', Number(b.dataset.m) === examMondai));
  $('examTitle').textContent = MONDAI_INFO[examMondai].title;
  $('genSection').classList.toggle('hidden', !!MONDAI_INFO[examMondai].noGen);
  $('examDesc').innerHTML = MONDAI_INFO[examMondai].desc + ' Làm hết rồi bấm <b>Nộp bài</b> để chấm. Câu sai sẽ tự đưa vào ôn tập.';
  renderCombo();
  const best = state.bookBest || {};
  const tests = BOOK_TESTS.filter(t => t.mondai === examMondai);
  const pasts = PAST_EXAMS.filter(e => e.qs.some(q => q.type === examMondai));
  $('bookTests').innerHTML = (tests.length ? tests.map(t => {
    const b = best[t.test];
    const cls = !b ? '' : b.score === t.qs.length ? ' done' : ' tried';
    return `<button class="book-test${cls}" data-i="${BOOK_TESTS.indexOf(t)}"><b>${esc(t.test.replace(/^\S+ /, ''))}</b>
      <span>${b ? `Cao nhất ${b.score}/${t.qs.length}` : `${t.qs.length} câu`}</span></button>`;
  }).join('') : '') + pasts.map(e => {
    const n = e.qs.filter(q => q.type === examMondai).length, key = `past:${e.exam}:${examMondai}`, b = best[key];
    const cls = !b ? '' : b.score === n ? ' done' : ' tried';
    return `<button class="book-test past${cls}" data-pm="${e.exam}"><b>${esc(examLabel(e.exam))}</b>
      <span>${b ? `Cao nhất ${b.score}/${n}` : `${n} câu · đề thật`}</span></button>`;
  }).join('') || '<p class="muted">Chưa có đề cho dạng này.</p>';
  const log = state.examLog || [];
  $('examHistory').innerHTML = log.length
    ? '<h3>Kết quả gần đây</h3>' + log.slice().reverse().map(r =>
      `<div class="hist-row"><span>${esc(r.name || '')}</span><span>${r.date.split('-').reverse().slice(0, 2).join('/')}</span><span>${r.score}/${r.n}</span><span class="muted">${fmtTime(r.secs)}</span></div>`).join('')
    : '';
}
const fmtTime = s => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
document.querySelectorAll('.mondai-tabs button').forEach(b => b.addEventListener('click', () => {
  state.settings.examMondai = Number(b.dataset.m);
  save();
  resetExam();
}));
$('bookTests').addEventListener('click', e => {
  const pm = e.target.closest('[data-pm]');
  if (pm) {
    const items = ALL_ITEMS.filter(it => it.qid.startsWith(`P|${pm.dataset.pm}|${examMondai}|`));
    return startExam(items.map(mkQ), `${examLabel(pm.dataset.pm)} · ${MONDAI_INFO[examMondai].title.split('—')[0].trim()}`,
      `past:${pm.dataset.pm}:${examMondai}`, examMondai);
  }
  const b = e.target.closest('.book-test');
  if (!b) return;
  const t = BOOK_TESTS[b.dataset.i];
  startExam(ALL_ITEMS.filter(it => it.qid.startsWith(`B${t.mondai}|${t.test}|`)).map(mkQ), t.test, t.test, t.mondai);
});
$('bookMixStart').addEventListener('click', () => {
  const all = ALL_ITEMS.filter(it => it.mondai === examMondai);
  if (!all.length) return;
  const n = Math.min(Number($('bookMixNum').value) || 9, all.length);
  startExam(shuffle(all.slice()).slice(0, n).map(mkQ), `${MONDAI_INFO[examMondai].title.split('—')[0].trim()} · Trộn sách + đề thật`, null, examMondai);
});
$('examStart').addEventListener('click', () => {
  const pool = quizPool($('examScope').value).filter(w => examMondai === 3 ? w.m3 : w.m1);
  if (!pool.length) {
    $('examMsg').textContent = $('examScope').value === 'weak'
      ? 'Chưa có từ hay sai nào. Học thêm rồi quay lại nhé!'
      : 'Chưa có từ nào trong phạm vi này — hãy học vài từ trước, hoặc chọn “Tất cả các từ”.';
    return;
  }
  state.settings.examFuri = $('examFuri').checked;
  save();
  const n = Math.min(Number($('examNum').value), pool.length);
  const furi = state.settings.examFuri !== false;
  startExam(shuffle(pool.slice()).slice(0, n).map(w => genQuestion(w, furi, examMondai)),
    `問題${examMondai} · Đề tự tạo`, null, examMondai);
});
function startExam(qs, name, bookTest, mondai) {
  exam = { qs, name, bookTest, mondai, start: Date.now() };
  $('examSetup').classList.add('hidden');
  $('examResult').classList.add('hidden');
  $('examPaper').classList.remove('hidden');
  $('examSubmit').classList.remove('hidden');
  $('examName').textContent = name;
  $('examInstr').classList.add('hidden');
  renderExam(false);
  $('examTimer').textContent = '00:00';
  exam.timer = setInterval(() => { $('examTimer').textContent = fmtTime(Math.floor((Date.now() - exam.start) / 1000)); }, 1000);
  window.scrollTo(0, 0);
}
function explainHtml(q) {
  const res = q.pick === null ? '⚪ Chưa làm.' : isAns(q, q.pick) ? '✅ Đúng.' : '❌ Sai.';
  const w = q.w;
  const kanjiText = (q.mondai === 2 ? q.answer : q.target) || '';
  let html = q.mondai === 8 || q.mondai === 9
    ? `${res} Đáp án: <b class="jp">${esc(q.answer)}</b>`
    : q.mondai === 7
    ? `${res} Thứ tự đúng: <b>${q.order.join(' → ')}</b> · ★ = <b class="jp">${esc(q.answer)}</b>`
    : q.mondai === 5
    ? `${res} Câu dùng đúng: <b>câu ${ansNo(q)}</b> · <b class="jp">${esc(q.word)}</b>${w && hasKanji(w) ? ` <span class="jp">(${esc(w.kanji)})</span>` : ''}`
    : q.mondai === 6
    ? `${res} Đáp án: <b class="jp">${esc(q.answer)}</b>`
    : q.mondai === 4
    ? `${res} 「<b class="jp">${esc(q.target)}</b>」 ≈ 「<b class="jp">${esc(q.answerMid)}</b>」 → câu ${ansNo(q)}`
    : q.mondai === 3
    ? `${res} Đáp án: <b class="jp">${esc(q.answer)}</b>${w && hasKanji(w) ? ` <span class="jp">(${esc(w.kanji)})</span>` : ''}`
    : q.mondai === 2
    ? `${res} <b class="jp">${esc(q.target)}</b> viết là <b class="jp">${esc(q.answer)}</b>`
    : `${res} <b class="jp">${esc(q.target)}</b> đọc là <b class="jp">${esc(q.answer)}</b>`;
  const hv = w?.hv || [...kanjiText].filter(c => HANVIET[c]).map(c => HANVIET[c]).join(' ');
  const mean = w?.mean || q.mean;
  if (mean) html += ` — ${esc(mean)}`;
  if (hv) html += ` · <span class="hvs">${hv}</span>`;
  if (q.circled && !isAns(q, q.circled - 1))
    html += `<div class="muted">📌 Trên sách bạn từng khoanh ${q.circled} (${esc(q.options[q.circled - 1])}) — câu này dễ nhầm, nhớ kỹ nhé.</div>`;
  if (q.xp) {
    html += `<div class="xp"><div class="xp-vi">${q.mondai === 5 ? '📖' : '🇻🇳'} ${nl2br(esc(q.xp.vi))}</div><div class="xp-why">💡 ${esc(q.xp.why)}</div>
      <ul class="xp-opts">${q.xp.opts.map((o, j) => { const ok = isAns(q, j);
        const mark = q.mondai === 7 ? (ok ? '★' : '•') : ok ? '✓' : '✗';
        return `<li class="${ok ? 'ok' : q.mondai === 7 ? 'neutral' : 'bad'}${q.pick === j ? ' picked' : ''}"><b>${mark} ${j + 1}.</b> ${esc(o.replace(/^[✓✗]\s*/, ''))}</li>`; }).join('')}</ul></div>`;
  }
  if (q.note) html += `<div class="muted">⚠️ ${esc(q.note)}</div>`;
  if (w?.ex) html += `<div class="example">${exBlock(w)}</div>`;
  if (q.src) html += `<div class="muted src-line">📍 ${esc(q.src)}</div>`;
  return html;
}
// 文法2 ★: hiện 4 ô trống; khi chấm điền theo thứ tự đúng, tô ô ★
function starSentence(q, graded) {
  let slot = 0;
  return q.tokens.map(t => {
    if (t !== '＿＿' && t !== '★') return nl2br(esc(t));
    const i = slot++;
    if (!graded) return `<span class="slot${t === '★' ? ' star' : ''}">${t === '★' ? '★' : ''}</span>`;
    return `<span class="slot filled${t === '★' ? ' star' : ''}">${esc(q.options[q.order[i] - 1])}</span>`;
  }).join('');
}
function passageHtml(q, graded, full) {
  if (!full) return `<span class="muted">(Đoạn văn ở trên)</span> chỗ trống <span class="blank">（${esc(q.blank)}）</span>`;
  const mark = `（${q.blank}）`;
  return `<div class="passage">${nl2br(esc(q.passage)).replace(esc(mark), graded
    ? `<span class="blank filled">（${esc(q.blank)}: ${esc(q.answer)}）</span>` : `<span class="blank">${esc(mark)}</span>`)}</div>`;
}
function renderExam(graded) {
  let prevM = null, prevPassage = null;
  $('examQs').innerHTML = exam.qs.map((q, i) => {
    const head = q.mondai !== prevM ? `<p class="exam-instr">${esc(MONDAI_INFO[q.mondai].instr)}</p>` : '';
    prevM = q.mondai;
    const fullPassage = q.mondai === 8 && q.passage !== prevPassage;
    prevPassage = q.mondai === 8 ? q.passage : null;
    const opts = q.options.map((o, j) => {
      let cls = 'm1-opt' + (q.mondai === 2 ? ' kanji' : [4, 5, 9].includes(q.mondai) ? ' sent' : '');
      if (q.pick === j) cls += ' picked';
      if (graded && isAns(q, j)) cls += ' correct';
      else if (graded && q.pick === j) cls += ' wrong';
      return `<button class="${cls}" data-q="${i}" data-o="${j}" ${graded ? 'disabled' : ''}><b>${j + 1}</b> ${q.optHtml ? q.optHtml[j] : esc(o)}</button>`;
    }).join('');
    return `${head}<div class="m1-q">
      <div class="m1-sent"><span class="m1-no">${i + 1}</span>${q.mondai === 8
        ? passageHtml(q, graded, fullPassage)
        : q.mondai === 9
        ? `<span class="m5-word">${esc(q.word)}</span> <span class="jp-kana">${esc(q.kana || '')}</span>`
        : q.mondai === 5
        ? `<span class="m5-word">${esc(q.word)}</span>`
        : q.mondai === 7
        ? starSentence(q, graded)
        : q.mondai === 6
        ? q.parts.map((p, k) => k === 0 ? p : (graded && q.parts.length === 2
            ? `<span class="blank filled">（${esc(q.answer)}）</span>` : '<span class="blank">（　　　）</span>') + p).join('')
        : ''}${q.mondai >= 5 ? '' : q.before}${q.mondai >= 5 ? '' : q.mondai === 3
        ? (graded ? `<span class="blank filled">（${esc(q.answer)}）</span>` : '<span class="blank">（　　　）</span>')
        : `<u class="m1-target">${esc(q.target)}</u>`}${q.mondai >= 5 ? '' : q.after}</div>
      <div class="m1-opts${[4, 5, 9].includes(q.mondai) ? ' vertical' : ''}">${opts}</div>
      ${graded ? `<div class="m1-explain">${explainHtml(q)}</div>` : ''}</div>`;
  }).join('');
}
$('examQs').addEventListener('click', e => {
  const b = e.target.closest('.m1-opt');
  if (!b || !exam || exam.graded) return;
  exam.qs[b.dataset.q].pick = Number(b.dataset.o);
  b.parentElement.querySelectorAll('.m1-opt').forEach(x => x.classList.toggle('picked', x === b));
});
$('examQuit').addEventListener('click', () => {
  if (exam && !exam.graded && !confirm('Thoát bài đang làm? Kết quả sẽ không được lưu.')) return;
  resetExam();
});
$('examSubmit').addEventListener('click', () => {
  if (!exam || exam.graded) return;
  const left = exam.qs.filter(q => q.pick === null).length;
  if (left && !confirm(`Còn ${left} câu chưa làm. Vẫn nộp bài?`)) return;
  clearInterval(exam.timer);
  exam.graded = true;
  const secs = Math.floor((Date.now() - exam.start) / 1000);
  let score = 0;
  const wrongQs = [];
  exam.qs.forEach(q => {
    const ok = q.pick !== null && isAns(q, q.pick);
    if (ok) score++; else wrongQs.push(q);
    if (q.w) recordAnswer(q.w, ok);
    recordQ(q, ok);
  });
  (state.examLog ||= []).push({ name: exam.name, date: todayStr(), n: exam.qs.length, score, secs });
  state.examLog = state.examLog.slice(-15);
  if (exam.bookTest) {
    const best = (state.bookBest ||= {});
    if (!best[exam.bookTest] || score > best[exam.bookTest].score) best[exam.bookTest] = { score, date: todayStr() };
  }
  save();
  renderExam(true);
  $('examSubmit').classList.add('hidden');
  const pct = Math.round(score / exam.qs.length * 100);
  $('examResult').innerHTML = `<div class="result-big">${score}/${exam.qs.length} (${pct}%)</div>
    <p style="text-align:center">${esc(exam.name)} · Thời gian: ${fmtTime(secs)} · ${pct >= 90 ? 'Xuất sắc! 🎉' : pct >= 70 ? 'Khá tốt, cố thêm chút nữa! 💪' : 'Xem lại giải thích từng câu bên dưới nhé!'}</p>
    <div class="actions">
      ${wrongQs.length ? '<button class="btn bad" id="examRetry">Làm lại câu sai</button>' : ''}
      <button class="btn primary" id="examNew">Chọn đề khác</button>
    </div>`;
  $('examResult').classList.remove('hidden');
  $('examNew').addEventListener('click', resetExam);
  if (wrongQs.length) $('examRetry').addEventListener('click', () =>
    startExam(shuffle(wrongQs.map(q => ({ ...q, pick: null }))), 'Làm lại câu sai', null, exam.mondai));
  window.scrollTo(0, 0);
});

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
