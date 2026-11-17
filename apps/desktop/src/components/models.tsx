import { useState } from "react";

import type { Model } from "../lib/api";
import { Heading, Option, Search } from "./popover";

const same = (id: string, model: string | null) =>
  model === id || (model ?? "").split(/[-:/]/u).includes(id);

interface Props {
  models: Model[];
  model: string | null;
  levels: string[];
  effort: string | null;
  loading: boolean;
  onModel: (model: string) => void;
  onEffort: (level: string) => void;
  close: () => void;
}

export const Models = ({
  models,
  model,
  levels,
  effort,
  loading,
  onModel,
  onEffort,
  close,
}: Props) => {
  const [query, setQuery] = useState("");
  const words = query.toLowerCase().trim();
  const shown = models.filter((entry) =>
    `${entry.id} ${entry.about}`.toLowerCase().includes(words)
  );
  return (
    <div className="flex min-h-0 flex-1 gap-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {models.length > 6 ? (
          <Search
            onChange={setQuery}
            placeholder="search models"
            value={query}
          />
        ) : null}
        <Heading>model</Heading>
        <div className="flex min-h-0 flex-col overflow-y-auto overscroll-contain">
          {loading ? (
            <p className="text-fog px-2 py-1.5">loading models</p>
          ) : null}
          {!loading && shown.length === 0 ? (
            <p className="text-fog px-2 py-1.5">no model matches</p>
          ) : null}
          {shown.map((entry) => (
            <Option
              hint={entry.about}
              key={entry.id}
              label={entry.id}
              onPick={() => {
                onModel(entry.id);
                close();
              }}
              selected={same(entry.id, model)}
            />
          ))}
        </div>
      </div>
      {levels.length > 0 ? (
        <div className="border-rim flex w-32 shrink-0 flex-col border-l pl-1">
          <Heading>effort</Heading>
          {["default", ...levels].map((level) => (
            <Option
              key={level}
              label={level}
              onPick={() => {
                onEffort(level);
                close();
              }}
              selected={(effort ?? "default") === level}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};
