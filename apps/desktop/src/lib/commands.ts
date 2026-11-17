export type Name =
  | "new"
  | "model"
  | "effort"
  | "permissions"
  | "goal"
  | "agent"
  | "rename"
  | "compact"
  | "review"
  | "changes"
  | "terminal"
  | "status"
  | "stop"
  | "archive"
  | "reveal"
  | "providers"
  | "mcp"
  | "settings"
  | "help";

export interface Command {
  name: Name;
  about: string;
  takes?: string;
}

export const commands: Command[] = [
  { about: "start a new chat in this folder", name: "new" },
  { about: "pick the model", name: "model", takes: "name" },
  { about: "how hard the model thinks", name: "effort", takes: "level" },
  { about: "ask, auto, or yolo", name: "permissions", takes: "mode" },
  {
    about: "keep the agent going until it's done",
    name: "goal",
    takes: "what done looks like",
  },
  {
    about: "move this chat to another agent",
    name: "agent",
    takes: "claude, codex, or sombre",
  },
  { about: "give this chat a name", name: "rename", takes: "name" },
  { about: "summarize to free up context", name: "compact" },
  { about: "ask the agent to review what's uncommitted", name: "review" },
  { about: "show what changed", name: "changes" },
  { about: "open a terminal in this folder", name: "terminal" },
  { about: "agent, model, folder, and cost", name: "status" },
  { about: "stop the running turn", name: "stop" },
  { about: "hide this chat from the sidebar", name: "archive" },
  { about: "show this chat's folder in finder", name: "reveal" },
  { about: "add providers and their keys", name: "providers" },
  { about: "add or remove mcp servers", name: "mcp" },
  { about: "open settings", name: "settings" },
  { about: "keys and commands", name: "help" },
];

export const suggest = (text: string): Command[] => {
  if (!text.startsWith("/") || /\s/u.test(text)) {
    return [];
  }
  const typed = text.slice(1).toLowerCase();
  return commands.filter((command) => command.name.startsWith(typed));
};

export type Parsed =
  | { known: true; name: Name; rest: string }
  | { known: false; name: string; rest: string };

export const parse = (text: string): Parsed | null => {
  const match = /^\/(?<name>[a-z-]+)(?:\s+(?<rest>[\s\S]*))?$/u.exec(
    text.trim()
  );
  if (!match?.groups) {
    return null;
  }
  const name = match.groups.name ?? "";
  const rest = (match.groups.rest ?? "").trim();
  const found = commands.find((command) => command.name === name);
  return found
    ? { known: true, name: found.name, rest }
    : { known: false, name, rest };
};
