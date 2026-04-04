import { spawnSync } from "node:child_process";

function run(script: string) {
  const result = spawnSync("npm", ["run", script], {
    stdio: "inherit",
    shell: true
  });
  if (result.status !== 0) {
    throw new Error(`npm run ${script} failed with code ${result.status}`);
  }
}

function main() {
  run("check:config");
  run("deploy:fin");
  run("mint:fin");
}

main();
