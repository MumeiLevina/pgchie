"""Test API hộp thư ẩn danh của Chie's Little Universe (chỉ dùng Python chuẩn).

Cách chạy (từ thư mục gốc của repo):
    python tests\\test_letter_api.py                 # preflight + gửi 1 thư THẬT (mặc định)
    python tests\\test_letter_api.py --dry-run       # chỉ kiểm tra, KHÔNG gửi thư thật
    python tests\\test_letter_api.py --endpoint URL  # ghi đè endpoint trong config.js
    python tests\\test_letter_api.py --message "Xin chào Chie!"  # đổi nội dung thư test

Chạy được từ thư mục nào cũng được — script tự tìm config.js theo vị trí của chính nó.
Mặc định sẽ gửi đúng 1 thư thật (mang nhãn [TEST]) vào inbox Formspree/Getform;
nếu không muốn spam inbox thì chạy --dry-run.
"""

import argparse
import json
import re
import socket
import ssl
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

CONFIG_PATH = Path(__file__).resolve().parent.parent / "config.js"
TIMEOUT = 20  # giây
BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"


def read_endpoint() -> str:
    """Đọc anonymousFormEndpoint trong config.js (regex, không cần thư viện JS)."""
    text = CONFIG_PATH.read_text(encoding="utf-8")
    m = re.search(r'anonymousFormEndpoint:\s*"([^"]*)"', text)
    if not m:
        sys.exit(f"Không tìm thấy anonymousFormEndpoint trong {CONFIG_PATH}")
    return m.group(1)


def http(method: str, url: str, headers: dict, data: bytes | None = None):
    """Trả về (status_code, headers, body_text, elapsed_s). Lỗi mạng → (None, {}, lỗi, elapsed)."""
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return resp.status, dict(resp.headers), body, round(time.perf_counter() - t0, 2)
    except urllib.error.HTTPError as e:  # vẫn là phản hồi HTTP hợp lệ (4xx/5xx)
        body = e.read().decode("utf-8", errors="replace")
        return e.code, dict(e.headers), body, round(time.perf_counter() - t0, 2)
    except (urllib.error.URLError, socket.timeout, ssl.SSLError, ConnectionError, OSError) as e:
        reason = getattr(e, "reason", None) or e
        return None, {}, f"Lỗi mạng: {reason}", round(time.perf_counter() - t0, 2)


def check_preflight(endpoint: str) -> None:
    """Bước 1 (không gửi thư thật): CORS preflight OPTIONS."""
    print(f"[1/2] CORS preflight — OPTIONS {endpoint}")
    status, headers, body, dt = http("OPTIONS", endpoint, {
        "Origin": "https://chie-little-universe.onrender.com",
        "Access-Control-Request-Method": "POST",
        "User-Agent": BROWSER_UA,
    })
    if status is None:
        print(f"  [THẤT BẠI] {body} ({dt}s)")
        sys.exit(1)
    allow_origin = headers.get("Access-Control-Allow-Origin", "").lower()
    ok = status in (200, 204) and ("*" in allow_origin or "onrender.com" in allow_origin)
    print(f"  HTTP {status} trong {dt}s")
    print(f"  Access-Control-Allow-Origin: {headers.get('Access-Control-Allow-Origin', '(thiếu)')}")
    if not ok:
        print("  [THẤT BẠI] Thiếu/ sai Access-Control-Allow-Origin → trình duyệt sẽ chặn POST.")
        sys.exit(1)
    print("  [ĐẠT] Trình duyệt được phép gọi API từ website (CORS OK).")


def check_send(endpoint: str, message: str, dry_run: bool) -> None:
    """Bước 2: POST đúng payload mà script.js gửi."""
    payload = json.dumps({"message": message, "_gotcha": "", "source": "Chie Little Universe"}).encode()
    headers = {"User-Agent": BROWSER_UA, "Accept": "application/json", "Content-Type": "application/json"}
    if dry_run:
        print("\n[2/2] --dry-run: chỉ in payload, KHÔNG gửi thư thật:")
        print(f"  POST {endpoint}\n  {payload.decode()}")
        return

    print("\n[2/2] Gửi 1 thư TEST thật (mang nhãn [TEST], có thể xóa trong dashboard):")
    status, headers, body, dt = http("POST", endpoint, headers, payload)
    if status is None:
        print(f"  [THẤT BẠI] {body} ({dt}s)")
        sys.exit(1)
    print(f"  HTTP {status} trong {dt}s")
    print(f"  Body: {body[:400]}{'...' if len(body) > 400 else ''}")

    confirmed = False
    try:
        parsed = json.loads(body)
        # Front-end (script.js) chỉ xóa nháp khi nhận được xác nhận thật:
        # Formspree: {"ok":true} • Getform/Forminit: {"success":true} hoặc {"message":"OK"}
        if status == 200 and (
            parsed.get("ok") is True
            or parsed.get("success") is True
            or re.fullmatch(r"(?i)ok", str(parsed.get("message", "")))
        ):
            confirmed = True
    except json.JSONDecodeError:
        pass

    if confirmed:
        print("\n[KẾT QUẢ: ĐẠT] API hoạt động trơn tru — thư TEST đã được inbox chấp nhận.")
        print("  Hãy kiểm tra dashboard Formspree/Getform để xác nhận và xóa thư [TEST].")
    else:
        print("\n[KẾT QUẢ: CHƯA OK] API không xác nhận thư (HTTP không phải 200+ok, hoặc đang rate-limit).")
        print("  Front-end sẽ giữ nháp và báo 'Thư chưa gửi được' — kiểm tra email/đăng ký Formspree,")
        print("  hạn mức free (~50 thư/tháng) hoặc rate-limit theo IP (429).")
        sys.exit(1)


def main() -> None:
    # Windows console (locale cp1258) có thể không encodable hết ký tự tiếng Việt —
    # ép UTF-8 để không bao giờ crash khi in.
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass
    ap = argparse.ArgumentParser(description="Test API hộp thư ẩn danh")
    ap.add_argument("--endpoint", help="Ghi đè URL API (mặc định: đọc từ config.js)")
    ap.add_argument("--message", default="[TEST - co the xoa] Xin chao Chie, day la tin test tu script.")
    ap.add_argument("--dry-run", action="store_true", help="Không gửi thư thật, chỉ kiểm tra preflight + in payload")
    args = ap.parse_args()

    endpoint = (args.endpoint or read_endpoint()).strip()
    if not endpoint:
        sys.exit("Endpoint trong config.js đang trống (anonymousFormEndpoint: \"\") — hộp thư chưa cấu hình.")

    print(f"Endpoint: {endpoint}\n")
    check_preflight(endpoint)
    check_send(endpoint, args.message, args.dry_run)


if __name__ == "__main__":
    main()
