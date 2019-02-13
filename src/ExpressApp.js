const request = require('request-promise')
const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const ip = require('ip');

// let test = express()
// test.listen(3167, () => console.log(`Test server listening on port ${3167}!`))
module.exports = function (expressServerSettings) {
  let expressServer
  let { port, whitelistDomains, behindProxy, proxy } = expressServerSettings
  const app = express()
  var corsOptions = {
    origin: function (origin, callback) {
      // when user access directly in his browser the bypass cors url, origin is undefined
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
    let { headers, url } = req.body
    if (!url) return res.status(500).send('Url is required!')
    if (!headers) return res.status(500).send('Headers are required!')
    let gzip = headers['Accept-Encoding'] && headers['Accept-Encoding'].indexOf('gzip') !== -1 ? true : false
    request({ url, headers, gzip, resolveWithFullResponse: true, proxy: behindProxy ? proxy : false })
      .then(response => res.json(response))
      .catch(error => res.send(error))
  })

  // let myIp = ip.address()
  expressServer = app.listen(port,() => {
    console.log(`ByPass CORS listening on port ${port}!`)
    // console.log('My ip address : ', '0.0.0.0')
    // check internet connection
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