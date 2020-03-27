FB = (...arg) => { /* do nothing */ }

Module.register("MMM-Freebox", {

  defaults: {
    updateDelay:  1 * 1000,
    debug: false,
    app_token: "",
    app_id: "",
    api_domain: "",
    https_port: 0,
    activeOnly: false,
    showIcon: true,
    showButton: true, 
    showSync: true, 
    showRate: true,
    showClient: true,
    showPlayer: false,
    showMissed: true,
    textWidth: "250px",
    excludeMac: [],
    sortBy: null
  },

  start: function () {
    this.config = this.configAssignment({}, this.defaults, this.config)
    this.Init = false
    this.update = null
    this.Freebox = {
      "Hidden": true,
      "Sync": null,
      "Debit": null,
      "State": null,
      "IP": null,
      "Clients": [],
      "Cache": {},
      "Calls" : [],
      "MissedCall": 0
    }
    if (this.config.debug) FB = (...arg) => { console.log("[Freebox]", ...arg) }
    if (this.config.excludeMac.length > 0) {
      /** normalise les adresses MAC en majuscule **/
      this.config.excludeMac = this.config.excludeMac.map(function(x){ return x.toUpperCase() })
    }
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
  
  result: function(payload) { // to do
    this.Freebox.Sync = payload.Sync
    this.Freebox.Debit = payload.Debit
    this.Freebox.State = payload.State
    this.Freebox.IP = payload.IP
    this.Freebox.Clients = payload.Clients
    this.Freebox.Calls = payload.Calls
    FB("Result:", this.Freebox)
    this.displayDom()
    if (this.Freebox.Hidden) this.showFreebox()
  },
  
  displayDom: function() {
    /** On applique les mises a jour en live ! **/

    /** Synchro **/
    var sync = document.getElementById("FREE_SYNC")
    var syncIcon = sync.querySelector("#FREE_ICON")
    var syncValue = sync.querySelector("#FREE_NAME")
    if (this.config.showIcon) syncIcon.classList.remove("hidden")
    if (this.config.showSync) sync.classList.remove("hidden")

    syncValue.textContent = "ADSL2+ Sync " + this.Freebox.Sync + " Mb/s"

    var syncBouton = sync.querySelector(".switch")
    if (this.config.showButton) syncBouton.classList.remove("hidden")

    var syncStatus = sync.querySelector("INPUT")
    syncStatus.checked = (this.Freebox.status == "up") ? "true" : "false"

    /** Appareils connecté **/
    if (Object.keys(this.Freebox.Clients).length > 0) {
      for (let [item, client] of Object.entries(this.Freebox.Clients)) {
        var mac = client.mac
        var cache = this.Freebox.Cache[mac]
        var excludeMac = this.config.excludeMac

        var selectClient = document.getElementsByClassName(mac)
        /** Nouveau Client connecté -> rebuild du cache **/
        if (!selectClient[0]) {
          clearInterval(this.update)
          this.update = null
          FB("Appareil inconnu [" + mac + "] - Rechargement du cache.")
          return this.sendSocketNotification("CACHE")
        }

        /** Le nom d'affichage a été changé **/
        var nameClient = selectClient[0].querySelector("#FREE_NAME")
        client.name = client.name ? client.name : "(Appareil sans nom)"
        if (cache.name != client.name) {
          this.Freebox.Cache[mac].name = client.name
          nameClient.textContent = cache.name
        }

        var statusClient = selectClient[0].querySelector("INPUT")
        var iconClient = selectClient[0].querySelector("#FREE_ICON")
        var statusBouton = selectClient[0].querySelector(".switch")
        if (this.config.showButton) statusBouton.classList.remove("hidden")
        statusClient.checked = client.active
        iconClient.className= client.type + (client.active ? "1" : "0")
        if (this.config.showIcon) iconClient.classList.remove("hidden")
        else iconClient.classList.add("hidden")

        if (cache.show) selectClient[0].classList.remove("hidden")
        if ((excludeMac.indexOf(mac) > -1) || (this.config.activeOnly && !client.active)) selectClient[0].classList.add("hidden")
      }
    }

    /** Affichage Débit utilisé en temps réél **/
    var debit = document.getElementById("FREE_DEBIT")
    var debitIcon = debit.querySelector("#FREE_ICON")
    var debitValue = debit.querySelector("#FREE_NAME")
    if (this.config.showIcon) debitIcon.classList.remove("hidden")
    if (this.config.showRate) debit.classList.remove("hidden")
    debitValue.textContent = "Débit Total utilisé " + this.Freebox.Debit + " Ko/s"

    /** Appels manqués **/

    /*
    if (this.Freebox.Calls.missed != this.Freebox.MissedCall) {
      clearInterval(this.update)
      this.update = null
      FB("Nouvel appel manqué - Rechargement du cache.")
      return this.sendSocketNotification("CACHE")
    }

    if (this.Freebox.Calls.missed > 0) {
      var call = document.getElementById("FREE_CALL")
      if (this.config.showMissed) call.classList.remove("hidden")
      var callIco = call.querySelector("#FREE_CALL_ICON")
      if (this.config.showIcon) callIco.classList.remove("hidden")
      var callMissed = call.querySelector("#FREE_CALL_MISSED")
      callMissed.textContent = this.Freebox.Calls.missed + ((this.Freebox.Calls.missed > 1) ? " appels manqués" : " appel manqué")

      for (let [nb, value] of Object.entries(this.Freebox.Calls.who)) {
        var whoMissed = document.getElementsByClassName("Missed_" + nb)
        if (this.config.showMissed) whoMissed.classList.remove("hidden")
        var whoName = whoMissed[0].querySelector("#FREE_CALLER_NAME")
        var whoDate = whoMissed[0].querySelector("#FREE_CALLER_DATE")
        whoName.textContent = value.name
        whoDate.textContent = moment(value.date, "X").format("ddd DD MMM à HH:mm") + " :"
      }
    }
    */
  },

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

  getDom: function () {
    var client = this.Freebox.Cache

    var wrapper = document.createElement("div")

    if (!this.Init) {
      wrapper.id = "FREE_LOADING"
      wrapper.style.width= this.config.textWidth
      wrapper.innerHTML = this.translate("LOADING")
      var free = document.createElement("div")
      free.id = "FREE_LOGO"
      wrapper.appendChild(free)
    } else {
      wrapper.innerHTML = ""
      /** on prepare le DOM en cachant tout **/

      /** Afficage Synchro **/
      var sync = document.createElement("div")
      sync.id = "FREE_SYNC"
      sync.classList.add("hidden")
      
      var syncIco = document.createElement("div")
      syncIco.classList.add("hidden")
      syncIco.id= "FREE_ICON"
      sync.appendChild(syncIco)
      
      var syncDisplay= document.createElement("div")
      syncDisplay.id = "FREE_NAME"
      syncDisplay.style.width= this.config.textWidth
      syncDisplay.textContent = "ADSL2+ Sync"
      sync.appendChild(syncDisplay)

      var syncStatus= document.createElement("div")
      syncStatus.className= "switch"
      syncStatus.classList.add("hidden")

      var syncButton = document.createElement("INPUT")
      syncButton.id = "switched"
      syncButton.type = "checkbox"
      syncButton.className = "switch-toggle switch-round";
      syncButton.checked = false
      syncButton.disabled = true
      var syncLabelButton = document.createElement('label')
      syncLabelButton.htmlFor = "swithed"
      syncStatus.appendChild(syncButton)
      syncStatus.appendChild(syncLabelButton)

      sync.appendChild(syncStatus)
      wrapper.appendChild(sync)

      /** appareils connecté **/
      if (Object.keys(client).length > 0) {
        for (let [item, value] of Object.entries(client)) {
          var id = item
          var type = value.type
          var setName = value.name

          var Client = document.createElement("div")
          Client.id= "FREE_CLIENT"
          Client.className= id
          Client.classList.add("hidden")

          var icoClient = document.createElement("div")
          icoClient.id= "FREE_ICON"
          icoClient.className= type + "0"
          icoClient.classList.add("hidden")
          Client.appendChild(icoClient)
  
          var nameClient = document.createElement("div")
          nameClient.id = "FREE_NAME"
          nameClient.style.width= this.config.textWidth
          nameClient.textContent = setName
          Client.appendChild(nameClient)

          var StatusClient = document.createElement("div")
          StatusClient.className = "switch"
          StatusClient.classList.add("hidden")

          var button = document.createElement("INPUT")
          button.id = "switched"
          button.type = "checkbox"
          button.className = "switch-toggle switch-round";
          button.checked = false
          button.disabled = true

          var label = document.createElement('label')
          label.htmlFor = "swithed"
  
          StatusClient.appendChild(button)
          StatusClient.appendChild(label)

          Client.appendChild(StatusClient)
  
          wrapper.appendChild(Client)
        }
      }

      /** debit utilisé **/
      var debit = document.createElement("div")
      debit.id = "FREE_DEBIT"
      debit.classList.add("hidden")
      var debitIco = document.createElement("div")
      debitIco.classList.add("hidden")
      debitIco.id= "FREE_ICON"
      debit.appendChild(debitIco)
      var debitDisplay= document.createElement("div")
      debitDisplay.id = "FREE_NAME"
      debitDisplay.style.width= this.config.textWidth
      debitDisplay.textContent = "Débit Total utilisé 0/0 Ko/s"
      debit.appendChild(debitDisplay)
  
      wrapper.appendChild(debit)

      /** Appels Manqués **/
      var call = document.createElement("div")
      call.id = "FREE_CALL"
      call.classList.add("hidden")
      var callIco = document.createElement("div")
      callIco.classList.add("hidden")
      callIco.id = "FREE_CALL_ICON"
      call.appendChild(callIco)
      var callMissed = document.createElement("div")
      callMissed.id = "FREE_CALL_MISSED"
      call.appendChild(callMissed)

      wrapper.appendChild(call)

      if (this.Freebox.MissedCall > 0) {
        for (var x =0;x < this.Freebox.MissedCall; x++) {
          var who = document.createElement("div")
          who.id = "FREE_WHO"
          who.classList.add("Missed_"+ x)
          var whoIcon = document.createElement("div")
          whoIcon.id = "FREE_CALLER_ICON"
          who.appendChild(whoIcon)
          var whoDate = document.createElement("div")
          whoDate.id = "FREE_CALLER_DATE"
          who.appendChild(whoDate)
          var whoName = document.createElement("div")
          whoName.id = "FREE_CALLER_NAME"
          who.appendChild(whoName)
          wrapper.appendChild(who)
        }
      }
    }
    return wrapper
	},

/*****************************************/

  getScripts: function () {
    return ["moment.js"];
  },

  getStyles: function() {
    return ["MMM-Freebox.css"]
  },

  configAssignment : function (result) {
    var stack = Array.prototype.slice.call(arguments, 1)
    var item
    var key
    while (stack.length) {
      item = stack.shift()
      for (key in item) {
        if (item.hasOwnProperty(key)) {
          if (typeof result[key] === "object" && result[key] && Object.prototype.toString.call(result[key]) !== "[object Array]") {
            if (typeof item[key] === "object" && item[key] !== null) {
              result[key] = this.configAssignment({}, result[key], item[key])
            } else result[key] = item[key]
          } else result[key] = item[key]
        }
      }
    }
    return result
  }
});
