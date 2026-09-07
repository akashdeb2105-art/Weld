'use client';

import { motion, useReducedMotion, type Variants } from 'motion/react';
import type { ReactNode } from 'react';

/**
 * Scroll-triggered reveal (M6 cinematic polish). Content fades + rises into
 * view when it enters the viewport. Honors prefers-reduced-motion by rendering
 * fully opaque with no transform. Uses the WELD ease token (--ease-weld-out).
 *
 * Motion communicates structure (the loop unfolding scene by scene); it is
 * never decoration that lies about the product.
 */

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]; // --ease-weld-out

export function Reveal({
  children,
  delay = 0,
  y = 22,
  className,
}: {
  children: ReactNode;
  /** seconds before this element starts once in view */
  delay?: number;
  /** px to rise from */
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();

  const variants: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : y },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: EASE, delay },
    },
  };

  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-64px' }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Stagger container: children wrapped in <RevealItem> cascade in as the group
 * enters the viewport. `as` keeps list semantics (e.g. "ol") when needed.
 */
export function RevealGroup({
  children,
  className,
  stagger = 0.08,
  as = 'div',
}: {
  children: ReactNode;
  className?: string;
  /** seconds between each child */
  stagger?: number;
  as?: 'div' | 'ol' | 'ul';
}) {
  const reduce = useReducedMotion();
  const variants: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : stagger } },
  };
  const Tag = as === 'ol' ? motion.ol : as === 'ul' ? motion.ul : motion.div;
  return (
    <Tag
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-64px' }}
    >
      {children}
    </Tag>
  );
}

/** A child of <RevealGroup>. `as="li"` keeps list semantics. */
export function RevealItem({
  children,
  className,
  y = 18,
  as = 'div',
}: {
  children: ReactNode;
  className?: string;
  y?: number;
  as?: 'div' | 'li';
}) {
  const reduce = useReducedMotion();
  const variants: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : y },
    show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
  };
  const Tag = as === 'li' ? motion.li : motion.div;
  return (
    <Tag className={className} variants={variants}>
      {children}
    </Tag>
  );
}
