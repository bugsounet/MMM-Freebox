var NodeHelper = require('node_helper')
const { Freebox } = require("@bugsounet/freebox")
var _ = require("underscore")
var ping = require('ping')

const fs = require("fs")
const parser = require("fast-xml-parser")
const moment = require("moment")
const wget = require('wget-improved')

FB = (...args) => { /* do nothing */ }

module.exports = NodeHelper.create({
  start: function() {
    console.log("[Freebox] Starting...")
    this.freebox = null
    this.init = false
    this.pingValue = null
    this.channelInfo = {}
    this.bouquetID= null
    this.FreeboxTV = {}
    this.FreeboxChannelTV = {} // basse de données des chaines du bouquet FreeboxTV
    this.FreeboxChannelBDD = {} // base de données des 900 chaines Freebox
    this.EPG = {}
    this.interval = null
  },

  Freebox: function (token) {
    this.Freebox_OS(token,this.config.showClientRate || this.config.showClientCnxType ,this.config.showMissedCall,this.config.showVPNUsers).then(
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
   this.Freebox(this.config.token)
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

    if (this.config.showVPNUsers) {
      var nbVPNUser = 0
      if (res.VPNUser) nbVPNUser = res.VPNUser.length
      this.sendInfo("NB_VPN_USER", nbVPNUser)
    }

    if (this.config.player.showPlayerInfo) {
      this.bouquetQuery(this.config.token)
      this.delayDownloadEPG()
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
    res.VPNUsers = {}
    res.VPNUsers.who = []
    res.VPNUsers.nb = 0
    res.Player = {
      power: false,
      channel: null,
      logo: null,
      volume: 0,
      mute: false,
      channelName: 0
    }

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
          active: client.active,
          access_type: null,
          signal: null,
          signal_percent: null,
          signal_bar: null,
          eth: null
        }
        if (this.config.showClientRate || this.config.showClientCnxType) {
          /** rate of wifi devices **/
          if (res.Wifi2g && Object.keys(res.Wifi2g).length > 0) {
            for (let [item, info] of Object.entries(res.Wifi2g)) {
              if (client.l2ident.id == info.mac) {
                device.debit = this.convert(info.tx_rate,0)
                device.access_type= "wifi2"
                device.signal = info.signal
                device.signal_percent = this.wifiPercent(info.signal)
                device.signal_bar = this.wifiBar(device.signal_percent)
              }
            }
          }
          if (res.Wifi5g && Object.keys(res.Wifi5g).length > 0) {
            for (let [item, info] of Object.entries(res.Wifi5g)) {
              if (client.l2ident.id == info.mac) {
                device.debit = this.convert(info.tx_rate,0)
                device.access_type= "wifi5"
                device.signal = info.signal
                device.signal_percent = this.wifiPercent(info.signal)
                device.signal_bar = this.wifiBar(device.signal_percent)
              }
            }
          }
          /** rate of eth devices **/
          if (res.EthCnx && Object.keys(res.EthCnx).length > 0) {
            for (let [item, info] of Object.entries(res.EthCnx)) {
              if (info.mac_list) {
                var macList = info.mac_list.map((mac_list)=>{return mac_list.mac})
                macList.forEach(mac => {
                  if (client.l2ident.id == mac) {
                    // devialet patch ou ... hub / cpl ?
                    // bizarre ce crash... il est pas systématique
                    // dans tous les cas, si erreur, je sors la valeur à 0
                    if (res[info.id] && res[info.id].tx_bytes_rate) {
                      device.debit = this.convert(res[info.id].tx_bytes_rate,0)
                      device.access_type = "ethernet"
                      device.eth = info.id
                    }
                    else {
                      device.debit = "0"
                      device.access_type = null
                      devbice.eth = null
                    }
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

    if (this.config.showVPNUsers) {
      var nbVPNUser = 0
      var vpnUser = {}

      if (res.VPNUser)
         nbVPNUser = res.VPNUser.length

      if (nbVPNUser > 0) {
        res.VPNUser.forEach((x)=> {
          vpnUser = {
            user:       x.user,
            vpn:        x.vpn,
            src_ip:     x.src_ip,
            rx_bytes:   this.convert(x.rx_bytes, null,2),
            tx_bytes:   this.convert(x.tx_bytes, null,2),
            date:       x.auth_time
          }
          res.VPNUsers.who.push(vpnUser)
        })
        res.VPNUsers.nb = nbVPNUser
      }
    }

    if (this.config.player.showPlayerInfo) {
      /** test TV **/
      this.player = res.playerInfo
      this.volume = res.playerVolume
      if (this.player && this.player.success && this.player.result && (this.player.result.power_state == "running") && this.player.result.foreground_app) {
        if (this.player.result.foreground_app.package == "fr.freebox.tv") {
          var channel = this.player.result.foreground_app.cur_url.split("channel=")[1]
          res.Player.channel = channel
          res.Player.power = true
          res.Player.logo = this.FreeboxTV[channel] ? "http://" + this.config.player.ServerIP + "/api/v8/tv/img/channels/logos68x60/" + this.FreeboxTV[channel] : "inconnu!"
          res.Player.channelName = this.FreeboxChannelTV[channel] ? this.FreeboxChannelTV[channel] : 0
          this.EPGSearch(this.FreeboxChannelTV[channel])
        }
      }
      else res.Player.power = false

      if (this.volume && this.volume.success && this.volume.result) {
        if (this.volume.result.mute) res.Player.mute = this.volume.result.mute
        if (this.volume.result.volume) res.Player.volume = this.volume.result.volume
      }
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
    delete res.EthCnx
    delete res.VPNUser
    delete res.playerInfo
    delete res.playerVolume

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

/** Freebox OS API CALL **/
  Freebox_OS: async function(token,clientRate, callLog, vpnUser) {
    var rate
    var output
    const freebox = new Freebox(token)
    await freebox.login()

    const clients = await freebox.request({
      method: "GET",
      url: "lan/browser/pub/"
    })

    const cnx = await freebox.request({
      method: "GET",
      url: "connection/"
    })

    if (callLog) {
      var calls = await freebox.request({
        method: "GET",
        url:"call/log/"
      })
    }

    if (clientRate) {
      var wifi2gCnx = await freebox.request({
        method: "GET",
        url:"wifi/ap/0/stations/"
      })

      var wifi5gCnx = await freebox.request({
        method: "GET",
        url:"wifi/ap/1/stations/"
      })

      var ethCnx = await freebox.request({
        method: "GET",
        url:"switch/status/"
      })

      var eth1 = await freebox.request({
        method: "GET",
        url:"switch/port/1/stats"
      })

      var eth2 = await freebox.request({
        method: "GET",
        url:"switch/port/2/stats"
      })

      var eth3 = await freebox.request({
        method: "GET",
        url:"switch/port/3/stats"
      })

      var eth4 = await freebox.request({
        method: "GET",
        url:"switch/port/4/stats"
      })
    }

    if (vpnUser) {
      var vpnUsers = await freebox.request({
        method: "GET",
        url:"vpn/connection/"
      })
    }

    var playerInfo = await freebox.request({
      method: "GET",
      url:"player/1/api/v8/status/"
    })

    var playerVolume = await freebox.request({
      method: "GET",
      url:"player/1/api/v8/control/volume"
    })

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
      Client: clients.data.result,
      Call: callLog ? calls.data.result: null,
      Wifi2g: clientRate ? wifi2gCnx.data.result : null,
      Wifi5g: clientRate ? wifi5gCnx.data.result : null,
      EthCnx: clientRate ? ethCnx.data.result : null,
      1: clientRate ? eth1.data.result : null,
      2: clientRate ? eth2.data.result : null,
      3: clientRate ? eth3.data.result : null,
      4: clientRate ? eth4.data.result : null,
      VPNUser: vpnUser ? vpnUsers.data.result: null,
      playerInfo: playerInfo ? playerInfo.data : null,
      playerVolume: playerVolume ? playerVolume.data : null
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
  },

  bouquetQuery: async function(token) {
    const freebox = new Freebox(token)
    await freebox.login()
    var data= {}

    const bouquets = await freebox.request({
      method: "GET",
      url: "tv/bouquets/"
    })
    data = bouquets.data
    await freebox.logout()

    if (data.success && data.result && data.result.length) {
      data.result.forEach((x) => {
        if (x.name == "Freebox TV") {
          this.bouquetID = x.id
          FB("Numéro du Bouquet Freebox trouvé:", this.bouquetID)
          this.ChannelLogo(this.config.token,this.bouquetID)
        }
      })
    }
    else console.log("[Freebox] Erreur Bouquet !?")
  },

  /** TV infos **/
  ChannelLogo: async function(token, bouquet) {
    const freebox = new Freebox(token)
    await freebox.login()
    var data= {}
    this.FreeboxTV = {}

    const channels = await freebox.request({
      method: "GET",
      url: `tv/bouquets/${bouquet}/channels`
    })
    data = channels.data
    await freebox.logout()
    if (data.success && data.result && data.result.length) {
      data.result.forEach((x) => {
        this.FreeboxTV[x.number] = x.uuid + ".png"
      })
    }

    /** Ajout de quelques logos manquant **/
    this.FreeboxTV["0"] = "uuid-webtv-234.png" // mosaïque
    this.FreeboxTV["46"] = "uuid-webtv-1098.png" // A la une Canal+
    this.FreeboxTV["106"] = "uuid-webtv-659.png" // canal+ Séries
    this.FreeboxTV["107"] = "uuid-webtv-947.png" // abctek
    this.FreeboxTV["108"] = "uuid-webtv-946.png" // disneytek
    this.FreeboxTV["130"] = "uuid-webtv-1319.png" // Netflix
    this.FreeboxTV["300"] = "uuid-webtv-427.png" // mosaïque France 3

    FB("LOGO- Nombre chaines trouvées:",Object.keys(this.FreeboxTV).length)
  },

  ChannelIdName: async function (token) {
    var CorrectChannelDBName = null
    try {
      CorrectChannelDBName = require("./correctChannelName.js").CorrectChannelDBName
    } catch (e) {
      console.log("[Freebox] erreur correctChannelName.js", e.message)
    }
    const freebox = new Freebox(token)
    await freebox.login()
    var data= {}
    var channel = await freebox.request({
      method: "GET",
      url:"tv/channels/"
    })
    data=  channel.data
    await freebox.logout()
    this.FreeboxChannelTV = {}

    if (Object.keys(data).length > 0) {
      for (let [item, value] of Object.entries(data.result)) {
        if (!value.name) console.log("[Freebox] hein!? la chaine n'as pas de nom !", item)
        else this.FreeboxChannelBDD[item +".png"] = value.name
      }
    }
    FB("FULL DB- Nombre de chaines trouvées:",Object.keys(this.FreeboxChannelBDD).length)
    if (Object.keys(this.FreeboxTV).length > 0) {
      for (let [item, value] of Object.entries(this.FreeboxTV)) {
        this.FreeboxChannelTV[item] = this.FreeboxChannelBDD[value]
      }
    }
    if (Object.keys(this.FreeboxChannelTV).length == 0) {
      console.log("[Freebox] BouquetDB- Aucune chaine trouvé... retry")
      this.ChannelIdName(this.config.token)
    }
    else {
      FB("BouquetDB- Nombre de chaines trouvées:", Object.keys(this.FreeboxChannelTV).length)
      /** synchronistaion des noms des chaines EPG avec FreeboxTV **/
      if (CorrectChannelDBName) {
        for (let [item, value] of Object.entries(this.EPG.tv.channel)) {
          for (let [EPG, FBTV] of Object.entries(CorrectChannelDBName)) {
            if (value["display-name"] == EPG) {
              FB("CorrectDB- " + EPG + " -> " + FBTV)
              value["display-name"] = FBTV
            }
          }
        }
        FB("CorrectDB- Nombre d'entrées EPG corrigées:", Object.keys(CorrectChannelDBName).length)
      }
    }
  },

  downloadEPG: async function() {
    var EPGFullURL = "https://xmltv.ch/xmltv/xmltv-complet.xml"
    var EPGDayURL = "https://xmltv.ch/xmltv/xmltv-complet_1jour.xml"
    var url = this.config.player.UseEPGDayURL ? EPGDayURL : EPGFullURL
    this.jsonData = null

    let download = wget.download(url, "./epg.xml", { });
    download.on('error', (err) => {
        console.log("Download EPG- error", err)
    })
    download.on('start', (fileSize) => {
        FB("Download EPG- URL: " + url + "- Taille:", this.convert(fileSize, null, 2))
    })
    download.on('end', (output) => {
        FB("Download EPG- Terminé !")
        this.xmlToJSON()
    })
  },

  xmlToJSON: function () {
    const xmlData = fs.readFileSync(`./epg.xml`, {
      encoding: "utf-8",
    })

    this.EPG = parser.parse(
      xmlData,
      {
        attrNodeName: "",
        textNodeName: "#text",
        attributeNamePrefix: "",
        arrayMode: "false",
        ignoreAttributes: false,
        parseAttributeValue: true,
      },
      true
    )
    FB("EPG- Créé !")
    this.ChannelIdName(this.config.token)
  },

  EPGSearch: function (name) {
    var output = {
      title: "Programme inconnu",
      start: 0,
      stop: 0,
      current: 0,
      photo: "unknow"
    }
    if (!name || !this.EPG) {
      FB("EPG- " + name + " *** no DB!")
      return this.sendSocketNotification("SEND_EPG", output)
    }

    var currentDate = moment().format("YYYYMMDDHHmmss")
    var channel = this.EPG.tv.channel
    var programme = this.EPG.tv.programme
    this.id = null
    var found = 0
    channel.forEach(element => {
        if (element["display-name"] == name) {
        this.id= element.id
      }
    })

    programme.forEach(prog => {
      if (prog.channel == this.id) {
        start = prog.start.split(' ')[0]
        stop = prog.stop.split(' ')[0]
        if (currentDate >= start && currentDate <= stop) {
          FB("EPG- " + name + " *** " + (prog.title ? prog.title : "no entry title !"))
          output.title= prog.title ? prog.title : "Programme inconnu"
          output.start= parseInt(start)
          output.stop= parseInt(stop)
          output.current= parseInt(currentDate)
          if (prog.icon && prog.icon.src) output.photo= prog.icon.src
          this.sendSocketNotification("SEND_EPG", output)
          found =1
        }
      }
    })
    if (!found) {
      FB("EPG- " + name + " *** no entry found !")
      this.sendSocketNotification("SEND_EPG", output)
    }
  },

  delayDownloadEPG: function () {
    this.downloadEPG()
    clearInterval(this.interval)
    this.interval = null
    this.interval = setTimeout(()=>{
      this.delayDownloadEPG()
    }, this.config.player.EPGDelay)
  }
});
