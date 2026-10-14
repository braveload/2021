// 공용 유틸: DOM 헬퍼, 토스트, 컨페티, QR, 이미지 압축, CSV 등 (외부 의존성 없음)

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function randomId(bytes = 16) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomCode(len = 6) {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return [...a].map((b) => abc[b % abc.length]).join('');
}

// 같은 값이면 항상 같은 난수(포스트잇 기울기를 안정적으로 유지)
export function seeded(n) {
  let x = (Number(n) || 1) * 2654435761 % 4294967296;
  x = (x ^ (x >>> 15)) * 2246822519 % 4294967296;
  return ((x >>> 0) % 1000) / 1000;
}

export const storage = {
  get(key, fallback = null) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } },
  del(key) { try { localStorage.removeItem(key); } catch { /* noop */ } },
};

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- 시간 ----------
export function fmtRemain(ms) {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const hh = String(Math.floor((s % 86400) / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return (d > 0 ? `${d}일 ` : '') + `${hh}:${mm}:${ss}`;
}

export function fmtDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

export function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ---------- 토스트 ----------
let toastTimer;
export function toast(msg, kind = 'info') {
  let el = $('#toast');
  if (!el) { el = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.append(el); }
  el.textContent = msg;
  el.dataset.kind = kind;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// ---------- 컨페티 (캔버스, 의존성 없음) ----------
export function confetti(opts = {}) {
  if (prefersReducedMotion()) return;
  const { count = 140, x = 0.5, y = 0.35, spread = 1 } = opts;
  const canvas = h('canvas', { class: 'confetti', 'aria-hidden': 'true' });
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const colors = ['#ffd84d', '#ff8fb8', '#7be0b0', '#6cb6ff', '#ff9f43', '#b388ff'];
  const parts = Array.from({ length: count }, () => ({
    x: innerWidth * x, y: innerHeight * y,
    vx: (Math.random() - 0.5) * 14 * spread, vy: -Math.random() * 12 - 4,
    w: 6 + Math.random() * 6, h: 4 + Math.random() * 5,
    r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
    c: colors[(Math.random() * colors.length) | 0], life: 0,
  }));
  let frame = 0;
  (function tick() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.38; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life++;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.globalAlpha = Math.max(0, 1 - p.life / 130);
      ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    }
    if (++frame < 140) requestAnimationFrame(tick); else canvas.remove();
  })();
}

// ---------- 떠오르는 이모지 ----------
export function floatEmoji(emoji, host = document.body) {
  if (prefersReducedMotion()) return;
  const el = h('span', { class: 'float-emoji', 'aria-hidden': 'true' }, emoji);
  el.style.setProperty('--x', `${10 + Math.random() * 80}%`);
  el.style.setProperty('--dx', `${(Math.random() - 0.5) * 120}px`);
  el.style.setProperty('--s', `${1.4 + Math.random() * 1.2}`);
  host.append(el);
  el.addEventListener('animationend', () => el.remove());
}

// ---------- QR (qrcode-generator, 필요할 때만 CDN 로드) ----------
let qrPromise;
export function loadQr() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  qrPromise ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
    s.onload = () => resolve(window.qrcode);
    s.onerror = () => { qrPromise = null; reject(new Error('QR 라이브러리를 불러오지 못했어요')); };
    document.head.append(s);
  });
  return qrPromise;
}

export async function qrSvg(text) {
  const qrcode = await loadQr();
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const cell = 8, margin = 3, size = (n + margin * 2) * cell;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (qr.isDark(r, c)) d += `M${(c + margin) * cell} ${(r + margin) * cell}h${cell}v${cell}h-${cell}z`;
  }
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', '초대 QR 코드');
  const bg = document.createElementNS(NS, 'rect');
  bg.setAttribute('width', size); bg.setAttribute('height', size); bg.setAttribute('fill', '#fff');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', d); path.setAttribute('fill', '#1b1b1f');
  svg.append(bg, path);
  return svg;
}

// ---------- 이미지 압축 (업로드 전 ~200KB 이하로) ----------
export async function compressImage(file, maxSide = 960, quality = 0.8) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    bitmap = await new Promise((res, rej) => {
      const img = new Image(); const url = URL.createObjectURL(file);
      img.onload = () => { URL.revokeObjectURL(url); res(img); };
      img.onerror = () => rej(new Error('이미지를 읽을 수 없어요'));
      img.src = url;
    });
  }
  const w0 = bitmap.width, h0 = bitmap.height;
  const scale = Math.min(1, maxSide / Math.max(w0, h0));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w0 * scale); canvas.height = Math.round(h0 * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  let q = quality, blob;
  for (let i = 0; i < 4; i++) {
    blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', q));
    if (blob && blob.size <= 380 * 1024) break;
    q -= 0.15;
  }
  if (!blob) throw new Error('이미지를 변환하지 못했어요');
  return blob;
}

// ---------- CSV ----------
export function toCsv(rows) {
  const esc = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;       // 엑셀 수식 주입 방지
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
}

export function download(filename, text, mime = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = h('textarea', { class: 'sr-copy', 'aria-hidden': 'true' }); ta.value = text;
    document.body.append(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { /* noop */ }
    ta.remove(); return ok;
  }
}
