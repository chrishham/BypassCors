import { BrowserWindow, ipcMain } from 'electron'
const request = require('request-promise')
const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')

function ExpressApp (expressServerSettings) {
  let expressServer
  let { port, whitelistDomains, behindProxy, proxy } = expressServerSettings
  const app = express()
  var corsOptions = {
    origin: function (origin, callback) {
      // when user access Bypass Cors url directly in his browser , origin is undefined
      if (!origin) return callback(null, true)
      if (whitelistDomains.indexOf(origin) !== -1) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    }
  }
  app.use(cors(corsOptions))
  app.use(bodyParser.json())

  app.get('/', (req, res) => res.send('Bypass CORS is up and running!'))

  app.post('/', (req, res) => {
    let { headers, url, fullPageRender, javascript, scrollInterval, debug, cookies } = req.body
    let origin = req.get('origin');
    if (!/^http(s)?:\/\/localhost:/.test(origin)) debug = false
    if (!url) return res.status(500).send('Url is required!')
    if (!headers) return res.status(500).send('Headers are required!')

    if (fullPageRender) return newBrowserWindow({ headers, url, javascript, scrollInterval, debug, cookies })
      .then(response => res.send(response))
      .catch(error => {
        // console.log(error.message)
        res.status(500).send(error.message)
      })

    const cookieJar = request.jar()
    if (cookies) setRequestCookies(cookies, cookieJar)

    let gzip = headers['Accept-Encoding'] && headers['Accept-Encoding'].indexOf('gzip') !== -1 ? true : false
    request({ url, headers, gzip, proxy: behindProxy ? proxy : false, jar: cookieJar })
      .then(html => {
        cookies = cookieJar ? cookieJar.getCookies(url) : null
        res.json({ html, cookies })
      })
      .catch(error => res.status(500).send(error))
  })

  expressServer = app.listen(port, () => {
    console.log(`ByPass CORS listening on port ${port}!`)
    let googleRequest = request({ url: 'https://www.google.com/', gzip: true, proxy: behindProxy ? proxy : false })
    let promiseTimeout = new Promise((resolve, reject) => {
      setTimeout(() => reject('err'), 5000);
    });
    Promise.race([googleRequest, promiseTimeout])
      .then(response => expressServer.emit('success'))
      .catch(error => expressServer.emit('error', new Error('No access to the internet. Check your network/proxy settings and try again.')))
  })
  return expressServer
}

function newBrowserWindow ({ headers, url, javascript, scrollInterval, debug, cookies }) {
  scrollInterval = scrollInterval || 500
  return new Promise((resolve, reject) => {
    let win = new BrowserWindow({
      width: 1000,
      height: 1000,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      },
      show: !!debug
    })
    let userAgent = headers['user-agent']

    let extraHeaders = ""
    for (let headerName in headers) {
      if (headerName.toLowerCase() !== 'user-agent') {
        extraHeaders += headerName + ':' + headers[headerName] + '\n'
      }
    }
    win.webContents.openDevTools()
    const ses = win.webContents.session
    Promise.resolve()
      .then(() => {
        if (cookies) return setElectronCookies(cookies, ses)
      })
      .then(() => {
        win.loadURL(url, {
          userAgent,
          extraHeaders
        })
      })
      .catch(error => reject(error))

    win.webContents.once('did-finish-load', () => {
      javascript = `(function(){
        ${javascript}
        })()
      function delay(t) {
        return new Promise(function (resolve) {
          setTimeout(resolve, t)
        })
      }
      `
      Promise.race([timeOutReject(10000), win.webContents.executeJavaScript(javascript)])
        .then(result => win.webContents.executeJavaScript(
          `
          (function(){
            return new Promise((resolve,reject)=>{
              totalHeight = document.body.scrollHeight
              for (let i = 0; i<totalHeight ; i+= 1000  ) {
                setTimeout(()=> {
                    window.scrollTo({ top: i, behavior: 'smooth' })
                    if( i + 1000 > totalHeight ) resolve(document.documentElement.innerHTML)
                }, ${scrollInterval} * i/1000)
              }
            })
          })()
        `)
          .then(html => {
            ses.cookies.get({}, (error, cookies) => {
              console.log('Electron cookies.length: ', cookies.length)
              if (error) return reject(error)
              resolve({ html, cookies })
              ses.clearStorageData()
            })
          })
        )
        .catch(error => {
          reject(error)
        })
        .then(() => {
          if (!debug) {
            win.destroy()
            win = null
          }
        })
    })
  })
}

function timeOutReject (t) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(new Error('Javascript execution timeout.'))
    }, t)
  })
}

function setElectronCookies (cookies, ses) {
  return new Promise((resolve, reject) => {
    cookies = cookies.filter(cookie => cookie.key || cookie.name)
    console.log('Request cookies.length: ', cookies.length)
    cookies.forEach(cookie => {
      if (cookie.key) {
        cookie.name = cookie.key
        delete cookie.key
      }
      const scheme = cookie.secure ? "https" : "http";
      const host = cookie.domain[0] === "." ? cookie.domain.substr(1) : cookie.domain;
      cookie.url = scheme + "://" + host;
      ses.cookies.set(cookie, setCookieCb)
    })
    let cbCntr = 0
    function setCookieCb (error) {
      if (error) {
        console.log(cbCntr, error)
        return reject(error)
      }
      cbCntr++
      if (cbCntr === cookies.length) {
        console.log('Finished adding cookies to session!')
        resolve()
      }
    }
  })
}

function setRequestCookies (cookies, cookieJar) {
  cookies.forEach(cookie => {
    if (cookie.name) {
      cookie.key = cookie.name
      delete cookie.name
    }
    const scheme = cookie.secure ? "https" : "http";
    const host = cookie.domain[0] === "." ? cookie.domain.substr(1) : cookie.domain;
    const url = scheme + "://" + host;
    cookieJar.setCookie(cookie.toString(), url)
  })
}

export { ExpressApp }