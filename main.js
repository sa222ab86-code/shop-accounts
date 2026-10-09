const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { pathToFileURL } = require('url');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
if (!app.requestSingleInstanceLock()) app.quit();

let win, lastHash = '';
const S = { extraDir: '', last: 0 };                       // الإعدادات
const P = n => path.join(app.getPath('userData'), n);
const DATA = () => P('data.json'), BK = () => P('backups');
const dlg = async (fn, o) => { const r = await dialog[fn](win, o); try { win.focus(); win.webContents.focus(); } catch (e) {} return r; };
const rd = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return d; } };
// كتابة آمنة: ملف مؤقت ثم استبدال، مع الاحتفاظ بنسخة .bak من الإصدار السابق
const put = (p, t) => { const x = p + '.tmp'; fs.writeFileSync(x, t); try { if (fs.existsSync(p)) fs.copyFileSync(p, p + '.bak'); } catch (e) {} fs.renameSync(x, p); };
const saveSet = () => { try { put(P('settings.json'), JSON.stringify(S)); } catch (e) {} };
const two = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
const stamp = () => { const d = new Date(); return `${ymd(d)}_${two(d.getHours())}-${two(d.getMinutes())}`; };

// يحتفظ بكل نسخ آخر يومين، ثم بأحدث نسخة لكل يوم حتى 60 يومًا
function prune(dir) {
  let f; try { f = fs.readdirSync(dir).filter(n => /^backup-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.json$/.test(n)).sort().reverse(); } catch (e) { return; }
  const cut = ymd(new Date(Date.now() - 2 * 864e5)), days = new Set();
  f.forEach(n => {
    const d = n.slice(7, 17);
    if (d >= cut) return;
    if (days.has(d) || days.size >= 60) { try { fs.unlinkSync(path.join(dir, n)); } catch (e) {} } else days.add(d);
  });
}
function backupTo(dir, txt) {
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `backup-${stamp()}.json`);
  fs.writeFileSync(f, txt); prune(dir); return f;
}
function doBackup(force) {
  let txt; try { txt = fs.readFileSync(DATA(), 'utf8'); } catch (e) { return null; }
  const h = crypto.createHash('md5').update(txt).digest('hex');
  if (!force && h === lastHash) return null;
  let f = null;
  try { f = backupTo(BK(), txt); } catch (e) {}
  if (S.extraDir) try { backupTo(S.extraDir, txt); } catch (e) {}
  lastHash = h; S.last = Date.now(); saveSet(); return f;
}

