import type { Alarm } from "@/features/live-data/live-data-types";
import type { ShipTreeNode } from "@/features/ship-visualizer/ship-visualizer-types";

/**
 * How the tree tags an open behaviour anomaly's parts, as the design has it:
 * a group's members "drifting", the systems a whole-ship anomaly involves
 * "involved", the others "normal". Other rows keep their usual reading.
 */
export function anomalyTreeTag(alarm: Alarm, otherwise?: (node: ShipTreeNode) => React.ReactNode) {
  const anomaly = alarm.anomaly;
  return function renderAnomalyTag(node: ShipTreeNode): React.ReactNode {
    if (!anomaly) return otherwise?.(node);
    const isShip = alarm.scope === "ship";
    const isMember = anomaly.members.includes(node.label);
    const isSystem = anomaly.systemIds.includes(node.id);
    if (isShip && (isSystem || isMember)) return <span className="text-[12px] font-semibold text-anomaly-ink">involved</span>;
    if (!isShip && isMember) return <span className="text-[12px] font-semibold text-anomaly-ink">drifting</span>;
    if (!isShip && isSystem) return <span className="text-[12px] text-anomaly-ink">in the group</span>;
    return otherwise?.(node);
  };
}
