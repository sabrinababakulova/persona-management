"use client";

import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "motion/react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

type MotionProviderProps = {
  children: ReactNode;
};

type RouteTransitionProps = {
  children: ReactNode;
  className?: string;
  routeKey: string;
};

type FeedbackPresenceProps = {
  children: ReactNode;
  className?: string;
  show: boolean;
};

type MotionToastProps = {
  message: string | null;
};

type LoadingStateProps = {
  className?: string;
  compact?: boolean;
  label?: string;
};

type InlineSpinnerProps = {
  className?: string;
};

type LoadingButtonContentProps = {
  isLoading: boolean;
  label: string;
  loadingLabel: string;
};

export function MotionProvider({ children }: MotionProviderProps) {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ duration: 0.24, ease: EASE_OUT }}
    >
      {children}
    </MotionConfig>
  );
}

export function RouteTransition({
  children,
  className,
  routeKey,
}: RouteTransitionProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={className}
        exit={{
          opacity: 0,
          scale: shouldReduceMotion ? 1 : 0.997,
          y: shouldReduceMotion ? 0 : -4,
        }}
        initial={{
          opacity: 0,
          scale: shouldReduceMotion ? 1 : 0.997,
          y: shouldReduceMotion ? 0 : 10,
        }}
        key={routeKey}
        transition={{
          duration: shouldReduceMotion ? 0.12 : 0.3,
          ease: EASE_OUT,
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export function FeedbackPresence({
  children,
  className,
  show,
}: FeedbackPresenceProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.div
          animate={{ height: "auto", opacity: 1, scale: 1, x: 0 }}
          className={className}
          exit={{
            height: 0,
            opacity: 0,
            scale: shouldReduceMotion ? 1 : 0.985,
            x: 0,
          }}
          initial={{
            height: 0,
            opacity: 0,
            scale: shouldReduceMotion ? 1 : 0.985,
            x: shouldReduceMotion ? 0 : -8,
          }}
          role="presentation"
          transition={{
            duration: shouldReduceMotion ? 0.12 : 0.24,
            ease: EASE_OUT,
          }}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function MotionToast({ message }: MotionToastProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {message ? (
        <motion.output
          animate={{ opacity: 1, scale: 1, x: 0 }}
          aria-live="polite"
          className="fixed top-20 right-4 z-70 max-w-[min(360px,calc(100vw-2rem))] rounded-xl border border-white/10 bg-text-heading px-4 py-3 text-sm text-white shadow-toast sm:right-6"
          exit={{
            opacity: 0,
            scale: shouldReduceMotion ? 1 : 0.97,
            x: shouldReduceMotion ? 0 : 16,
          }}
          initial={{
            opacity: 0,
            scale: shouldReduceMotion ? 1 : 0.97,
            x: shouldReduceMotion ? 0 : 24,
          }}
          key={message}
          transition={{
            duration: shouldReduceMotion ? 0.12 : 0.28,
            ease: EASE_OUT,
          }}
        >
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-success-green align-middle shadow-[0_0_0_4px_rgba(61,186,122,0.16)]" />
          {message}
        </motion.output>
      ) : null}
    </AnimatePresence>
  );
}

export function LoadingState({
  className,
  compact = false,
  label,
}: LoadingStateProps) {
  const t = useTranslations("Common");
  const shouldReduceMotion = useReducedMotion();
  const sizeClassName = compact ? "h-6 w-6" : "h-9 w-9";
  const resolvedLabel = label ?? t("loading");

  return (
    <motion.div
      animate={{ opacity: 1 }}
      aria-live="polite"
      className={`flex items-center justify-center text-text-secondary ${
        compact ? "gap-2.5" : "flex-col gap-3"
      } ${className ?? ""}`}
      initial={{ opacity: 0 }}
      role="status"
    >
      <div aria-hidden="true" className={`relative ${sizeClassName}`}>
        <div className="absolute inset-0 rounded-full border-2 border-primary-blue/15" />
        <motion.div
          animate={shouldReduceMotion ? { opacity: 1 } : { rotate: 360 }}
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary-blue border-r-primary-blue/60"
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : {
                  duration: 0.9,
                  ease: "linear",
                  repeat: Number.POSITIVE_INFINITY,
                }
          }
        />
        <motion.span
          animate={
            shouldReduceMotion
              ? { opacity: 1 }
              : { opacity: [0.55, 1, 0.55], scale: [0.75, 1, 0.75] }
          }
          className="absolute inset-[36%] rounded-full bg-primary-blue"
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : {
                  duration: 1.2,
                  ease: "easeInOut",
                  repeat: Number.POSITIVE_INFINITY,
                }
          }
        />
      </div>
      <span className={compact ? "text-xs" : "text-sm"}>{resolvedLabel}</span>
    </motion.div>
  );
}

export function InlineSpinner({ className }: InlineSpinnerProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.span
      animate={shouldReduceMotion ? { opacity: 1 } : { rotate: 360 }}
      aria-hidden="true"
      className={`inline-block h-4 w-4 rounded-full border-2 border-current/25 border-t-current ${className ?? ""}`}
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : { duration: 0.8, ease: "linear", repeat: Number.POSITIVE_INFINITY }
      }
    />
  );
}

export function LoadingButtonContent({
  isLoading,
  label,
  loadingLabel,
}: LoadingButtonContentProps) {
  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.span
        animate={{ opacity: 1, y: 0 }}
        className="inline-flex items-center justify-center gap-2"
        exit={{ opacity: 0, y: -4 }}
        initial={{ opacity: 0, y: 4 }}
        key={isLoading ? "loading" : "idle"}
        transition={{ duration: 0.15 }}
      >
        {isLoading ? <InlineSpinner /> : null}
        {isLoading ? loadingLabel : label}
      </motion.span>
    </AnimatePresence>
  );
}

export { AnimatePresence, motion };
