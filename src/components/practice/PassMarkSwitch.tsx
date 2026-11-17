"use client";
import { InfoTip } from "@/components/ui/InfoTip";
import { Switch } from "@/components/ui/Switch";
import { usePracticeMode } from "./PracticeModeProvider";

export const PASS_MARK_HELP = "Free practice: no pass mark. Your score is still shown, but any score, even 0%, lets you move on.";

/** Header control, next to the theme button: the switch, with a small "i" that explains it. */
export function PassMarkSwitch() {
  const { noPassMark, setNoPassMark } = usePracticeMode();
  return (
    <div className="ml-2 flex items-center gap-2">
      <Switch checked={noPassMark} onChange={setNoPassMark} label="Free practice, no pass mark" />
      <InfoTip text={PASS_MARK_HELP} label="About free practice" />
    </div>
  );
}
