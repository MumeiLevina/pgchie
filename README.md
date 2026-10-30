# Chie's Little Universe ✦

Personal website HTML/CSS/JavaScript thuần — xanh pastel, responsive, không cần npm hoặc build tool.

## Chạy thử

1. Mở thư mục bằng VS Code.
2. Mở `index.html` bằng **Live Server** (hoặc chạy `python -m http.server 8000` rồi mở `http://localhost:8000`).
3. Sửa **`config.js`** để thêm tên, tiểu sử, GIF, link mạng xã hội, Discord và nhạc.

## Gắn GIF bằng URL

Mở `config.js` rồi thay:

```js
backgroundGifUrl: "assets/ocean-dream.gif",
heroGifUrl: "https://ten-mien-cua-ban.com/chie.gif",
moodGifUrl: "https://ten-mien-cua-ban.com/mood.gif",
clockGifUrl: "https://ten-mien-cua-ban.com/clock.gif",
```

`backgroundGifUrl`: GIF nền toàn website, hiện dùng GIF biển xanh lưu cục bộ từ [Pinterest](https://www.pinterest.com/pin/1056023812600133090/). Nền cố định khi cuộn, có lớp phủ sáng để chữ dễ đọc. `heroGifUrl`: ảnh lớn trang đầu, hiện để trống để giữ ảnh Marin. `moodGifUrl`: ảnh/GIF trong widget. `clockGifUrl`: GIF nền đồng hồ (có lớp phủ màu để chữ dễ đọc). Khi để trống, dùng ảnh mặc định trong `assets/`.

Dải duy băng đang để trống và giữ chiều cao. Để thêm nội dung, mở `index.html`, tìm `marquee-band` rồi thay comment bên trong thẻ `<div>` con bằng nội dung của bạn.

**Lưu ý:** Website có thể tải GIF qua đường dẫn HTTPS công khai; nguồn bên ngoài có thể chặn hotlink hoặc hết hạn. Tốt nhất tải GIF bạn được phép dùng vào thư mục `assets` và sửa thuộc tính `src` trong HTML nếu muốn lưu cục bộ. Chỉ cần đổi URL; không cần tạo ảnh mới.

## Các widget

- Profile / hero / GIF: hoạt động ngay (ảnh mặc định chính là hai ảnh người dùng cung cấp).
- Đồng hồ: chạy tự động, hiển thị giờ Việt Nam.
- Gallery: xem ảnh lớn bằng click và ESC để đóng.
- Social cards: thêm các URL trong `socials` để card mở link thật. Chưa gắn link sẽ không click được.
- Discord: thêm **Discord User ID** vào `discordUserId`, đồng thời tham gia dịch vụ Lanyard (`https://lanyard.rest/`). Trạng thái là tùy chọn; nếu chưa có ID thì không hiển thị trạng thái online giả.
- Nhạc: thêm các bài vào mảng `playlist` cùng URL âm thanh mà bạn có quyền phát. Khi chưa có nhạc, nút điều khiển sẽ bị vô hiệu hóa. Link Spotify dẫn tới trang tìm kiếm Obito (có thể thay bằng link playlist chính xác).
- Tin nhắn ẩn danh: thêm endpoint **Formspree** vào `anonymousFormEndpoint`. Khi chưa cấu hình sẽ báo rõ chưa gửi, không giả vờ thành công. Không cần nhúng mật khẩu quản trị vào front-end.

Ví dụ thêm nhạc tự sở hữu/quyền phát:

```js
playlist: [
  { title: "My original song", artist: "Me", src: "assets/my-original-song.mp3" }
],
```

## Hộp thư ẩn danh thật

1. Tạo biểu mẫu tại `https://formspree.io/` bằng tài khoản của chủ website.
2. Sao chép endpoint `https://formspree.io/f/...` vào `anonymousFormEndpoint`.
3. Thử gửi và kiểm tra Inbox của tài khoản Formspree.
4. Bật chống spam/giới hạn gửi trong Formspree và xem lại chính sách dữ liệu của dịch vụ trước khi public.

**Cẩn thận về quyền riêng tư:** Đừng đưa token, mật khẩu, API key bí mật vào `config.js`, vì file có thể được xem công khai trên GitHub Pages. Với tin nhắn ẩn danh, không nên cam kết ẩn danh tuyệt đối do bên cung cấp form có thể xử lý dữ liệu kết nối.

## Đưa lên GitHub Pages

Repository: [MumeiLevina/pgchie](https://github.com/MumeiLevina/pgchie).

1. Mở [Settings → Pages](https://github.com/MumeiLevina/pgchie/settings/pages).
2. Ở **Build and deployment → Source**, chọn **Deploy from a branch**.
3. Chọn nhánh **main**, thư mục **/ (root)** rồi bấm **Save**.
4. Sau khi GitHub triển khai xong, truy cập **https://mumeilevina.github.io/pgchie/**.

Website dùng HTML/CSS/JavaScript thuần, không cần cài npm hoặc chạy build. File `index.html` nằm ngay ở gốc repo; `.nojekyll` cho phép xuất bản trực tiếp các tệp tĩnh. Các đường dẫn ảnh, CSS và JavaScript đều tương đối nên hoạt động dưới đường dẫn `/pgchie/`.

Sau này, sửa các file ngay ở gốc dự án, commit và push lên `main` để cập nhật website:

```powershell
git add .
git commit -m "Update website"
git push origin main
```

Thư mục lồng `chie-little-universe/` cũ được giữ làm bản dự phòng trên máy và được loại khỏi Git bằng `.gitignore`. Bản dùng để triển khai là các file ở gốc.

## Tệp nguồn

- `index.html`: bố cục, nội dung, các ô chức năng.
- `style.css`: palette xanh pastel, glassmorphism, animation, responsive.
- `config.js`: toàn bộ thông tin cần thay nhanh.
- `script.js`: đồng hồ, Discord, music player, links, gallery, gửi form.
- `assets/`: hai hình cosplay do người dùng cung cấp ở dạng WebP tối ưu, favicon SVG.
- `.nojekyll`: xuất bản website tĩnh trực tiếp trên GitHub Pages.

Ghi chú: Đây là website độc lập lấy cảm hứng từ nhóm chức năng của Mei.dev, không sao chép CSS hay thông tin người dùng từ dự án kia.
