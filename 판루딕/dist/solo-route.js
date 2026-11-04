(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const routes = { chain: 'number-chain.html', line: 'line-control.html', code: 'code-breaker.html', reverse: 'lights.html', lights: 'lights.html', dice: 'dice-strategy.html' };
  const requested = params.get('game');
  const target = new URL(Object.hasOwn(routes, requested) ? routes[requested] : routes.code, location.href);
  if (params.get('records') === '1') target.searchParams.set('records', '1');
  location.replace(target.href);
})();
