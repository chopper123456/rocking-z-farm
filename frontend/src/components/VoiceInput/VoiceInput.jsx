import { useState, useRef, useEffect } from 'react';
import './VoiceInput.css';

/**
 * Voice-to-text using Web Speech API (SpeechRecognition).
 * onResult(text), onError(), optional lang.
 */
export default function VoiceInput({ onResult, lang = 'en-US', placeholder = 'Tap to speak...' }) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    setSupported(true);
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;
    rec.onresult = (e) => {
      const last = e.results.length - 1;
      const text = e.results[last][0].transcript;
      if (e.results[last].isFinal) onResult?.(text);
    };
    rec.onerror = () => {
      setListening(false);
      onResult?.('');
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    return () => {
      try {
        rec.abort();
      } catch (_) {}
    };
  }, [lang, onResult]);

  const toggle = () => {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
    setListening(!listening);
  };

  if (!supported) return null;

  return (
    <button
      type="button"
      className={`voice-input-btn ${listening ? 'listening' : ''}`}
      onClick={toggle}
      aria-label={listening ? 'Stop listening' : 'Start voice input'}
    >
      {listening ? '🎤 Listening...' : '🎤'}
      <span className="voice-input-label">{listening ? 'Tap to stop' : placeholder}</span>
    </button>
  );
}
