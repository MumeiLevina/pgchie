(() => {
  const form = document.getElementById('loginForm');
  const status = document.getElementById('loginStatus');
  const button = document.getElementById('loginButton');
  if (new URLSearchParams(location.search).has('expired')) status.textContent = 'Phiên đăng nhập đã hết hạn. Bạn đăng nhập lại nhé.';
  form.addEventListener('submit', async event => {
    event.preventDefault(); button.disabled = true; status.textContent = 'Đang đăng nhập…';
    try {
      const preflight = await fetch('/api/auth/csrf', { cache: 'no-store' });
      if (!preflight.ok) throw new Error('Máy chủ đang bận. Bạn thử lại sau nhé.');
      const { csrf } = await preflight.json();
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify({ email: document.getElementById('email').value, password: document.getElementById('password').value }) });
      if (response.status === 429) throw new Error('Đã thử đăng nhập quá nhiều lần. Vui lòng chờ 15 phút.');
      if (response.status === 401) throw new Error('Email hoặc mật khẩu chưa đúng.');
      if (!response.ok) throw new Error('Chưa thể đăng nhập. Bạn tải lại trang và thử lại nhé.');
      location.replace('/admin/');
    } catch (error) { status.textContent = error instanceof TypeError ? 'Không kết nối được máy chủ. Bạn thử lại nhé.' : error.message; }
    finally { button.disabled = false; document.getElementById('password').value = ''; }
  });
})();
