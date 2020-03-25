const { FreeboxRegister } = require("freebox");

async function main() {
  const freeboxRegister = new FreeboxRegister({
    app_id: "fbx.MMM-Freebox",
    app_name: "Freebox",
    app_version: "1.0.0",
    device_name: "Magic Mirror",
  });

  // Obtaining an app_token & everything you need
  // https://dev.freebox.fr/sdk/os/login/
  const access = await freeboxRegister.register();
}

main().catch(err => console.error(err));
