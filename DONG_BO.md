# Cài đặt đồng bộ tiến độ giữa các máy (làm 1 lần, ~5 phút)

App lưu tiến độ lên **Firebase Firestore** (miễn phí) theo **username** — không cần mật khẩu.

## 1. Tạo project Firebase
1. Vào https://console.firebase.google.com → đăng nhập Google → **Create a project** (Tạo dự án).
2. Đặt tên (vd `tu-vung-n4`) → tắt Google Analytics (không cần) → **Create project**.

## 2. Bật Firestore
1. Menu trái **Build → Firestore Database** → **Create database**.
2. Chọn vị trí gần (vd `asia-southeast1` – Singapore) → chọn **Start in production mode** → **Create**.
3. Vào tab **Rules**, xoá hết, dán đoạn sau rồi bấm **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{user} {
      allow read: if user.matches('^[a-z0-9_.-]{3,30}$');
      allow write: if user.matches('^[a-z0-9_.-]{3,30}$')
        && request.resource.data.keys().hasOnly(['data', 'updated'])
        && request.resource.data.data is string
        && request.resource.data.data.size() < 900000;
    }
  }
}
```

## 3. Lấy projectId và apiKey
1. Bấm ⚙️ cạnh **Project Overview** → **Project settings**.
2. Ở mục **Your apps** bấm biểu tượng **</>** (Web) → đặt tên bất kỳ → **Register app**.
3. Màn hình hiện `firebaseConfig = { apiKey: "...", ..., projectId: "..." }` → copy 2 giá trị `apiKey` và `projectId`.

## 4. Điền vào app
Mở file `sync-config.js`, điền 2 giá trị đó, commit và push. (apiKey của Firebase là khoá công khai, để trong code web là bình thường.)

## 5. Dùng
Trên mỗi máy: ⚙︎ → **Đồng bộ giữa các máy** → nhập cùng một username → **Đồng bộ**.
