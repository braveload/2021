// 같은 주소로 들어와도 휴대폰이면 모바일 화면(/m/)으로 자동 이동합니다.
// 추가 서버·도메인 없이 같은 Vercel 프로젝트 안에서 처리하므로 비용이 들지 않습니다.
// ?desktop=1 을 붙이면 PC 화면을 강제로 볼 수 있습니다.
(() => {
  try {
    const params = new URLSearchParams(location.search);
    if (params.get('desktop') === '1') { sessionStorage.setItem('rp.forceDesktop', '1'); return; }
    if (sessionStorage.getItem('rp.forceDesktop') === '1') return;
    const ua = navigator.userAgent || '';
    const isPhone = /iPhone|iPod|Android.+Mobile|Mobile.+Firefox|Windows Phone/i.test(ua);
    if (isPhone) location.replace('/m' + location.search + location.hash);
  } catch { /* 저장소 차단 등은 무시하고 PC 화면 유지 */ }
})();
