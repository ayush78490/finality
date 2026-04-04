require("dotenv").config();
const { GearApi } = require("@gear-js/api");
const { decodeAddress } = require("@polkadot/util-crypto");
const { u8aToHex } = require("@polkadot/util");

(async () => {
  const api = await GearApi.create({ providerAddress: process.env.VARA_WS_ENDPOINT });
  const source = u8aToHex(decodeAddress("5DPGeZBpA86BF6WBGWHfay2Vo9SNhw1b53jvgciF4VQTQ6m2"));
  const codeId = "0x81663df58f48684923777cd8cf281bfd2e4ee427926abc52a1fcf4ecd41be7ad";

  const list = [
    "New",
    "new",
    JSON.stringify({ New: ["Finality Token", "FIN", 12] }),
    JSON.stringify(["New", "Finality Token", "FIN", 12]),
    JSON.stringify({ new: ["Finality Token", "FIN", 12] })
  ];

  for (const p of list) {
    try {
      const g = await api.program.calculateGas.initCreate(
        source,
        codeId,
        p,
        0,
        true,
        null,
        null
      );
      console.log("ok", p, g.min_limit?.toString?.() || JSON.stringify(g));
    } catch (e) {
      console.log("err", p, e.message || String(e));
    }
  }

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
