# App học từ vựng N4 — 30 ngày

## Cách mở
Mở file `index.html` bằng Chrome hoặc Safari (double-click). Không cần cài gì thêm và không cần mạng.

## Mỗi ngày
1. **Sáng – Học từ mới** (~37 từ/ngày, ~20 phút): bấm "Học" ở trang *Hôm nay*.
   Xem chữ → tự đoán nghĩa và cách đọc → lật thẻ → chọn *Chưa nhớ* hoặc *Nhớ rồi*.
   Thẻ nào chưa nhớ sẽ quay lại sau vài thẻ.
2. **Tối – Ôn tập**: bấm "Ôn". App tự nhắc lại từ sau 1 → 3 → 7 → 14 → 30 ngày.
   Mặt sau thẻ có câu ví dụ kèm furigana và bản dịch. Bấm 🔊 cạnh câu để nghe cả câu.
3. **Quiz**: 4 dạng giống đề JLPT (nghĩa, cách đọc chữ Hán, chọn chữ Hán đúng, điền từ vào câu).
   Câu sai sẽ tự đưa vào danh sách ôn.

4. **Luyện đề** (chọn dạng ở trên cùng):
   - 問題1 漢字読み: chọn cách đọc hiragana — 20 bài テスト từ sách (140 câu)
   - 問題2 表記: chọn chữ Hán đúng — 20 bài テスト từ sách (100 câu)
   - 問題3 文脈規定: chọn từ điền vào chỗ trống — 20 bài テスト từ sách (160 câu)
   - 問題4 言い換え類義: chọn câu cùng nghĩa — 20 bài テスト từ sách (80 câu); phần khác nhau giữa các câu được in đậm
   - 問題5 用法: chọn câu dùng từ đúng — 20 bài テスト từ sách (80 câu)
   - 文法1 文法形式: chọn ngữ pháp điền vào chỗ trống — 20 bài テスト từ sách (260 câu)
   - 文法2 ★: sắp xếp 4 cụm từ, chọn cụm ở ô ★ — 20 bài テスト từ sách (80 câu); chấm xong hiện câu hoàn chỉnh

   問題3, 問題4, 問題5 và 文法 có thêm bản dịch câu, giải thích vì sao đúng và nghĩa/lý do sai của từng lựa chọn.

   Mỗi bài lưu điểm cao nhất. Có thể trộn câu ngẫu nhiên từ các bài, hoặc tạo đề mới từ 806 từ (問題1–3).
   Làm xong bấm *Nộp bài* để chấm và xem giải thích.

Ngày 1–22 học từ mới, ngày 23–30 chỉ ôn và làm quiz "Từ hay sai".

## Lưu ý
- Tiến độ được lưu trong trình duyệt. Đổi máy/trình duyệt thì vào ⚙︎ → *Xuất file tiến độ* rồi nhập lại ở máy mới.
- Muốn sửa hoặc thêm từ: sửa `vocab.txt` (mỗi dòng `kana|chữ Hán|nghĩa`), sau đó chạy `python3 build_data.py`.
- Đề trong sách nằm ở `mondai1.jsonl` … `mondai7.jsonl` (mỗi dòng một câu; `[ ]` là phần gạch chân, `（　）` là chỗ trống, `answer` là đáp án đúng, `note` là ghi chú khi nghi sách in lỗi, `xp` là bản dịch + giải thích, `order` là thứ tự đúng của đề ★).
- Câu ví dụ nằm trong `examples.tsv` (mỗi dòng `ID<TAB>câu<TAB>bản dịch`). Trong câu, `{漢字|かんじ}` là furigana, còn `[...]` đánh dấu từ đang học. Sửa xong cũng chạy lại `python3 build_data.py`.
