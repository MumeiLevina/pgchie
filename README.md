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
- Nhạc: thêm các bài vào mảng `playlist`. Card, cửa sổ nghe nhạc và mini player dùng chung một thẻ audio. Khi chưa có nhạc, nút phát bị vô hiệu hóa. Link Spotify là đường dẫn riêng, không dùng để phát âm thanh.
- Tin nhắn ẩn danh: thêm endpoint **Formspree** vào `anonymousFormEndpoint`. Khi chưa cấu hình, thông báo giải thích chưa gửi được; nội dung nháp được giữ nguyên. Không cần nhúng mật khẩu quản trị vào front-end.

## Thêm nhạc và ảnh bìa

1. Chép bản nhạc bạn được phép công khai vào **`assets/music/`**. Hỗ trợ MP3, OGG, WAV và các định dạng trình duyệt đọc được (ví dụ M4A). Không đổi đuôi một tệp khác thành `.mp3`.
2. Tạo thư mục **`assets/music/covers/`**, rồi chép ảnh bìa WebP, JPG hoặc PNG vào đó. Nên dùng ảnh vuông khoảng 400 × 400 px, dung lượng nhỏ. Bìa là tùy chọn; thiếu ảnh sẽ hiện hình trái tim mặc định.
3. Mở **`config.js`**, tìm `playlist: []`, thêm một dòng cho mỗi bài. Không phải sửa `music.js`.

```js
playlist: [
  {
    id: "my-song-01",
    title: "My original song",
    artist: "Me",
    src: "assets/music/my-original-song.mp3",
    cover: "assets/music/covers/my-cover.webp",
    accent: "#A9DDEB"
  }
],
```

Đây chỉ là ví dụ cấu hình; kho mã không kèm bản thu. Tên tệp, chữ hoa/thường và thư mục phải khớp chính xác. Tên có dấu hoặc khoảng trắng cũng được hỗ trợ, nhưng tên ngắn như `my-song.mp3` dễ quản lý hơn. Giữ `id` ổn định để trình phát nhớ đúng bài khi bạn đổi thứ tự. Đổi thứ tự các mục để sắp xếp playlist; xóa mục để bỏ bài khỏi giao diện.

Các mục cũ chỉ có `title`, `artist`, `src` vẫn hoạt động. Mảng `SITE_CONFIG.playlist` là danh sách duy nhất trong cấu hình mặc định. Trình đọc cũng chấp nhận `music.playlist` nếu bạn chuyển hẳn sang cấu trúc đó và bỏ mảng cấp ngoài; nếu có cả hai thì mảng cấp ngoài được ưu tiên, kể cả khi rỗng.

Trong phần **`music`**, bạn có thể sửa:

| Tùy chọn | Ý nghĩa |
| --- | --- |
| `enabled: true` | Đặt `false` để ẩn card nhạc |
| `defaultVolume: 0.65` | Âm lượng lần đầu: 0 đến 1, tương ứng 0% đến 100% |
| `repeatMode: "all"` | `"off"` dừng ở cuối, `"one"` lặp một bài, `"all"` lặp mixtape |
| `shuffle: false` | Đặt `true` để mặc định phát ngẫu nhiên |
| `visualizer: true` | Bộ hiển thị tần số âm thanh thật trong cửa sổ nghe nhạc |
| `rememberPreferences: true` | Lưu âm lượng, chế độ và bài đã chọn trên trình duyệt người nghe |
| `autoplay: false` | Giữ `false`; trình phát luôn chờ thao tác phát, kể cả sau khi tải lại |

Cài đặt đã lưu của khách được ưu tiên hơn mặc định mới. Muốn thử mặc định, dùng cửa sổ riêng tư hoặc xóa khóa `chie.music.v1` trong bộ nhớ trang. Không lưu thư nháp hoặc dữ liệu nhạy cảm vào localStorage.

**Cách nghe:** bấm phát trên card, hoặc `open player` để mở đĩa vinyl, thanh tua, âm lượng và danh sách bài. Nút lặp chuyển lần lượt tắt → tất cả → một bài. Nút trước tua về đầu nếu đã nghe hơn 3 giây; nếu chưa thì về bài trước (lịch sử khi bật shuffle). Khi đang dừng, nút trước/tiếp chỉ chọn bài; bấm bài trong danh sách sẽ phát. Dismiss mini player bằng ×; mini cũng tự ẩn khi card, hộp thư hoặc cửa sổ nghe nhạc đang hiển thị.

Không tự phát tiếng khi tải trang. Trình duyệt thường yêu cầu một lần bấm để cho phép âm thanh/Web Audio; âm lượng có thể chịu điều khiển của hệ điều hành trên thiết bị di động. Media Session được dùng khi trình duyệt hỗ trợ; điều khiển màn hình khóa/Bluetooth phụ thuộc trình duyệt và thiết bị.

