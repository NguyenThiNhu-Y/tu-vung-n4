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

4. **Luyện tổng hợp** (đầu tab Luyện đề):
   - 🔀 Đề trộn: rút câu từ mọi dạng, mọi nguồn (sách + đề thật + từ đồng nghĩa); ưu tiên câu đến hạn ôn và câu chưa làm
   - 🔁 Ôn câu sai: câu sai quay lại sau 1 → 3 → 7 → 14 → 30 ngày cho tới khi nhớ
   - 🗂 Đề thi thật JLPT: 14 đề (2010–2026 + 1 đề thi thử), làm nguyên đề phần 文字・語彙 + 文法
   - 🔗 Từ đồng nghĩa JLPT: 48 cặp đã từng ra đề
5. **Luyện theo từng dạng** (chọn tab):
   - 問題1 漢字読み: chọn cách đọc hiragana — 20 bài テスト từ sách (140 câu)
   - 問題2 表記: chọn chữ Hán đúng — 20 bài テスト từ sách (100 câu)
   - 問題3 文脈規定: chọn từ điền vào chỗ trống — 20 bài テスト từ sách (160 câu)
   - 問題4 言い換え類義: chọn câu cùng nghĩa — 20 bài テスト từ sách (80 câu); phần khác nhau giữa các câu được in đậm
   - 問題5 用法: chọn câu dùng từ đúng — 20 bài テスト từ sách (80 câu)
   - 文法1 文法形式: chọn ngữ pháp điền vào chỗ trống — 20 bài テスト từ sách (260 câu)
   - 文法2 ★: sắp xếp 4 cụm từ, chọn cụm ở ô ★ — 20 bài テスト từ sách (80 câu); chấm xong hiện câu hoàn chỉnh
   - 文法3 文章: đoạn văn nhiều chỗ trống (chỉ có trong đề thật)
   - Mỗi tab có thêm các đề thật theo năm (viền nét đứt)

   問題3, 問題4, 問題5 và 文法 có thêm bản dịch câu, giải thích vì sao đúng và nghĩa/lý do sai của từng lựa chọn.

   Mỗi bài lưu điểm cao nhất. Có thể trộn câu ngẫu nhiên từ các bài, hoặc tạo đề mới từ 806 từ (問題1–3).
   Làm xong bấm *Nộp bài* để chấm và xem giải thích.

6. **Đọc hiểu 読解** (tab *Đọc hiểu*): toàn bộ bài đọc 問題4 短文, 問題5 中文 và 問題6 情報検索 trong các đề JLPT thật.
   - Bấm **🧭 Cách làm bài đọc** để đọc hướng dẫn: phân bổ thời gian, quy trình 4 bước, mẹo cho từng dạng, các từ "tín hiệu" cần để ý.
   - Khi làm bài có đồng hồ kèm thời gian mục tiêu. Có thể bật/tắt *Furigana hỗ trợ*, bấm 🔊 để nghe cả bài, và 💡 để xem gợi ý cách làm bài đó.
   - Sau khi nộp bài:
     - căn cứ của đáp án được **tô vàng** ngay trong bài;
     - mỗi câu có giải thích vì sao đúng, vì sao từng lựa chọn kia sai, và mẹo cho dạng câu hỏi đó;
     - xem được bản dịch cả bài và bảng từ vựng của bài.
   - Bài làm sai quay lại ở nút **🔁 Làm lại bài sai** theo lịch 1 → 3 → 7 → 14 ngày.
   - Mỗi ngày nên làm 1–2 bài: lần đầu tắt furigana và làm như thi thật, sau đó bật furigana đọc kỹ lại.

Ngày 1–22 học từ mới, ngày 23–30 chỉ ôn và làm quiz "Từ hay sai".

## Lưu ý
- Tiến độ được lưu trong trình duyệt. Đổi máy/trình duyệt thì vào ⚙︎ → *Xuất file tiến độ* rồi nhập lại ở máy mới.
- Muốn sửa hoặc thêm từ: sửa `vocab.txt` (mỗi dòng `kana|chữ Hán|nghĩa`), sau đó chạy `python3 build_data.py`.
- Đề trong sách nằm ở `mondai1.jsonl` … `mondai7.jsonl` (mỗi dòng một câu; `[ ]` là phần gạch chân, `（　）` là chỗ trống, `answer` là đáp án đúng, `note` là ghi chú khi nghi sách in lỗi, `xp` là bản dịch + giải thích, `order` là thứ tự đúng của đề ★).
- Đề thi thật nằm trong `past/<năm-tháng>.jsonl` (type 1–8 = 問題1–5, 文法1–3); bảng đồng nghĩa ở `synonyms.jsonl`.
- Bài đọc nằm trong `reading/<năm-tháng>.jsonl`, mỗi dòng là một bài đọc kèm câu hỏi. Ký hiệu trong bài:
  - `{漢字|よみ}`: furigana in sẵn trong đề;
  - `[漢字|よみ]`: furigana hỗ trợ (bật/tắt được);
  - `__…__`: phần gạch chân;
  - `ev`: đoạn căn cứ sẽ được tô vàng.
- Câu ví dụ nằm trong `examples.tsv` (mỗi dòng `ID<TAB>câu<TAB>bản dịch`). Trong câu, `{漢字|かんじ}` là furigana, còn `[...]` đánh dấu từ đang học. Sửa xong cũng chạy lại `python3 build_data.py`.
