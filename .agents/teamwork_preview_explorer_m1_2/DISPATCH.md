# Dispatch: Explorer M1-2 (Electron IPC & Native Desktop Shell)

**Agent Identity**: teamwork_preview_explorer_m1_2
**Working Directory**: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m1_2
**Role**: Electron IPC & Desktop Shell Specialist
**Milestone**: Milestone 1 (Foundation, Shell, Theming & RTL)

## Task Description
Investigate and specify the exact architecture and code implementation for Electron main process, preload script, secure IPC channels, frameless custom titlebar with window controls, and native desktop capabilities (PDF printing, file dialogs).
Read:
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\ORIGINAL_REQUEST.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\PROJECT.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_survey_3\handoff.md

Output detailed implementation specifications in your `handoff.md`.

## 2026-09-19T04:29:12Z
You are teamwork_preview_explorer_m1_2.
Your working directory is: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m1_2
Your task assignment is in: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m1_2\DISPATCH.md
Read:
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\ORIGINAL_REQUEST.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\PROJECT.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_survey_3\handoff.md

Investigate and specify the exact architecture and code implementation for the Electron desktop shell:
1. electron/main.ts with secure BrowserWindow lifecycle (frameless, titleBarStyle: 'hidden', contextIsolation: true, nodeIntegration: false, sandbox: true).
2. electron/preload.ts exposing window.electronAPI via contextBridge with typed methods (minimizeWindow, maximizeWindow, closeWindow, isMaximized, printInvoicePDF, exportFile, getSystemTheme, getAppVersion).
3. electron/ipcHandlers.ts implementing the main process handlers.
4. Custom TitleBar React component with draggable window region (-webkit-app-region: drag) and non-drag window control buttons.
Write your findings and code blueprints in c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m1_2\handoff.md and report back via send_message.
