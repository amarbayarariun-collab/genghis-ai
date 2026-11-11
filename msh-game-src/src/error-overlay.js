// Shows load/runtime errors on screen (the artifact viewer hides the console).
const box = document.createElement('pre');
box.style.cssText = 'position:fixed;left:8px;bottom:8px;max-width:70vw;max-height:40vh;overflow:auto;z-index:99999;background:rgba(80,0,0,.85);color:#fff;font:11px monospace;padding:6px;margin:0;display:none;white-space:pre-wrap';
const show = (msg) => { box.style.display = 'block'; box.textContent += msg + '\n'; if (!box.isConnected) document.body.appendChild(box); };
window.addEventListener('error', (e) => { if (e.message) show('ERR ' + e.message); });
window.addEventListener('unhandledrejection', (e) => show('REJ ' + (e.reason?.message || e.reason)));
const ce = console.error.bind(console);
console.error = (...a) => { ce(...a); show(a.map((x) => (x && x.message) || String(x)).join(' ')); };
const ci = console.info.bind(console);
console.info = (...a) => { ci(...a); if (String(a[0]).startsWith('[camp] loaded')) window.__campOk = true; };
