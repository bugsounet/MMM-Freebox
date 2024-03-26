var NodeHelper = require('node_helper')
const { Freebox } = require("./components/freebox.js")
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
    this.init = false
  },

  Freebox: async function (config) {
    this.Freebox_OS(config,this.config.showClientRate || this.config.showClientCnxType).then(
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
    this.Freebox(this.config.freebox)
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
    this.sendSocketNotification("debug", res)
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
      
      let ip = client.l3connectivities.find(cnx => cnx.af === "ipv4" && cnx.active)
      device.ip = ip ? ip.addr : null
      if (client.access_point?.connectivity_type === "wifi") {
        if (client.access_point?.wifi_information.band === "2d4g") device.access_type= "wifi2"
        if (client.access_point?.wifi_information.band === "5g") device.access_type= "wifi5"
        if (client.access_point?.wifi_information.band === "6g") device.access_type= "wifi6"
        if (client.access_point?.wifi_information.band === "60g") device.access_type= "wifi7"
        if (client.access_point?.wifi_information.signal) {
          device.signal = client.access_point.wifi_information.signal
          device.signal_percent = this.wifiPercent(device.signal)
          device.signal_bar = this.wifiBar(device.signal_percent)
        }
        if (client.access_point?.tx_rate) device.debit = this.convert(client.access_point.tx_rate*10,1)
        else device.debit = "0 Kb/s"
      }
      
      if (this.config.showClientRate || this.config.showClientCnxType) {
  
        res.EthCnx.forEach(info=> {
          if (info.mac_list) {
            if(!info.mac_list.length) return // return an object ???
            var macList = info.mac_list.map((mac_list)=>{return mac_list.mac})
            macList.forEach(mac => {
              if (client.l2ident.id == mac) {
                if (res[info.id] && res[info.id].tx_bytes_rate) {
                  device.debit = this.convert(res[info.id].tx_bytes_rate,1)
                  device.access_type = "ethernet"
                  device.eth = info.id
                }
                else {
                  /* try again next time */
                }
              }
            })
          }
        })
      }
      res.Clients.push(device)
    })

    /** delete all Freebox result **/
    delete res.Client
    delete res[1]
    delete res[2]
    delete res[3]
    delete res[4]
    delete res[5]
    delete res[6]
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
  Freebox_OS: async function(config,clientRate) {
    FB("Start Query Freebox Server:")
    var rate
    var output

    const freebox = new Freebox(config)
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
    }

    FB("Quering Connexion...")
    const cnx = await freebox.request({
      method: "GET",
      url: "connection/"
    })

    FB("Quering Client...")
    const clients = await freebox.request({
      method: "GET",
      url: "lan/browser/pub/"
    })

    FB("Quering ALL Ethernet Cnx...")
      var ethCnx = await freebox.request({
        method: "GET",
        url:"switch/status/"
      })

    if (clientRate) {
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

      if (this.config.checkFreePlug) {
        FB("Quering Freeplug...")
        var eth5 = await freebox.request({
          method: "GET",
          url:"switch/port/5/stats"
        })
      }
      if (this.config.checkSFP) {
        FB("Quering SFP...")
        var eth6 = await freebox.request({
          method: "GET",
          url:"switch/port/9999/stats"
        })
      }
    }
    FB("Done!")

    bandwidth = this.convert(cnx.data.result.bandwidth_down,2) + " - " + this.convert(cnx.data.result.bandwidth_up,2)
    debit = this.convert(cnx.data.result.rate_down,2) +" - " + this.convert(cnx.data.result.rate_up,2)
    type = (cnx.data.result.media == "xdsl") ? "xDSL" : ((cnx.data.result.media == "ftth") ? "FTTH" : "Inconnu")
    degroup = (cnx.data.result.type == "rfc2684") ? true : false

    output = {
      Model: this.FreeboxVersion,
      Type: type,
      Degroup: degroup,
      Bandwidth: bandwidth,
      Debit: debit,
      IP: cnx.data.result.ipv4,
      Client: clients.data.result ? clients.data.result : [],
      EthCnx: clientRate && ethCnx.data.result ? ethCnx.data.result : [],
      1: clientRate && eth1.data.result ? eth1.data.result : [],
      2: clientRate && eth2.data.result ? eth2.data.result : [],
      3: clientRate && eth3.data.result ? eth3.data.result : [],
      4: clientRate && eth4.data.result ? eth4.data.result : [],
      5: clientRate && this.config.checkFreePlug && eth5.data.result ? eth5.data.result : [],
      6: clientRate && this.config.checkSFP && eth6.data.result ? eth6.data.result : [],
    }

    await freebox.logout()
    return output
  },
  
  /** converti les octets en G/M/K **/
  convert: function(bytes,FixTo) {
    if (bytes>1000000000) bytes=(bytes/1000000000).toFixed(FixTo) + " Gb/s"
    else if (bytes>1000000) bytes=(bytes/1000000).toFixed(FixTo) + " Mb/s"
    else bytes=(bytes/1000).toFixed(FixTo) + " Kb/s"
    return bytes
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
