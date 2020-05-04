var NodeHelper = require('node_helper');
const { Freebox } = require("freebox");
var _ = require("underscore");
var ping = require('ping');

FB = (...args) => { /* do nothing */ }

async function Freebox_OS(token,id,domain,port,clientRate, callLog) {
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

  if (callLog) {
    var calls = await freebox.request({
      method: "GET",
      url:"call/log/",
    });
  }

  if (clientRate) {
    var wifiCnx = await freebox.request({
      method: "GET",
      url:"wifi/ap/0/stations/",
    });

    var ethCnx = await freebox.request({
      method: "GET",
      url:"switch/status/",
    });

    var eth1 = await freebox.request({
      method: "GET",
      url:"switch/port/1/stats",
    });

    var eth2 = await freebox.request({
      method: "GET",
      url:"switch/port/2/stats",
    });

    var eth3 = await freebox.request({
      method: "GET",
      url:"switch/port/3/stats",
    });

    var eth4 = await freebox.request({
      method: "GET",
      url:"switch/port/4/stats",
    });
  }

  bandwidth = (cnx.data.result.bandwidth_down/1000000).toFixed(2) + "/" + (cnx.data.result.bandwidth_up/1000000).toFixed(2)
  debit = (cnx.data.result.rate_down/1000).toFixed(0) + "/" + (cnx.data.result.rate_up/1000).toFixed(0)
  type = (cnx.data.result.media == "xdsl") ? "xDSL" : ((cnx.data.result.media == "ftth") ? "FTTH" : "Inconnu")
  degroup = (cnx.data.result.type == "rfc2684") ? true : false

  output = {
    Type: type,
    Degroup: degroup,
    Bandwidth: bandwidth,
    Debit: debit,
    IP: cnx.data.result.ipv4,
    Client: clients.data.result,
    Call: callLog ? calls.data.result: null,
    Wifi: clientRate ? wifiCnx.data.result : null,
    EthCnx: clientRate ? ethCnx.data.result : null,
    1: clientRate ? eth1.data.result : null,
    2: clientRate ? eth2.data.result : null,
    3: clientRate ? eth3.data.result : null,
    4: clientRate ? eth4.data.result : null
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
    Freebox_OS(token,id,domain,port,this.config.showClientRate,this.config.showMissedCall).then(
      (res) => {
        if (!this.init) this.makeCache(res)
        else this.makeResult(res)
      },
      (err) => { 
        FB("[Freebox] " + err)
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
    if (this.config.showMissedCall) {
      var filtered = _.where(res.Call, {type: "missed"})
      var missed = filtered.length
      this.sendInfo("MISSED_CALL", missed)
    }
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
          debit: null,
          active: client.active
        }
        if (this.config.showClientRate) {
          /** rate of wifi devices **/
          if (Object.keys(res.Wifi).length > 0) {
            for (let [item, info] of Object.entries(res.Wifi)) {
              if (client.l2ident.id == info.mac) {
                device.debit = (info.tx_rate/1000).toFixed(0)
              }
            }
          }
          /** rate of eth devices **/
          if (Object.keys(res.EthCnx).length > 0) {
            for (let [item, info] of Object.entries(res.EthCnx)) {
              if (info.mac_list) {
                var macList = info.mac_list.map((mac_list)=>{return mac_list.mac})
                macList.forEach(mac => {
                  if (client.l2ident.id == mac) {
                    // devialet patch ou ... hub / cpl ?
                    // bizarre ce crash... il est pas systématique
                    // dans tous les cas, si erreur, je sors la valeur à 0
                    if (res[info.id] && res[info.id].tx_bytes_rate)
                      device.debit = (res[info.id].tx_bytes_rate/1000).toFixed(0)
                    else device.debit = "0"
                  }
                })
              }
            }
          }
        }
        res.Clients.push(device)
      }
    }

    if (this.config.showMissedCall) {
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
    }

    /** delete all Freebox result **/
    delete res.Call
    delete res.Client
    delete res[1]
    delete res[2]
    delete res[3]
    delete res[4]
    delete res.Wifi
    delete res.EthCnx

    res.Ping = this.config.showPing ? this.pingValue : null
    this.sendInfo("RESULT", res)
  },

  Ping: function() {
    ping.promise.probe(this.config.pingAdress,
      {
        timeout: 2,
        extra: ['-4']
      }
    )
    .then((res)=> {
      if (res.alive) {
        this.pingValue = res.time + " ms"
      } else {
        this.pingValue = "Erreur !"
      }
    })
  },
});
