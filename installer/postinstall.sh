#!/bin/bash
# +--------------------------------+
# | npm postinstall                |
# | @bugsounet                     |
# +--------------------------------+

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

# module name
Installer_module="MMM-Freebox"

# check version in package.json file
Installer_version="$(cat ../package.json | grep version | cut -c14-30 2>/dev/null)"

# Let's start !
Installer_info "Welcome to $Installer_module $Installer_version"
Installer_info "postinstall script v$Installer_vinstaller"

echo

# use beep request questions ?
Installer_beep=false

# Check not run as root
if [ "$EUID" -eq 0 ]; then
  Installer_error "npm install must not be used as root"
  exit 1
fi

echo

Installer_yesno "Register MMM-Freebox to Freebox Server" && (
  node Freebox_Login.js
)

# the end...
Installer_exit "$Installer_module is now installed !"
