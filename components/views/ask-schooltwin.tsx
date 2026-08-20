"use client"

import { useState } from "react"
import { Card } from "@/components/primitives"
import { askSuggestions, type AskAnswer } from "@/lib/data"
import { Search, Sparkles, FileText, Send } from "lucide-react"

export function AskSchoolTwinView() {
  const [query, setQuery] = useState("")
  const [answer, setAnswer] = useState<AskAnswer | null>(null)
  const [thinking, setThinking] = useState(false)

  function ask(a: AskAnswer) {
    setQuery(a.q)
    setThinking(true)
    setAnswer(null)
    setTimeout(() => {
      setThinking(false)
      setAnswer(a)
    }, 650)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    // Match to the closest canned answer, else fall back to the first.
    const match =
      askSuggestions.find((s) => s.q.toLowerCase() === query.trim().toLowerCase()) ??
      askSuggestions.find((s) =>
        query
          .toLowerCase()
          .split(" ")
          .some((w) => w.length > 3 && s.q.toLowerCase().includes(w)),
      ) ??
      askSuggestions[0]
    ask(match)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
          <Sparkles className="size-3.5" />
          Ask in plain language
        </div>
        <h1 className="text-2xl font-semibold text-balance">Ask SchoolTwin</h1>
        <p className="text-sm text-muted-foreground text-pretty">
          Query the live evidence layer across every school. Every answer is grounded in traceable signals — never a
          guess.
        </p>
      </div>

      <form onSubmit={submit} className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Which school needs my attention most?"
          className="w-full rounded-xl border border-border bg-card py-4 pl-12 pr-14 text-sm shadow-sm outline-none ring-ring/40 focus:ring-2"
          aria-label="Ask a question about your schools"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg bg-primary text-primary-foreground transition hover:opacity-90"
          aria-label="Submit question"
        >
          <Send className="size-4" />
        </button>
      </form>

      {!answer && !thinking && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Try asking</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {askSuggestions.map((s) => (
              <button
                key={s.q}
                onClick={() => ask(s)}
                className="rounded-lg border border-border bg-card p-3 text-left text-sm transition hover:border-primary/40 hover:bg-accent/40"
              >
                {s.q}
              </button>
            ))}
          </div>
        </div>
      )}

      {thinking && (
        <Card className="p-6">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Sparkles className="size-4 animate-pulse text-primary" />
            Reviewing signals and reconciling evidence…
          </div>
        </Card>
      )}

      {answer && (
        <Card className="overflow-hidden">
          <div className="border-b border-border bg-accent/40 px-5 py-3 text-sm font-medium">{answer.q}</div>
          <div className="space-y-4 p-5">
            <p className="text-sm leading-relaxed text-pretty">{answer.a}</p>
            <div className="rounded-lg border border-border bg-secondary/60 p-4">
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <FileText className="size-3.5" />
                Evidence trail
              </p>
              <ul className="space-y-1.5">
                {answer.evidence.map((e, i) => (
                  <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-xs text-muted-foreground">
              SchoolTwin only answers from recorded evidence. When confidence is low, it says so.
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}
