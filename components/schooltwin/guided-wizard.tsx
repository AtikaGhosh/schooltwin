'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'

import { useSchoolTwin } from '@/components/providers/schooltwin-provider'

export interface GuidedWizardStep {
  id: string
  question: string
  content: ReactNode
  valid: boolean
}

export function GuidedWizard({
  steps,
  onComplete,
  submitting = false,
}: {
  steps: GuidedWizardStep[]
  onComplete: () => void | Promise<void>
  submitting?: boolean
}) {
  const { t } = useSchoolTwin()
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState<'next' | 'back'>('next')
  const headingRef = useRef<HTMLHeadingElement>(null)
  const step = steps[index]
  useEffect(() => {
    headingRef.current?.focus()
  }, [index])
  function next() {
    if (!step.valid) return
    if (index === steps.length - 1) void onComplete()
    else {
      setDirection('next')
      setIndex((value) => value + 1)
    }
  }
  function back() {
    setDirection('back')
    setIndex((value) => value - 1)
  }
  return (
    <section className="mx-auto max-w-xl px-1 py-4 text-center sm:px-6 sm:py-8">
      <div
        aria-live="polite"
        className="text-muted-foreground text-sm font-semibold tabular-nums"
      >
        {t('wizard.progress', { current: index + 1, total: steps.length })}
      </div>
      <div className="bg-muted mx-auto mt-3 h-1.5 max-w-sm overflow-hidden rounded-full">
        <div
          className="gradient-progress h-full motion-reduce:transition-none"
          style={{ width: `${((index + 1) / steps.length) * 100}%` }}
        />
      </div>
      <div key={step.id} data-direction={direction} className="wizard-stage">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mx-auto mt-10 text-2xl leading-snug font-semibold tracking-tight text-pretty focus:outline-none sm:text-3xl"
        >
          {step.question}
        </h1>
        <div className="mx-auto mt-8 max-w-md text-left">{step.content}</div>
      </div>
      <div className="mx-auto mt-10 flex max-w-md items-center justify-between gap-3">
        {index > 0 ? (
          <button
            type="button"
            onClick={back}
            className="quiet-action text-muted-foreground inline-flex min-h-12 items-center gap-2 rounded-lg px-4 font-semibold"
          >
            <ArrowLeft className="size-4" />
            {t('common.back')}
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          disabled={!step.valid || submitting}
          onClick={next}
          className="primary-action inline-flex min-h-12 items-center gap-2 rounded-xl px-7 font-semibold disabled:cursor-not-allowed"
        >
          {submitting
            ? t('common.loading')
            : index === steps.length - 1
              ? t('common.submit')
              : t('common.next')}
          <ArrowRight className="size-4" />
        </button>
      </div>
      {!step.valid ? (
        <p className="text-muted-foreground mt-4 text-center text-xs">
          {t('wizard.choose')}
        </p>
      ) : null}
    </section>
  )
}

export function AnswerButtons({
  value,
  options,
  onChange,
}: {
  value: string
  options: Array<[string, string]>
  onChange: (value: string) => void
}) {
  return (
    <div className="grid gap-3">
      {options.map(([option, label]) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={`choice-control flex min-h-16 items-center justify-center gap-3 rounded-xl border px-5 text-center text-base font-semibold tracking-wide ${value === option ? 'border-primary bg-primary/[0.09] text-primary shadow-[0_0_0_1px_var(--primary)]' : 'border-border/80 bg-card'}`}
        >
          <span>{label}</span>
          {value === option ? (
            <Check className="success-enter size-4" aria-hidden />
          ) : null}
        </button>
      ))}
    </div>
  )
}
