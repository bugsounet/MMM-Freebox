const { FreeboxRegister } = require("@bugsounet/freebox");
var count = 1

async function main() {
  const register = await new FreeboxRegister().register();
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
