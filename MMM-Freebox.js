FB = (...arg) => { /* do nothing */ }

Module.register("MMM-Freebox", {

  defaults: {
    debug: false,
    verbose: false,
    updateDelay:  5 * 1000,
    zoom: 110,
    activeOnly: false,
    showIcon: true,
    showButton: true,
    showBandWidth: true,
    showRate: true,
    showClient: true,
    showClientRate: true,
    showEthClientRate: false,
    showClientIP: false,
    showClientCnxType: true,
    showFree: true,
    showIP: true,
    showPing: true,
    pingAdress: "google.fr",
    textWidth: 250,
    excludeMac: [],
    sortBy: null,
    checkFreePlug: false,
    checkSFP: false
  },

  start: function () {
    this.Init = false
    this.Freebox = {
      "Hidden": true,
      "Bandwidth": null,
      "Debit": null,
      "IP": null,
      "Degroup": false,
      "Type": null,
      "Clients": [],
      "Cache": {},
      "Ping": null
    }

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
      case "CACHE":
        this.cache(payload)
        break
      case "RESULT":
        this.result(payload)
        break
      case "debug":
        console.log(payload)
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
  },

  showFreebox: function() {
    this.Freebox.Hidden = false
    FB("Show module")
    this.show(1000, {lockString: "FREEBOX_LOCKED"})
  },

  result: function(payload) {
    this.Freebox.Model = payload.Model
    this.Freebox.Type = payload.Type
    this.Freebox.Degroup = payload.Degroup
    this.Freebox.Bandwidth = payload.Bandwidth
    this.Freebox.Debit = payload.Debit
    this.Freebox.IP = payload.IP
    this.Freebox.Clients = payload.Clients
    this.Freebox.Ping = payload.Ping
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
    bandWidthValue.textContent = this.Freebox.Type + (this.Freebox.Degroup ? ' (Dégroupé): ' : ': ') + this.Freebox.Bandwidth

    /** Adresse IP **/
    var IP = document.getElementById("FREE_IP")
    var IPIcon = IP.querySelector("#FREE_ICON")
    var IPDisplay = IP.querySelector("#FREE_VALUE")
    if (this.config.showIcon) IPIcon.classList.remove("hidden")
    if (this.config.showIP) IP.classList.remove("hidden")
    IPDisplay.textContent = this.Freebox.IP

    /** Appareils connecté je suppose qu'il y a en plus d'un en memoire! donc pas de check... **/
    this.Freebox.Clients.forEach(client => {
      var mac = client.mac
      var cache = this.Freebox.Cache[mac]
      var excludeMac = this.config.excludeMac

      var clientSelect = document.getElementsByClassName(mac)[0]
      /** Nouveau Client connecté -> rebuild du cache **/
      if (!clientSelect || (this.Freebox.Clients.length != Object.keys(this.Freebox.Cache).length)) {
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
        else if (client.access_type == "wifi2") clientAccess.className ="wifi2_"+ (client.signal_bar ? client.signal_bar : 0)
        else if (client.access_type == "wifi5") clientAccess.className ="wifi5_"+ (client.signal_bar ? client.signal_bar : 0)
        else if (client.access_type == "wifi6") clientAccess.className ="wifi6_"+ (client.signal_bar ? client.signal_bar : 0)
        else if (client.access_type == "wifi7") clientAccess.className ="wifi7_"+ (client.signal_bar ? client.signal_bar : 0)
        /* can't really code it ... but can be handled with eth5/eth6
        else if (client.access_type == "freeplug") clientAccess.className= "freeplug"
        else if (client.access_type == "sfp") clientAccess.className= "sfp"
        */
        else if (client.access_type == "VM") clientAccess.className= "VM"
        else clientAccess.className = "black"
        if (client.repeater) clientAccess.classList.add("repeater");
        else clientAccess.classList.remove("repeater");
      }

       /** debit client **/
      var clientDebit = clientSelect.querySelector("#FREE_RATE")
      if (this.config.showClientRate) clientDebit.classList.remove("hidden")
      clientDebit.textContent = client.debit

      /** bouton **/
      var clientStatus = clientSelect.querySelector("INPUT")
      var clientIcon = clientSelect.querySelector("#FREE_ICON")
      var clientBouton = clientSelect.querySelector(".switch")
      if (this.config.showButton) clientBouton.classList.remove("FBhidden")
      clientStatus.checked = client.active
      clientIcon.className= client.type + (client.active ? "1" : "0")
      if (this.config.showIcon) clientIcon.classList.remove("hidden")
      else clientIcon.classList.add("hidden")

      /** Exclude @mac **/
      if (cache.show && excludeMac.indexOf(mac) == "-1") {
        if (this.config.activeOnly && client.active) clientSelect.classList.remove("hidden")
        else if (!this.config.activeOnly) clientSelect.classList.remove("hidden")
      }

      /** activeOnly **/
      if (this.config.activeOnly && !client.active) clientSelect.classList.add("hidden")
    })

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

  },

  getDom: function () {
    var client = this.Freebox.Cache

    var wrapper = document.createElement("div")
    wrapper.id = "FREE"
    if (!this.Init) {
      wrapper.id = "FREE_LOADING"
      wrapper.innerHTML = this.translate("LOADING")
      var free = document.createElement("div")
      free.id = "FREE_LOGO"
      wrapper.appendChild(free)
    } else {
      wrapper.innerHTML = ""
      wrapper.style.zoom = `${this.config.zoom}%`;
      /** on prepare le DOM en cachant tout **/

      /** Afficage de la bande passante **/
      var bandWidth = document.createElement("div")
      bandWidth.id = "FREE_BAND"
      bandWidth.classList.add("hidden")

      var bandWidthIcon = document.createElement("div")
      bandWidthIcon.className = "internet"
      bandWidthIcon.classList.add("hidden")
      bandWidthIcon.id= "FREE_ICON"
      bandWidth.appendChild(bandWidthIcon)

      var bandWidthDisplay= document.createElement("div")
      bandWidthDisplay.id = "FREE_VALUE"
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
      IPText.textContent = "Adresse IP:"
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
          clientStatus.classList.add("FBhidden")

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
      debitIcon.className = "rate"
      debitIcon.classList.add("hidden")
      debit.appendChild(debitIcon)
      var debitText = document.createElement("div")
      debitText.id = "FREE_TEXT"
      debitText.textContent = "Débit total utilisé:"
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
      pingText.textContent = "Ping:"
      ping.appendChild(pingText)
      var pingDisplay= document.createElement("div")
      pingDisplay.id = "FREE_VALUE"

      ping.appendChild(pingDisplay)
      wrapper.appendChild(ping)
    }
    return wrapper
  },

/*****************************************/

  getScripts: function () {
    return [
      "moment.js"
    ]
  },

  getStyles: function() {
    return ["MMM-Freebox.css"]
  }
});
