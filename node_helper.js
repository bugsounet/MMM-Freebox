var NodeHelper = require('node_helper');
const { Freebox } = require("freebox");

async function Freebox_OS(token,id,domain,port) {
  var rate
  var output
  const freebox = new Freebox({
    app_token: token,
    app_id: id,
    api_domain: domain,
    https_port: port,
    api_base_url: "/api/",
    api_version: "6.0"
  })

  await freebox.login()

  const xdsl = await freebox.request({
    method: "GET",
    url: "connection/xdsl",
  });

  const client = await freebox.request({
    method: "GET",
    url: "lan/browser/pub/",
  });

  const cnx = await freebox.request({
    method: "GET",
    url: "connection/",
  });
  
  sync = (xdsl.data.result.down.rate/1000).toFixed(2) + "/" + (xdsl.data.result.up.rate/1000).toFixed(2)
  debit = (cnx.data.result.rate_down/1000).toFixed(2) + "/" + (cnx.data.result.rate_up/1000).toFixed(2)
  state = cnx.data.result.state
  ip = cnx.data.result.ipv4

  output = {
    Sync: sync,
    Debit: debit,
    State : cnx.data.result.state,
    IP: cnx.data.result.ipv4,
    Client: client.data.result,
  }

  await freebox.logout()
  return output
};

module.exports = NodeHelper.create({

  start: function() {
    console.log("[Freebox] Starting...")
    this.freebox = null
    this.init = false
    this.FB = (text,param) => { /* do nothing */ }
  },

  Freebox: function (token,id,domain,port) {
    Freebox_OS(token,id,domain,port).then(
      (res) => {
        if (!this.init) this.makeCache(res)
        else this.sendInfo("RESULT", res)
      },
      (err) => { 
        console.log("[Freebox] Freebox -- " + err)
        if (!this.init) this.scan() 
      }
    )
  },

  scan: function() {
   this.Freebox(
     this.config.app_token,
     this.config.app_id,
     this.config.api_domain,
     this.config.https_port
   )
  },

  socketNotificationReceived: function(notification, payload) {
    switch(notification) {
      case "INIT":
        this.config = payload
        this.sendInfo("INITIALIZED")
        if (this.config.debug) {
          this.FB = (text,param) => { console.log("[Freebox " + text, param) }
        }
        this.scan()
        break
      case "SCAN":
      this.init = true
        this.scan()
        break
      case "CACHE":
        this.init = false
        this.scan()
        break
    }
  },

  sendInfo: function (noti, payload) {
    this.FB("Send notification: " + noti, payload ? payload : "")
    this.sendSocketNotification(noti, payload)
  },

  makeCache: function (res) {
    this.cache = {}
    if (Object.keys(res.Client).length > 0) {
      for (let [item, value] of Object.entries(res.Client)) {
        this.cache[value.l2ident.id] = {
          name: value.primary_name ? value.primary_name : "(Appareil sans nom)",
          type: value.host_type
        }
      }
    }
    this.sendInfo("CACHE", this.cache)
  }
});
