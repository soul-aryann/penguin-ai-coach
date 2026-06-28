"use client";
import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, AlertCircle, X } from "lucide-react";

interface VoiceRecorderProps {
  onAudioReady: (blob: Blob) => void;
  disabled?: boolean;
}

export default function VoiceRecorder({ onAudioReady, disabled = false }: VoiceRecorderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Canvas & Audio Context refs for visualization
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      cleanupAudioNodes();
    };
  }, []);

  const cleanupAudioNodes = () => {
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch (_) {}
      sourceRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (_) {}
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    dataArrayRef.current = null;
  };

  // Handle Canvas Resizing for High DPI (Retina) screens
  useEffect(() => {
    if (!isOpen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    };

    resizeCanvas();
    if (typeof window !== "undefined") {
      window.addEventListener("resize", resizeCanvas);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", resizeCanvas);
      }
    };
  }, [isOpen]);

  // Canvas Wave Animation Loop
  useEffect(() => {
    if (!isOpen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let phase = 0;

    const draw = () => {
      animationFrameId = requestAnimationFrame(draw);

      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
      
      ctx.clearRect(0, 0, width, height);

      // Get real-time frequency/volume data
      let volume = 0;
      if (isRecording && analyserRef.current && dataArrayRef.current) {
        const analyser = analyserRef.current;
        const dataArray = dataArrayRef.current;
        if (analyser && dataArray) {
          analyser.getByteFrequencyData(dataArray as any);
          
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          volume = sum / dataArray.length / 255; // Normalized value between 0 and 1
        }
      }

      // Sine wave parameters
      const numWaves = 3;
      const baseAmplitude = isRecording ? 10 + volume * 90 : 2; // Subtle ambient ripple if inactive
      const speed = isRecording ? 0.03 + volume * 0.09 : 0.006; // Wave speed scales with frequency volume

      phase += speed;

      for (let w = 0; w < numWaves; w++) {
        ctx.beginPath();
        // Wave 0 is the thickest
        ctx.lineWidth = (w === 0 ? 4 : 2) * dpr;
        
        // Custom Color Palette:
        // Deep Background: #0b0909
        // Muted Mid-tones: #2e4540
        // Vibrant Wave Accent: #408175
        // Soft Highlight/Text: #b5b9f0
        if (w === 0) {
          ctx.strokeStyle = `rgba(64, 129, 117, ${isRecording ? 0.9 : 0.4})`; // #408175
        } else if (w === 1) {
          ctx.strokeStyle = `rgba(181, 185, 240, ${isRecording ? 0.7 : 0.25})`; // #b5b9f0
        } else {
          ctx.strokeStyle = `rgba(46, 69, 64, ${isRecording ? 0.5 : 0.15})`; // #2e4540
        }

        for (let x = 0; x < width; x++) {
          // Taper wave amplitude towards the left and right edges (sine envelope)
          const envelope = Math.sin((x * Math.PI) / width);
          const frequency = (0.006 + w * 0.004) / dpr;
          const y =
            height / 2 +
            Math.sin(x * frequency - phase - (w * Math.PI) / 2) *
              baseAmplitude *
              envelope *
              dpr;

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isOpen, isRecording]);

  const startRecording = async () => {
    audioChunksRef.current = [];
    setPermissionError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Initialize AudioContext & Analyser for real-time wave visualization
      const AudioContextClass = typeof window !== "undefined"
        ? (window.AudioContext || (window as any).webkitAudioContext)
        : null;
      
      if (!AudioContextClass) {
        throw new Error("Web Audio API is not supported in this browser.");
      }

      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;
      source.connect(analyser);

      // Determine supported mime types for recording
      let options = { mimeType: "audio/webm" };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: "audio/ogg" }; // Fallback
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: "" }; // Let browser decide
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm"
        });

        console.log("Final Audio Blob Size:", audioBlob.size, "bytes");
        
        // Stop all track streams to release microphone
        stream.getTracks().forEach((track) => track.stop());
        cleanupAudioNodes();

        if (audioBlob.size > 0) {
          onAudioReady(audioBlob);
          setIsOpen(false); // Close the immersive view after successful recording
        }
      };

      // Start recording and capture chunks every 1s
      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          // Limit recording length to 2 minutes (120s)
          if (prev >= 120) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err: any) {
      console.error("Microphone access error:", err);
      setPermissionError(
        "Microphone access denied. Please check your browser permissions to continue."
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <>
      {/* Import Cormorant Garamond font */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&display=swap');
        .font-serif-garamond {
          font-family: 'Cormorant Garamond', serif;
        }
      `}} />

      {/* Minimized Trigger Button */}
      {!isOpen ? (
        <div className="flex justify-center w-full py-2">
          <button
            onClick={() => setIsOpen(true)}
            disabled={disabled}
            className="flex items-center gap-3 px-8 py-3.5 rounded-xl border border-[#2e4540] bg-[#0b0909] hover:bg-[#2e4540]/20 text-[#b5b9f0] transition-all duration-300 shadow-lg shadow-[#0b0909]/50 active:scale-98 font-serif-garamond text-lg tracking-wide group"
          >
            <Mic className="h-5 w-5 text-[#408175] group-hover:scale-110 transition-transform" />
            <span>Open Penguin Voice Coach</span>
          </button>
        </div>
      ) : (
        /* Immersive Full-Screen Overlay */
        <div className="fixed inset-0 z-50 bg-[#0b0909] text-[#b5b9f0] font-serif-garamond flex flex-col justify-between p-8 md:p-12 overflow-hidden select-none">
          {/* Ambient background glows */}
          <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#408175]/5 blur-[120px] pointer-events-none"></div>
          <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#b5b9f0]/3 blur-[120px] pointer-events-none"></div>

          {/* Header */}
          <header className="relative z-10 flex items-center justify-between w-full max-w-5xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-[#2e4540]/30 border border-[#408175]/20 flex items-center justify-center text-[#408175] shadow-inner">
                <svg className="h-8 w-8" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="50" cy="35" r="15" fill="currentColor" />
                  <path d="M50 50 L30 80 L70 80 Z" fill="currentColor" opacity="0.8" />
                  <path d="M50 35 L45 40 L55 40 Z" fill="#b5b9f0" />
                  <circle cx="47" cy="33" r="1.5" fill="#0b0909" />
                  <circle cx="53" cy="33" r="1.5" fill="#0b0909" />
                </svg>
              </div>
              <span className="text-2xl font-bold tracking-wider uppercase text-white">Penguin</span>
            </div>
            <button
              onClick={() => {
                if (isRecording) stopRecording();
                setIsOpen(false);
              }}
              className="p-3 rounded-full bg-[#2e4540]/20 hover:bg-[#2e4540]/50 border border-[#408175]/10 hover:border-[#408175]/30 text-[#b5b9f0] transition-all"
              title="Close Voice Coach"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          {/* Main Centered Subject */}
          <main className="relative z-10 flex-1 flex flex-col items-center justify-center max-w-3xl mx-auto w-full">
            
            {/* Wave Visualization Canvas */}
            <div className="w-full h-48 flex items-center justify-center relative mb-8">
              <canvas
                ref={canvasRef}
                className="w-full max-w-2xl h-full opacity-95"
              />
            </div>

            {/* Error Banner */}
            {permissionError && (
              <div className="mb-6 flex items-center gap-2 rounded-xl bg-rose-950/30 border border-rose-500/20 px-5 py-3 text-sm text-rose-300 max-w-md text-center backdrop-blur-sm">
                <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
                <span>{permissionError}</span>
              </div>
            )}

            {/* Main Action Button */}
            <div className="relative flex items-center justify-center mb-8">
              {isRecording && (
                <>
                  <div className="absolute h-28 w-28 rounded-full bg-[#408175]/10 animate-ping duration-1000"></div>
                  <div className="absolute h-36 w-36 rounded-full bg-[#b5b9f0]/5 animate-pulse duration-1000"></div>
                </>
              )}

              <button
                onClick={toggleRecording}
                disabled={disabled}
                className={`relative z-10 flex h-20 w-20 items-center justify-center rounded-full transition-all duration-500 transform active:scale-95 disabled:opacity-50 disabled:pointer-events-none shadow-2xl ${
                  isRecording
                    ? "bg-[#408175] text-[#0b0909] hover:bg-[#408175]/90 shadow-[#408175]/20"
                    : "bg-[#2e4540] text-[#b5b9f0] hover:bg-[#2e4540]/80 border border-[#408175]/30 hover:border-[#408175]/50 shadow-[#0b0909]/50"
                }`}
                aria-label={isRecording ? "Stop recording" : "Start recording"}
              >
                {isRecording ? (
                  <Square className="h-8 w-8 fill-current stroke-none" />
                ) : (
                  <Mic className="h-8 w-8" />
                )}
              </button>
            </div>

            {/* Status & Timer */}
            <div className="text-center">
              <h2 className={`text-3xl font-medium tracking-widest uppercase transition-all duration-300 ${isRecording ? "text-[#408175] scale-105 font-bold animate-pulse" : "text-[#b5b9f0]"}`}>
                {isRecording ? "Listening..." : "Tap to Speak"}
              </h2>
              {isRecording && (
                <p className="text-lg text-[#b5b9f0]/60 mt-3 font-mono tracking-wider">
                  {formatTime(recordingTime)} / 02:00
                </p>
              )}
            </div>
          </main>

          {/* Footer Instruction */}
          <footer className="relative z-10 text-center w-full max-w-lg mx-auto opacity-70 hover:opacity-100 transition-opacity">
            <p className="text-sm italic text-[#b5b9f0]/80 tracking-wide font-light">
              "Speak clearly. Penguin will analyze your grammar, vocabulary, and pronunciation in real-time."
            </p>
          </footer>
        </div>
      )}
    </>
  );
}
