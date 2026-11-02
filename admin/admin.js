(() => {
  const $ = id => document.getElementById(id);
  const state = { view: 'overview', page: 1, search: '', sort: 'newest', csrf: '', selected: null, messages: [], generation: 0, busy: false };
  const labels = { overview: ['Một chút yêu thương ♡', 'Những lời nhắn gửi đến góc nhỏ của Chie.'], inbox: ['Hộp thư của Chie', 'Dành một chút thời gian cho những lời nhắn nhỏ.'], unread: ['Những lá thư chưa mở', 'Có những điều đang chờ bạn ghé qua.'], favorites: ['Những điều muốn giữ ♡', 'Lời nhắn bạn đã đánh dấu yêu thích.'], archived: ['Góc lưu trữ', 'Những lá thư đã được cất lại gọn gàng.'], settings: ['Một không gian an toàn', 'Kết nối và cách hộp thư riêng hoạt động.'] };
  const errors = { integration_not_configured: 'Chưa cấu hình quyền đọc Formspree. Xem Cài đặt để kết nối.', provider_access_denied: 'Formspree chưa cho phép đọc thư. Kiểm tra API key và gói tài khoản.', provider_rate_limited: 'Formspree đang giới hạn lượt đọc. Vui lòng đợi trước khi thử lại.', sync_rate_limited: 'Bạn đồng bộ quá nhanh. Chờ một phút rồi thử lại nhé.', sync_in_progress: 'Một lượt đồng bộ đang chạy. Bạn thử lại sau nhé.', provider_unavailable: 'Hiện chưa kết nối được Formspree. Bạn có thể thử đồng bộ lại.', provider_invalid_response: 'Dữ liệu Formspree chưa đúng định dạng. Chưa nhập trang thư này.', csrf_failed: 'Phiên bảo vệ đã thay đổi. Bạn tải lại trang nhé.', message_not_found: 'Lời nhắn này không còn trong hộp thư.', invalid_query: 'Bộ lọc chưa hợp lệ. Bạn tải lại trang nhé.' };
  const date = value => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
  function node(tag, text, className) { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; if (className) element.className = className; return element; }
  async function api(url, options = {}) {
    let response;
    try { response = await fetch(url, { cache: 'no-store', ...options, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': state.csrf, ...options.headers } }); }
    catch { throw new Error('Không kết nối được backend. Kiểm tra kết nối rồi nhấn Thử lại.'); }
    if (response.status === 401) { state.messages = []; $('messageList').replaceChildren(); $('detail').replaceChildren(); location.replace('/login?expired=1'); throw new Error('Phiên đăng nhập đã hết hạn.'); }
    let payload; try { payload = await response.json(); } catch { throw new Error('Backend chưa sẵn sàng. Bạn thử lại sau nhé.'); }
    if (!response.ok) throw new Error(errors[payload.error] || (response.status === 403 ? 'Bạn không có quyền thực hiện thao tác này.' : 'Chưa thực hiện được. Bạn thử lại nhé.'));
    return payload;
  }
  function notify(text = '') { $('notice').textContent = text; }
  function emptyDetail() {
    const div = node('div', undefined, 'detail-placeholder');
    const icon = node('div', '♡', 'empty-envelope'); icon.setAttribute('aria-hidden', 'true');
    div.append(icon, node('h3', 'Một lời nhắn, một khoảng lặng.'), node('p', 'Chọn một lá thư để đọc ở đây.'), node('span', 'SENT WITH A LITTLE LOVE', 'eyebrow')); $('detail').replaceChildren(div);
  }
  function renderDetail(message) {
    if (!message) { emptyDetail(); return; }
    const header = node('div', undefined, 'detail-head'); header.append(node('h3', 'Một người gửi ẩn danh ♡'));
    const time = node('time', date(message.received_at)); time.dateTime = message.received_at; header.append(time);
    const body = node('div', undefined, 'detail-body'); body.append(node('p', 'dear chie,', 'letter-address'), node('div', message.content, 'letter-content'), node('p', '— gửi đến bạn, bằng một chút yêu thương', 'letter-signature'));
    const actions = node('div', undefined, 'detail-actions');
    function action(id, title, run, pressed) { const button = node('button', title, id === 'deleteMessage' ? 'danger' : 'quiet'); button.id = id; if (pressed !== undefined) button.setAttribute('aria-pressed', String(pressed)); button.addEventListener('click', run); actions.append(button); }
    action('readMessage', message.is_read ? 'Đánh dấu chưa đọc' : 'Đánh dấu đã đọc', () => update(message, { is_read: !message.is_read }, 'readMessage'));
    action('favoriteMessage', message.is_favorite ? '♡ Bỏ yêu thích' : '♡ Yêu thích', () => update(message, { is_favorite: !message.is_favorite }, 'favoriteMessage'), message.is_favorite);
    action('archiveMessage', message.is_archived ? 'Bỏ lưu trữ' : 'Lưu trữ', () => update(message, { is_archived: !message.is_archived }, 'archiveMessage'), message.is_archived);
    action('copyMessage', 'Sao chép', async () => { try { await navigator.clipboard.writeText(message.content); notify('Đã sao chép lời nhắn.'); } catch { notify('Không sao chép được. Bạn có thể chọn và sao chép nội dung thư.'); } });
    action('deleteMessage', 'Xóa bản sao', () => $('deleteDialog').showModal());
    $('detail').replaceChildren(header, body, actions);
  }
  function renderList(data) {
    $('resultCount').textContent = `${data.total} lời nhắn`;
    $('pageLabel').textContent = `Trang ${state.page} / ${Math.max(1, Math.ceil(data.total / data.pageSize))}`;
    $('previous').disabled = state.page <= 1; $('next').disabled = state.page * data.pageSize >= data.total;
    const rows = data.messages.map(message => {
      const button = node('button', undefined, `message-row${message.is_read ? '' : ' unread'}`);
      button.setAttribute('aria-pressed', String(state.selected?.id === message.id));
      button.setAttribute('aria-label', `${message.is_read ? 'Đã đọc' : 'Chưa đọc'}: ${message.content.slice(0, 60)}`);
      const meta = node('span', undefined, 'message-meta'); const title = node('strong', 'Một người gửi ẩn danh');
      if (message.is_favorite) title.append(node('span', '♡', 'message-heart'));
      meta.append(title, node('span', new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(message.received_at))));
      button.append(meta, node('span', message.content, 'message-preview'));
      button.addEventListener('click', async () => {
        state.selected = message; renderDetail(message);
        document.querySelectorAll('.message-row').forEach(row => row.setAttribute('aria-pressed', String(row === button)));
        if (!message.is_read) await update(message, { is_read: true });
      }); return button;
    });
    if (!rows.length) { const empty = node('div', undefined, 'empty-list'); empty.append(node('strong', state.search ? 'Chưa tìm thấy lời nhắn' : 'Hộp thư đang yên tĩnh ♡'), node('span', state.search ? 'Thử một từ khóa khác nhé.' : 'Những thư đã đồng bộ sẽ xuất hiện ở đây.')); rows.push(empty); }
    $('messageList').replaceChildren(...rows);
  }
  async function load() {
    const generation = ++state.generation;
    $('messageList').setAttribute('aria-busy', 'true');
    $('messageList').replaceChildren(node('p', 'Đang mở hộp thư…', 'empty-list'));
    try {
      const [data, counts] = await Promise.all([api(`/api/messages?${new URLSearchParams({ filter: state.view === 'settings' ? 'inbox' : state.view, page: state.page, search: state.search, sort: state.sort })}`), api('/api/overview')]);
      if (generation !== state.generation) return;
      if (state.page > 1 && !data.messages.length) { state.page--; return load(); }
      state.messages = data.messages; renderList(data);
      for (const key of ['total', 'unread', 'favorites', 'recent']) $(key).textContent = counts[key];
      $('navUnread').textContent = counts.unread;
    } catch (error) {
      if (generation !== state.generation) return;
      const empty = node('div', undefined, 'empty-list'); const retry = node('button', 'Thử lại', 'quiet'); retry.addEventListener('click', load);
      empty.append(node('strong', 'Chưa mở được hộp thư'), node('p', error.message), retry); $('messageList').replaceChildren(empty);
      $('previous').disabled = $('next').disabled = true;
    } finally { if (generation === state.generation) $('messageList').setAttribute('aria-busy', 'false'); }
  }
  async function update(message, patch, focusId) {
    if (state.busy) return;
    state.busy = true;
    $('detail').querySelectorAll('button').forEach(button => { button.disabled = true; });
    try {
      await api(`/api/messages/${message.id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      Object.assign(message, patch); state.selected = message; renderDetail(message); notify(); await load();
      if (focusId) $(focusId)?.focus();
    } catch (error) { notify(error.message); renderDetail(message); }
    finally { state.busy = false; }
  }
  function view(name) {
    state.view = name; state.page = 1; state.selected = null; state.search = ''; $('search').value = ''; notify();
    document.querySelectorAll('[data-view]').forEach(button => { if (button.dataset.view === name) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); });
    [$('viewTitle').textContent, $('viewSubtitle').textContent] = labels[name];
    $('overview').hidden = name !== 'overview'; $('settings').hidden = name !== 'settings'; $('mailSection').hidden = name === 'settings';
    $('listTitle').textContent = name === 'overview' ? 'Lời nhắn mới nhất' : labels[name][0];
    emptyDetail(); if (name !== 'settings') load();
  }
  async function integration() {
    const data = await api('/api/integration');
    $('sync').disabled = !data.configured;
    $('integrationTitle').textContent = data.configured ? 'Formspree đã được cấu hình' : 'Cần kết nối quyền đọc Formspree';
    $('integrationText').textContent = data.configured ? `Chưa xác minh trong phiên này.${data.next_offset ? ` Tiếp tục nhập từ thư ${data.next_offset + 1}.` : ' Nhấn Đồng bộ thư để kiểm tra kết nối.'}` : 'Website vẫn gửi thư qua Formspree. Dashboard cần API key riêng để đọc thư.';
    $('footerStatus').textContent = data.configured ? 'CHỜ XÁC MINH' : 'CHƯA KẾT NỐI'; $('formId').textContent = data.formId;
    $('lastSync').textContent = data.last_sync ? date(data.last_sync) : 'Chưa đồng bộ';
  }
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => view(button.dataset.view)));
  $('openSettings').addEventListener('click', () => view('settings'));
  let searchTimer;
  $('search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.search = $('search').value; state.page = 1; load(); }, 250); });
  $('sort').addEventListener('change', () => { state.sort = $('sort').value; state.page = 1; load(); });
  $('previous').addEventListener('click', () => { state.page--; load(); }); $('next').addEventListener('click', () => { state.page++; load(); });
  $('sync').addEventListener('click', async () => {
    $('sync').disabled = true; notify('Đang đồng bộ từ Formspree…');
    try {
      const data = await api('/api/sync', { method: 'POST', body: '{}' }); await integration();
      $('integrationTitle').textContent = 'Đã xác minh kết nối đọc Formspree';
      $('integrationText').textContent = data.complete ? 'Đã đọc xong lượt lịch sử này. Các bản sao đã xóa sẽ không được nhập lại.' : 'Còn lịch sử thư. Nhấn Đồng bộ thư để nhập trang kế tiếp.';
      $('footerStatus').textContent = 'ĐÃ KẾT NỐI';
      notify(`Đã kiểm tra ${data.scanned} thư từ Formspree. ${data.complete ? 'Lượt đồng bộ đã hoàn tất.' : 'Tiếp tục đồng bộ để nhập thêm.'}`);
      await load();
    } catch (error) { notify(error.message); $('integrationTitle').textContent = 'Chưa đồng bộ được'; $('integrationText').textContent = error.message; $('footerStatus').textContent = 'CẦN KIỂM TRA'; }
    finally { $('sync').disabled = false; }
  });
  $('confirmDelete').addEventListener('click', async () => {
    if (!state.selected || state.busy) return; state.busy = true; $('confirmDelete').disabled = true;
    try {
      await api(`/api/messages/${state.selected.id}`, { method: 'DELETE', body: JSON.stringify({ confirm: true }) });
      $('deleteDialog').close(); state.selected = null; emptyDetail(); notify('Đã xóa nội dung bản sao. Thư gốc vẫn ở Formspree.'); await load(); $('search').focus();
    } catch (error) { $('deleteDialog').close(); notify(error.message); }
    finally { state.busy = false; $('confirmDelete').disabled = false; }
  });
  $('logout').addEventListener('click', async () => { try { await api('/api/auth/logout', { method: 'POST', body: '{}' }); location.replace('/login'); } catch (error) { notify(error.message); } });
  (async () => {
    try { const session = await api('/api/session'); state.csrf = session.csrf; await integration(); await load(); }
    catch (error) { notify(error.message); $('integrationTitle').textContent = 'Backend chưa sẵn sàng'; $('integrationText').textContent = 'Tải lại trang để thử kết nối lại.'; $('sync').disabled = true; }
  })();
})();
