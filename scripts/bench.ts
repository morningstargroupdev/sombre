const binary = "target/release/sombre";
const runs = 30;

const checks: { name: string; args: string[]; budget: number }[] = [
  { args: ["--version"], budget: 5, name: "sombre --version" },
  { args: ["ls"], budget: 10, name: "sombre ls" },
  {
    args: ["ls", "--all", "--json"],
    budget: 10,
    name: "sombre ls --all --json",
  },
];

const build = Bun.spawnSync(
  ["cargo", "build", "--release", "-q", "-p", "sombre"],
  {
    stderr: "inherit",
  }
);
if (build.exitCode !== 0) {
  process.exit(build.exitCode ?? 1);
}

const median = (values: number[]): number => {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

let over = 0;
for (const check of checks) {
  Bun.spawnSync([binary, ...check.args], {
    stderr: "ignore",
    stdout: "ignore",
  });
  const times: number[] = [];
  for (let run = 0; run < runs; run += 1) {
    const start = performance.now();
    Bun.spawnSync([binary, ...check.args], {
      stderr: "ignore",
      stdout: "ignore",
    });
    times.push(performance.now() - start);
  }
  const took = median(times);
  const fine = took <= check.budget;
  if (!fine) {
    over += 1;
  }
  console.log(
    `${fine ? "ok  " : "slow"}  ${check.name.padEnd(24)} ${took.toFixed(1).padStart(6)} ms  budget ${check.budget} ms`
  );
}

if (over > 0) {
  console.log(`${over} over budget`);
  process.exit(1);
}
