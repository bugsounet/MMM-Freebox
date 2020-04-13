const { FreeboxRegister } = require("freebox");
var count = 1

async function main() {
  const freeboxRegister = new FreeboxRegister({
    app_id: "fbx.MMM-Freebox",
    app_name: "MMM-Freebox",
    app_version: "1.0.0",
    device_name: "Magic Mirror",
  });

  // Obtaining an app_token & everything you need
  // https://dev.freebox.fr/sdk/os/login/
  const access = await freeboxRegister.register();
}

function retry() {
  console.log("Retry... "+ count + "/10")
  count++
  main().catch(err => {
    console.log("[Freebox][Error] " + err)
    if (count < 11) retry()
  })
}

main().catch(err => retry() ) 
