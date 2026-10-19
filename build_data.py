"""Đọc vocab.txt + hanviet.txt + examples.tsv + mondaiN.jsonl -> data.js (chạy lại sau khi sửa vocab.txt)."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
hv = {}
for tok in open(os.path.join(HERE, 'hanviet.txt'), encoding='utf-8').read().split():
    k, v = tok.split(':')
    hv[k] = v
words, cat, seen = [], '', set()
for line in open(os.path.join(HERE, 'vocab.txt'), encoding='utf-8'):
    line = line.strip()
    if not line:
        continue
    if line.startswith('#'):
        cat = line[1:].strip()
        continue
    p = line.split('|') + ['']
    kana, kanji, mean, note = p[0], p[1], p[2], p[3]
    wid = kana + '|' + kanji
    if wid in seen:
        raise SystemExit('Trùng từ: ' + wid)
    seen.add(wid)
    words.append({'id': wid, 'cat': cat, 'kana': kana, 'kanji': kanji,
                  'mean': mean, 'note': note})
# Đề thi thật (past/*.jsonl) và bảng đồng nghĩa (synonyms.jsonl)
import glob
past = []
for path in sorted(glob.glob(os.path.join(HERE, 'past', '*.jsonl'))):
    for line in open(path, encoding='utf-8'):
        if line.strip():
            q = json.loads(line)
            past.append({k: q[k] for k in ('exam', 'type', 'no', 'sentence', 'word', 'passage', 'blank', 'options',
                                           'answer', 'circled', 'note', 'xp', 'order') if k in q})
syn_path = os.path.join(HERE, 'synonyms.jsonl')
synonyms = [json.loads(l) for l in open(syn_path, encoding='utf-8') if l.strip()] if os.path.exists(syn_path) else []
ex_path = os.path.join(HERE, 'examples.tsv')
examples = {}
if os.path.exists(ex_path):
    for line in open(ex_path, encoding='utf-8'):
        p = line.rstrip('\n').split('\t')
        if len(p) == 3:
            examples[p[0]] = (p[1], p[2])
for w in words:
    if w['id'] in examples:
        w['ex'], w['exVi'] = examples[w['id']]
no_ex = [w['id'] for w in words if 'ex' not in w]
# Đề trong sách: mondai1.jsonl, mondai2.jsonl (mỗi dòng 1 câu hỏi)
mondai = {}
for n in (1, 2, 3, 4, 5, 6, 7):
    path = os.path.join(HERE, f'mondai{n}.jsonl')
    if not os.path.exists(path):
        continue
    mondai[n] = []
    for line in open(path, encoding='utf-8'):
        if line.strip():
            q = json.loads(line)
            mondai[n].append({k: q[k] for k in ('test', 'no', 'word', 'sentence', 'options', 'answer', 'circled', 'mean', 'note', 'xp', 'order') if k in q})
missing = sorted({c for w in words for c in w['kanji'] if '一' <= c <= '鿿' and c not in hv})
used = {c for w in words for c in w['kanji']} | {c for qs in mondai.values() for q in qs for c in q.get('sentence', q.get('word', '')) + ''.join(q['options'])}
hv = {k: v for k, v in hv.items() if k in used}
with open(os.path.join(HERE, 'data.js'), 'w', encoding='utf-8') as f:
    f.write('// File tự sinh từ vocab.txt bằng build_data.py — đừng sửa tay\n')
    f.write('const VOCAB = ' + json.dumps(words, ensure_ascii=False) + ';\n')
    f.write('const HANVIET = ' + json.dumps(hv, ensure_ascii=False) + ';\n')
    f.write('const MONDAI = ' + json.dumps(mondai, ensure_ascii=False) + ';\n')
    f.write('const PAST = ' + json.dumps(past, ensure_ascii=False) + ';\n')
    f.write('const SYNONYMS = ' + json.dumps(synonyms, ensure_ascii=False) + ';\n')
print('Có câu ví dụ:', len(words) - len(no_ex), '/', len(words), ('— thiếu: ' + ', '.join(no_ex[:10])) if no_ex else '')
print('Đề thi thật:', len(past), 'câu,', len({q['exam'] for q in past}), 'đề; đồng nghĩa:', len(synonyms), 'cặp')
print('Đề trong sách:', ', '.join(f'問題{n}: {len(qs)} câu' for n, qs in mondai.items()))
print(len(words), 'từ;', len(hv), 'chữ Hán;', 'thiếu Hán Việt:', ''.join(missing) or 'không')
