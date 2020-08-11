FB = (...arg) => { /* do nothing */ }

Module.register("MMM-Freebox", {

  defaults: {
    updateDelay:  5 * 1000,
    token: "",
    activeOnly: false,
    showIcon: true,
    showButton: true,
    showBandWidth: true,
    showRate: true,
    showClient: true,
    showClientRate: true,
    showClientIP: false,
    showClientCnxType: true,
    showFreePlayer: true,
    showMissedCall: true,
    showVPNUsers: true,
    maxMissed: 3,
    showIP: true,
    showPing: true,
    pingAdress: "google.fr",
    textWidth: 250,
    excludeMac: [],
    sortBy: null,
    debug: false,
    verbose: false,
    dev: false,
    debitText: "Débit total utilisé : ",
    player : {
      showPlayerInfo: false,
      // depuis le firmware 4.2.3, problemes d'affichage des logos
      // essayez avec les ips :  "192.168.0.254" (l'ip du freebox server)
      //                         "mafreebox.free.fr" ou le resultat de l'ip de mafreebox.free.fr
      //                         "212.27.38.253" l'ip de mafreebox.free.fr (a voir si cela fonctionne pour vous)
      ServerIP: "212.27.38.253",
      UseEPGDayURL: true,
      EPGDelay: 2* 60 *60 *1000
    }
  },

  start: function () {
    this.config = configMerge({}, this.defaults, this.config)
    this.Init = false
    this.update = null
    this.Freebox = {
      "Hidden": true,
      "Bandwidth": null,
      "Debit": null,
      "IP": null,
      "Degroup": false,
      "Type": null,
      "Clients": [],
      "Cache": {},
      "Calls" : [],
      "MissedCall": 0,
      "Ping": null,
      "VPNUsers": [],
      "nbVPNUser": 0,
      "Player": {}
    }
    this.EPG = "Programme inconnu"

    this.maxMissedCall = 0
    if (this.config.debug) FB = (...arg) => { console.log("[Freebox]", ...arg) }
    if (this.config.excludeMac.length > 0) {
      /** normalise les adresses MAC en majuscule **/
      this.config.excludeMac = this.config.excludeMac.map(function(x){ return x.toUpperCase() })
    }
    if (this.config.textWidth < 200) this.config.textWidth = 200
    if (typeof this.config.textWidth != 'number') this.config.textWidth = this.defaults.textWidth
    console.log("[Freebox] Started...")
  },

  notificationReceived: function (notification, payload) {
    switch(notification) {
      case "DOM_OBJECTS_CREATED":
        this.sendSocketNotification("INIT", this.config)
        break
    }
  },

  socketNotificationReceived: function (notification, payload) {
    switch (notification) {
      case "INITIALIZED":
        this.Init = true
        this.cache(payload)
        break
      case "MISSED_CALL":
        this.Freebox.MissedCall = payload
        break
      case "CACHE":
        this.cache(payload)
        break
      case "RESULT":
        this.result(payload)
        break
      case "NB_VPN_USER":
        this.Freebox.nbVPNUser = payload
        break
      case "SEND_EPG":
        this.EPG = payload
        //console.log("[Freebox] " + payload)
        break
    }
  },

  cache: function(payload) {
    this.Freebox.Cache = payload
    FB("Cache:", this.Freebox)
    this.hideFreebox()
  },

  hideFreebox: function() {
    this.Freebox.Hidden = true
    this.hide(1000, this.callbackHide(), {lockString: "FREEBOX_LOCKED"})
    FB("Hide module")
  },

  callbackHide: function () {
    this.updateDom()
    this.sendSocketNotification("SCAN")
    this.ScanClient()
  },

  showFreebox: function() {
    this.Freebox.Hidden = false
    FB("Show module")
    this.show(1000, {lockString: "FREEBOX_LOCKED"})
  },
  
  result: function(payload) {
    this.Freebox.Type = payload.Type
    this.Freebox.Degroup = payload.Degroup
    this.Freebox.Bandwidth = payload.Bandwidth
    this.Freebox.Debit = payload.Debit
    this.Freebox.IP = payload.IP
    this.Freebox.Clients = payload.Clients
    this.Freebox.Calls = payload.Calls
    this.Freebox.VPNUsers = payload.VPNUsers
    this.Freebox.Ping = payload.Ping
    this.Freebox.Player = payload.Player
    this.Freebox.Player.program = this.EPG
    FB("Result:", this.Freebox)
    this.displayDom()
    if (this.Freebox.Hidden) this.showFreebox()
  },

  displayDom: function() {
    /** On applique les mises a jour en live ! **/

    /** Bande Passante **/
    var bandWidth = document.getElementById("FREE_BAND")
    var bandWidthIcon = bandWidth.querySelector("#FREE_ICON")

    var bandWidthValue = bandWidth.querySelector("#FREE_VALUE")
    if (this.config.showIcon) bandWidthIcon.classList.remove("hidden")
    if (this.config.showBandWidth) bandWidth.classList.remove("hidden")
    bandWidthValue.textContent = this.Freebox.Type + (this.Freebox.Degroup ? ' (Dégroupé): ' : ':') + this.Freebox.Bandwidth
    

    /** Adresse IP **/
    var IP = document.getElementById("FREE_IP")
    var IPIcon = IP.querySelector("#FREE_ICON")
    var IPDisplay = IP.querySelector("#FREE_VALUE")
    if (this.config.showIcon) IPIcon.classList.remove("hidden")
    if (this.config.showIP) IP.classList.remove("hidden")
    IPDisplay.textContent = this.Freebox.IP

    /** Appareils connecté **/
    if (Object.keys(this.Freebox.Clients).length > 0) {
      for (let [item, client] of Object.entries(this.Freebox.Clients)) {
        var mac = client.mac
        var cache = this.Freebox.Cache[mac]
        var excludeMac = this.config.excludeMac

        var clientSelect = document.getElementsByClassName(mac)[0]
        /** Nouveau Client connecté -> rebuild du cache **/
        if (!clientSelect) {
          clearInterval(this.update)
          this.update = null
          FB("Appareil inconnu [" + mac + "] - Rechargement du cache.")
          return this.sendSocketNotification("CACHE")
        }

        /** Le nom d'affichage a été changé **/
        var clientName = clientSelect.querySelector("#FREE_NAME")
        client.name = client.name ? client.name : "(Appareil sans nom)"
        if (cache.name != client.name) {
          this.Freebox.Cache[mac].name = client.name
          clientName.textContent = cache.name
        }

        if (this.config.showClientIP) {
          /** Affichage IP **/
          var clientIP = clientSelect.querySelector("#FREE_CLIENTIP")
          clientIP.textContent = client.ip ? client.ip : ""
        }

        /** Wifi ou Eth ? **/
        var clientAccess = clientSelect.querySelector("#FREE_ACCESS")
        if (this.config.showClientCnxType) {
          clientAccess.classList.remove("hidden")
          if (client.access_type == "ethernet") clientAccess.className= "ethernet"+ client.eth
          else if (client.access_type == "wifi2") {
            clientAccess.className ="wifi2_"+ (client.signal_bar ? client.signal_bar : 0)
          }
          else if (client.access_type == "wifi5") {
            clientAccess.className ="wifi5_"+ (client.signal_bar ? client.signal_bar : 0)
          }
          else clientAccess.className = "black"
        }

         /** debit client **/
        var clientDebit = clientSelect.querySelector("#FREE_RATE")
        if (this.config.showClientRate) clientDebit.classList.remove("hidden")
        clientDebit.textContent = client.debit ? client.debit : ""

        /** bouton **/
        var clientStatus = clientSelect.querySelector("INPUT")
        var clientIcon = clientSelect.querySelector("#FREE_ICON")
        var clientBouton = clientSelect.querySelector(".switch")
        if (this.config.showButton) clientBouton.classList.remove("hidden")
        clientStatus.checked = client.active
        clientIcon.className= client.type + (client.active ? "1" : "0")
        if (this.config.showIcon) clientIcon.classList.remove("hidden")
        else clientIcon.classList.add("hidden")

        /** Eclude @mac **/
        if (cache.show && excludeMac.indexOf(mac) == "-1") {
          if (this.config.activeOnly && client.active) clientSelect.classList.remove("hidden")
          else if (!this.config.activeOnly) clientSelect.classList.remove("hidden")
        }

        /** activeOnly **/
        if (this.config.activeOnly && !client.active) clientSelect.classList.add("hidden")
      }
    }

    /** Affichage Débit utilisé en temps réél **/
    var debit = document.getElementById("FREE_DEBIT")
    var debitIcon = debit.querySelector("#FREE_ICON")
    var debitValue = debit.querySelector("#FREE_VALUE")
    if (this.config.showIcon) debitIcon.classList.remove("hidden")
    if (this.config.showRate) debit.classList.remove("hidden")
    debitValue.textContent = this.Freebox.Debit

    /** Affichage Ping en temps réél **/
    var ping = document.getElementById("FREE_PING")
    var pingIcon = ping.querySelector("#FREE_ICON")
    var pingValue = ping.querySelector("#FREE_VALUE")
    if (this.config.showIcon) pingIcon.classList.remove("hidden")
    if (this.config.showPing) ping.classList.remove("hidden")
    pingValue.textContent = this.Freebox.Ping

    /** Appels manqués **/
    if (this.Freebox.Calls.missed != this.Freebox.MissedCall) {
      clearInterval(this.update)
      this.update = null
      FB("Nouvel appel manqué - Rechargement du cache.")
      return this.sendSocketNotification("CACHE")
    }

    if (this.Freebox.Calls.missed > 0) {
      var call = document.getElementById("FREE_CALL")
      if (this.config.showMissedCall) call.classList.remove("hidden")
      var callIco = call.querySelector("#FREE_ICON")
      if (this.config.showIcon) callIco.classList.remove("hidden")
      var callMissed = call.querySelector("#FREE_MISSED")
      callMissed.textContent = this.Freebox.Calls.missed + ((this.Freebox.Calls.missed > 1) ? " appels manqués" : " appel manqué")

      for (let [nb, value] of Object.entries(this.Freebox.Calls.who)) {
        if (nb >= this.maxMissedCall) break
        var whoMissed = document.getElementsByClassName("Missed_" + nb)
        if (this.config.showMissedCall) whoMissed[0].classList.remove("hidden")
        var whoIcon = whoMissed[0].querySelector("#FREE_ICON")
        var whoName = whoMissed[0].querySelector("#FREE_CALLER")
        var whoDate = whoMissed[0].querySelector("#FREE_TEXT")
        if (this.config.showIcon) whoIcon.classList.remove("hidden")
        whoName.textContent = value.name
        whoDate.textContent = moment(value.date, "X").format("ddd DD MMM à HH:mm") + " :"
      }
    }

    /** Utilisateurs VPN **/
    if (this.Freebox.VPNUsers.nb != this.Freebox.nbVPNUser) {
      clearInterval(this.update)
      this.update = null
      FB("Connection/Deco VPN - Rechargement du cache.")
      return this.sendSocketNotification("CACHE")
    }

    if  (this.Freebox.VPNUsers.nb > 0) {
      for (let [nb, value] of Object.entries(this.Freebox.VPNUsers.who)) {
        var vpnUser = document.getElementsByClassName("VPNUSER_" + nb)
        if (this.config.showVPNUsers) vpnUser[0].classList.remove("hidden")
        var vpnLogin = vpnUser[0].querySelector("#FREE_VPNLOGIN")
        var vpnType  = vpnUser[0].querySelector("#FREE_VPNTYPE")
        var vpnRXTX  = vpnUser[0].querySelector("#FREE_VPNRXTX")
        var vpnDate  = vpnUser[0].querySelector("#FREE_VPNDATE")
        vpnLogin.innerHTML = value.user 
        vpnType.innerHTML = value.vpn +"<br/>(" + value.src_ip +")"
        vpnRXTX.innerHTML = value.rx_bytes+ " &#8659<br/>" + value.tx_bytes + " &#8657"
        vpnDate.innerHTML = moment(value.date, "X").format("ddd DD MMM<br/>HH:mm")
      }
    }

    /** TV **/
    if (this.config.player.showPlayerInfo) {
      var TV = document.getElementById("FREE_TV")
      var TVLogo = document.getElementById("FREE_CHANNEL")
      if (this.Freebox.Player.logo && this.Freebox.Player.power) {
        TV.classList.remove("hidden")
        if (this.Freebox.Player.logo == "inconnu!") TVLogo.src = "/modules/MMM-Freebox/resources/tv1.png"
        else TVLogo.src = this.Freebox.Player.logo
        var TVPhoto= document.getElementById("FREE_PHOTO")
        if (this.Freebox.Player.program.photo == "unknow") TVPhoto.src= "/modules/MMM-Freebox/resources/unknow.jpg"
        else TVPhoto.src= this.Freebox.Player.program.photo
        var TVProgram = document.getElementById("FREE_PROGRAM")
        var TVProgress = document.getElementById("FREE_PROGRESS")
        var TVProgressStart = document.getElementById("FREE_PROGRESS_START")
        var TVProgressEnd = document.getElementById("FREE_PROGRESS_END")
        if (this.Freebox.Player.program.title == "Programme inconnu") {
          TVProgram.classList.add("hidden")
          TVProgress.classList.add("hidden")
          TVProgressStart.classList.add("hidden")
          TVProgressEnd.classList.add("hidden")
        }
        else {
          TVProgram.innerHTML = this.Freebox.Player.program.title
          /** putain de formule de merde ! **/
          TVProgress.value= this.Freebox.Player.program.current ? ((((this.Freebox.Player.program.current - this.Freebox.Player.program.start) / (this.Freebox.Player.program.stop-this.Freebox.Player.program.start)) * 100)) : 100
          var startStr = this.Freebox.Player.program.start.toString().substring(8, 12)
          var endStr = this.Freebox.Player.program.stop.toString().substring(8, 12)
          if (startStr) {
            var startHour= startStr.substring(0,2)
            var startMin= startStr.substring(2)
            var startTime= startHour+"h"+startMin
            TVProgressStart.textContent = startTime
          }
          else TVProgressStart.textContent = "00h00"
          if (endStr) {
            var endHour= endStr.substring(0,2)
            var endMin= endStr.substring(2)
            var endTime= endHour+"h"+endMin
            TVProgressEnd.textContent = endTime
          }
          else TVProgressEnd.textContent = "00h00"
          TVProgram.classList.remove("hidden")
          TVProgress.classList.remove("hidden")
          TVProgressStart.classList.remove("hidden")
          TVProgressEnd.classList.remove("hidden")
        }
      }
      else TV.classList.add("hidden")
      var TVVolume = document.getElementById("FREE_VOLUME")
      if (this.Freebox.Player.mute) TVVolume.src = "/modules/MMM-Freebox/resources/volmute.png"
      else {
        if (this.Freebox.Player.volume && this.Freebox.Player.volume !=100) {
          var volume = ((this.Freebox.Player.volume * 5) / 100).toFixed(0)
          TVVolume.src = "/modules/MMM-Freebox/resources/vol"+volume+".png"
        }
        else {
          if (this.Freebox.Player.volume ==100) TVVolume.src = "/modules/MMM-Freebox/resources/volmax.png"
          else if (!this.Freebox.Player.mute) TVVolume.src = "/modules/MMM-Freebox/resources/vol0.png"
        }
      }
    }
  },

  /** scan main loop **/
  ScanClient: function () {
    clearInterval(this.update)
    this.update = null
    this.counterUpdate = this.config.updateDelay

    this.update = setInterval( ()=> {
      this.counterUpdate -= 1000
      if (this.counterUpdate <= 0) {
        clearInterval(this.update)
        this.update = null
        this.sendSocketNotification("SCAN")
        this.ScanClient()
      }
    }, 1000);
  },

  /** ne scan pas si le module est suspendu **/
  suspend: function() {
    clearInterval(this.update)
    this.update = null
    console.log("MMM-Freebox is suspended.")
  },

  /** reprend le scan si le module est actif **/
  resume: function() {
    this.ScanClient()
    console.log("MMM-Freebox is resumed.")
  },

  getDom: function () {
    var client = this.Freebox.Cache

    var wrapper = document.createElement("div")

    if (!this.Init) {
      wrapper.id = "FREE_LOADING"
      wrapper.style.width= this.config.textWidth+"px"
      wrapper.innerHTML = this.translate("LOADING")
      var free = document.createElement("div")
      free.id = "FREE_LOGO"
      wrapper.appendChild(free)
    } else {
      wrapper.innerHTML = ""
      /** on prepare le DOM en cachant tout **/

      /** Afficage de la bande passante **/
      var bandWidth = document.createElement("div")
      bandWidth.id = "FREE_BAND"
      //bandWidth.style.width = (this.config.textWidth + 60) + "px"
      bandWidth.classList.add("hidden")

      var bandWidthIcon = document.createElement("div")
      bandWidthIcon.className = "bandwidth"
      bandWidthIcon.classList.add("hidden")
      bandWidthIcon.id= "FREE_ICON"
      bandWidth.appendChild(bandWidthIcon)

      var bandWidthDisplay= document.createElement("div")
      bandWidthDisplay.id = "FREE_VALUE"
      //bandWidthDisplay.style.width= this.config.textWidth + "px"
      bandWidth.appendChild(bandWidthDisplay)

      wrapper.appendChild(bandWidth)

      /** Adresse IP **/
      var IP = document.createElement("div")
      IP.id = "FREE_IP"
      IP.classList.add("hidden")
      var IPIcon = document.createElement("div")
      IPIcon.id= "FREE_ICON"
      IPIcon.className = "ip"
      IPIcon.classList.add("hidden")
      IP.appendChild(IPIcon)
      var IPText = document.createElement("div")
      IPText.id = "FREE_TEXT"
      IPText.textContent = "Adresse IP :"
      IP.appendChild(IPText)
      var IPDisplay= document.createElement("div")
      IPDisplay.id = "FREE_VALUE"

      IP.appendChild(IPDisplay)
      wrapper.appendChild(IP)

      /** appareils connecté **/
      if (Object.keys(client).length > 0) {
        for (let [item, value] of Object.entries(client)) {
          var id = item
          var type = value.type
          var setName = value.name

          var client = document.createElement("div")
          client.id= "FREE_CLIENT"
          client.className= id
          client.classList.add("hidden")

          var clientIcon = document.createElement("div")
          clientIcon.id= "FREE_ICON"
          clientIcon.className= type + "0"
          clientIcon.classList.add("hidden")
          client.appendChild(clientIcon)
  
          var clientName = document.createElement("div")
          clientName.id = "FREE_NAME"
          clientName.style.width= this.config.showClientIP ? this.config.textWidth-80 + "px" : this.config.textWidth + "px"
          clientName.textContent = setName
          client.appendChild(clientName)

          if (this.config.showClientIP) {
            var clientIP = document.createElement("div")
            clientIP.id= "FREE_CLIENTIP"
            client.appendChild(clientIP)
          }

          var clientCnxType= document.createElement("div")
          clientCnxType.id = "FREE_ACCESS"
          clientCnxType.className= "black"
          clientCnxType.classList.add("hidden")
          client.appendChild(clientCnxType)

          var clientDebit = document.createElement("div")
          clientDebit.id ="FREE_RATE"
          clientDebit.textContent = "-"
          clientDebit.classList.add("hidden")
          client.appendChild(clientDebit)

          var clientStatus = document.createElement("div")
          clientStatus.className = "switch"
          clientStatus.classList.add("hidden")

          var clientButton = document.createElement("INPUT")
          clientButton.id = "switched"
          clientButton.type = "checkbox"
          clientButton.className = "switch-toggle switch-round";
          clientButton.checked = false
          clientButton.disabled = true

          var clientLabel = document.createElement('label')
          clientLabel.htmlFor = "swithed"
  
          clientStatus.appendChild(clientButton)
          clientStatus.appendChild(clientLabel)

          client.appendChild(clientStatus)
  
          wrapper.appendChild(client)
        }
      }

      /** debit utilisé **/
      var debit = document.createElement("div")
      debit.id = "FREE_DEBIT"
      debit.classList.add("hidden")
      var debitIcon = document.createElement("div")
      debitIcon.id= "FREE_ICON"
      debitIcon.className = "bandwidth"
      debitIcon.classList.add("hidden")
      debit.appendChild(debitIcon)
      var debitText = document.createElement("div")
      debitText.id = "FREE_TEXT"
      debitText.textContent = this.config.debitText 
      debit.appendChild(debitText)
      var debitDisplay= document.createElement("div")
      debitDisplay.id = "FREE_VALUE"

      debit.appendChild(debitDisplay)
      wrapper.appendChild(debit)

      /** ping **/
      var ping = document.createElement("div")
      ping.id = "FREE_PING"
      ping.classList.add("hidden")
      var pingIcon = document.createElement("div")
      pingIcon.id= "FREE_ICON"
      pingIcon.className = "ping"
      pingIcon.classList.add("hidden")
      ping.appendChild(pingIcon)
      var pingText = document.createElement("div")
      pingText.id = "FREE_TEXT"
      pingText.textContent = "Ping :"
      ping.appendChild(pingText)
      var pingDisplay= document.createElement("div")
      pingDisplay.id = "FREE_VALUE"

      ping.appendChild(pingDisplay)
      wrapper.appendChild(ping)

      /** Appels Manqués **/
      var call = document.createElement("div")
      call.id = "FREE_CALL"
      call.classList.add("hidden")
      var callIcon = document.createElement("div")
      callIcon.id = "FREE_ICON"
      callIcon.className = "missing"
      callIcon.classList.add("hidden")
      call.appendChild(callIcon)
      var callMissed = document.createElement("div")
      callMissed.id = "FREE_MISSED"
      call.appendChild(callMissed)

      wrapper.appendChild(call)

      if (this.Freebox.MissedCall > 0) {
        if (this.Freebox.MissedCall > this.config.maxMissed) {
          this.maxMissedCall = this.config.maxMissed
        }
        else this.maxMissedCall = this.Freebox.MissedCall

        for (var x =0;x < this.maxMissedCall; x++) {
          var who = document.createElement("div")
          who.id = "FREE_WHO"
          who.className= "Missed_"+ x
          who.classList.add("hidden")
          var whoIcon = document.createElement("div")
          whoIcon.id = "FREE_ICON"
          whoIcon.className = "missed"
          whoIcon.classList.add("hidden")
          who.appendChild(whoIcon)
          var whoDate = document.createElement("div")
          whoDate.id = "FREE_TEXT"
          who.appendChild(whoDate)
          var whoName = document.createElement("div")
          whoName.id = "FREE_CALLER"
          who.appendChild(whoName)
          wrapper.appendChild(who)
        }
      }

      /** Utilisateurs VPN **/
      if (this.Freebox.nbVPNUser > 0) {
        var table = document.createElement("div")
        table.id = "FREE_VPN"
        wrapper.appendChild(table)

        for (var x = 0 ; x < this.Freebox.nbVPNUser; x++) {
         var vpnUser = document.createElement("div")
          vpnUser.id = "FREE_VPNUSER"
          vpnUser.className= "VPNUSER_"+ x
          vpnUser.classList.add("hidden")
          table.appendChild(vpnUser)

          var vpnLogin = document.createElement("div")
          vpnLogin.id = "FREE_VPNLOGIN"
          vpnUser.appendChild(vpnLogin)

          var vpnType = document.createElement("div")
          vpnType.id = "FREE_VPNTYPE"
          vpnUser.appendChild(vpnType)

          var vpnRxTx = document.createElement("div")
          vpnRxTx.id = "FREE_VPNRXTX"
          vpnUser.appendChild(vpnRxTx)

          var vpnDate = document.createElement("div")
          vpnDate.id = "FREE_VPNDATE"
          vpnUser.appendChild(vpnDate)
        }
      }

      /** TV info **/
      if (this.config.player.showPlayerInfo) {
        var TV = document.createElement("div")
        TV.id = "FREE_TV"
        TV.classList.add("hidden")
        var Contener = document.createElement("div")
        Contener.id = "FREE_CONTENER"
        var TVLogo = document.createElement("img")
        TVLogo.id= "FREE_CHANNEL"
        TVLogo.className = "tv"
        Contener.appendChild(TVLogo)
        var TVPhoto= document.createElement("img")
        TVPhoto.id = "FREE_PHOTO"
        TVPhoto.className = "photo"
        Contener.appendChild(TVPhoto)
        var TVVolume = document.createElement("img")
        TVVolume.id = "FREE_VOLUME"
        TVVolume.className = "volume"
        Contener.appendChild(TVVolume)
        TV.appendChild(Contener)
        var TVProgram = document.createElement("div")
        TVProgram.id = "FREE_PROGRAM"
        TV.appendChild(TVProgram)
        var TVProgressContener = document.createElement("div")
        TVProgressContener.id = "FREE_PROGRESS_CONTENER"
        var TVProgressStart = document.createElement("div")
        TVProgressStart.id = "FREE_PROGRESS_START"
        TVProgressContener.appendChild(TVProgressStart)
        var TVProgress = document.createElement("meter")
        TVProgress.id = "FREE_PROGRESS"
        TVProgress.className="meter"
        TVProgress.min= 0
        TVProgress.max= 100
        TVProgressContener.appendChild(TVProgress)
        var TVProgressEnd = document.createElement("div")
        TVProgressEnd.id = "FREE_PROGRESS_END"
        TVProgressContener.appendChild(TVProgressEnd)
        TV.appendChild(TVProgressContener)
        wrapper.appendChild(TV)
      }
    }
    return wrapper
  },

/*****************************************/

  getScripts: function () {
    return [
      "moment.js",
      "configMerge.min.js"
    ]
  },

  getStyles: function() {
    return ["MMM-Freebox.css"]
  }
});
