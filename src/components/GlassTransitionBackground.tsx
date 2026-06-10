import React, { useEffect, useRef } from "react";
import { vertexShader, fragmentShader } from "./UnfocusedShaders";

interface GlassTransitionBackgroundProps {
  theme: "day" | "night";
}

// Cubic bezier easing matching Jayzhushi's Framer transition: [0.25, 0.8, 0.25, 1]
function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

export const GlassTransitionBackground: React.FC<GlassTransitionBackgroundProps> = ({ theme }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Keep latest refs of theme and animation progress for WebGL render consistency
  const transitionRef = useRef({
    linearProgress: 1.0,
    currentProgress: 1.0,
    fromTheme: theme,
    toTheme: theme,
    startTime: 0,
    isAnimating: false,
  });

  // Track textures and GL instances
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const texturesRef = useRef<{ day: WebGLTexture | null; night: WebGLTexture | null }>({
    day: null,
    night: null,
  });
  const videosRef = useRef<{ day: HTMLVideoElement | null; night: HTMLVideoElement | null }>({
    day: null,
    night: null,
  });
  const videosLoadedRef = useRef<{ day: boolean; night: boolean }>({
    day: false,
    night: false,
  });

  const triggerTransitionRef = useRef<(toTheme: "day" | "night") => void>(() => {});

  // Handle trigger animation on theme change
  useEffect(() => {
    if (triggerTransitionRef.current) {
      triggerTransitionRef.current(theme);
    }
  }, [theme]);

  // Handle WebGL initialization and assets binding
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { alpha: false, antialias: true, premultipliedAlpha: false });
    if (!gl) {
      console.error("WebGL not supported in this browser");
      return;
    }
    glRef.current = gl;

    // Compile Shaders helper
    const compileShader = (source: string, type: number): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compilation error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compileShader(vertexShader, gl.VERTEX_SHADER);
    const fs = compileShader(fragmentShader, gl.FRAGMENT_SHADER);

    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program linking error:", gl.getProgramInfoLog(program));
      return;
    }
    programRef.current = program;

    // Cleanup redundant shaders
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    // Setup Quad Geometry
    const vertices = new Float32Array([
      -1, -1, 0,  0, 0,
       1, -1, 0,  1, 0,
      -1,  1, 0,  0, 1,
      -1,  1, 0,  0, 1,
       1, -1, 0,  1, 0,
       1,  1, 0,  1, 1,
    ]);

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // Retrieve Attribute locations
    const positionLocation = gl.getAttribLocation(program, "position");
    const uvLocation = gl.getAttribLocation(program, "uv");

    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 20, 0);

    gl.enableVertexAttribArray(uvLocation);
    gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 20, 12);

    const render = () => {
      const activeGl = glRef.current;
      const activeProg = programRef.current;
      if (!activeGl || !activeProg || !canvasRef.current) return;

      activeGl.clearColor(0.043, 0.043, 0.043, 1.0);
      activeGl.clear(activeGl.COLOR_BUFFER_BIT);

      activeGl.useProgram(activeProg);

      // Identity matrices for projection & modelView inside shader
      const identityMatrix = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ]);

      const projMatrixLoc = activeGl.getUniformLocation(activeProg, "projectionMatrix");
      const mvMatrixLoc = activeGl.getUniformLocation(activeProg, "modelViewMatrix");
      activeGl.uniformMatrix4fv(projMatrixLoc, false, identityMatrix);
      activeGl.uniformMatrix4fv(mvMatrixLoc, false, identityMatrix);

      // Canvas dimensions
      const uPanelSizeLoc = activeGl.getUniformLocation(activeProg, "uPanelSize");
      activeGl.uniform2f(uPanelSizeLoc, canvasRef.current.width, canvasRef.current.height);

      // Underlying resolution size
      const uMediaSizeLoc = activeGl.getUniformLocation(activeProg, "uMediaSize");
      const activeTheme = transitionRef.current.toTheme;
      const activeVidElement = videosRef.current[activeTheme];
      const videoW = activeVidElement && activeVidElement.videoWidth ? activeVidElement.videoWidth : 1280;
      const videoH = activeVidElement && activeVidElement.videoHeight ? activeVidElement.videoHeight : 720;
      activeGl.uniform2f(uMediaSizeLoc, videoW, videoH);

      // Fit mode (1: Cover, 0: Contain)
      const uFitModeLoc = activeGl.getUniformLocation(activeProg, "uFitMode");
      activeGl.uniform1i(uFitModeLoc, 1);

      // Transition parameters evaluation
      const prog = transitionRef.current.currentProgress;
      
      // Select textures and blend parameters (crossfade mix)
      const fromTex = texturesRef.current[transitionRef.current.fromTheme] || texturesRef.current.day || texturesRef.current.night;
      const toTex = texturesRef.current[transitionRef.current.toTheme] || texturesRef.current.day || texturesRef.current.night;

      if (fromTex) {
        activeGl.activeTexture(activeGl.TEXTURE0);
        activeGl.bindTexture(activeGl.TEXTURE_2D, fromTex);
        const uTexture1Loc = activeGl.getUniformLocation(activeProg, "uTexture1");
        activeGl.uniform1i(uTexture1Loc, 0);
      }

      if (toTex) {
        activeGl.activeTexture(activeGl.TEXTURE1);
        activeGl.bindTexture(activeGl.TEXTURE_2D, toTex);
        const uTexture2Loc = activeGl.getUniformLocation(activeProg, "uTexture2");
        activeGl.uniform1i(uTexture2Loc, 1);
      }

      // Set the smooth transition progress as uMixRatio (0.0 means 100% fromTheme, 1.0 means 100% toTheme)
      const mixRatioLoc = activeGl.getUniformLocation(activeProg, "uMixRatio");
      activeGl.uniform1f(mixRatioLoc, prog);

      // Compute visual distortion parameters as a function of current transition status
      // At prog=0 or prog=1 we want flawless, razor-sharp, zero-distortion rendering of the passive background
      // At prog=0.5, we reach apex distortion, blurring, and color chromatography
      const curve = Math.sin(prog * Math.PI); // beautiful sine dome (0 -> 1 -> 0)

      // Unfocused Transition configuration matching Framer properties & curves
      const blurValue = curve * 200.0;
      const angleValue = 45 * (Math.PI / 180); // 45 degrees in radians
      const falloffValue = 1.0;
      const falloffTypeValue = 0.0;
      const dispersionValue = curve * 0.2;
      const noiseValue = 0.0; // Completely disable noise/grain
      const noiseBlendValue = 0.0;
      const scaleValue = curve * 0.15; // elegant zoom in transition distortion
      const centerValue = [0.5, 0.5];
      const originValue = [0.0, 0.5];

      // Inject Uniforms into Fragment Shader
      activeGl.uniform1f(activeGl.getUniformLocation(activeProg, "uBlur"), blurValue);
      activeGl.uniform1f(activeGl.getUniformLocation(activeProg, "uAngle"), angleValue);
      activeGl.uniform1f(activeGl.getUniformLocation(activeProg, "uFalloff"), falloffValue);
      activeGl.uniform1f(activeGl.getUniformLocation(activeProg, "uFalloffType"), falloffTypeValue);
      activeGl.uniform1f(activeGl.getUniformLocation(activeProg, "uDispersion"), dispersionValue);
      activeGl.uniform1f(activeGl.getUniformLocation(activeProg, "uNoise"), noiseValue);
      activeGl.uniform1f(activeGl.getUniformLocation(activeProg, "uNoiseBlend"), noiseBlendValue);
      activeGl.uniform1f(activeGl.getUniformLocation(activeProg, "uScale"), scaleValue);
      activeGl.uniform2f(activeGl.getUniformLocation(activeProg, "uCenter"), centerValue[0], centerValue[1]);
      activeGl.uniform2f(activeGl.getUniformLocation(activeProg, "uOrigin"), originValue[0], originValue[1]);

      // Run Draw call
      activeGl.drawArrays(activeGl.TRIANGLES, 0, 6);
    };

    // Helper to load video and initialize its texture on GPU
    const loadVideo = (url: string, key: "day" | "night") => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);

      // Pre-fill with a placeholder pixel while video frames load
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array(key === "day" ? [255, 255, 255, 255] : [11, 11, 11, 255])
      );

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      texturesRef.current[key] = tex;

      const video = document.createElement("video");
      video.src = url;
      video.crossOrigin = "anonymous";
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.style.display = "none";

      // Append to DOM to make it behave nicely, play automatically
      document.body.appendChild(video);

      video.addEventListener("canplaythrough", () => {
        videosLoadedRef.current[key] = true;
        render();
      }, { once: true });

      video.play().catch((err) => {
        console.warn("Autoplay was prevented by browser preferences, it will play on interaction:", err);
      });

      videosRef.current[key] = video;
    };

    // Pre-load Day and Night background videos using direct MP4 links
    loadVideo("https://d8j0ntlcm91z4.cloudfront.net/user_39ca84eAE1ODL9hbR5VhoEj8tBf/hf_20260610_094543_91773f9a-6afd-487c-9b97-d7026b2656fe.mp4", "day");
    loadVideo("https://d8j0ntlcm91z4.cloudfront.net/user_39ca84eAE1ODL9hbR5VhoEj8tBf/hf_20260610_095534_2cd61916-11fa-4a3d-b450-3b8cc6f87304.mp4", "night");

    // Dynamic dimensions handler
    const resizeCanvas = () => {
      const outer = containerRef.current;
      if (!outer || !glRef.current || !canvasRef.current) return;
      
      const width = outer.clientWidth;
      const height = outer.clientHeight;
      
      canvasRef.current.width = width;
      canvasRef.current.height = height;
      glRef.current.viewport(0, 0, width, height);
      
      render();
    };

    // Use ResizeObserver for precise resize feedback
    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Animation progress ticker / scheduler inside useEffect
    let animationFrameId = 0;
    const duration = 1200; // Let's use 1.2s for an incredibly luxurious, seamless transition

    const tick = (now: number) => {
      // Check if we are animating a transition
      if (transitionRef.current.isAnimating) {
        const elapsed = now - transitionRef.current.startTime;
        let rawProgress = elapsed / duration;
        
        if (rawProgress >= 1.0) {
          rawProgress = 1.0;
          transitionRef.current.isAnimating = false;
        }
        
        const easedProgress = easeOutQuart(rawProgress);
        transitionRef.current.linearProgress = rawProgress;
        transitionRef.current.currentProgress = easedProgress;
      }

      // Check current state and dynamically upload current video(s) frame(s) to WebGL texture(s)
      const activeGl = glRef.current;
      if (activeGl) {
        const fromTheme = transitionRef.current.fromTheme;
        const toTheme = transitionRef.current.toTheme;
        const isAnim = transitionRef.current.isAnimating;

        const uploadVideoFrame = (texture: WebGLTexture | null, video: HTMLVideoElement | null) => {
          if (video && texture && video.readyState >= video.HAVE_CURRENT_DATA) {
            activeGl.pixelStorei(activeGl.UNPACK_FLIP_Y_WEBGL, true);
            activeGl.bindTexture(activeGl.TEXTURE_2D, texture);
            activeGl.texImage2D(activeGl.TEXTURE_2D, 0, activeGl.RGBA, activeGl.RGBA, activeGl.UNSIGNED_BYTE, video);
          }
        };

        if (isAnim) {
          // During transition, upload both videos to active WebGL textures
          uploadVideoFrame(texturesRef.current.day, videosRef.current.day);
          uploadVideoFrame(texturesRef.current.night, videosRef.current.night);
        } else {
          // Stable state: upload only the active video texture to optimize performance
          const activeTheme = toTheme;
          uploadVideoFrame(texturesRef.current[activeTheme], videosRef.current[activeTheme]);
        }
      }

      render();
      
      animationFrameId = requestAnimationFrame(tick);
    };

    triggerTransitionRef.current = (toTheme: "day" | "night") => {
      const prevTo = transitionRef.current.toTheme;
      if (toTheme === prevTo) return;
      
      // Reset current time to the requested offsets safely upon transition
      if (toTheme === "day" && videosRef.current.day) {
        try {
          videosRef.current.day.currentTime = 2.0;
        } catch (err) {
          console.warn("Failed to set day video currentTime:", err);
        }
      } else if (toTheme === "night" && videosRef.current.night) {
        try {
          videosRef.current.night.currentTime = 1.0;
        } catch (err) {
          console.warn("Failed to set night video currentTime:", err);
        }
      }

      const prevFrom = transitionRef.current.fromTheme;
      const now = performance.now();
      const currentLinear = transitionRef.current.linearProgress;
      
      let startProgress = 0.0;
      
      if (toTheme === prevFrom && currentLinear < 1.0) {
        startProgress = 1.0 - currentLinear;
      }
      
      transitionRef.current.fromTheme = prevTo;
      transitionRef.current.toTheme = toTheme;
      transitionRef.current.linearProgress = startProgress;
      transitionRef.current.currentProgress = easeOutQuart(startProgress);
      transitionRef.current.startTime = now - (startProgress * duration);
      
      transitionRef.current.isAnimating = true;
    };

    // Start continuous rendering loop to play videos inside WebGL smoothly
    animationFrameId = requestAnimationFrame(tick);

    // Cleanup resources to guarantee zero memory leaks
    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      
      const currentGl = glRef.current;
      if (currentGl) {
        currentGl.deleteBuffer(vertexBuffer);
        if (texturesRef.current.day) currentGl.deleteTexture(texturesRef.current.day);
        if (texturesRef.current.night) currentGl.deleteTexture(texturesRef.current.night);
        if (programRef.current) currentGl.deleteProgram(programRef.current);
      }
      glRef.current = null;
      programRef.current = null;

      // Clean up background video elements
      if (videosRef.current.day) {
        videosRef.current.day.pause();
        videosRef.current.day.remove();
        videosRef.current.day = null;
      }
      if (videosRef.current.night) {
        videosRef.current.night.pause();
        videosRef.current.night.remove();
        videosRef.current.night = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      id="fullpage-background-layer"
      className="fixed inset-0 w-full h-full z-[-10] select-none pointer-events-none overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{
          imageRendering: "auto",
        }}
      />
    </div>
  );
};
