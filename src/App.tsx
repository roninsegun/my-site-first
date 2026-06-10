import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import NatureSoundButton from "./components/NatureSoundButton";
import { GlassTransitionBackground } from "./components/GlassTransitionBackground";
import { BlurTextEffect } from "./components/BlurTextEffect";

export default function App() {
  const [theme, setTheme] = useState<"day" | "night">("day");
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 640 : false
  );

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 640;
      setIsMobile(mobile);
      if (!mobile) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className={`min-h-screen w-full flex flex-col justify-start overflow-x-hidden relative transition-colors duration-[1200ms] ease-in-out ${
      theme === "day" ? "text-black" : "text-[#f5f5f5]"
    }`}>
      {/* Immersive Background Glass WebGL Layer (Lowest Layer, z-[-10]) */}
      <GlassTransitionBackground theme={theme} />

      {/* Main Content Workspace */}
      <div className="relative flex flex-col min-h-screen w-full justify-start bg-transparent">
        {/* Editorial Header */}
        <header className={`w-full py-8 md:py-12 px-6 sm:px-8 md:px-12 bg-transparent transition-colors duration-[1200ms] ease-in-out relative ${
          theme === "day" ? "text-black" : "text-[#f5f5f5]"
        }`}>

        <div 
          id="header-container"
          className="grid grid-cols-12 gap-y-0 items-baseline w-full font-sans text-[14px] sm:text-[18px] font-normal tracking-tight select-none relative"
        >
          {/* Column 1: Flow (Desktop & Tablet) */}
          <div id="brand-item" className="hidden sm:block sm:col-start-1 sm:col-span-1 relative z-30">
            <span className="cursor-pointer transition-opacity duration-200 hover:opacity-75 font-normal">
              Flow
            </span>
          </div>

          {/* Mobile Description replaces brand "Flow" on the left, only list items are in menu when open */}
          <div 
            id="brand-item-mobile" 
            className="sm:hidden col-span-9 font-sans text-[14px] font-normal text-current tracking-tight leading-normal relative z-10"
          >
            You don’t chase ideas — you execute them.
          </div>

          {/* Column 2: Sync */}
          <div id="place-item" className="col-span-1 hidden sm:block sm:col-start-2 sm:col-span-1 relative z-30">
            <span className="cursor-pointer transition-opacity duration-200 hover:opacity-75">
              Sync
            </span>
          </div>

          {/* Column 3: System */}
          <div id="environments-item" className="col-span-2 hidden sm:block sm:col-start-3 sm:col-span-2 relative z-30">
            <span className="cursor-pointer transition-opacity duration-200 hover:opacity-75">
              System
            </span>
          </div>

          {/* Column 7: Central Message / Description */}
          <div id="message-item" className="col-span-5 hidden sm:block sm:col-start-7 sm:col-span-5 sm:text-left lg:text-right text-neutral-500/80 sm:text-inherit leading-normal transition-colors duration-[1200ms] ease-in-out relative z-30">
            <span className="cursor-pointer transition-opacity duration-200 hover:opacity-75 whitespace-pre-wrap">
                You don’t chase ideas — you execute them.
            </span>
          </div>

          {/* Column 12: Work (Desktop & Tablet right-aligned) */}
          <div id="work-item" className="hidden sm:block sm:col-start-12 sm:col-span-1 text-right relative z-30">
            <span className="cursor-pointer transition-opacity duration-200 hover:opacity-75">
              Work
            </span>
          </div>

          {/* Column 12: Menu / Toggle (Mobile only) */}
          <div id="menu-item" className="sm:hidden col-span-3 col-start-10 text-right relative z-50 flex flex-col items-end">
            <span 
              onClick={() => setMenuOpen(!menuOpen)}
              className="cursor-pointer font-normal selection:bg-transparent text-[14px]"
            >
              <AnimatePresence mode="wait">
                <motion.span
                  key={menuOpen ? "close" : "menu"}
                  initial={{ y: 6, opacity: 0, filter: "blur(1px)" }}
                  animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                  exit={{ y: -6, opacity: 0, filter: "blur(1px)" }}
                  whileTap={{ scale: 0.88, y: 1 }}
                  transition={{ 
                    duration: 0.22, 
                    ease: "easeOut",
                  }}
                  className="inline-block"
                >
                  {menuOpen ? "Close" : "Menu"}
                </motion.span>
              </AnimatePresence>
            </span>
          </div>
        </div>
      </header>

      {/* Hero Title and Switcher Container */}
      <main className="flex-1 w-full flex items-center justify-center p-6 md:p-12 overflow-hidden selection:bg-neutral-100 pb-20 md:pb-24">
        <div className="flex flex-col items-center gap-y-8 md:gap-y-12 relative -translate-y-[40px] md:-translate-y-[80px] w-full max-w-7xl">
          <h1 
            id="hero-title"
            className={`font-lora font-normal text-center leading-[0.85] select-none text-[13vw] sm:text-[11vw] md:text-[10vw] lg:text-[9.5vw] xl:text-[9vw] transition-colors duration-[1200ms] ease-in-out ${
              theme === "day" ? "text-black" : "text-white"
            }`}
            style={{ letterSpacing: "-0.04em" }}
          >
            <BlurTextEffect 
              text={"Focus hits\nanytime"}
              blurDirection="both"
              blurIntensity={8}
              blurWidth={45}
            />
          </h1>
          
          {/* Custom high-fidelity pill switcher with proportional mobile/desktop scaling */}
          <motion.div 
            id="theme-switcher-container"
            onClick={() => setTheme(theme === "day" ? "night" : "day")}
            style={{
              width: isMobile ? "210px" : "270px",
              height: isMobile ? "46px" : "60px",
              padding: isMobile ? "3px" : "4px",
            }}
            whileHover={{ 
              scale: 0.96,
            }}
            whileTap={{ scale: 0.93 }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 30,
            }}
            className={`relative rounded-full flex items-center select-none cursor-pointer transition-[background-color,border-color] duration-[1200ms] ease-in-out shadow-sm ${
              theme === "day" 
                ? "bg-[#111111] border border-neutral-900" 
                : "bg-[#f5f5f5] border border-neutral-300 active:border-neutral-400"
            }`}
          >
            {/* Day Option Toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setTheme("day");
              }}
              className="flex-1 relative z-10 h-full flex items-center justify-center font-sans font-normal tracking-tight focus:outline-none cursor-pointer"
              style={{
                fontSize: isMobile ? "14px" : "18px",
              }}
            >
              <motion.span 
                animate={{
                  scale: theme === "day" ? 1.04 : 0.93,
                  opacity: theme === "day" ? 1 : 0.45,
                  filter: theme === "day" ? "blur(0px)" : "blur(0.35px)",
                }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 25,
                }}
                className={`relative inline-flex items-start ${
                  theme === "day" 
                    ? "text-neutral-950 font-medium" 
                    : "text-neutral-500 hover:text-[#111111]"
                }`}
              >
                day
                <span 
                  className={`relative -top-1 font-sans transition-colors duration-[1200ms] ease-in-out ${
                    theme === "day" ? "text-neutral-950/70" : "text-neutral-500/60"
                  }`}
                  style={{
                    fontSize: isMobile ? "7.7px" : "10px",
                    marginLeft: isMobile ? "1px" : "2px",
                  }}
                >p.m.</span>
              </motion.span>
            </button>

            {/* Night Option Toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setTheme("night");
              }}
              className="flex-1 relative z-10 h-full flex items-center justify-center font-sans font-normal tracking-tight focus:outline-none cursor-pointer"
              style={{
                fontSize: isMobile ? "14px" : "18px",
              }}
            >
              <motion.span 
                animate={{
                  scale: theme === "night" ? 1.04 : 0.93,
                  opacity: theme === "night" ? 1 : 0.45,
                  filter: theme === "night" ? "blur(0px)" : "blur(0.35px)",
                }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 25,
                }}
                className={`relative inline-flex items-start ${
                  theme === "night" 
                    ? "text-white font-medium" 
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                night
                <span 
                  className={`relative -top-1 font-sans transition-colors duration-[1200ms] ease-in-out ${
                    theme === "night" ? "text-white/70" : "text-neutral-400/60"
                  }`}
                  style={{
                    fontSize: isMobile ? "7.7px" : "10px",
                    marginLeft: isMobile ? "1px" : "2px",
                  }}
                >a.m.</span>
              </motion.span>
            </button>

            {/* Sliding Highlight Pill */}
            <motion.div
              initial={false}
              animate={{
                top: isMobile ? "3px" : "4px",
                bottom: isMobile ? "3px" : "4px",
                width: isMobile ? "calc(50% - 3px)" : "calc(50% - 4px)",
                left: theme === "day" 
                  ? (isMobile ? "3px" : "4px") 
                  : "calc(50%)",
              }}
              transition={{
                type: "spring",
                stiffness: 420,
                damping: 28,
                mass: 0.9,
              }}
              className={`absolute rounded-full shadow-md ${
                theme === "day" ? "bg-white" : "bg-black"
              }`}
            />
          </motion.div>
        </div>
      </main>

      {/* Full-Screen overlay burger menu on mobile */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Soft backdrop blur with interactive dismiss click */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.75, ease: [0.25, 1, 0.5, 1] }}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-40 bg-black/5 dark:bg-black/20 backdrop-blur-[3px] sm:hidden"
            />

            {/* Sliding Menu Panel with synchronized theme styling and high-end liquid glass effect */}
            <motion.div
              variants={{
                hidden: { 
                  x: "100%", 
                  opacity: 0,
                  transition: { duration: 0.6, ease: [0.25, 1, 0.5, 1] }
                },
                visible: { 
                  x: 0, 
                  opacity: 1,
                  transition: { 
                    duration: 0.75, 
                    ease: [0.25, 1, 0.5, 1],
                    staggerChildren: 0.06,
                    delayChildren: 0.15
                  }
                }
              }}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className={`fixed top-0 right-0 h-full w-[280px] sm:w-[320px] sm:hidden z-45 flex flex-col justify-start px-6 pt-[120px] pb-6 shadow-2xl backdrop-blur-[24px] transition-colors duration-[1200ms] ease-in-out ${
                theme === "day" 
                  ? "bg-white/65 text-black" 
                  : "bg-[#0b0b0b]/65 text-white"
              }`}
            >
              <div className="flex flex-col gap-y-4">
                {["Flow", "Sync", "System", "Work"].map((item) => (
                  <motion.div
                    key={item}
                    variants={{
                      hidden: { x: 15, opacity: 0 },
                      visible: { 
                        x: 0, 
                        opacity: 1,
                        transition: { type: "spring", stiffness: 100, damping: 20 }
                      }
                    }}
                    whileHover={{ opacity: 0.7 }}
                    whileTap={{ opacity: 0.5 }}
                    onClick={() => setMenuOpen(false)}
                    className="cursor-pointer font-sans text-[14px] font-normal tracking-tight py-2"
                  >
                    {item}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <NatureSoundButton theme={theme} />
      </div>
    </div>
  );
}
