import { useRef, useCallback, useEffect } from "react";

const RADIUS = 150;

export function useSpyglass(containerRef: React.RefObject<HTMLElement | null>) {
  const targetRef = useRef<HTMLElement | null>(null);

  const setTarget = useCallback((el: HTMLElement | null) => {
    targetRef.current = el;
    if (el) {
      el.style.clipPath = "circle(0px at 0px 0px)";
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMove = (clientX: number, clientY: number) => {
      const el = targetRef.current;
      if (!el) return;
      const rect = container.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      el.style.clipPath = `circle(${RADIUS}px at ${x}px ${y}px)`;
    };

    const onMouse = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const onLeave = () => {
      const el = targetRef.current;
      if (el) {
        el.style.clipPath = "circle(0px at 0px 0px)";
      }
    };

    container.addEventListener("mousemove", onMouse);
    container.addEventListener("touchmove", onTouch);
    container.addEventListener("mouseleave", onLeave);

    return () => {
      container.removeEventListener("mousemove", onMouse);
      container.removeEventListener("touchmove", onTouch);
      container.removeEventListener("mouseleave", onLeave);
    };
  }, [containerRef]);

  return { setTarget };
}
