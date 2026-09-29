"use client";

import ReactMarkdown from "react-markdown";
import { formatUtcTime } from "@/features/live-data/lib/format-readings";
import type { LogEvent } from "@/features/event-log/event-log-types";
import type { AssistantMessage } from "../assistant-types";

type Props = {
  message: AssistantMessage;
  events: LogEvent[];
  onOpenLog: () => void;
  onOpenComponent: (label: string) => void;
};

const CHIP_CLASS =
  "cursor-pointer rounded-md border border-line-strong px-2.5 py-1 font-mono text-[12px] text-accent-ink hover:border-accent-line";

/** An answer's markdown, in the cockpit's type: paragraphs, lists, bold. */
function Answer({ content }: { content: string }) {
  return (
    <div className="text-[14px] leading-[1.55] text-ink">
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-2 flex list-none flex-col gap-1.5 pl-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 list-decimal pl-5">{children}</ol>,
          li: ({ children }) => (
            <li className="flex gap-2">
              <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
              <span>{children}</span>
            </li>
          ),
          strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
          code: ({ children }) => <code className="font-mono text-[13px]">{children}</code>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/**
 * A turn of the conversation: the operator's question, the assistant's answer
 * with what it cites — log entries, a sensor's trend, the components — or why
 * it could not answer.
 */
export function AssistantMessageItem({ message, events, onOpenLog, onOpenComponent }: Props) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-accent-soft px-4 py-2.5 text-[14px] text-ink">{message.content}</p>
      </div>
    );
  }
  if (message.role === "error") {
    return (
      <p role="alert" className="rounded-xl border border-alarm/40 bg-alarm-soft px-4 py-3 text-[13px] text-ink">
        {message.content}
      </p>
    );
  }

  const { reply } = message;
  const cited = reply.citedEvents.flatMap((number) => events.filter((event) => event.number === number));
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-line bg-card px-4 py-3.5">
      <Answer content={reply.answer} />
      {(cited.length > 0 || reply.evidenceSensor || reply.highlights.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {cited.map((event) => (
            <button key={event.id} type="button" onClick={onOpenLog} className={CHIP_CLASS}>
              Log #{event.number} · {formatUtcTime(event.at)}
            </button>
          ))}
          {reply.evidenceSensor && <span className={CHIP_CLASS}>{reply.evidenceSensor} trend</span>}
          {reply.highlights.map((highlight) => (
            <button key={highlight.component} type="button" onClick={() => onOpenComponent(highlight.component)} className={CHIP_CLASS}>
              {highlight.component}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}
