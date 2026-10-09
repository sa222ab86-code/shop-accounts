const { contextBridge, ipcRenderer: r } = require('electron');
contextBridge.exposeInMainWorld('api', {
  loadSync: () => r.sendSync('load-sync'),
  save: d => r.invoke('save', d),
  saveFile: (n, d) => r.invoke('save-file', n, d),
  savePdf: (n, h) => r.invoke('save-pdf', n, h),
  backupNow: () => r.invoke('backup-now'),
  listBackups: () => r.invoke('list-backups'),
  chooseExtraDir: () => r.invoke('choose-extra-dir'),
  openBackupDir: () => r.invoke('open-backup-dir'),
  restore: () => r.invoke('restore'),
  getVersion: () => r.invoke('app-version'),
  updState: () => r.invoke('upd-state'),
  updCheck: () => r.invoke('upd-check'),
  updDownload: () => r.invoke('upd-download'),
  updInstall: () => r.invoke('upd-install'),
  onUpd: cb => r.on('upd', (e, s) => cb(s))
});
