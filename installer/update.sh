#!/bin/bash
# +-----------------+
# | Freebox updater |
# ------------------+

# get the installer directory
Installer_get_current_dir () {
  SOURCE="${BASH_SOURCE[0]}"
  while [ -h "$SOURCE" ]; do
    DIR="$( cd -P "$( dirname "$SOURCE" )" && pwd )"
    SOURCE="$(readlink "$SOURCE")"
    [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE"
  done
  echo "$( cd -P "$( dirname "$SOURCE" )" && pwd )"
}

Installer_dir="$(Installer_get_current_dir)"

# move to installler directory
cd "$Installer_dir"
source utils.sh


Installer_info "Welcome to Freebox updater !"
echo

cd ~/MagicMirror/modules/MMM-Freebox
rm -f package-lock.json

Installer_info "Updating..."

git reset --hard HEAD
git pull
cd node_modules

Installer_info "Deleting ALL @bugsounet libraries..."

rm -rf @bugsounet
cd ~/MagicMirror/modules/MMM-Freebox

Installer_info "Ready for Installing..."

# launch installer
npm install
