"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Glasses } from "@/lib/glasses";

interface AIStylistProps {
  currentProduct: Glasses;
  currentKey: string;
  currentColor: string;
  onSelectFrame: (key: string) => void;
  onSelectColor: (colorName: string) => void;
  faceMetrics: { shape: string; skinTone: string } | null;
}

const FRAME_NAMES: Record<string, string> = {
  aviator: "Luxe Square Aviator Sunglasses",
  tortoise: "Retro Oval Sunglasses",
  wire: "Geometric Navigator Sunglasses",
};

// Determines the primary recommended frame & color based on face shape and skin tone
function getSingleRecommendation(shape: string, skinTone: string) {
  let frame = "aviator";

  if (shape === "Square" || shape === "Diamond") {
    frame = "wire";
  } else if (shape === "Round" || shape === "Oblong") {
    frame = "tortoise";
  } else if (shape === "Heart" || shape === "Oval") {
    frame = "aviator";
  }

  const t = skinTone.toLowerCase();
  const warm = t.includes("warm");
  let color = warm ? "Gold" : "Silver";

  if (frame === "tortoise") {
    color = "Tortoiseshell";
  }

  return { frame, color, frameName: FRAME_NAMES[frame] };
}

export default function AIStylistOverlay({
  currentProduct,
  currentKey,
  currentColor,
  onSelectFrame,
  onSelectColor,
  faceMetrics,
}: AIStylistProps) {
  const router = useRouter();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("Tap mic to speak to AI Stylist");
  const [cart, setCart] = useState<{ name: string; color: string; price: number }[]>([]);
  const [showCartModal, setShowCartModal] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);

  const recognitionRef = useRef<any>(null);

  const speak = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Speaks the exact custom greeting out loud as soon as face scan finishes
  useEffect(() => {
    if (faceMetrics && !hasGreeted) {
      setHasGreeted(true);
      const rec = getSingleRecommendation(faceMetrics.shape, faceMetrics.skinTone);
      const greeting = `Hello, I'll be your digital optician at Innovibe Studios today. I scanned your face and you have a ${faceMetrics.shape} face shape with a ${faceMetrics.skinTone} skin tone, so I recommend you try the ${rec.frameName}.`;
      
      speak(greeting);
      setTranscript(`AI: Recommended ${rec.frameName}`);
    }
  }, [faceMetrics, hasGreeted]);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onresult = (event: any) => {
        const lastIndex = event.results.length - 1;
        const command = event.results[lastIndex][0].transcript.toLowerCase().trim();
        setTranscript(`You said: "${command}"`);
        handleIntent(command);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech error:", event.error);
        setIsListening(false);
      };

      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, [currentProduct, currentColor, onSelectFrame, onSelectColor]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please use Google Chrome.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setTranscript("Voice paused.");
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        setTranscript("Listening... Speak naturally.");
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleIntent = (cmd: string) => {
    const aviatorKeywords = ["aviator", "luxe", "square", "pilot"];
    const tortoiseKeywords = ["tortoise", "retro", "oval", "brown"];
    const wireKeywords = ["wire", "geometric", "navigator", "metal"];
    const cartKeywords = ["cart", "bag", "add"];
    const checkoutKeywords = ["checkout", "buy", "pay"];

    if (aviatorKeywords.some((w) => cmd.includes(w))) {
      onSelectFrame("aviator");
      speak("Switching to Luxe Square Aviator Sunglasses.");
    } else if (tortoiseKeywords.some((w) => cmd.includes(w))) {
      onSelectFrame("tortoise");
      speak("Switching to Retro Oval Sunglasses.");
    } else if (wireKeywords.some((w) => cmd.includes(w))) {
      onSelectFrame("wire");
      speak("Switching to Geometric Navigator Sunglasses.");
    } else if (cartKeywords.some((w) => cmd.includes(w))) {
      setCart((prev) => [...prev, { name: currentProduct.name, color: currentColor, price: currentProduct.price }]);
      speak(`Added ${currentProduct.name} to your cart.`);
      setShowCartModal(true);
    } else if (checkoutKeywords.some((w) => cmd.includes(w))) {
      speak("Taking you to checkout.");
      router.push("/checkout");
    } else {
      speak("I heard you. Try asking for aviators, retro ovals, geometric navigators, or to add to cart.");
    }
  };

  return (
    <div className="absolute bottom-6 left-6 right-6 z-30 flex flex-col items-center gap-3">
      {/* Voice Control Floating Bar */}
      <div className="bg-neutral-900/90 backdrop-blur-md border border-neutral-800 px-6 py-3 rounded-2xl flex items-center justify-between w-full max-w-2xl shadow-2xl">
        <div className="flex items-center gap-3 overflow-hidden">
          <button
            onClick={toggleListening}
            className={`h-11 w-11 shrink-0 rounded-full flex items-center justify-center transition text-lg ${
              isListening ? "bg-red-500 animate-pulse text-white shadow-lg shadow-red-500/50" : "bg-white text-black hover:bg-neutral-200"
            }`}
            title="Toggle Voice Stylist"
          >
            🗣️
          </button>
          <div className="text-left truncate">
            <div className="text-[10px] uppercase tracking-widest text-neutral-400">
              {faceMetrics ? `Innovibe Optician • ${faceMetrics.shape} Face` : "AI Stylist Assistant"}
            </div>
            <div className="text-xs text-neutral-200 truncate font-mono">{transcript}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowCartModal(!showCartModal)}
            className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs text-white transition"
          >
            🛒 Cart ({cart.length})
          </button>
          <button
            onClick={() => router.push("/checkout")}
            className="px-4 py-1.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition"
          >
            Checkout →
          </button>
        </div>
      </div>
    </div>
  );
}