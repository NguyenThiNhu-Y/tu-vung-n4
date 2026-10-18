"""Đọc vocab.txt + hanviet.txt -> data.js (chạy lại sau khi sửa vocab.txt)."""
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
missing = sorted({c for w in words for c in w['kanji'] if '一' <= c <= '鿿' and c not in hv})
used = {c for w in words for c in w['kanji']}
hv = {k: v for k, v in hv.items() if k in used}
with open(os.path.join(HERE, 'data.js'), 'w', encoding='utf-8') as f:
    f.write('// File tự sinh từ vocab.txt bằng build_data.py — đừng sửa tay\n')
    f.write('const VOCAB = ' + json.dumps(words, ensure_ascii=False) + ';\n')
    f.write('const HANVIET = ' + json.dumps(hv, ensure_ascii=False) + ';\n')
print(len(words), 'từ;', len(hv), 'chữ Hán;', 'thiếu Hán Việt:', ''.join(missing) or 'không')