Chỉ tải bài đã chọn khi cần nghe; không tải metadata của toàn bộ danh sách. Thời lượng từng bài xuất hiện sau khi chính bài đó đã tải metadata. Bìa trong playlist tải lười; thời lượng chưa biết hiện `—:—`. Visualizer chỉ dùng dữ liệu thật, dừng vẽ khi tạm dừng, ẩn tab, đóng cửa sổ hoặc bật giảm chuyển động. Nếu playlist có URL âm thanh khác nguồn, visualizer được tắt cho cả danh sách để tránh Web Audio làm mất tiếng do CORS; nghe nhạc bằng audio gốc vẫn hoạt động nếu URL cho phép. Khuyến nghị lưu tệp cùng website.

**Bản quyền và quyền truy cập:** chỉ đưa lên bản thu và ảnh bạn sở hữu hoặc có giấy phép phân phối công khai. Người khác có thể tải mọi MP3/ảnh từ website; đây không phải thư viện riêng tư hoặc hệ thống chống tải xuống. Nhạc có thể dùng nhiều băng thông hosting. Không đưa mật khẩu hoặc tài liệu riêng vào thư mục xuất bản.

## Hộp thư ẩn danh thật

1. Tạo biểu mẫu tại `https://formspree.io/` bằng tài khoản của chủ website.
2. Sao chép endpoint `https://formspree.io/f/...` vào `anonymousFormEndpoint`.
3. Thử gửi một tin từ website đã xuất bản và kiểm tra **Inbox riêng tư** trong tài khoản Formspree. Chỉ kiểm tra giao diện thành công chưa đủ chứng minh thư đã vào hộp thư.
4. Bật và kiểm tra các thiết lập chống spam trong Formspree. Website có honeypot `_gotcha`, giới hạn 500 ký tự, chặn gửi lặp khi đang xử lý và thời gian chờ 15 giây. Không hỏi tên/email, không cần tài khoản người gửi và không công khai nội dung thư.
5. Trong **Restrict to Domain**, giới hạn đúng tên miền website thật; thêm miền xem trước nếu cần thử ở đó. Đừng giới hạn sai miền khiến request hợp lệ bị chặn. Xem [chống spam](https://help.formspree.io/articles/troubleshooting/how-to-prevent-spam/) và [honeypot](https://help.formspree.io/articles/building-your-form/honeypot-spam-filtering/). Nếu bật CAPTCHA/challenge yêu cầu tương tác, phải thử luồng AJAX thực tế và cấu hình theo hướng dẫn Formspree; honeypot không thay thế mọi biện pháp chống spam.

Lỗi mạng, endpoint chưa có/sai, từ chối hoặc phản hồi chưa xác nhận thành công đều giữ nguyên nháp trong ô nhập. Chỉ xóa sau khi Formspree trả về JSON `ok: true`. Nháp chỉ nằm trong ô nhập hiện tại: tải lại/đóng trang sẽ mất nháp, nên sao chép lời nhắn nếu cần quay lại sau. Khi gửi bị timeout, Formspree có thể đã nhận request; kiểm tra hộp thư trước khi thử lại nếu lo trùng thư.

**Cẩn thận về quyền riêng tư:** Đừng đưa token, mật khẩu, API key bí mật vào `config.js`, vì file có thể được xem công khai trên GitHub Pages. Với tin nhắn ẩn danh, không nên cam kết ẩn danh tuyệt đối do bên cung cấp form có thể xử lý dữ liệu kết nối.

## Đưa lên GitHub Pages

Repository: [MumeiLevina/pgchie](https://github.com/MumeiLevina/pgchie).

1. Mở [Settings → Pages](https://github.com/MumeiLevina/pgchie/settings/pages).
2. Ở **Build and deployment → Source**, chọn **Deploy from a branch**.
3. Chọn nhánh **main**, thư mục **/ (root)** rồi bấm **Save**.
4. Sau khi GitHub triển khai xong, truy cập **https://mumeilevina.github.io/pgchie/**.

Website dùng HTML/CSS/JavaScript thuần, không cần cài npm hoặc chạy build. File `index.html` nằm ngay ở gốc repo; `.nojekyll` cho phép xuất bản trực tiếp các tệp tĩnh. Các đường dẫn ảnh, CSS và JavaScript đều tương đối nên hoạt động dưới đường dẫn `/pgchie/`.

Để cập nhật, sửa các file ngay ở gốc dự án, tạo nhánh và pull request để review:

```powershell
git switch -c feature/my-update
git add index.html style.css music.css music.js script.js config.js assets README.md
git commit -m "Update website"
git push -u origin feature/my-update
```

Chỉ merge vào `main` sau khi chủ website đồng ý. Merge có thể kích hoạt hosting đang theo dõi `main`.

## Xuất bản trên Render Static Site

Cấu hình đã đối chiếu [Render Static Sites](https://render.com/docs/static-sites) và [Blueprint specification](https://render.com/docs/blueprint-spec). Đây vẫn là website tĩnh, không cần Node.js server. `package.json` chỉ dành cho kiểm thử phát triển.

Sau khi review và được phép merge nhánh tính năng vào `main`:

1. Đăng nhập [Render Dashboard](https://dashboard.render.com/), chọn **New → Static Site**.
2. Kết nối GitHub và chọn **MumeiLevina/pgchie**.
3. Chọn branch **`main`**, để **Root Directory** trống.
4. **Build Command:** `echo "No build required"`.
5. **Publish Directory:** `.` (một dấu chấm).
6. Thêm biến môi trường **`SKIP_INSTALL_DEPS=true`** để bỏ qua cài các gói kiểm thử.
7. Kiểm tra thiết lập rồi chọn **Create Static Site** khi đã sẵn sàng xuất bản. Render sẽ cấp URL thật; không cần đoán tên miền.
8. Mở URL HTTPS Render cấp, kiểm tra ảnh/GIF, nhạc tự thêm, thư gửi thử và Inbox. Kiểm tra chuyển từ HTTP sang HTTPS và không có tài nguyên HTTP bị chặn.

Hoặc chọn **New → Blueprint**, kết nối repository và dùng `render.yaml` sau khi tệp đó đã ở `main`. Blueprint dùng `type: web` + `runtime: static`, không phải dịch vụ web có lệnh start. Không cần thêm quy tắc rewrite mọi URL về `index.html`: website không dùng router; thiếu MP3 phải trả lỗi thật.

Đường dẫn ảnh/nhạc/CSS/JS đều tương đối, hỗ trợ cả Render ở gốc và GitHub Pages dưới `/pgchie/`. Render thường tự triển khai khi nhánh đã chọn cập nhật; xem lại Auto-Deploy trước khi merge các lần sau. Chưa tạo dịch vụ hoặc xác nhận deploy nghĩa là **chưa triển khai**. Không có URL production Render được hardcode trong dự án.

## Kiểm thử dành cho người phát triển

Không cần npm để dùng website. Để chạy kiểm thử tự động, cài Node.js, Python và Microsoft Edge, rồi chạy:

```powershell
npm ci
python -m pip install imageio-ffmpeg
python tests/generate-tone.py
npm test
```

Script tạo tín hiệu sin WAV/MP3 ngắn trong thư mục tạm của hệ điều hành, ngoài website. Không có bản thu hoặc audio mẫu được commit. Bài kiểm thử MP3 được bỏ qua nếu chưa tạo tín hiệu; những kiểm thử khác vẫn dùng WAV tạo trong bộ nhớ. `imageio-ffmpeg` chỉ cần cho việc tạo tín hiệu kiểm thử, không dùng khi hosting.

Nếu không có Edge, cài trình duyệt kiểm thử rồi dùng Chromium:

```powershell
npx playwright install chromium
$env:CHIE_BROWSER_CHANNEL = "chromium"
npm test
```

Kiểm thử tự mở máy chủ nội bộ ở cổng 8001 và lưu ảnh tại `test-results/` (không đưa lên Git). Bao gồm phát/đổi bài/tua/âm lượng/lặp/shuffle, lỗi tài nguyên, bộ nhớ bị chặn, giảm chuyển động, dữ liệu tần số thật, hộp thư giả lập, keyboard, layout 375/390/768/1024/1440 và so sánh bố cục các phần cũ với commit `a8b2f08`. Clone đầy đủ lịch sử để chạy phép so sánh baseline. Formspree trong kiểm thử được giả lập; không chứng minh việc giao thư thực tế. Xem [TESTING.md](TESTING.md) để biết kết quả và giới hạn.

Thư mục lồng `chie-little-universe/` cũ được giữ làm bản dự phòng trên máy và được loại khỏi Git bằng `.gitignore`. Bản dùng để triển khai là các file ở gốc.

## Tệp nguồn

- `index.html`: bố cục, nội dung, các ô chức năng.
- `style.css`: palette xanh pastel, glassmorphism, animation, responsive.
- `config.js`: toàn bộ thông tin cần thay nhanh.
- `script.js`: đồng hồ, Discord, links, gallery, gửi form.
- `music.js` / `music.css`: engine audio dùng chung và giao diện nghe nhạc.
- `assets/`: hai hình cosplay do người dùng cung cấp ở dạng WebP tối ưu, favicon SVG.
- `.nojekyll`: xuất bản website tĩnh trực tiếp trên GitHub Pages.
- `render.yaml`: cấu hình Render Static Site sau khi được phép merge/xuất bản.
- `tests/`, `playwright.config.js`, `package*.json`: kiểm thử phát triển, không phải dependency runtime.

Ghi chú: Đây là website độc lập lấy cảm hứng từ nhóm chức năng của Mei.dev, không sao chép CSS hay thông tin người dùng từ dự án kia.
