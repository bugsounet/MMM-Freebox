# MMM-Freebox

MMM-Freebox est un module pour le projet [MagicMirror](https://github.com/MichMich/MagicMirror) par [Michael Teeuw](https://github.com/MichMich).

Il permet d'afficher, sur votre Mirroir, divers informations de votre [Freebox](https://www.free.fr/freebox/) en temps réél.

Plusieurs modules sont disponibles et permet l'affichage suivant:

 * Bande Passante.
 * Adresse IP.
 * Appareils connectés
 * Débit utilisé (total et/ou par appareil)
 * Ping de votre mirroir vers google.fr (ou autre)
 * Appels manqués.
 * Type de connexion utilisé par les appareils

## Update
 * v2.0.0
   * delete EPG
   * delete VPN
   * add freebox Delte support
 * v1.4.2 (25/08/2020)
   * correction d'un bug lors du demarrage -> reste figé sur le logo Freebox
   * correction d'un crash si le XML de l'EPG n'est pas conforme
   * correcttion du css (logo freebox)
 * v1.4.1 (12/08/2020)
   * Ajout IP des clients connectés [Issue #16](https://github.com/bugsounet/MMM-Freebox/issues/16) pour @BlackCatDeployment
 * v1.4.0 (10/08/2020)
   * Affichage de la chaîne regardé avec son programme en cours
 * v1.3.3 (04/08/2020)
   * Affichage des clients connectés en wifi (2.4Ghz: vert, 5Ghz: bleu)
   * Affichage des clients connectés en ethernet et indique le port de connexion
   * Affichage des clients connectés en VPN (thx @wileck)
 * v1.3.2 (16/07/2020)
   * Fix crash au scan des clients
 * v1.3.0 - v1.3.1 (15/07/2020)
   * Probleme côté Free avec le protocole SSL (utilisation du mode HTTP en attendant)
   * Creation de la nouvelle librairie API Freebox
   * Pre-code pour le VPN
   * Nouveau format de configuration (uniquement le token est necessaire)
   * Affichage client connecté en wifi 5g + debit
   * Calcul et affichage des unités débit en live (Giga/Mega/Kilo octets)
 * v1.2.2 (18/04/2020)
   * **FIX**: rafraichissement si activeOnly actif
 * v1.2.1 (15/04/2020)
   * **FIX**: si erreur de récupération débit d'un appareil -> force valeur à 0
 * v1.2.0 (13-04-2020)
   * **FIX**: correction affichage par appareils (Freebox devialet) 
   * **ADD**: Ajout de l'adresse du ping personalisé (pingAdress)
   * **FIX**: Revu npm install et le script d'association
 * v1.1.0 (07-04-2020)
   * **ADD**: affichage des débits par appareils
 * v1.0.0 (30-03-2020)
   * Initial release
## Screenshot
![](https://raw.githubusercontent.com/bugsounet/MMM-Freebox/dev/screen.png)
![](https://raw.githubusercontent.com/bugsounet/MMM-Freebox/dev/screen2.png)

## Installation
 * Clonez le module dans votre dossier de module de MagicMirror et exécutez `npm install` dans le répertoire du module.
```sh
git clone https://github.com/bugsounet/MMM-Freebox.git
cd MMM-Freebox
npm install
```
  * Associer votre MMM-Freebox à votre Freebox Server.

```sh
cd ~/MagicMirror/modules/MMM-Freebox
npm run register

Merci de vérifier votre écran LCD de votre Freebox Server et autoriser l'enregistrement de l'application.
```
  * Validez l'association par la flèche de droite de l'écran LCD de votre Freebox Server.
  
  * Sauvegarder précieusement l'information de connexion. 

```js
token: "<token>",
```

### **Attention:** Les informations fournies par la Freebox sont à considérer comme des identifiants !
### Ne JAMAIS les divulguer car cela permet d'avoir un accès à votre freebox à distance !

## Configuration
Pour afficher le module, inserez ceci dans votre ficher `config.js`

### Configuration Minimale

Remplacer le tokden la valeurs de connexion fourni par votre Freebox Server.
```js
{
  module: "MMM-Freebox",
  position: "top_center",
  configDeepMerge: true,
  config: {
    token: "<token>",
  }
},
```
### Configuration Personalisée
Ceci est la configuration par defaut si vous definissez aucune valeurs

```js
{
  module: 'MMM-Freebox',
  position: 'top_center',
  configDeepMerge: true,
  config: {
    /** remplacer le token par votre valeur **/
    token:  "<token>",
    updateDelay: 5 * 1000,
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
    maxMissed: 3,
    showIP: true,
    showPing: true,
    pingAdress: "google.fr",
    textWidth: 250,
    excludeMac: [],
    sortBy: null,
    checkFreePlug: false,
    checkSFP: false,
    debug: false,
    verbose: false
  }
},
```

| Option  | Description | Type | Defaut |
| ------- | --- | --- | --- |
| updateDelay | Delai de mise à jour en ms | Number | 5 * 1000 (5 sec) |
| activeOnly | Affiche uniquement les appareils connectés | Boolean | false |
| showIcon| Affiche les icones | Boolean | true |
| showButton | Affiche les boutons de status de connexion | Boolean | true |
| showBandWidth | Affiche la bande passante | Boolean | true |
| showRate | Affiche le débit utilisé | Boolean | true |
| showClient | Affiche la liste des appareils | Boolean | true |
| showClientRate | Affiche le débit de l'appareil | Boolean | true |
| showClientIP | Affiche l'addresse IPv4 de l'appareil | Boolean | false |
| showClientCnxType | Affiche le type de connexion des appareils | Boolean | true |
| showFreePlayer | Affiche les Freebox Player | Boolean | true |
| showMissedCall | Affiche les appels manqués | Boolean | true |
| maxMissed | Nombre d'appel maximum à afficher | Number | 3 |
| showIP | Affiche l'adresse ip de connexion | Boolean | true |
| showPing | Affiche le ping entre le mirroir et google.fr | Boolean | true |
| pingAdress| personalisation de l'adresse a ping | String | google.fr |
| textWidth | Largeur du texte à afficher (mini: 220) | Number | 250 |
| excludeMac | Ne pas afficher les appareils connectés avec certaines adresses MAC | Array | [] |
| sortBy | Classement des appareils connectés par : type, name, mac ou null pour classement par defaut| String | null |
| checkFreePlug| Permet de verifier et d'afficher les connexions via FreePlug sur le reseau (Freebox Delta uniquement)| Boolean | false |
| checkSFP| Permet de verifier et d'afficher les connexions via la carte SFP sur le reseau (Freebox Delta uniquement)| Boolean | false |
| debug | Active le mode de debuguage | Boolean | false |
| verbose | Active le mode verbose en console | Boolean| false |

### Personalisation de l'affichage des appareils connecté

 * Utilisez l'interface FreeboxOS de votre Freebox Server (Periphériques Réseau)
 * Utilisez l'application freebox sur votre téléphone (Appareils Connectés)

## Notes:
 - Les essais ont été effectué avec des Freebox Mini 4k, Freebox Revolution et Freebox Devialet.
 - Je n'ai pas encore de retour sur la Freebox One et POP je pense que cela devrait fonctionner également car toutes les box Free utilisent la même API
 - Ne fonctionne pas avec les Freebox Crystal et antérieur (API différante)
 - En cas de souci, ne pas hésiter a ouvrir une ISSUE

## Donation
 [Donation](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=TTHRH94Y4KL36&source=url), si vous aimez ce module !
