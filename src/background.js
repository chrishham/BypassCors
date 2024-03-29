'use strict'

import { app, protocol, BrowserWindow, ipcMain, Menu, Tray, nativeImage } from 'electron'
import { createProtocol } from 'vue-cli-plugin-electron-builder/lib'
import { ExpressApp } from './ExpressApp'
import installExtension, { VUEJS_DEVTOOLS } from 'electron-devtools-installer'
require('events').EventEmitter.defaultMaxListeners = 15
const path = require('path')
const { autoUpdater } = require('electron-updater')
const settings = require('electron-settings')
const contextMenu = require('electron-context-menu')

contextMenu({
  prepend: (params, browserWindow) => []
})

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
      win.show()
    }
  })
}
// Standard scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { secure: true } }])

function createWindow () {
  // Create the browser window.
  let iconFileName = process.platform === 'linux' ? 'icon_16x16.png' : 'icon_32x32@2x.png'
  const iconPath = isDevelopment ? path.join('build', 'images', iconFileName)
    : path.join(process.resourcesPath, iconFileName)
  // console.log('iconPath', iconPath)
  win = new BrowserWindow({
    width: 800,
    height: 720,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      nodeIntegrationInWorker: true
    }
  })
  win.setTitle(require('../electron-builder.json').productName + ' v' + require('../package.json').version)
  win.on('page-title-updated', (event, title) => {
    event.preventDefault()
    // console.log(title)
  })
  if (process.env.WEBPACK_DEV_SERVER_URL) {
    // Load the url of the dev server if in development mode
    win.loadURL(process.env.WEBPACK_DEV_SERVER_URL)
    if (!process.env.IS_TEST) win.webContents.openDevTools()
  } else {
    createProtocol('app')
    // Load the index.html when not in development
    win.loadURL('app://./index.html')
  }
  win.on('close', (event) => {
    event.preventDefault()
    win.hide()
  })
  win.on('minimize', function (event) {
    event.preventDefault()
    win.hide()
  })
}

app.on('ready', function () {
  autoUpdater.checkForUpdatesAndNotify()
})
// Quit when all windows are closed.
app.on('window-all-closed', () => {
  app.quit()
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
    await installExtension(VUEJS_DEVTOOLS)
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
* Tray configuration
*/
let tray = null
app.on('ready', () => {
  let iconFileName = process.platform === 'linux' ? 'icon_16x16.png' : 'icon_16x16@2x.png'
  const imgPath = isDevelopment ? path.join('build', 'images', iconFileName)
    : path.join(process.resourcesPath, iconFileName)
  let trayImage = nativeImage.createFromPath(imgPath)
  tray = new Tray(trayImage)
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: function () {
        win.show()
      }
    },
    {
      label: 'Quit',
      click: function () {
        app.isQuiting = true
        app.quit()
        app.exit()
      }
    }
  ])
  tray.setToolTip('Bypass CORS')
  tray.setContextMenu(contextMenu)
  tray.on('click', () => {
    win.show()
  })
})

/*
 Bypass Cors configuration.
*/

let expressServer

ipcMain.on('restartExpressServer', () => {
  let expressServerSettings = settings.get('expressServerSettings')
  if (expressServer) expressServer.close()
  expressServer = ExpressApp(expressServerSettings)
  expressServer.on('error', function (e) {
    let message = e.message
    console.log(message)
    if (/EADDRINUSE/.test(e.message)) message = 'Port is already in use. Please try a different one.'
    if (/EACCES/.test(e.message)) message = "You don't have permissions to use this port. Try the 1024 - 65535 range."
    expressServer.removeListener('success', success)
    expressServer.close()
    win.webContents.send('expressServerError', message)
  })
  expressServer.on('success', success)

  function success () {
    // console.log('main process received success message!')
    win.webContents.send('expressServerSuccess')
  };
})
