import { motion, useReducedMotion } from 'framer-motion'

const OFFSETS = {
  up: { y: 28 },
  down: { y: -28 },
  left: { x: 28 },
  right: { x: -28 },
  none: {},
}

/**
 * Animates its children into view as they scroll into the viewport.
 * Shared by all landing page sections so reveals feel consistent.
 */
export default function ScrollReveal({
  children,
  direction = 'up',
  delay = 0,
  duration = 0.5,
  once = true,
  className,
}) {
  const reduceMotion = useReducedMotion()

  if (reduceMotion) {
    return <div className={className}>{children}</div>
  }

  const offset = OFFSETS[direction] ?? OFFSETS.up

  return (
    <motion.div
      initial={{ opacity: 0, ...offset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once, amount: 0.3 }}
      transition={{ duration, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
