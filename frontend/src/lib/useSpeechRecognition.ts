// Speech-to-text via the browser's Web Speech API (SpeechRecognition).
//
// No dependencies and no API key — recognition runs in the browser (Chrome,
// Edge, and Safari support it; Firefox does not). The hook exposes a simple
// start/stop interface and reports interim + final transcripts, so the chat
// input can be dictated.

import { useCallback, useEffect, useRef, useState } from "react"

// The Web Speech API isn't in the standard TS DOM lib, so declare the minimal
// shape we use.
interface SpeechRecognitionAlternative {
  transcript: string
}
interface SpeechRecognitionResult {
  0: SpeechRecognitionAlternative
  isFinal: boolean
  length: number
}
interface SpeechRecognitionResultList {
  length: number
  [index: number]: SpeechRecognitionResult
}
interface SpeechRecognitionEventLike {
  resultIndex: number
  results: SpeechRecognitionResultList
}
interface SpeechRecognitionErrorEventLike {
  error: string
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getRecognitionCtor(): SpeechRecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export interface UseSpeechRecognitionOptions {
  lang?: string
  // Called whenever the transcript updates (interim + final).
  onTranscript?: (text: string, isFinal: boolean) => void
}

export interface UseSpeechRecognition {
  supported: boolean
  listening: boolean
  error: string | null
  start: () => void
  stop: () => void
  toggle: () => void
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {},
): UseSpeechRecognition {
  const { lang = "en-US", onTranscript } = options
  const [supported] = useState(() => !!getRecognitionCtor())
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  // Keep the latest callback without re-creating the recognition instance.
  const onTranscriptRef = useRef(onTranscript)
  useEffect(() => {
    onTranscriptRef.current = onTranscript
  }, [onTranscript])

  useEffect(() => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) return

    const recognition = new Ctor()
    recognition.lang = lang
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onresult = (e) => {
      let interim = ""
      let final = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]
        const text = result[0]?.transcript ?? ""
        if (result.isFinal) final += text
        else interim += text
      }
      if (final) onTranscriptRef.current?.(final.trim(), true)
      else if (interim) onTranscriptRef.current?.(interim.trim(), false)
    }
    recognition.onerror = (e) => {
      // "aborted"/"no-speech" are benign; surface the rest.
      if (e.error !== "aborted" && e.error !== "no-speech") {
        setError(
          e.error === "not-allowed"
            ? "Microphone access was blocked. Allow it in your browser to use voice."
            : `Voice input error: ${e.error}`,
        )
      }
      setListening(false)
    }
    recognition.onend = () => setListening(false)

    recognitionRef.current = recognition
    return () => {
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      try {
        recognition.abort()
      } catch {
        /* ignore */
      }
      recognitionRef.current = null
    }
  }, [lang])

  const start = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition || listening) return
    setError(null)
    try {
      recognition.start()
      setListening(true)
    } catch {
      // start() throws if called while already started — ignore.
    }
  }, [listening])

  const stop = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition) return
    try {
      recognition.stop()
    } catch {
      /* ignore */
    }
    setListening(false)
  }, [])

  const toggle = useCallback(() => {
    if (listening) stop()
    else start()
  }, [listening, start, stop])

  return { supported, listening, error, start, stop, toggle }
}
