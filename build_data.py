"""Đọc vocab.txt + hanviet.txt + examples.tsv + mondai1.jsonl -> data.js (chạy lại sau khi sửa vocab.txt)."""
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
# Đề 問題1 chép từ sách (mondai1.jsonl): mỗi dòng 1 câu hỏi
m1_path = os.path.join(HERE, 'mondai1.jsonl')
mondai1 = []
if os.path.exists(m1_path):
    for line in open(m1_path, encoding='utf-8'):
        if line.strip():
            q = json.loads(line)
            mondai1.append({k: q[k] for k in ('test', 'no', 'sentence', 'options', 'answer', 'circled', 'mean') if k in q})
missing = sorted({c for w in words for c in w['kanji'] if '一' <= c <= '鿿' and c not in hv})
used = {c for w in words for c in w['kanji']} | {c for q in mondai1 for c in q['sentence']}
hv = {k: v for k, v in hv.items() if k in used}
with open(os.path.join(HERE, 'data.js'), 'w', encoding='utf-8') as f:
    f.write('// File tự sinh từ vocab.txt bằng build_data.py — đừng sửa tay\n')
    f.write('const VOCAB = ' + json.dumps(words, ensure_ascii=False) + ';\n')
    f.write('const HANVIET = ' + json.dumps(hv, ensure_ascii=False) + ';\n')
    f.write('const MONDAI1 = ' + json.dumps(mondai1, ensure_ascii=False) + ';\n')
print('Có câu ví dụ:', len(words) - len(no_ex), '/', len(words), ('— thiếu: ' + ', '.join(no_ex[:10])) if no_ex else '')
print('Đề 問題1 trong sách:', len(mondai1), 'câu')
print(len(words), 'từ;', len(hv), 'chữ Hán;', 'thiếu Hán Việt:', ''.join(missing) or 'không')
