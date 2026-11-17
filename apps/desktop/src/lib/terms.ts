import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";

import type { Out } from "./api";
import { failure, hangup, input, pty, resize } from "./api";

export interface Shell {
  term: Terminal;
  fit: FitAddon;
  box: HTMLDivElement;
  alive: boolean;
  ended: (() => void) | null;
  run: number;
}

const QUICK = 1000;

const shells = new Map<string, Shell>();

export const drop = (key: string) => {
  const found = shells.get(key);
  if (found) {
    found.run += 1;
  }
  hangup(key).catch(() => null);
  found?.term.dispose();
  shells.delete(key);
};

const token = (name: string) =>
  getComputedStyle(document.documentElement)
    .getPropertyValue(`--color-${name}`)
    .trim();

const theme = () => ({
  background: token("ink"),
  black: token("well"),
  brightBlack: token("edge"),
  brightWhite: token("paper"),
  cursor: token("ember"),
  cursorAccent: token("ink"),
  foreground: token("body"),
  selectionBackground: `${token("ember")}55`,
  white: token("body"),
});

const begin = async (key: string, folder: string, shell: Shell) => {
  shell.alive = true;
  shell.run += 1;
  const { run } = shell;
  const started = Date.now();
  const { term } = shell;
  const listen = (out: Out) => {
    if (shell.run !== run) {
      return;
    }
    if (out.kind === "data") {
      term.write(out.text);
      return;
    }
    shell.alive = false;
    if (out.code === 0 || Date.now() - started > QUICK) {
      shell.ended?.();
      drop(key);
      return;
    }
    term.write(
      `\r\n\u001B[2mshell ended${out.code === null ? "" : ` with code ${out.code}`}. restart it from the bar above\u001B[0m\r\n`
    );
  };
  try {
    await pty({ cols: term.cols, folder, key, rows: term.rows }, listen);
  } catch (error) {
    shell.alive = false;
    term.write(`\r\n${failure(error)}\r\n`);
  }
};

export const shell = (key: string, folder: string) => {
  const found = shells.get(key);
  if (found) {
    return found;
  }
  const box = document.createElement("div");
  box.className = "h-full w-full";
  const term = new Terminal({
    allowProposedApi: false,
    cursorBlink: false,
    fontFamily: getComputedStyle(document.documentElement)
      .getPropertyValue("--font-mono")
      .trim(),
    fontSize: 12.5,
    lineHeight: 1.25,
    scrollback: 5000,
    theme: theme(),
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.open(box);
  const made: Shell = { alive: false, box, ended: null, fit, run: 0, term };
  term.onData((data) => {
    if (made.alive) {
      input(key, data).catch(() => null);
    }
  });
  term.onResize(({ cols, rows }) => {
    if (made.alive) {
      resize(key, cols, rows).catch(() => null);
    }
  });
  shells.set(key, made);
  begin(key, folder, made);
  return made;
};

export const restart = async (key: string, folder: string) => {
  const found = shells.get(key);
  if (found) {
    found.run += 1;
  }
  await hangup(key).catch(() => null);
  if (found) {
    found.term.reset();
    found.term.focus();
    begin(key, folder, found);
  }
};
