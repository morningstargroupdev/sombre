import { useState } from "react";

import type { Offer, Server } from "../lib/api";
import { bring, plug, unplug } from "../lib/api";
import { Row } from "./card";
import { Field, primary, secondary } from "./field";
import type { Edit } from "./providers";
import { Remove } from "./remove";

const Plug = ({ onEdit }: { onEdit: Edit }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [run, setRun] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const cancel = () => {
    setOpen(false);
    setName("");
    setRun("");
    setProblem(null);
  };

  const save = async () => {
    if (name.trim() === "" || run.trim() === "") {
      return;
    }
    const failed = await onEdit((place) => plug(name, run, place));
    setProblem(failed);
    if (!failed) {
      cancel();
    }
  };

  return (
    <Row
      about="a command that starts the server, or the url it listens on"
      below={
        open ? (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Field
                focus
                label="name"
                onCancel={cancel}
                onChange={setName}
                onSubmit={save}
                placeholder="lowercase, like files"
                value={name}
              />
              <Field
                label="command or url"
                onCancel={cancel}
                onChange={setRun}
                onSubmit={save}
                placeholder="npx -y @scope/server ~/notes"
                value={run}
              />
            </div>
            {problem ? (
              <p className="text-paper text-[12px]" role="alert">
                {problem}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <button className={secondary} onClick={cancel} type="button">
                cancel
              </button>
              <button
                className={primary}
                disabled={name.trim() === "" || run.trim() === ""}
                onClick={save}
                type="button"
              >
                add server
              </button>
            </div>
          </div>
        ) : null
      }
      title="add a server"
    >
      {open ? null : (
        <button
          className={secondary}
          onClick={() => setOpen(true)}
          type="button"
        >
          add
        </button>
      )}
    </Row>
  );
};

interface Props {
  servers: Server[];
  offered: Offer[];
  onEdit: Edit;
}

export const Servers = ({ servers, offered, onEdit }: Props) => {
  const [problem, setProblem] = useState<string | null>(null);
  const run = async (call: Parameters<Edit>[0]) => {
    setProblem(await onEdit(call));
  };
  return (
    <>
      {servers.length === 0 ? (
        <Row
          about="servers give sombre's agent more tools, like files, browsers, or your issue tracker"
          title="no mcp servers yet"
        />
      ) : (
        servers.map((server) => (
          <Row about={server.run} key={server.name} title={server.name}>
            <Remove
              confirm={`remove ${server.name}`}
              label="remove"
              onRemove={() => run((place) => unplug(server.name, place))}
            />
          </Row>
        ))
      )}
      {offered.map((offer) => (
        <Row
          about={
            <span className="block truncate" title={offer.run}>
              {`from ${offer.from}: ${offer.run}`}
            </span>
          }
          key={`${offer.from}:${offer.name}`}
          title={offer.name}
        >
          <button
            className={secondary}
            onClick={() => run((place) => bring(offer.name, place))}
            type="button"
          >
            add
          </button>
        </Row>
      ))}
      {problem ? (
        <p className="text-paper px-4 py-3 text-[12px]" role="alert">
          {problem}
        </p>
      ) : null}
      <Plug onEdit={onEdit} />
    </>
  );
};
