const { FreeboxRegister } = require("../components/freebox.js");

var count = 1;

async function main () {
  const register = await new FreeboxRegister(
    {
      app_id: "fbx.MMM-Freebox",
      app_name: "MMM-Freebox",
      app_version: "2.0.0",
      device_name: "Magic Mirror²"
    }
  ).register();
}

function retry () {
  console.log(`Retry... ${ count  }/10`);
  count++;
  main().catch((err) => {
    console.log(`[Freebox][Error] ${  err}`);
    if (count < 11) retry();
  });
}

main().catch((err) => retry() );
