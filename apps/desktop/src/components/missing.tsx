import { openUrl } from "@tauri-apps/plugin-opener";

import type { Installed } from "../lib/api";
import { names } from "../lib/api";
import { Copy } from "./copy";
import { chip } from "./popover";

interface Props {
  entry: Installed;
}

export const Missing = ({ entry }: Props) => (
  <div className="border-rim bg-raise/50 flex w-full max-w-[560px] flex-col gap-2 rounded-xl border px-4 py-3 text-left text-[12.5px]">
    <p className="text-paper">{`${names[entry.agent]} isn't installed yet`}</p>
    <p className="text-fog">
      run this in a terminal, then come back. sombre finds it on its own
    </p>
    <div className="bg-well border-rim flex items-center gap-2 rounded-lg border py-1.5 pr-1 pl-3">
      <code className="text-body min-w-0 flex-1 truncate">{entry.install}</code>
      <Copy text={entry.install} />
    </div>
    <button
      className={`${chip} self-start px-0`}
      onClick={() => {
        openUrl(entry.docs);
      }}
      type="button"
    >
      {`read the ${names[entry.agent]} setup guide ↗`}
    </button>
  </div>
);
