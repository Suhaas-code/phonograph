import { useCallback, useEffect, useRef, useState } from "react";

// Wires an alphabet rail to a scroll container: tracks the active letter while
// scrolling and jumps to a letter's group on demand. The caller renders group
// headers and registers each via setHeaderRef(letter).
export function useAlphabetScroll(letters: string[]) {
  const containerRef = useRef<HTMLDivElement>(null);
  const headerRefs = useRef<Record<string, HTMLElement | null>>({});
  const [active, setActive] = useState(letters[0] ?? "");

  const setHeaderRef = useCallback(
    (letter: string) => (el: HTMLElement | null) => {
      headerRefs.current[letter] = el;
    },
    []
  );

  const onScroll = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    const top = c.scrollTop + 4;
    let current = letters[0] ?? "";
    for (const l of letters) {
      const el = headerRefs.current[l];
      if (el && el.offsetTop <= top) current = l;
    }
    if (current) setActive(current);
  }, [letters]);

  const jump = useCallback((letter: string, smooth: boolean) => {
    const c = containerRef.current;
    const el = headerRefs.current[letter];
    if (c && el) c.scrollTo({ top: el.offsetTop, behavior: smooth ? "smooth" : "auto" });
    setActive(letter);
  }, []);

  // Keep the active letter valid when the set changes (filter/sort).
  useEffect(() => {
    setActive((prev) => (letters.includes(prev) ? prev : letters[0] ?? ""));
  }, [letters]);

  return { containerRef, setHeaderRef, active, onScroll, jump };
}
