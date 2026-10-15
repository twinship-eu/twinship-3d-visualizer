"use client";

import { activeAlarmOn, useLiveData } from "@/features/live-data/hooks/use-live-data";
import { ALARM_CONTEXT_TRENDS, COMPONENT_LIVE } from "./component-live-config";
import { ComponentTrendsStrip } from "./component-trends-strip";

type Props = {
  componentLabel: string;
  /** The Tailwind class of its section's dot. */
  dotClass: string;
};

/**
 * Under the scene, with a component selected in Live data: its trends over
 * the last minute — or, while it has an active alarm, the alarm's context.
 * Nothing for a component with no live data.
 */
export function SelectedComponentStrip({ componentLabel, dotClass }: Props) {
  const snapshot = useLiveData();
  const alarm = activeAlarmOn(snapshot, componentLabel);
  const alarmContext = alarm?.sensorId ? ALARM_CONTEXT_TRENDS[alarm.sensorId] : undefined;

  if (alarmContext) {
    return (
      <ComponentTrendsStrip
        title="Alarm context · live"
        caption="the reading and the signals that drive it · last 60 s"
        dotClass="bg-warn"
        cards={alarmContext}
        isFirstHighlighted
      />
    );
  }

  const definition = COMPONENT_LIVE[componentLabel];
  if (!definition) return null;

  return (
    <ComponentTrendsStrip
      title={`${componentLabel} · live trends`}
      caption={`last 60 s · ${snapshot?.rateHz ?? 1} Hz`}
      dotClass={dotClass}
      cards={definition.trends}
    />
  );
}
