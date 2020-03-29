var NodeHelper = require('node_helper');
const { Freebox } = require("freebox");
var _ = require("underscore");
var ping = require('ping');

FB = (...args) => { /* do nothing */ }

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

  const clients = await freebox.request({
    method: "GET",
    url: "lan/browser/pub/",
  });

  const cnx = await freebox.request({
    method: "GET",
    url: "connection/",
  });

  const calls = await freebox.request({
    method: "GET",
    url:"call/log/",
  }),
  
  bandwidth = (cnx.data.result.bandwidth_down/1000000).toFixed(2) + "/" + (cnx.data.result.bandwidth_up/1000000).toFixed(2)
  debit = (cnx.data.result.rate_down/1000).toFixed(0) + "/" + (cnx.data.result.rate_up/1000).toFixed(0)
  ip = cnx.data.result.ipv4
  type = (cnx.data.result.media == "xdsl") ? "xDSL" : ((cnx.data.result.media == "ftth") ? "FTTH" : "Inconnu")
  degroup = (cnx.data.result.type == "rfc2684") ? true : false
  output = {
    Type: type,
    Degroup: degroup,
    Bandwidth: bandwidth,
    Debit: debit,
    IP: ip,
    Client: clients.data.result,
    Call: calls.data.result
  }

  await freebox.logout()
  return output
};

module.exports = NodeHelper.create({

  start: function() {
    console.log("[Freebox] Starting...")
    this.freebox = null
    this.init = false
    this.pingValue = null
  },

  Freebox: function (token,id,domain,port) {
    Freebox_OS(token,id,domain,port).then(
      (res) => {
        if (!this.init) this.makeCache(res)
        else this.makeResult(res)
      },
      (err) => { 
        console.log("[Freebox] " + err)
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
   if (this.config.showPing) this.Ping()
  },

  socketNotificationReceived: function(notification, payload) {
    switch(notification) {
      case "INIT":
        this.config = payload
        if (this.config.debug) {
          FB = (...args) => { console.log("[Freebox]", ...args) }
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
    FB("Send notification: " + noti, this.config.verbose ? payload : "")
    if(!this.config.dev) this.sendSocketNotification(noti, payload)
  },

  makeCache: function (res) {
    console.log (res)
    this.cache = {}
    if (Object.keys(res.Client).length > 0) {
      for (let [item, client] of Object.entries(res.Client)) {
        this.cache[client.l2ident.id] = {
          name: client.primary_name ? client.primary_name : "(Appareil sans nom)",
          type: client.host_type,
          show: (!this.config.showFreePlayer && client.vendor_name == "Freebox SAS") ? false : this.config.showClient
        }
      }
    }
    this.cache = this.sortBy(this.cache, this.config.sortBy)
    var filtered = _.where(res.Call, {type: "missed"})
    var missed = filtered.length
    this.sendInfo("MISSED_CALL", missed)
    this.sendInfo("INITIALIZED", this.cache)

  },

  sortBy: function (data, sort) {
    var result = {}
    /** sort by type or by name **/
    if (sort == "type" || sort == "name") {
      FB("Sort cache by" , sort)
      var arr = []
      for (var mac in data) {
        if (data.hasOwnProperty(mac)) {
            var obj = {}
            obj[mac] = data[mac]
            obj.Sort = data[mac][sort].toLowerCase()
            arr.push(obj)
        }
      }

      arr.sort((a, b)=> {
        var at = a.Sort
        var bt = b.Sort
        return at > bt ? 1 : ( at < bt ? -1 : 0 )
      })

      for (var i=0, l=arr.length; i<l; i++) {
        var obj = arr[i];
        delete obj.Sort
        for (var mac in obj) {
          if (obj.hasOwnProperty(mac)) {
              var id = mac
          }
        }

        result[mac] = obj[id]
      }
    } else if (sort == "mac") {
      /** sort by MAC **/
      FB("Sort cache by", sort)
      var mac = Object.keys(data)
      mac.sort()
      mac.forEach((macSort)=> {
        result[macSort] = data[macSort]
      })
    } else {
      /** other return the same **/
      FB("Cache not sorted")
      result = data
    }
    return result
  },

  makeResult: function(res) {
    res.Clients = []
    res.Calls= {}
    res.Calls.who = []
    res.Calls.missed = 0
    var device = {}
    /** Array of client with used value in object **/
    if (Object.keys(res.Client).length > 0) {
      for (let [item, client] of Object.entries(res.Client)) {
        device = {
          mac: client.l2ident.id,
          name: client.primary_name ? client.primary_name : "(Appareil sans nom)",
          type: client.host_type,
          vendor: client.vendor_name,
          active: client.active
        }
        res.Clients.push(device)
      }
    }

    var filtered = _.where(res.Call, {type: "missed"})
    var missed = filtered.length
    var call = {}
    if (missed > 0) {
      for (let [item, value] of Object.entries(filtered)) {
        call = {
          name: value.name,
          date: value.datetime,
          new: value.new
        }
        res.Calls.who.push(call)
      }
    }
    res.Calls.missed = missed

    delete res.Call
    delete res.Client
    res.Ping = this.pingValue
    this.sendInfo("RESULT", res)
  },

  Ping: function() {
    ping.promise.probe("google.fr")
    .then((res)=> {
      if (res.alive) {
        this.pingValue = res.time + " ms"
      } else {
        this.pingValue = "Erreur !"
      }
    })
  },
});
