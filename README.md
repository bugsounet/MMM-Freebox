# MMM-Freebox

MMM-Freebox est un module pour le projet [MagicMirror²](https://github.com/MagicMirrorOrg/MagicMirror)

Il permet d'afficher, sur votre Mirroir, divers informations de votre [Freebox](https://www.free.fr/freebox/) en temps réél.

Plusieurs modules sont disponibles et permet l'affichage suivant:

 * Model de la Freebox.
 * Bande Passante.
 * Adresse IP.
 * Appareils connectés.
 * Débit utilisé (total et/ou par appareil).
 * Ping de votre mirroir vers google.fr (ou autre)
 * Type de connexion utilisé par les appareils. (ethernet, wifi, machine virtuelle)

## Screenshot
![](https://raw.githubusercontent.com/bugsounet/MMM-Freebox/dev/screenshot.png)

## Installation

 * Clonez le module dans le dossier module:
```sh
cd ~/MagicMirror/modules
git clone https://github.com/bugsounet/MMM-Freebox
cd MMM-Freebox
npm install
```
  * Associer `MMM-Freebox` à votre Freebox Server.

```sh
cd ~/MagicMirror/modules/MMM-Freebox
npm run register

Merci de vérifier votre écran LCD de votre Freebox Server et autoriser l'enregistrement de l'application.
```
  * Validez l'association par la flèche de droite de l'écran LCD de votre Freebox Server.
  
  * Sauvegarder précieusement l'information de connexion.

```js
    freebox: {
      app_token: 'xxxxxxxxxxxxxxxxxxxxxxxxx',
      app_id: 'fbx.MMM-Freebox',
      api_domain: 'xxxxx.fbxos.fr',
      https_port: xxxx,
      api_base_url: '/api/',
      api_version: 'xxx.x'
    },
```
### **Attention:** Les informations fournies par la Freebox sont à considérer comme des identifiants!
### Ne JAMAIS les divulguer car cela permet d'avoir un accès à votre freebox à distance!

## Configuration
Pour afficher le module, inserez ceci dans votre ficher `config.js`

### Configuration Minimale

Remplacer le contenu de `freebox` par les valeurs de connexion fourni par votre Freebox Server.
```js
{
  module: "MMM-Freebox",
  position: "top_left",
  animateIn: "fadeInLeft",
  animateOut: "fadeOutLeft",
  config: {
    freebox: { // inserez vos informations de connexion
      app_token: 'xxxxxxxxxxxxxxxxxxxxxxxxx',
      app_id: 'fbx.MMM-Freebox',
      api_domain: 'xxxxx.fbxos.fr',
      https_port: xxxx,
      api_base_url: '/api/',
      api_version: 'xxx.x'
    },
  }
},
```

### Configuration Personalisée
Ceci est la configuration par defaut si vous definissez aucune valeurs

```js
{
  module: 'MMM-Freebox',
  position: 'top_left',
  animateIn: "fadeInLeft",
  animateOut: "fadeOutLeft",
  config: {
    freebox: { // inserez vos informations de connexion
      app_token: 'xxxxxxxxxxxxxxxxxxxxxxxxx',
      app_id: 'fbx.MMM-Freebox',
      api_domain: 'xxxxx.fbxos.fr',
      https_port: xxxx,
      api_base_url: '/api/',
      api_version: 'xxx.x'
    },
    debug: false,
    verbose: false,
    updateDelay:  5 * 1000,
    zoom: 110,
    activeOnly: false,
    showModel: true,
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
  }
},
```

| Option  | Description | Type | Defaut |
| ------- | --- | --- | --- |
| debug | Active le mode de debuguage | Boolean | false |
| verbose | Active le mode verbose en console | Boolean| false |
| updateDelay | Delai de mise à jour en ms | Number | 5 * 1000 (5 sec) |
| zoom | Permet de zoomer le module | Number | 110 |
| activeOnly | Affiche uniquement les appareils connectés | Boolean | false |
| showModel | Affiche le model de Freebox utilisé | Boolean | true |
| showIcon| Affiche les icones | Boolean | true |
| showButton | Affiche les boutons de status de connexion | Boolean | true |
| showBandWidth | Affiche la bande passante | Boolean | true |
| showRate | Affiche le débit utilisé | Boolean | true |
| showClient | Affiche la liste des appareils | Boolean | true |
| showClientRate | Affiche le débit de l'appareil | Boolean | true |
| showEthClientRate | Affiche le débit de connexion de l'appareil connecté sur le port ethernet.<br>**Ne fonctionne que si un seul appareil est connecté par port ethernet.**<br>**Activer sur vous n'utiliser pas de swtich/hub sur votre Freebox!** | Boolean | false |
| showClientIP | Affiche l'addresse IPv4 des appareils | Boolean | false |
| showClientCnxType | Affiche le type de connexion des appareils | Boolean | true |
| showFree | Affiche les Freebox Player | Boolean | true |
| showIP | Affiche l'adresse ip de votre connexion | Boolean | true |
| showPing | Affiche le ping entre le mirroir et google.fr | Boolean | true |
| pingAdress| personalisation de l'adresse a ping | String | google.fr |
| textWidth | Largeur du texte à afficher (mini: 220) | Number | 250 |
| excludeMac | Ne pas afficher les appareils connectés avec certaines adresses MAC | Array | [] |
| sortBy | Classement des appareils connectés par : "type", "name", "mac" ou null pour classement par defaut| String | null |
| checkFreePlug| Permet de verifier et d'afficher les connexions via FreePlug sur le reseau (Freebox Delta uniquement)| Boolean | false |
| checkSFP| Permet de verifier et d'afficher les connexions via la carte SFP sur le reseau (Freebox Delta/Ultra uniquement)| Boolean | false |


### Personalisation de l'affichage des appareils connectés
 * Utilisez l'interface `FreeboxOS` de votre Freebox Server (Periphériques Réseau)
 * Utilisez l'application `Freebox Connect` sur votre téléphone (Appareils Connectés)

## Update
Utilisez cette commande:
```
cd ~/MagicMirror/modules/MMM-Freebox
npm run update
```

## Notes:
 - Les essais ont été effectué avec une Freebox Ultra.
 - Merci de me confirmer le bon fonctionnement sur les autres Freebox!
 - Ne fonctionne pas avec les Freebox Crystal et antérieur (API différante)

## Donation
 Si vous aimez ce module, un petit café est bien sympatique :)
 
 [Donation](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=TTHRH94Y4KL36&source=url)
