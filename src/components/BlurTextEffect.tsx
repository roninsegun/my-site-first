import React, { useMemo, useEffect, useRef } from "react";

interface BlurTextEffectProps {
  text: string;
  blurDirection?: "left" | "right" | "both";
  blurIntensity?: number; // default 8px (soft, mystical blur)
  blurWidth?: number; // 0..100, default 45%
  className?: string;
  style?: React.CSSProperties;
}

export const BlurTextEffect: React.FC<BlurTextEffectProps> = ({
  text,
  blurDirection = "both",
  blurIntensity = 8,
  blurWidth = 45,
  className = "",
  style,
}) => {
  const lines = useMemo(() => text.split("\n"), [text]);
  const blurThreshold = useMemo(() => Math.max(0, Math.min(1, blurWidth / 100)), [blurWidth]);

  // Keep references to all character spans for direct high-speed DOM styling
  const charRefs = useRef<Array<HTMLSpanElement | null>>([]);
  
  // Track animated blur state of each character independently with inertia (LERP)
  const animatedBlurs = useRef<number[]>([]);
  
  // Keep pointer location in a mutable ref to dodge React render cycles during movement
  const pointerRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });

  const containerRef = useRef<HTMLSpanElement | null>(null);
  
  // High-performance ref to detect if user has active mouse or needs touch flow sweep
  const isMouseUserRef = useRef<boolean>(true);

  // Calculate static target blurs for resting/default state
  const staticBlurs = useMemo(() => {
    let flatIndex = 0;
    const list: number[] = [];
    
    lines.forEach((line) => {
      const total = line.length;
      line.split("").forEach((_, charIndex) => {
        const t = total <= 1 ? 0 : charIndex / (total - 1);
        let dist = 0;

        if (blurDirection === "both") {
          dist = Math.min(t, 1 - t);
        } else if (blurDirection === "right") {
          dist = 1 - t;
        } else {
          dist = t;
        }

        let blurVal = 0;
        if (blurIntensity > 0 && blurThreshold > 0 && dist <= blurThreshold) {
          blurVal = blurIntensity * (1 - dist / blurThreshold);
        }
        list.push(blurVal);
        flatIndex++;
      });
    });
    
    return list;
  }, [lines, blurDirection, blurIntensity, blurThreshold]);

  // Initialize and update the ref pointer move listener, detecting pointer class dynamically
  useEffect(() => {
    // Initial guess: if it is a touch device / tablet / mobile
    const isCoarseTouch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
    const isSmallScreen = typeof window !== "undefined" && window.innerWidth < 1024;
    
    // Default to mouse mode on typical desktop, auto-sweep on typical mobile/tablet
    isMouseUserRef.current = !isCoarseTouch && !isSmallScreen;

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === "mouse") {
        isMouseUserRef.current = true;
      } else if (e.pointerType === "touch" || e.pointerType === "pen") {
        isMouseUserRef.current = false;
      }
      pointerRef.current.x = e.clientX;
      pointerRef.current.y = e.clientY;
      pointerRef.current.active = true;
    };

    const handlePointerLeave = () => {
      // For desktop/hover users, leaving the document should restore the default blurred look
      if (isMouseUserRef.current) {
        pointerRef.current.active = false;
      }
    };

    // Listen to touch events directly to also force touch/mobile mode off mouse-hover
    const handleTouchStart = () => {
      isMouseUserRef.current = false;
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("pointerleave", handlePointerLeave, { passive: true });
    window.addEventListener("pointercancel", handlePointerLeave, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("pointercancel", handlePointerLeave);
      window.removeEventListener("touchstart", handleTouchStart);
    };
  }, []);

  // Set up the animation frame ticks for dynamic fluid interpolation
  useEffect(() => {
    let animationFrameId: number;
    
    // Smooth LERP (linear interpolation) speed factor - makes the focus slide like liquid glass
    const lerpSpeed = 0.12; 
    // Radius of maximum clarity around cursor (in pixels) - increased for larger area of effect
    const focusRadius = 240;

    const tick = () => {
      const activeSpans = charRefs.current;
      const staticVals = staticBlurs;
      const { x, y, active } = pointerRef.current;
      const container = containerRef.current;

      let px = x;
      let py = y;
      let isFocusActive = active;

      // If we are NOT in mouse mode (coarse-touch device / tablet / mobile),
      // we utilize our smooth sweeping automatic floating highlighter.
      if (!isMouseUserRef.current && container) {
        const rect = container.getBoundingClientRect();
        if (rect && rect.width > 0) {
          isFocusActive = true;
          const time = performance.now() / 1000;
          
          // Smoother horizontal sweep back and forth across the title bounding box of BlurTextEffect
          const xFactor = 0.5 + 0.38 * Math.sin(time * 1.4);
          px = rect.left + rect.width * xFactor;
          
          // Subtle vertical waving to elegantly cover multiple lines
          const yFactor = 0.5 + 0.18 * Math.cos(time * 0.9);
          py = rect.top + rect.height * yFactor;
        }
      }

      // Ensure that state array matches active ref size
      if (animatedBlurs.current.length !== activeSpans.length) {
        animatedBlurs.current = activeSpans.map((_, i) => staticVals[i] ?? 0);
      }

      for (let i = 0; i < activeSpans.length; i++) {
        const span = activeSpans[i];
        if (!span) continue;

        let targetBlur = staticVals[i] ?? 0;

        if (isFocusActive) {
          // Calculate distance from cursor to span's mid-point
          const rect = span.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          
          const distance = Math.hypot(px - cx, py - cy);

          if (distance < focusRadius) {
            // Under the cursor / close by: text becomes crisp and fully sharp
            // Using a power of 1.8 curve makes the transition to clarity much sharper and broadens the crisp center zone.
            const ratio = distance / focusRadius; // 0 (at center) to 1 (at edge of lens)
            targetBlur = Math.pow(ratio, 1.8) * blurIntensity;
          } else {
            // Outside of clarity lens: stays softly blurred at maximum selected intensity
            targetBlur = blurIntensity;
          }
        }

        // Apply physics LERP to current animated value
        const current = animatedBlurs.current[i] ?? targetBlur;
        const next = current + (targetBlur - current) * lerpSpeed;
        animatedBlurs.current[i] = next;

        // Directly modify style for elite frame-rate efficiency
        span.style.filter = next > 0.1 ? `blur(${next.toFixed(2)}px)` : "none";
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [staticBlurs, blurIntensity]);

  // Reset arrays when text content or structure changes to prevent stale indices
  charRefs.current = [];

  let flatIndexCount = 0;

  return (
    <span
      ref={containerRef}
      className={`inline-flex flex-col items-center ${className}`}
      style={{ ...style, width: "100%" }}
    >
      {lines.map((line, lineIndex) => {
        const words = line.split(" ");

        return (
          <span
            key={lineIndex}
            className="inline-flex flex-wrap justify-center items-center"
            style={{ width: "100%" }}
          >
            {words.map((word, wordIndex) => {
              const wordChars = word.split("");
              return (
                <span key={wordIndex} className="inline-flex whitespace-nowrap">
                  {wordChars.map((char, charIndex) => {
                    const currentFlatIndex = flatIndexCount;
                    flatIndexCount++;

                    return (
                      <span
                        key={charIndex}
                        ref={(el) => {
                          charRefs.current[currentFlatIndex] = el;
                        }}
                        className="inline-block"
                        style={{
                          willChange: "filter",
                          filter: (staticBlurs[currentFlatIndex] ?? 0) > 0.1 
                            ? `blur(${(staticBlurs[currentFlatIndex] ?? 0).toFixed(2)}px)` 
                            : "none",
                        }}
                      >
                        {char}
                      </span>
                    );
                  })}
                  
                  {/* Append a space character after the word if it's not the last word */}
                  {wordIndex < words.length - 1 && (() => {
                    const spaceFlatIndex = flatIndexCount;
                    flatIndexCount++;
                    return (
                      <span
                        ref={(el) => {
                          charRefs.current[spaceFlatIndex] = el;
                        }}
                        className="inline-block"
                        style={{
                          willChange: "filter",
                          filter: (staticBlurs[spaceFlatIndex] ?? 0) > 0.1 
                            ? `blur(${(staticBlurs[spaceFlatIndex] ?? 0).toFixed(2)}px)` 
                            : "none",
                        }}
                      >
                        {"\u00A0"}
                      </span>
                    );
                  })()}
                </span>
              );
            })}
          </span>
        );
      })}
    </span>
  );
};

export default BlurTextEffect;
