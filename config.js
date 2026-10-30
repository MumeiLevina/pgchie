/*
 * CHỈ CẦN SỬA FILE NÀY để cá nhân hóa website.
 * Dán link GIF trực tiếp (.gif/.webp) vào backgroundGifUrl, heroGifUrl, moodGifUrl, clockGifUrl.
 * Để chuỗi trống "" nếu chưa có link. Ảnh mẫu được giữ nguyên.
 * Không bỏ mật khẩu/API key bí mật vào file này (website công khai).
 */
window.SITE_CONFIG = {
  displayName: "Chie", // Đổi tên nếu cần
  brandName: "chie",   // Chữ nhỏ trên thanh điều hướng
  bio: "Xin chào, mình là Chie ♡ Đây là góc nhỏ mình dành cho cosplay, những khoảnh khắc đáng yêu và âm nhạc mình yêu thích.",
  backgroundGifUrl: "assets/ocean-dream.gif", // GIF nền toàn website
  heroGifUrl: "",      // Để trống để dùng ảnh cosplay Marin trong khung đầu trang
  moodGifUrl: "",      // Ví dụ: "https://your-domain.com/mood.gif"
  clockGifUrl: "",     // Tuỳ chọn: GIF nền ở ô đồng hồ
  discordUserId: "",   // Discord user ID, cần tham gia Lanyard (lanyard.rest)
  socials: {
    facebook: "",     // https://www.facebook.com/...
    instagram: "",    // https://www.instagram.com/...
    tiktok: "",       // https://www.tiktok.com/@...
    discord: ""       // https://discord.gg/...
  },
  artistUrl: "https://open.spotify.com/search/Obito",
  // Chỉ dùng link bài nhạc bạn có quyền phát trên website. Không tải nhạc bản quyền trái phép.
  playlist: [
    // { title: "Tên bài hát", artist: "Nghệ sĩ", src: "https://example.com/audio.mp3" }
  ],
  // Formspree (https://formspree.io/) cung cấp endpoint dạng https://formspree.io/f/xxxxxxxx
  // Để trống: chưa gửi tin nhắn và không hiển thị thông báo cấu hình trên giao diện.
  anonymousFormEndpoint: ""
};
