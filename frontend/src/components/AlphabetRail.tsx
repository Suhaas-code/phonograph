import { useRef } from "react";

// Vertical A–Z rail pinned to the right of a scroll container. Tapping a letter
// jumps to that group; dragging a finger (or mouse) scrubs through letters for
// fast scrolling. The parent owns scroll + active-letter detection.
export default function AlphabetRail({
  letters,
  active,
  onSelect,
}: {
  letters: string[];
  active: string;
  onSelect: (letter: string, smooth: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const pick = (clientY: number, smooth: boolean) => {
    const el = ref.current;
    if (!el || letters.length === 0) return;
    const rect = el.getBoundingClientRect();
    const ratio = (clientY - rect.top) / rect.height;
    const idx = Math.min(letters.length - 1, Math.max(0, Math.floor(ratio * letters.length)));
    onSelect(letters[idx], smooth);
  };

  if (letters.length === 0) return null;

  return (
    <div
      ref={ref}
      className="absolute bottom-0 right-0 top-0 z-10 flex touch-none select-none flex-col items-center justify-center gap-px py-2"
      onTouchStart={(e) => pick(e.touches[0].clientY, false)}
      onTouchMove={(e) => {
        e.preventDefault();
        pick(e.touches[0].clientY, false);
      }}
    >
      {letters.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onSelect(l, true)}
          className={`flex h-5 w-6 items-center justify-center rounded text-[11px] font-medium leading-none transition-colors md:h-4 ${
            active === l
              ? "bg-accent font-bold text-ink"
              : "text-gray-500 hover:text-white"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
