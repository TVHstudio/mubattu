(function () {
  'use strict';

  /* ── Cấu hình ── hộp đồng gửi API GIỮ NGUYÊN như ss6-dang-ky-som-v1/ss6/index.html ──────
     ENDPOINT : bộ chuyển tiếp cùng miền của SS6.
     PIXEL_ID : rỗng = KHÔNG nạp Pixel, không bắn gì. Chỉ điền sau khi Long duyệt.
     INVITE   : gốc link mời (mẫu theo bản chốt trang chủ; chờ DEV xác nhận). */
  var ENDPOINT = '/api/prereg-ss6.php';
  var PIXEL_ID = '239336658546525';
  var LEAD_NAME = 'ss6_presignup';
  var SERVER_TAG = 'ss6';
  var INVITE = 'https://mubattu.info/?moi=';

  var $ = function (id) { return document.getElementById(id); };
  var form = $('reg'), phone = $('phone'), help = $('help'), btn = $('submit'), btnLabel = $('submitLabel');
  var cContact = $('consent_contact'), cMeta = $('consent_meta'), srvErr = $('srvErr'), tickRow = $('chkContactRow'), tickErr = $('tickErr');
  var currentLink = '';

  /* ── Số điện thoại: cùng luật với backend (di động Việt Nam) ── */
  function normalizePhone(raw) {
    var s = String(raw || '').trim();
    if (!/^\+?[0-9\s().-]+$/.test(s)) return null;
    var d = s.replace(/\D/g, '');
    if (/^0[35789]\d{8}$/.test(d)) return d;
    if (/^84[35789]\d{8}$/.test(d)) return '0' + d.slice(2);
    return null;
  }
  function setHelp(msg, bad) {
    help.textContent = msg || '';
    if (bad) phone.setAttribute('aria-invalid', 'true'); else phone.removeAttribute('aria-invalid');
  }
  function showErr(msg) { srvErr.textContent = msg || ''; }
  function setTickErr(msg) {
    tickErr.textContent = msg || '';
    tickRow.classList.toggle('bad', !!msg);
    if (msg) cContact.setAttribute('aria-invalid', 'true'); else cContact.removeAttribute('aria-invalid');
  }
  phone.addEventListener('input', function () {
    var d = phone.value.replace(/[^\d+]/g, '');
    if (d.length >= 10 && !normalizePhone(phone.value)) setHelp('Số điện thoại chưa đúng định dạng di động Việt Nam.', true);
    else setHelp('', false);
  });
  cContact.addEventListener('change', function () { if (cContact.checked) setTickErr(''); });

  /* ── Chip thiết bị: chọn được nhiều, chỉ là lựa chọn giao diện (chưa gửi đi; payload giữ như bản cũ) ── */
  document.querySelectorAll('.chip').forEach(function (c) {
    c.addEventListener('click', function () { c.setAttribute('aria-pressed', c.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); });
  });

  /* Thiết bị người dùng chọn (Long 21/10): gửi kèm để thống kê, ví dụ "PC,Android"; chưa chọn thì chuỗi rỗng */
  function thietBi() {
    return [].map.call(document.querySelectorAll('.chip[aria-pressed="true"]'), function (c) { return c.getAttribute('aria-label') || c.textContent.trim(); }).join(',');
  }

  /* ── Pixel: chỉ nạp SAU KHI người dùng tự chọn ô đồng ý đo lường ── */
  function loadPixel() {
    if (!PIXEL_ID || !cMeta.checked) return;
    if (window.__ss6PixelLoaded) {
      if (typeof window.fbq === 'function') { try { window.fbq('consent', 'grant'); } catch (e) {} }
      return;
    }
    window.__ss6PixelLoaded = true;
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = true; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', PIXEL_ID);
    window.fbq('consent', 'grant');
    window.fbq('track', 'PageView');
  }
  cMeta.addEventListener('change', function () {
    if (cMeta.checked) loadPixel();
    else if (typeof window.fbq === 'function') { try { window.fbq('consent', 'revoke'); } catch (e) {} }
  });
  function cookie(name) {
    var parts = document.cookie ? document.cookie.split(';') : [];
    for (var i = 0; i < parts.length; i++) {
      var it = parts[i].replace(/^\s+/, '');
      if (it.indexOf(name + '=') === 0) return decodeURIComponent(it.slice(name.length + 1));
    }
    return '';
  }
  function utm() {
    var q = new URLSearchParams(location.search);
    return {
      utm_source: q.get('utm_source') || '', utm_medium: q.get('utm_medium') || '',
      utm_campaign: q.get('utm_campaign') || '', utm_content: q.get('utm_content') || '',
      utm_term: q.get('utm_term') || '', fbclid: q.get('fbclid') || ''
    };
  }
  function newEventId() {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return 'ev-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  /* ── Gửi form ── */
  var ERRORS = {
    'E-NET': 'Máy chủ chưa nhận được yêu cầu. Vui lòng thử lại. [E-NET]',
    'E-TIMEOUT': 'Hệ thống đang xử lý chậm. Yêu cầu của bạn vẫn được giữ lại. [E-TIMEOUT]',
    'E-PARSE': 'Phản hồi hệ thống chưa hợp lệ. Vui lòng thử lại. [E-PARSE]',
    'E-BIZ': 'Thông tin đăng ký chưa hợp lệ. Vui lòng kiểm tra lại. [E-BIZ]',
    UNAUTHORIZED: 'Cấu hình đăng ký chưa khớp. Vui lòng thử lại sau. [E-BIZ]',
    INVALID_PHONE: 'Số điện thoại chưa đúng định dạng di động Việt Nam. [E-BIZ]',
    INVALID_NAME: 'Không gửi được thông tin. Vui lòng tải lại trang rồi thử lại. [E-BIZ]',
    CONSENT_REQUIRED: 'Cần đồng ý để nhận mã. Vui lòng chọn ô đồng ý thứ nhất rồi thử lại. [E-BIZ]',
    INVALID_EVENT_ID: 'Không tạo được mã phiên. Vui lòng tải lại trang. [E-BIZ]',
    BUSY: 'Hệ thống đang đông. Vui lòng thử lại sau vài giây. [E-BIZ]',
    CAPTCHA: 'Xác minh chưa hoàn tất. Vui lòng bấm lại'
  };
  /* Turnstile (Cloudflare): token dùng một lần, gửi xong (lỗi) thì reset để lấy token mới */
  function tsToken() { var i = form.querySelector('[name="cf-turnstile-response"]'); return i ? i.value : ''; }
  function tsReset() { try { if (window.turnstile) window.turnstile.reset($('ts')); } catch (e) {} }
  function docJson(res) { return res.json().catch(function () { throw new Error(res.status === 403 ? 'CAPTCHA' : res.status === 429 ? 'BUSY' : 'E-PARSE'); }); }
  function errorMessage(code) {
    return ERRORS[code] || 'Chưa gửi được. Vui lòng kiểm tra kết nối mạng rồi thử lại. [E-NET]';
  }
  function resetButton() {
    tsReset();
    btn.disabled = false;
    btn.classList.remove('dang-gui');
    btnLabel.textContent = 'ĐĂNG KÝ SỚM';
  }

  function finish(data, consentMeta, eventId) {
    if (!data || !data.ok) throw new Error((data && (data.business_code || data.error)) || 'E-PARSE');
    showDone(data.code, data.isNew);
    /* Lead chỉ bắn khi backend xác nhận đăng ký MỚI và người dùng đã tự chọn ô đo lường. */
    if (data.isNew === true && consentMeta && cMeta.checked && PIXEL_ID && typeof window.fbq === 'function') {
      try {
        window.fbq('track', 'Lead', { content_name: LEAD_NAME, server: SERVER_TAG }, { eventID: eventId });
      } catch (e) {}
    }
  }
  function poll(requestId, consentMeta, eventId, startedAt) {
    fetch(ENDPOINT + '?request_id=' + encodeURIComponent(requestId), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.pending === true) {
          var elapsed = Date.now() - startedAt;
          if (elapsed >= 12000) btnLabel.textContent = 'Đang tạo mã… vui lòng không đóng trang';
          if (elapsed > 300000) {
            showErr('Yêu cầu đã được lưu. Hệ thống đang tạo mã chậm hơn dự kiến; vui lòng thử lại số này sau ít phút để nhận đúng mã cũ. [E-TIMEOUT]');
            btn.disabled = false;
            btn.classList.remove('dang-gui');
            btnLabel.textContent = 'Kiểm tra lại mã';
            return;
          }
          setTimeout(function () { poll(requestId, consentMeta, eventId, startedAt); }, elapsed < 30000 ? 1000 : 3000);
          return;
        }
        finish(data, consentMeta, eventId);
      })
      .catch(function (err) { showErr(errorMessage(err && err.message)); resetButton(); });
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    showErr('');
    var n = normalizePhone(phone.value);
    if (!n) {
      setHelp(phone.value.trim() ? 'Số điện thoại chưa đúng định dạng di động Việt Nam, ví dụ 0912 345 678.' : 'Vui lòng nhập số điện thoại di động Việt Nam, ví dụ 0912 345 678.', true);
      phone.focus(); return;
    }
    setHelp('', false);
    if (!cContact.checked) {
      setTickErr('Cần chọn ô đồng ý thứ nhất để đăng ký.');
      cContact.focus();
      return;
    }
    setTickErr('');

    btn.disabled = true;
    btn.classList.add('dang-gui');
    btnLabel.textContent = 'Đang gửi…';

    var consentMeta = cMeta.checked === true;
    var u = utm();
    var eventId = newEventId();
    var fbp = '', fbc = '';
    if (consentMeta) {
      fbp = cookie('_fbp');
      fbc = cookie('_fbc') || (u.fbclid ? 'fb.1.' + Date.now() + '.' + u.fbclid : '');
    }
    var payload = {
      phone: n,
      consent: true,
      consent_meta: consentMeta,
      website: $('website').value,
      utm_source: u.utm_source, utm_medium: u.utm_medium, utm_campaign: u.utm_campaign,
      utm_content: u.utm_content, utm_term: u.utm_term,
      referrer: document.referrer || '',
      event_id: eventId,
      user_agent: navigator.userAgent,
      fbp: fbp, fbc: fbc,
      page_url: location.href,
      device: thietBi(),
      cf_turnstile: tsToken()
    };

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(payload),
      cache: 'no-store'
    })
      .then(docJson)
      .then(function (data) {
        if (!data || !data.ok) throw new Error((data && (data.business_code || data.error)) || 'E-PARSE');
        if (data.pending === true && data.request_id) {
          btnLabel.textContent = 'Đã nhận, đang tạo mã…';
          poll(data.request_id, consentMeta, eventId, Date.now());
          return;
        }
        finish(data, consentMeta, eventId);
      })
      .catch(function (err) { showErr(errorMessage(err && err.message)); resetButton(); });
  });

  /* ── Trạng thái "Đã đăng ký" ── */
  function showDone(code, isNew) {
    currentLink = INVITE + code;
    $('code').textContent = code;
    var lk = $('link');
    lk.textContent = currentLink; lk.href = currentLink;
    $('zalo').href = 'https://chat.zalo.me/';   // 28/10: zalo.me/share khong phai duong chia se cua Zalo
    $('fb').href = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(currentLink);
    if (isNew === false) {
      $('doneTitle').textContent = 'Số điện thoại này đã được đăng ký';
      $('doneNote').textContent = 'Đây vẫn là mã mời 8 ký tự của bạn. Mỗi số điện thoại chỉ có một mã.';
    }
    form.hidden = true;
    $('done').hidden = false;
    $('done').scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  $('copy').addEventListener('click', function () {
    if (!currentLink) return;
    var b = this, giu = 'Chép link';
    function ok() { b.textContent = 'Đã chép'; setTimeout(function () { b.textContent = giu; }, 1800); }
    function du() {
      var ta = document.createElement('textarea');
      ta.value = currentLink; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); ok(); } catch (e) {}
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(currentLink).then(ok, du);
    else du();
  });

  /* Gửi Zalo (Long 27/10 "sửa cho chạy"): điện thoại mở bảng chia sẻ của máy (chọn Zalo); máy tính chép link rồi mở Zalo web để dán */
  $('zalo').addEventListener('click', function (e) {
    if (!currentLink) return;
    e.preventDefault();
    var b = this, chu = 'Cùng đăng ký sớm MU Bất Tử để nhận quà: ' + currentLink;
    if (navigator.share) { navigator.share({ title: 'MU Bất Tử', text: chu, url: currentLink }).catch(function () {}); return; }
    var mo = function () { window.open('https://chat.zalo.me/', '_blank', 'noopener'); b.textContent = 'Đã chép link, dán vào Zalo'; setTimeout(function () { b.textContent = 'Gửi Zalo'; }, 3500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(chu).then(mo, mo); else mo();
  });

  /* ── Hỏi đáp: mở một câu một lúc ── */
  var nutHd = document.querySelectorAll('.hd button[aria-controls]');
  function datHd(b, mo) {
    var p = $(b.getAttribute('aria-controls'));
    b.setAttribute('aria-expanded', mo ? 'true' : 'false');
    if (p) p.hidden = !mo;
    b.querySelector('.cong').textContent = mo ? '−' : '+';
  }
  nutHd.forEach(function (b) {
    b.addEventListener('click', function () {
      var mo = b.getAttribute('aria-expanded') !== 'true';
      nutHd.forEach(function (x) { if (x !== b) datHd(x, false); });
      datHd(b, mo);
    });
  });
})();
