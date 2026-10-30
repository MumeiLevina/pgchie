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
  heroGifUrl: "assets/15a505ba-0847-44d0-8807-abe3e0603446.jpg", // Ảnh đại diện lớn trong khung CHIE CAM
  moodGifUrl: "",      // Ví dụ: "https://your-domain.com/mood.gif"
  clockGifUrl: "",     // Tuỳ chọn: GIF nền ở ô đồng hồ
  discordUserId: "",   // Discord user ID, cần tham gia Lanyard (lanyard.rest)
  socials: {
    facebook: "https://www.facebook.com/lietobiedasick",
    instagram: "https://www.instagram.com/yzniebeiu",
    tiktok: "https://www.tiktok.com/@lietobiedasick?lang=vi-VN",
    discord: "https://discord.com/invite/MB4xEVG6"
  },
  artistUrl: "https://open.spotify.com/search/Obito",
  // Chỉ dùng link bài nhạc bạn có quyền phát trên website. Không tải nhạc bản quyền trái phép.
  playlist: [
    { id: "its-you", title: "It's You", artist: "Ali Gatie", src: "assets/music/Ali Gatie - It's You (Official Lyrics Video) - Ali Gatie.mp3" },
    { id: "baby", title: "Baby", artist: "MCK ft. marzuz", src: "assets/music/Baby - MCK (ft. marzuz) - MCK __ Nger.mp3" },
    { id: "nguyen-van-muoi", title: "NGUYỄN VĂN MƯỜI", artist: "MCK", src: "assets/music/NGUYỄN VĂN MƯỜI - MCK (OFFICIAL MUSIC VIDEO) - MCK __ Nger.mp3" },
    { id: "sai-gon-oi", title: "Sài Gòn ơi", artist: "Obito", src: "assets/music/Obito - Sài Gòn ơi - Obito Official.mp3" },
    { id: "doi-khi", title: "đôi khi", artist: "Obito", src: "assets/music/đôi khi - Obito Official.mp3" }
  ],
  // playlist ở trên là danh sách duy nhất. Không cần sửa logic trình phát.
  music: {
    enabled: true,
    autoplay: false, // Luôn đợi bạn bấm phát; không tự mở tiếng khi tải lại trang.
    defaultVolume: 0.65,
    repeatMode: "all", // "off", "one", "all"
    shuffle: false,
    visualizer: true,
    rememberPreferences: true
  },
  // Formspree (https://formspree.io/) cung cấp endpoint dạng https://formspree.io/f/xxxxxxxx
  // Để trống: giải thích chưa thể gửi; giữ nguyên thư nháp.
  anonymousFormEndpoint: ""
};
