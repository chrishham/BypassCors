'use strict'

import { app, protocol, BrowserWindow, ipcMain, Menu, Tray, nativeImage } from 'electron'
import {
  createProtocol,
  installVueDevtools
} from 'vue-cli-plugin-electron-builder/lib'
require('events').EventEmitter.defaultMaxListeners = 15;
const AutoLaunch = require('auto-launch');
const settings = require('electron-settings');
const ExpressApp = require('./ExpressApp')

const isDevelopment = process.env.NODE_ENV !== 'production'

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
  app.exit()
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
}
// Standard scheme must be registered before the app is ready
protocol.registerStandardSchemes(['app'], { secure: true })
function createWindow () {
  // Create the browser window.
  win = new BrowserWindow({ width: 800, height: 680 })

  if (process.env.WEBPACK_DEV_SERVER_URL) {
    // Load the url of the dev server if in development mode
    win.loadURL(process.env.WEBPACK_DEV_SERVER_URL)
    if (!process.env.IS_TEST) win.webContents.openDevTools()
  } else {
    createProtocol('app')
    // Load the index.html when not in development
    win.loadURL('app://./index.html')
  }

  win.webContents.on('did-finish-load', winIsReady)

  win.on('closed', () => {
    win = null
  })
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow()
  }
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  if (isDevelopment && !process.env.IS_TEST) {
    // Install Vue Devtools
    await installVueDevtools()
  }
  createWindow()
})

// Exit cleanly on request from parent process in development mode.
if (isDevelopment) {
  if (process.platform === 'win32') {
    process.on('message', data => {
      if (data === 'graceful-exit') {
        app.quit()
      }
    })
  } else {
    process.on('SIGTERM', () => {
      app.quit()
    })
  }
}

/*
 Enable Bypass Cors to start at startup
 */
var bypassCorsAutoLauncher = new AutoLaunch({
  name: 'Bypass Cors',
  path: '/Applications/bypass-cors.app',
});

bypassCorsAutoLauncher.enable();

bypassCorsAutoLauncher.isEnabled()
  .then(function (isEnabled) {
    if (isEnabled) {
      console.log('Bypass cors is enabled to start at startup!')
      return;
    }
    bypassCorsAutoLauncher.enable();
  })
  .catch(function (err) {
    console.log(error)
  });

/*
 Bypass Cors configuration.
*/

let expressServer

function winIsReady () {
  console.log('Window is ready!')
  if (!settings.has('expressServerSettings')) {
    settings.set('expressServerSettings', {
      port: '3167',
      whitelistDomains: []
    });
  }
  let expressServerSettings = settings.get('expressServerSettings')
  restartExpressServer(expressServerSettings)
}

function restartExpressServer (expressServerSettings) {
  if (expressServer) expressServer.close();
  expressServer = ExpressApp(expressServerSettings)
  expressServer.on('error', function (e) {
    let message = e.message
    console.log(message)
    if (/EADDRINUSE/.test(e.message)) message = "Port is already in use. Please try a different one."
    if (/EACCES/.test(e.message)) message = "You don't have permissions to use this port. Try the 1024 - 65535 range."
    expressServer.removeListener('success', success)
    expressServer.close()
    win.webContents.send('expressServerError', message)
  });
  expressServer.on('success', success)

  function success () {
    console.log('main process received success message!')
    win.webContents.send('expressServerSuccess')
  };
}

ipcMain.on('restartExpressServer', (event, expressServerSettings) => {
  settings.set('expressServerSettings', expressServerSettings)
  restartExpressServer(expressServerSettings)
  win.webContents.send('expressServerSettings', expressServerSettings)
})

ipcMain.on('getExpressServerSettings', (event) => {
  let expressServerSettings = settings.get('expressServerSettings')
  win.webContents.send('expressServerSettings', expressServerSettings)
})