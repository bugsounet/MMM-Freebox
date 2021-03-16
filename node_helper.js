// @todo ... check freeplug and sfp cnx
// npmcheck powa !

var NodeHelper = require('node_helper')
const { Freebox } = require("@bugsounet/freebox")
var _ = require("underscore")
var ping = require('ping')

FB = (...args) => { /* do nothing */ }

module.exports = NodeHelper.create({
  start: function() {
    console.log("[Freebox] Starting...")
    this.freebox = null
    this.pingValue = null
    this.interval = null
    this.cache = {}
    this.update = null
    this.FreeboxVersion = null
    this.FreeboxV7 = false
    this.init = false
  },

  Freebox: async function (token) {
    this.Freebox_OS(token,this.config.showClientRate || this.config.showClientCnxType ,this.config.showMissedCall).then(
      (res) => {
        if (Object.keys(this.cache).length == 0) this.makeCache(res)
        else {
          this.makeResult(res)
          this.updateInterval()
        }
      },
      (err) => {
        FB("[Error] " + err)
        this.updateInterval()
      }
    )
  },

  scan: function() {
    if (this.config.showPing) this.Ping()
    this.Freebox(this.config.token)
  },

  /** scan main loop **/
  updateInterval: function () {
    clearInterval(this.update)
    this.counterUpdate = this.config.updateDelay

    this.update = setInterval( ()=> {
      this.counterUpdate -= 1000
      if (this.counterUpdate <= 0) {
        clearInterval(this.update)
        this.scan()
      }
    }, 1000)
  },

  socketNotificationReceived: function(notification, payload) {
    switch(notification) {
      case "INIT":
        this.config = payload
        if (this.config.debug) FB = (...args) => { console.log("[Freebox]", ...args) }
        this.scan()
        break
      case "SCAN":
        this.updateInterval()
        break
      case "CACHE":
        this.cache = {}
        this.scan()
        this.updateInterval()
        break
    }
  },

  sendInfo: function (noti, payload) {
    FB("Send notification: " + noti, this.config.verbose ? payload : "")
    this.sendSocketNotification(noti, payload)
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
    this.makeResult(res)
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

    res.Client.forEach(client=> {
    /** Array of client with used value in object **/
      device = {
        mac: client.l2ident.id,
        name: client.primary_name ? client.primary_name : "(Appareil sans nom)",
        ip: null,
        type: client.host_type,
        vendor: client.vendor_name,
        debit: null,
        active: client.active,
        access_type: null,
        signal: null,
        signal_percent: null,
        signal_bar: null,
        eth: null
      }
      if (this.config.showClientRate || this.config.showClientCnxType) {
        /** rate of wifi devices **/
        res.Wifi2g.forEach(info=> {
          if (client.l2ident.id == info.mac) {
            device.debit = this.convert(info.tx_rate,0)
            device.access_type= "wifi2"
            device.signal = info.signal
            device.signal_percent = this.wifiPercent(info.signal)
            device.signal_bar = this.wifiBar(device.signal_percent)
          }
        })
        res.Wifi5g.forEach(info=> {
          if (client.l2ident.id == info.mac) {
            device.debit = this.convert(info.tx_rate,0)
            device.access_type= "wifi5"
            device.signal = info.signal
            device.signal_percent = this.wifiPercent(info.signal)
            device.signal_bar = this.wifiBar(device.signal_percent)
          }
        })
        if (this.FreeboxV7) {
          res.Wifi5g2.forEach(info=> {
            if (client.l2ident.id == info.mac) {
              device.debit = this.convert(info.tx_rate,0)
              device.access_type= "wifi5"
              device.signal = info.signal
              device.signal_percent = this.wifiPercent(info.signal)
              device.signal_bar = this.wifiBar(device.signal_percent)
            }
          })
          res.Wifi5g3.forEach(info=> {
            if (client.l2ident.id == info.mac) {
              device.debit = this.convert(info.tx_rate,0)
              device.access_type= "wifi5"
              device.signal = info.signal
              device.signal_percent = this.wifiPercent(info.signal)
              device.signal_bar = this.wifiBar(device.signal_percent)
            }
          }) || null
        }
        /** rate of eth devices **/
        res.EthCnx.forEach(info=> {
          if (info.mac_list) {
            var macList = info.mac_list.map((mac_list)=>{return mac_list.mac})
            macList.forEach(mac => {
              if (client.l2ident.id == mac) {
                if (res[info.id] && res[info.id].tx_bytes_rate) {
                  device.debit = this.convert(res[info.id].tx_bytes_rate,0)
                  device.access_type = "ethernet"
                  device.eth = info.id
                }
                else { /* attend le prochain le tour */ }
              }
            })
          }
        })
      }

      if (client.l3connectivities && this.config.showClientIP) {
        client.l3connectivities.forEach(ip => {
          if (ip.af == "ipv4" && ip.active) device.ip = ip.addr
        })
      }

      res.Clients.push(device)
    })

    if (this.config.showMissedCall) {
      var filtered = _.where(res.Call, {type: "missed"})
      var missed = filtered.length
      var call = {}
      if (missed > 0) {
        filtered.forEach(caller => {
          call = {
            name: caller.name,
            date: caller.datetime,
            new: caller.new
          }
          res.Calls.who.push(call)
        })
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
    delete res.Wifi2g
    delete res.Wifi5g,
    delete res.Wifi5g2,
    delete res.wifi5g3,
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
      if (res.alive) this.pingValue = res.time + " ms"
      else this.pingValue = "Erreur !"
    })
  },

/** Freebox OS API CALL **/
  Freebox_OS: async function(token,clientRate, callLog) {
    FB("Start Query Freebox Server:")
    var rate
    var output

    const freebox = new Freebox(token)
    await freebox.login()

    if (!this.init) {
      FB("Quering Freebox Model...")
      const FreeboxVersion = await freebox.request({
        method: "GET",
        url: "api_version/"
      })
      this.FreeboxVersion = FreeboxVersion.data.box_model_name
      FB("Found:", this.FreeboxVersion)
      this.init = true
      this.FreeboxV7 = this.FreeboxVersion.match(/(v7)/gi) ? true : false
    }

    FB("Quering Client...")
    const clients = await freebox.request({
      method: "GET",
      url: "lan/browser/pub/"
    })

    FB("Quering Connexion...")
    const cnx = await freebox.request({
      method: "GET",
      url: "connection/"
    })

    if (callLog) {
      FB("Quering Call Log...")
      var calls = await freebox.request({
        method: "GET",
        url:"call/log/"
      })
    }

    if (clientRate) {
      FB("Quering Wifi 2Ghz...")
      var wifi2gCnx = await freebox.request({
        method: "GET",
        url:"wifi/ap/0/stations/"
      })

      FB("Quering Wifi 5Ghz...")
      var wifi5gCnx = await freebox.request({
        method: "GET",
        url:"wifi/ap/1/stations/"
      })

      /** Freebox Delta require ... **/
      if (this.FreeboxV7) {
        FB("Quering Wifi 5Ghz card 2...")
        var wifi5gCnx2 = await freebox.request({
          method: "GET",
          url:"wifi/ap/2/stations/"
        })

        FB("Quering Wifi 5Ghz card 3...")
        var wifi5gCnx3 = await freebox.request({
          method: "GET",
          url:"wifi/ap/3/stations/"
        })
      }
      /** **/
      FB("Quering ALL Ethernet Cnx...")
      var ethCnx = await freebox.request({
        method: "GET",
        url:"switch/status/"
      })

      FB("Quering Ethernet on port 1...")
      var eth1 = await freebox.request({
        method: "GET",
        url:"switch/port/1/stats"
      })

      FB("Quering Ethernet on port 2...")
      var eth2 = await freebox.request({
        method: "GET",
        url:"switch/port/2/stats"
      })

      FB("Quering Ethernet on port 3...")
      var eth3 = await freebox.request({
        method: "GET",
        url:"switch/port/3/stats"
      })

      FB("Quering Ethernet on port 4...")
      var eth4 = await freebox.request({
        method: "GET",
        url:"switch/port/4/stats"
      })
    }

    FB("Done!")

    bandwidth = this.convert(cnx.data.result.bandwidth_down,2,1) + " - " + this.convert(cnx.data.result.bandwidth_up,2,1)
    debit = this.convert(cnx.data.result.rate_down,2) +" - " + this.convert(cnx.data.result.rate_up,2)
    type = (cnx.data.result.media == "xdsl") ? "xDSL" : ((cnx.data.result.media == "ftth") ? "FTTH" : "Inconnu")
    degroup = (cnx.data.result.type == "rfc2684") ? true : false

    output = {
      Type: type,
      Degroup: degroup,
      Bandwidth: bandwidth,
      Debit: debit,
      IP: cnx.data.result.ipv4,
      Client: clients.data.result ? clients.data.result : [],
      Call: callLog && calls.data.result ? calls.data.result : [],
      Wifi2g: clientRate && wifi2gCnx.data.result ? wifi2gCnx.data.result : [],
      Wifi5g: clientRate && wifi5gCnx.data.result ? wifi5gCnx.data.result : [],
      Wifi5g2: clientRate && this.FreeboxV7 && wifi5gCnx2.data.result ? wifi5gCnx2.data.result : [],
      Wifi5g3: clientRate && this.FreeboxV7 && wifi5gCnx3.data.result ? wifi5gCnx3.data.result : [],
      EthCnx: clientRate && ethCnx.data.result ? ethCnx.data.result : [],
      1: clientRate && eth1.data.result ? eth1.data.result : [],
      2: clientRate && eth2.data.result ? eth2.data.result : [],
      3: clientRate && eth3.data.result ? eth3.data.result : [],
      4: clientRate && eth4.data.result ? eth4.data.result : [],
    }
    await freebox.logout()
    return output
  },

  /** converti les octets en G/M/K **/
  convert: function(octet,FixTo, type=0) {
    if (octet>1000000000){
      if (type == 2) octet=octet/1000000000 + " Go"
      else octet=(octet/1000000000).toFixed(FixTo) + (type ? " Gb/s" : " Go/s")
    } else if (octet>1000000){
      if (type == 2) octet=octet/1000000 + " Mo"
      else octet=(octet/1000000).toFixed(FixTo) + (type ? " Mb/s" : " Mo/s")
    } else if (octet>1000){
      if (type == 2) octet=octet/1000 + " Ko"
      else octet=(octet/1000).toFixed(FixTo) + (type ? " Kb/s" : " Ko/s")
    } else {
      if (type == 2) octet=octet + " o"
      else octet="0" + (type ? " Kb/s" : " Ko/s")
    }
    return octet
  },

  /** Signal wifi en % **/
  wifiPercent(dB) {
    if(dB <= -100)
      quality = 0;
    else if(dB >= -50)
      quality = 100;
    else
      quality = 2 * (dB + 100);
    return quality
  },

  /** nbre de barre wifi selon % quality) **/
  wifiBar(percent) {
    return parseInt(((percent*5)/100).toFixed(0))
  }
});
