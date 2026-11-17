import type { Aim } from "../lib/api";
import { aim } from "../lib/store";

interface Props {
  chatKey: string;
  goal: Aim;
}

const action =
  "text-fog hover:text-paper focus-visible:text-paper active:text-body cursor-pointer rounded px-1 disabled:cursor-default disabled:opacity-40";

export const Pursuit = ({ chatKey, goal }: Props) => (
  <p className="flex min-w-0 items-center gap-[1ch]">
    <span aria-hidden="true" className="text-ember">
      ◎
    </span>
    <span className="text-body shrink-0">{`goal ${goal.status}`}</span>
    <span className="min-w-0 truncate" title={goal.summary}>
      {goal.objective}
    </span>
    <span className="ml-auto flex shrink-0 items-center">
      <button
        className={action}
        onClick={() => aim(chatKey, goal.active ? "pause" : "resume")}
        type="button"
      >
        {goal.active ? "pause" : "resume"}
      </button>
      <button
        className={action}
        onClick={() => aim(chatKey, "clear")}
        type="button"
      >
        clear
      </button>
    </span>
  </p>
);
