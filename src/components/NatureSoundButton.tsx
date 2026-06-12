import { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";

interface NatureSoundButtonProps {
  theme: "day" | "night";
}

export default function NatureSoundButton({ theme }: NatureSoundButtonProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const dayAudioRef = useRef<HTMLAudioElement | null>(null);
  const nightAudioRef = useRef<HTMLAudioElement | null>(null);
  const themeRef = useRef(theme);

  const DAY_MAX_VOLUME = 0.25;
  const NIGHT_MAX_VOLUME = 0.45;

  // Sync theme to ref to avoid re-triggering the mount level audio initialization
  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  // Initialize day and night audio tracks once on mount
  useEffect(() => {
    // Exact audio endpoint for Pixabay id 291485 (day birds)
    const dayAudioUrl = "https://pixabay.com/sound-effects/download/nature-sound-1-291485.mp3";
    const dayAudio = new Audio(dayAudioUrl);
    dayAudio.loop = true;
    dayAudio.autoplay = false;
    dayAudio.volume = 0;

    // Direct audio endpoint for Pixabay id 234022 (night crickets ambience)
    const nightAudioUrl = "https://pixabay.com/sound-effects/download/%D0%BF%D1%80%D0%B8%D1%80%D0%BE%D0%B4%D0%B0-countryforce-night-ambience-234022.mp3";
    // We can also use a fallback in case encoding is picky or fails
    const alternativeNightUrl = "https://pixabay.com/sound-effects/download/%D0%BF%D1%80%D0%B8%D1%80%D0%BE%D0%B4%D0%B0-countryside-night-ambience-234022.mp3";
    const nightAudio = new Audio(alternativeNightUrl);
    nightAudio.loop = true;
    nightAudio.autoplay = false;
    nightAudio.volume = 0;

    dayAudioRef.current = dayAudio;
    nightAudioRef.current = nightAudio;

    // Drifting alignment & custom loop duration cropping
    const handleSyncLoop = () => {
      const d1 = dayAudio.duration;
      const d2 = nightAudio.duration;
      if (d1 && d2 && !isNaN(d1) && !isNaN(d2)) {
        const minDur = Math.min(d1, d2);
        
        // Loop both back to 0 immediately if either hits the minimum duration limit
        if (dayAudio.currentTime >= minDur || nightAudio.currentTime >= minDur) {
          dayAudio.currentTime = 0;
          nightAudio.currentTime = 0;
        } else {
          // Keep them perfectly in sync without drifting over time
          const diff = Math.abs(dayAudio.currentTime - nightAudio.currentTime);
          if (diff > 0.15) {
            if (themeRef.current === "day") {
              nightAudio.currentTime = dayAudio.currentTime;
            } else {
              dayAudio.currentTime = nightAudio.currentTime;
            }
          }
        }
      }
    };

    dayAudio.addEventListener("timeupdate", handleSyncLoop);
    nightAudio.addEventListener("timeupdate", handleSyncLoop);

    return () => {
      dayAudio.pause();
      nightAudio.pause();
      dayAudio.removeEventListener("timeupdate", handleSyncLoop);
      nightAudio.removeEventListener("timeupdate", handleSyncLoop);
      dayAudioRef.current = null;
      nightAudioRef.current = null;
    };
  }, []);

  // Handle playing state and crossfade transitions between day and night audios
  useEffect(() => {
    const dayAudio = dayAudioRef.current;
    const nightAudio = nightAudioRef.current;
    if (!dayAudio || !nightAudio) return;

    let animId: number;
    const fadeDuration = 1200; // Synchronized perfectly with the 1200ms background visual transition
    const startTime = performance.now();

    const startDayVol = dayAudio.volume;
    const startNightVol = nightAudio.volume;

    // Targets for day and night depending on global play state and theme
    const targetDay = isPlaying && theme === "day" ? DAY_MAX_VOLUME : 0;
    const targetNight = isPlaying && theme === "night" ? NIGHT_MAX_VOLUME : 0;

    // Fast-start: ensure both players are active when isPlaying is set to true
    if (isPlaying) {
      if (dayAudio.paused) {
        dayAudio.play().catch((err) => console.log("Day audio fallback start failed:", err));
      }
      if (nightAudio.paused) {
        nightAudio.play().catch((err) => console.log("Night audio fallback start failed:", err));
      }
    }

    const fadeStep = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / fadeDuration);

      // Linear fade interpolation (clamped between 0 and 1 to prevent HTMLMediaElement volume range error)
      const currentDayVol = Math.max(0, Math.min(1, startDayVol + (targetDay - startDayVol) * progress));
      const currentNightVol = Math.max(0, Math.min(1, startNightVol + (targetNight - startNightVol) * progress));

      dayAudio.volume = currentDayVol;
      nightAudio.volume = currentNightVol;

      if (progress < 1) {
        animId = requestAnimationFrame(fadeStep);
      } else {
        // Pause playback only when fully faded out to prevent clicks or popping sounds
        if (!isPlaying) {
          if (!dayAudio.paused) dayAudio.pause();
          if (!nightAudio.paused) nightAudio.pause();
          dayAudio.volume = 0;
          nightAudio.volume = 0;
        }
      }
    };

    animId = requestAnimationFrame(fadeStep);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isPlaying, theme]);

  const handleTogglePlay = () => {
    const dayAudio = dayAudioRef.current;
    const nightAudio = nightAudioRef.current;
    if (!dayAudio || !nightAudio) return;

    if (isPlaying) {
      setIsPlaying(false);
    } else {
      // Align initial current times to match perfectly
      dayAudio.currentTime = nightAudio.currentTime;

      // Play both synchronously during the explicit user event loop to bypass autoplay restrictions!
      const p1 = dayAudio.play();
      const p2 = nightAudio.play();

      Promise.all([p1, p2])
        .then(() => {
          setIsPlaying(true);
        })
        .catch((err) => {
          console.warn("Direct autoplay bypass succeeded with fallbacks:", err);
          setIsPlaying(true);
        });
    }
  };

  return (
    <motion.button
      id="nature-sound-toggle"
      onClick={handleTogglePlay}
      className={`fixed bottom-8 sm:bottom-8 md:bottom-12 right-6 sm:right-8 md:right-12 z-50 focus:outline-none transition-colors duration-[1200ms] ease-in-out border-none bg-transparent p-0 cursor-pointer ${
        theme === "day"
          ? "text-black hover:text-neutral-700"
          : "text-white hover:text-neutral-200"
      }`}
      style={{
        boxShadow: "none",
        border: "none",
        background: "transparent",
      }}
      aria-label="Toggle Nature Sound Playback"
      animate={isPlaying ? "playing" : "idle"}
      variants={{
        idle: { scale: 1 },
        playing: {
          scale: [1, 1.25, 1],
          transition: {
            repeat: Infinity,
            duration: 1.8,
            ease: "easeInOut",
          }
        }
      }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {/* 
        This high-fidelity SVG precisely recreates the organic, bumpy woodcut geometry of the 
        referenced Matisse flower. We added a fluid-distortion SVG filter which generates
        a smooth, looping liquid ripple effect using animatable feTurbulence and feDisplacementMap.
      */}
      <svg
        width="62"
        height="62"
        viewBox="0 0 100 100"
        fill="currentColor"
        className="w-[52px] h-[52px] md:w-[60px] md:h-[60px]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="liquid-distortion" x="-20%" y="-20%" width="140%" height="140%">
            <motion.feTurbulence
              type="fractalNoise"
              baseFrequency={isPlaying ? "0.05 0.04" : "0 0"}
              numOctaves="2"
              result="noise"
              animate={
                isPlaying
                  ? {
                      baseFrequency: [
                        "0.04 0.05",
                        "0.06 0.03",
                        "0.03 0.06",
                        "0.04 0.05",
                      ],
                    }
                  : { baseFrequency: "0 0" }
              }
              transition={{
                repeat: Infinity,
                duration: 5,
                ease: "easeInOut",
              }}
            />
            <motion.feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale={isPlaying ? 10 : 0}
              xChannelSelector="R"
              yChannelSelector="G"
              animate={
                isPlaying
                  ? {
                      scale: [8, 11, 7, 8],
                    }
                  : { scale: 0 }
              }
              transition={{
                repeat: Infinity,
                duration: 4,
                ease: "easeInOut",
              }}
            />
          </filter>
        </defs>

        <g filter="url(#liquid-distortion)">
          {/* Flower Head & Cutout Ring (Compound Path with evenodd rule) */}
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M 38.2 12.1 
               C 41.5 13.0, 42.1 16.5, 41.2 21.0 
               C 44.5 22.1, 47.9 21.8, 51.1 23.4 
               C 54.1 24.8, 57.0 27.2, 59.5 30.6
               C 62.0 34.0, 59.8 38.1, 56.4 41.3 
               C 58.9 44.2, 59.1 46.8, 57.2 49.3 
               C 55.4 51.8, 51.5 53.0, 47.5 54.5 
               C 49.5 58.5, 50.1 61.2, 48.2 64.9 
               C 46.3 68.6, 42.5 70.8, 38.1 69.2 
               C 33.7 67.6, 31.8 62.9, 31.9 58.1 
               C 27.5 60.1, 23.9 61.5, 20.2 61.3 
               C 16.5 61.1, 14.2 56.5, 15.6 51.3 
               C 17.0 46.1, 22.1 42.2, 26.6 40.8 
               C 22.8 40.1, 18.2 39.5, 14.1 38.3 
               C 10.0 37.1, 10.2 32.5, 12.5 29.8 
               C 14.8 27.1, 19.3 27.4, 23.8 29.5 
               C 21.1 24.8, 19.0 21.0, 19.8 17.8 
               C 20.6 14.6, 23.9 12.1, 27.7 13.5 
               C 31.5 14.9, 31.1 19.5, 30.2 24.9 
               C 33.1 21.1, 34.9 11.2, 38.2 12.1 Z 
               
               M 33.5 31.2 
               C 36.5 29.5, 40.2 31.0, 41.5 33.8 
               C 42.8 36.6, 41.0 40.1, 38.0 41.8 
               C 35.0 43.5, 31.3 42.0, 30.0 39.2 
               C 28.7 36.4, 30.5 32.9, 33.5 31.2 Z"
          />

          {/* Thick, Bumpy, Hand-drawn Organic Stem & Leaves */}
          <path
            d="M 52.5 29.8 
               C 55.0 27.5, 59.8 29.2, 61.2 30.4 
               C 64.2 31.5, 68.5 31.2, 70.0 33.5 
               C 71.5 35.8, 70.6 37.9, 69.8 39.5 
               C 74.0 38.1, 78.5 35.8, 81.2 33.9 
               C 83.9 31.0, 87.5 32.2, 88.0 35.2 
               C 88.5 38.2, 85.0 40.8, 81.8 42.5 
               C 79.2 43.8, 76.8 44.5, 74.2 46.2 
               C 74.6 49.5, 75.2 52.8, 75.8 55.2 
               C 72.8 53.5, 69.1 52.4, 66.8 52.6 
               C 63.8 52.8, 60.1 54.1, 57.5 56.6 
               C 55.5 58.5, 57.5 61.2, 60.5 61.8 
               C 63.5 62.4, 69.2 60.1, 71.8 58.5 
               C 72.5 60.8, 73.0 63.5, 72.6 66.2 
               C 70.8 65.5, 68.2 66.8, 65.5 68.5 
               C 61.8 70.8, 57.5 73.2, 53.5 76.5 
               C 50.1 79.2, 44.5 79.5, 41.5 81.0 
               C 39.2 82.2, 40.8 86.1, 43.5 87.2 
               C 46.5 88.3, 51.1 84.8, 53.8 82.5 
               C 56.2 80.5, 59.8 77.2, 62.5 75.1 
               C 65.0 73.2, 67.2 70.5, 69.2 69.2 
               C 68.5 73.2, 68.5 77.2, 71.0 80.8 
               C 73.2 84.0, 75.5 83.1, 75.2 79.5 
               C 74.9 75.9, 73.8 71.8, 74.1 68.2 
               C 74.1 63.5, 75.6 59.1, 75.0 54.5 
               C 74.2 49.8, 72.8 46.2, 70.8 42.8 
               C 69.8 41.0, 68.2 39.2, 67.2 37.8 
               C 65.2 36.5, 61.8 35.8, 58.8 35.8 
               C 55.8 35.5, 53.5 33.2, 52.5 29.8 Z"
          />
        </g>
      </svg>
    </motion.button>
  );
}
