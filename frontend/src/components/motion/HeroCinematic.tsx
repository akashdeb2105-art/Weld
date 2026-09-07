'use client';

import { motion, useReducedMotion, type Variants } from 'motion/react';
import type { ReactNode } from 'react';

/**
 * Hero entrance (M6 cinematic polish). The headline, sub-copy, CTAs, and the
 * prompt→bible card rise in sequence on load. Honors prefers-reduced-motion by
 * rendering with no transform/opacity animation. Uses the WELD ease token.
 */

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]; // --ease-weld-out

export function HeroCinematic({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const variants: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.12, delayChildren: 0.05 } },
  };
  return (
    <motion.div variants={variants} initial="hidden" animate="show" className="contents">
      {children}
    </motion.div>
  );
}

/** One beat of the hero entrance. */
export function HeroBeat({
  children,
  className,
  y = 26,
}: {
  children: ReactNode;
  className?: string;
  y?: number;
}) {
  const reduce = useReducedMotion();
  const variants: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : y },
    show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
  };
  return (
    <motion.div className={className} variants={variants}>
      {children}
    </motion.div>
  );
}
