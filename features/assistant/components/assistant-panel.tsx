"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, MessageCircle, Plus, X } from "lucide-react";
import { useEventLog } from "@/features/event-log/hooks/use-event-log";
import { ASSISTANT_DISCLAIMER, ASSISTANT_REQUEST_LIMITS, SUGGESTED_QUESTIONS } from "../assistant-config";
import { useSendQuestion } from "../hooks/use-send-question";
import { clearHighlights, startNewConversation, takePendingQuestion, useAssistantState } from "../lib/assistant-store";
import { AssistantMessageItem } from "./assistant-message-item";

type Props = {
  /** Omitted on the phone's Ask tab, which the tab bar closes. */
  onClose?: () => void;
  /** The phone's Ask tab: shown below lg, in the page, rather than beside the scene at lg. */
  isPhonePage?: boolean;
  onOpenLog: () => void;
  onOpenComponent: (label: string) => void;
};

const ICON_BUTTON_CLASS =
  "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-line text-ink-2 hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

/** The assistant thinking: three dots. */
function Thinking() {
  return (
    <div role="status" aria-label="The assistant is thinking" className="flex gap-1 px-2 py-3">
      {["[animation-delay:-0.3s]", "[animation-delay:-0.15s]", ""].map((delay) => (
        <span key={delay} className={`size-1.5 animate-bounce rounded-full bg-muted ${delay}`} />
      ))}
    </div>
  );
}

/**
 * The ship assistant, beside the scene: ask about alarms, components or
 * sensor data, in words — it answers from the live data, the event log and
 * the ontology, and lights up what it talks about on the ship.
 */
export function AssistantPanel({ onClose, onOpenLog, onOpenComponent, isPhonePage = false }: Props) {
  const { messages, highlights } = useAssistantState();
  const { events } = useEventLog();
  const { send, isThinking } = useSendQuestion();
  const [input, setInput] = useState("");
  const messagesRef = useRef<HTMLDivElement>(null);
  const hasSentPending = useRef(false);

  // Opened, the conversation goes on where it was — with the question asked from elsewhere, if one was, sent once.
  // Only "New chat" starts another.
  useEffect(() => {
    if (hasSentPending.current) return;
    hasSentPending.current = true;
    const question = takePendingQuestion();
    if (question) void send(question);
  }, [send]);

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isThinking]);

  const submit = (question: string) => {
    if (!question.trim() || isThinking) return;
    void send(question);
    setInput("");
  };

  return (
    <aside
      aria-label="Ship assistant"
      className={
        isPhonePage
          ? "flex h-[calc(100dvh-25rem)] min-h-[420px] flex-col bg-surface text-ink lg:hidden"
          : "hidden w-[420px] shrink-0 flex-col border-l border-line bg-surface text-ink lg:flex"
      }
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-5 py-4">
        <span className="flex size-10 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
          <MessageCircle className="size-5" aria-hidden />
        </span>
        <div className="flex min-w-0 grow flex-col">
          <h2 className="text-lg font-bold">Ship assistant</h2>
          <p className="text-xs text-ink-2">Uses live stream · event log · ontology</p>
        </div>
        <button
          type="button"
          onClick={() => {
            startNewConversation();
            setInput("");
          }}
          disabled={isThinking || messages.length === 0}
          title="Start a new conversation"
          className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-semibold text-ink-2 hover:border-line-strong hover:text-ink disabled:cursor-default disabled:opacity-40"
        >
          <Plus className="size-4" aria-hidden />
          New chat
        </button>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close the assistant" className={ICON_BUTTON_CLASS}>
            <X className="size-4" aria-hidden />
          </button>
        )}
      </header>

      {/* Pinned under the header, not over the scene: what the answer lit up on the ship */}
      {highlights.length > 0 && (
        <div className="flex shrink-0 items-center gap-3 border-b border-line bg-accent-soft/40 px-5 py-2 text-[13px]">
          <MessageCircle className="size-4 shrink-0 text-accent-ink" aria-hidden />
          <span className="min-w-0 grow truncate">
            <b className="font-semibold">
              {highlights.length} component{highlights.length === 1 ? "" : "s"}
            </b>{" "}
            highlighted on the ship
          </span>
          <button type="button" onClick={clearHighlights} className="shrink-0 cursor-pointer rounded-md bg-btn px-2.5 py-1 font-semibold hover:brightness-110">
            Clear
          </button>
        </div>
      )}

      <div ref={messagesRef} className="flex min-h-0 grow flex-col gap-4 overflow-y-auto px-5 py-5">
        {messages.length === 0 && (
          <p className="text-[14px] text-ink-2">
            Ask about the ship&apos;s alarms, its components or its sensor data. The answers come from the live data, the event log and the
            knowledge graph, and light up on the ship what they talk about.
          </p>
        )}
        {messages.map((message) => (
          <AssistantMessageItem key={message.id} message={message} events={events} onOpenLog={onOpenLog} onOpenComponent={onOpenComponent} />
        ))}
        {isThinking && <Thinking />}
      </div>

      <footer className="flex shrink-0 flex-col gap-3 border-t border-line px-5 py-4">
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map((question) => (
            <button
              key={question}
              type="button"
              disabled={isThinking}
              onClick={() => submit(question)}
              className="cursor-pointer rounded-full border border-line-strong px-3.5 py-1.5 text-[13px] hover:border-accent-line disabled:cursor-default disabled:opacity-50"
            >
              {question}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            submit(input);
          }}
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            maxLength={ASSISTANT_REQUEST_LIMITS.QUESTION_CHARS}
            placeholder="Ask about alarms, components or sensor data…"
            aria-label="Your question"
            className="h-12 min-w-0 grow rounded-lg border border-line bg-card px-3.5 text-[14px] outline-none placeholder:text-muted focus:border-accent-line"
          />
          <button
            type="submit"
            disabled={isThinking || !input.trim()}
            aria-label="Send"
            className="flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-accent text-white hover:brightness-110 disabled:cursor-default disabled:opacity-50"
          >
            <ArrowRight className="size-5" aria-hidden />
          </button>
        </form>
        <p className="text-[11px] leading-snug text-muted">{ASSISTANT_DISCLAIMER}</p>
      </footer>
    </aside>
  );
}