ipcMain.on('load-sync', e => { e.returnValue = rd(DATA(), null); });
ipcMain.handle('save', (e, d) => { if (!d || typeof d !== 'object') return false; put(DATA(), JSON.stringify(d)); return true; });
ipcMain.handle('save-file', async (e, name, data) => {
  const r = await dlg('showSaveDialog', { defaultPath: name });
  if (r.canceled) return { ok: false };
  fs.writeFileSync(r.filePath, data, 'utf8'); return { ok: true, path: r.filePath };
});
ipcMain.handle('save-pdf', async (e, name, html) => {
  const r = await dlg('showSaveDialog', { defaultPath: name, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
  if (r.canceled) return { ok: false };
  const tmp = path.join(app.getPath('temp'), 'rep-' + Date.now() + '.html');
  let ff = '';
  [['Tajawal-Regular.ttf', 400], ['Tajawal-Bold.ttf', 700]].forEach(([n, w]) => {
    const p = path.join(__dirname, 'fonts', n);
    if (fs.existsSync(p)) ff += `@font-face{font-family:AppFont;src:url("${pathToFileURL(p).href}");font-weight:${w}}`;
  });
  fs.writeFileSync(tmp, html.replace('/*FONTS*/', ff).replace(/<script[\s\S]*?<\/script>/gi, ''), 'utf8');
  const w = new BrowserWindow({ show: false, webPreferences: { javascript: false } });
  try {
    await w.loadFile(tmp);
    const pdf = await w.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true, pageSize: 'A4' });
    fs.writeFileSync(r.filePath, pdf); shell.openPath(r.filePath);
    return { ok: true, path: r.filePath };
  } finally { w.destroy(); try { fs.unlinkSync(tmp); } catch (e) {} }
});
ipcMain.handle('backup-now', async () => {
  doBackup(true);
  const r = await dlg('showOpenDialog', { title: 'اختر مجلد النسخة', properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled) return { ok: true };
  try { return { ok: true, path: backupTo(r.filePaths[0], fs.readFileSync(DATA(), 'utf8')) }; } catch (e) { return { ok: false }; }
});
ipcMain.handle('list-backups', () => {
  let files = [];
  try { files = fs.readdirSync(BK()).filter(n => /^backup-.*\.json$/.test(n)).sort().reverse().slice(0, 8).map(n => ({ name: n, size: fs.statSync(path.join(BK(), n)).size })); } catch (e) {}
  return { files, last: S.last, extra: S.extraDir };
});
ipcMain.handle('choose-extra-dir', async () => {
  const r = await dlg('showOpenDialog', { properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled) return {};
  S.extraDir = r.filePaths[0]; saveSet(); doBackup(true); return { dir: S.extraDir };
});
ipcMain.handle('open-backup-dir', () => { fs.mkdirSync(BK(), { recursive: true }); return shell.openPath(BK()); });
ipcMain.handle('restore', async () => {
  const r = await dlg('showOpenDialog', { properties: ['openFile'], defaultPath: BK(), filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (r.canceled) return {};
  let d; try { d = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8')); } catch (e) { return { error: 'الملف غير صالح' }; }
  if (!d || !Array.isArray(d.branches) || !Array.isArray(d.tx) || !Array.isArray(d.inv)) return { error: 'هذا الملف ليس نسخة صالحة' };
  doBackup(true);                       // نسخة أمان من البيانات الحالية قبل الاستبدال
  put(DATA(), JSON.stringify(d)); lastHash = ''; return { ok: true };
});

// ---- التحديث من GitHub Releases ----
let autoUpdater = null, UPD = { s: 'idle' };
try { autoUpdater = require('electron-updater').autoUpdater; } catch (e) {}
const send = s => { UPD = s; try { win && win.webContents.send('upd', s); } catch (e) {} };
function initUpdater() {
  if (!autoUpdater || !app.isPackaged) return;
  autoUpdater.autoDownload = false; autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.on('checking-for-update', () => send({ s: 'checking' }));
  autoUpdater.on('update-available', i => send({ s: 'available', v: i.version }));
  autoUpdater.on('update-not-available', () => send({ s: 'none' }));
  autoUpdater.on('download-progress', p => send({ s: 'progress', p: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', i => send({ s: 'ready', v: i.version }));
  autoUpdater.on('error', e => send({ s: 'error', m: String((e && e.message) || e).slice(0, 200) }));
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 8000);
}
ipcMain.handle('app-version', () => ({ v: app.getVersion(), packaged: app.isPackaged }));
ipcMain.handle('upd-state', () => UPD);
ipcMain.handle('upd-check', () => {
  if (!autoUpdater || !app.isPackaged) return { ok: false };
  return autoUpdater.checkForUpdates().then(() => ({ ok: true })).catch(e => ({ ok: false, m: e.message }));
});
ipcMain.handle('upd-download', () => autoUpdater.downloadUpdate().then(() => ({ ok: true })).catch(() => ({ ok: false })));
ipcMain.handle('upd-install', () => { doBackup(true); setImmediate(() => autoUpdater.quitAndInstall(true, true)); });

function createWindow() {
  win = new BrowserWindow({ width: 1200, height: 820, autoHideMenuBar: true, icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false } });
  win.on('focus', () => win.webContents.focus());
  win.loadFile('index.html');
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, u) => { if (!u.startsWith('file:')) e.preventDefault(); });
}
app.whenReady().then(() => {
  app.setAppUserModelId('com.shop.accounts');
  Object.assign(S, rd(P('settings.json'), {}));
  doBackup(false);
  setInterval(() => doBackup(false), 3600e3);
  createWindow();
  initUpdater();
});
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('before-quit', () => doBackup(false));
app.on('window-all-closed', () => app.quit());
