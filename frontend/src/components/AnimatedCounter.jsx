import { useEffect, useRef, useState } from "react";

function clampDuration(delta) {
  if (delta >= 500) {
    return 980;
  }
  if (delta >= 100) {
    return 760;
  }
  return 520;
}

export default function AnimatedCounter({ value = 0, decimals = 0, className = "" }) {
  const target = Number.isFinite(Number(value)) ? Number(value) : 0;
  const [displayValue, setDisplayValue] = useState(target);
  const previousRef = useRef(target);
  const frameRef = useRef(null);

  useEffect(() => {
    const start = previousRef.current;
    const end = target;
    if (start === end) {
      setDisplayValue(end);
      return undefined;
    }

    const delta = Math.abs(end - start);
    const duration = clampDuration(delta);
    const startAt = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - startAt) / duration, 1);
      const eased = 1 - (1 - progress) * (1 - progress);
      const next = start + (end - start) * eased;
      setDisplayValue(next);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        previousRef.current = end;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [target]);

  return <span className={className}>{displayValue.toFixed(decimals)}</span>;
}
