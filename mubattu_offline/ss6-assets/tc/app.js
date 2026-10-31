/* Trang chủ v6: menu hamburger, cuộn tới thẻ thiết bị, tab bảng xếp hạng, accordion hỏi đáp (thợ sau thêm vào cuối). */
(function () {
  'use strict';
  var menu = document.querySelector('.hero-menu');
  if (menu) {
    var bam = menu.querySelector('.bam');
    var dong = function () { menu.classList.remove('mo'); bam.setAttribute('aria-expanded', 'false'); bam.setAttribute('aria-label', 'Mở menu'); };
    bam.addEventListener('click', function () {
      var mo = menu.classList.toggle('mo');
      bam.setAttribute('aria-expanded', mo ? 'true' : 'false');
      bam.setAttribute('aria-label', mo ? 'Đóng menu' : 'Mở menu');
    });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) dong(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') dong(); });
  }
  /* chip thiết bị: cuộn tới thẻ #the-<pc|android|ios|web> nếu có, không thì tới #vao-choi */
  document.addEventListener('click', function (e) {
    var c = e.target.closest('[data-the]');
    if (!c) return;
    var t = document.getElementById('the-' + c.getAttribute('data-the')) || document.getElementById('vao-choi');
    if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  });
})();
