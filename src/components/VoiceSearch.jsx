import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { voiceSearchProducts } from '../api/products.api';
import { Modal } from './Modal';

const MAX_RECORD_MS = 6000;
const MIME_CANDIDATES = ['audio/webm', 'audio/mp4', 'audio/ogg'];

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported?.(type));
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Pro-only voice version of the Kassa name search: cashier speaks a
// product name, this records a short clip, sends it to the voice-search
// endpoint (Whisper transcription + fuzzy match — see
// products.controller.js), and either adds the clear winner straight to
// the cart or lets the cashier tap the right one from a short candidate
// list. Stays open after each hit (back to idle, ready to record again)
// so several items can be added in a row, same spirit as CameraScanner.
export function VoiceSearch({ onAddProduct, onClose }) {
  const [status, setStatus] = useState('idle'); // idle | recording | processing
  const [matches, setMatches] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [flash, setFlash] = useState(null);
  const [error, setError] = useState('');

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const stopTimerRef = useRef(null);

  useEffect(
    () => () => {
      clearTimeout(stopTimerRef.current);
      const recorder = mediaRecorderRef.current;
      if (recorder?.state === 'recording') recorder.stop();
      recorder?.stream.getTracks().forEach((t) => t.stop());
    },
    []
  );

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 2200);
    return () => clearTimeout(timer);
  }, [flash]);

  async function startRecording() {
    setError('');
    setMatches(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        handleRecorded(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setStatus('recording');
      stopTimerRef.current = setTimeout(() => stopRecording(), MAX_RECORD_MS);
    } catch {
      setError('Mikrofonga ruxsat berilmadi');
    }
  }

  function stopRecording() {
    clearTimeout(stopTimerRef.current);
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }

  async function handleRecorded(blob) {
    setStatus('processing');
    try {
      const base64 = await blobToBase64(blob);
      const data = await voiceSearchProducts(base64, blob.type);
      setTranscript(data.transcript);
      if (!data.transcript) {
        setError('Hech narsa eshitilmadi');
      } else if (data.autoPick) {
        const picked = data.matches[0].product;
        onAddProduct(picked);
        setFlash({ text: `${picked.name} qo'shildi`, key: Date.now() });
      } else if (data.matches.length > 0) {
        setMatches(data.matches);
      } else {
        setError(`"${data.transcript}" — mos mahsulot topilmadi`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setStatus('idle');
    }
  }

  function pickCandidate(product) {
    onAddProduct(product);
    setMatches(null);
    setFlash({ text: `${product.name} qo'shildi`, key: Date.now() });
  }

  return (
    <Modal title="Ovozli qidiruv" onClose={onClose}>
      <div className="flex flex-col items-center gap-4 py-2">
        <button
          type="button"
          onClick={status === 'recording' ? stopRecording : startRecording}
          disabled={status === 'processing'}
          className={`flex h-20 w-20 items-center justify-center rounded-full text-white transition-all duration-200 disabled:opacity-50 ${
            status === 'recording' ? 'animate-pulse-dot bg-error' : 'hover:scale-105'
          }`}
          style={status !== 'recording' ? { backgroundImage: 'var(--gradient-brand)' } : undefined}
          aria-label={status === 'recording' ? "To'xtatish" : 'Yozib olish'}
        >
          {status === 'recording' ? <Square size={28} /> : <Mic size={28} />}
        </button>

        <p className="text-sm text-base-content/60">
          {status === 'recording' && 'Tinglanmoqda... mahsulot nomini ayting'}
          {status === 'processing' && 'Tahlil qilinmoqda...'}
          {status === 'idle' && !error && !matches && !flash && 'Boshlash uchun bosing'}
        </p>

        {error && <p className="text-sm text-error">{error}</p>}

        {flash && (
          <div
            key={flash.key}
            className="animate-pop w-full rounded-field bg-success/90 p-3 text-center text-sm font-medium text-white"
          >
            {flash.text}
          </div>
        )}

        {matches && matches.length > 0 && (
          <div className="flex w-full flex-col gap-1.5">
            <p className="text-xs text-base-content/50">"{transcript}" — qaysi biri?</p>
            {matches.map(({ product }) => (
              <button
                key={product._id}
                type="button"
                onClick={() => pickCandidate(product)}
                className="flex items-center justify-between rounded-field px-3 py-2 text-left text-sm hover:bg-base-200"
              >
                <span className="font-medium">{product.name}</span>
                <span className="text-xs text-base-content/50">{product.price.toLocaleString()}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
