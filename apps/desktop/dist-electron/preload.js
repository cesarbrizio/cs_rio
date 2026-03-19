"use strict";
const electron = require("electron");
const electronAPI = {
  notify: {
    cancel: (id) => electron.ipcRenderer.invoke("notify:cancel", id),
    cancelAll: () => electron.ipcRenderer.invoke("notify:cancel-all"),
    hasPermission: () => electron.ipcRenderer.invoke("notify:has-permission"),
    requestPermission: () => electron.ipcRenderer.invoke("notify:request-permission"),
    schedule: (payload) => electron.ipcRenderer.invoke("notify:schedule", payload),
    show: (payload) => electron.ipcRenderer.invoke("notify:show", payload.title, payload.body)
  },
  storage: {
    getItem: (key) => electron.ipcRenderer.invoke("storage:get", key),
    removeItem: (key) => electron.ipcRenderer.invoke("storage:remove", key),
    setItem: (key, value) => electron.ipcRenderer.invoke("storage:set", key, value)
  },
  shell: {
    onNotificationsEnabledChange: (listener) => {
      const wrappedListener = (_event, enabled) => {
        listener(enabled);
      };
      electron.ipcRenderer.on("shell:notifications-enabled-changed", wrappedListener);
      return () => {
        electron.ipcRenderer.removeListener("shell:notifications-enabled-changed", wrappedListener);
      };
    },
    quit: () => electron.ipcRenderer.send("shell:quit"),
    syncSettings: (payload) => electron.ipcRenderer.invoke("shell:sync-settings", payload),
    toggleFullscreen: () => electron.ipcRenderer.invoke("shell:toggle-fullscreen")
  },
  window: {
    close: () => electron.ipcRenderer.send("window:close"),
    maximize: () => electron.ipcRenderer.send("window:maximize"),
    minimize: () => electron.ipcRenderer.send("window:minimize"),
    setFullscreen: (enabled) => electron.ipcRenderer.send("window:fullscreen", enabled)
  }
};
electron.contextBridge.exposeInMainWorld("electronAPI", electronAPI);
