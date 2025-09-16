import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

// 密码管理API
const passwordAPI = {
  getPasswords: () => ipcRenderer.invoke("get-passwords"),
  addPassword: (passwordData) => ipcRenderer.invoke("add-password", passwordData),
  updatePassword: (id, passwordData) => ipcRenderer.invoke("update-password", { id, passwordData }),
  deletePassword: (id) => ipcRenderer.invoke("delete-password", id),
  searchPasswords: (query) => ipcRenderer.invoke("search-passwords", query),
  generatePassword: (options) => ipcRenderer.invoke("generate-password", options),
  checkPasswordStrength: (password) => ipcRenderer.invoke("check-password-strength", password)
};

// Custom APIs for renderer
const api = {
  ...electronAPI,
  password: passwordAPI
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
}
