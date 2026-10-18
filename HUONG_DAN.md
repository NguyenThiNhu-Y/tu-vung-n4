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

Ngày 1–22 học từ mới, ngày 23–30 chỉ ôn và làm quiz "Từ hay sai".

## Lưu ý
- Tiến độ được lưu trong trình duyệt. Đổi máy/trình duyệt thì vào ⚙︎ → *Xuất file tiến độ* rồi nhập lại ở máy mới.
- Muốn sửa hoặc thêm từ: sửa `vocab.txt` (mỗi dòng `kana|chữ Hán|nghĩa`), sau đó chạy `python3 build_data.py`.
- Câu ví dụ nằm trong `examples.tsv` (mỗi dòng `ID<TAB>câu<TAB>bản dịch`). Trong câu, `{漢字|かんじ}` là furigana, còn `[...]` đánh dấu từ đang học. Sửa xong cũng chạy lại `python3 build_data.py`.
