import { useEffect, useRef, useState } from 'react';

export default function App() {
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setStatus('error');
      setMessage('Speech recognition not supported in this browser');
      return;
    }
    recognitionRef.current = new SR();
    recognitionRef.current.interimResults = true;
    recognitionRef.current.continuous = true;
    recognitionRef.current.lang = 'en-US';
    recognitionRef.current.onresult = (e: any) => {
      let finalText = '';
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) {
          finalText += res[0].transcript;
        } else {
          interimText += res[0].transcript;
        }
      }
      if (finalText) setTranscript((prev) => (prev ? prev + ' ' : '') + finalText.trim());
      setInterim(interimText.trim());
    };
    recognitionRef.current.onerror = (e: any) => {
      setStatus('error');
      setMessage(`Speech error: ${e?.error || e}`);
      setListening(false);
    };
    recognitionRef.current.onstart = () => {
      setListening(true);
      setMessage('Listening…');
    };
    recognitionRef.current.onend = () => {
      setListening(false);
      // Keep message as-is; stop() will handle save
    };
    // Best-effort permission preflight to surface denied state
    try {
      const anyNav: any = navigator as any;
      if (anyNav?.permissions?.query) {
        anyNav.permissions.query({ name: 'microphone' as any }).then((p: any) => {
          if (p.state === 'denied') {
            setStatus('error');
            setMessage('Microphone permission denied. Enable mic access for localhost.');
          }
        }).catch(() => {});
      }
    } catch {}
    setStatus('ok');
    setMessage('Ready');
  }, []);

  function start() {
    if (!recognitionRef.current) return;
    setTranscript('');
    setInterim('');
    try {
      recognitionRef.current.start();
    } catch (e) {
      // start can throw if already started
    }
  }

  async function stop() {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
    setListening(false);
    const text = (transcript + (interim ? ' ' + interim : '')).trim();
    await saveToNotion(text);
  }

  const saveToNotion = async (text: string) => {
    if (!text.trim()) {
      setMessage('No speech captured');
      return;
    }
    setMessage('Saving to Notion…');
    try {
      const title = new Date().toLocaleString();
      const res = await fetch('/api/save-to-notion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          title: `Voice note ${title}`, 
          content: text 
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data?.detail?.message || data?.error || 'Unknown error');
      setMessage(`Saved: ${data.page_id}`);
      setInterim('');
      setTranscript('');
    } catch (e) {
      setStatus('error');
      setMessage(String(e));
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Voice to Notion</h1>
        <p className="mt-1 text-sm text-slate-500">Start speaking, stop to save.</p>
        <div className="mt-6">
          <div className="flex items-center gap-2">
            <span className={`inline-flex h-2 w-2 rounded-full ${status === 'ok' ? 'bg-emerald-500' : status === 'error' ? 'bg-rose-500' : 'bg-amber-500'}`}></span>
            <span className="text-sm text-slate-600">{status === 'idle' ? 'Initializing…' : status === 'ok' ? (listening ? 'Listening' : 'Ready') : 'Error'}</span>
          </div>
          <p className="mt-2 text-sm text-slate-500 break-all">{message}</p>
        </div>
        <div className="mt-4 flex gap-3">
          {!listening ? (
            <button onClick={start} className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">Start</button>
          ) : (
            <button onClick={stop} className="inline-flex items-center justify-center rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white">Stop & Save</button>
          )}
        </div>
        <div className="mt-6 space-y-2">
          <p className="text-xs text-slate-500">Transcript</p>
          <div className="min-h-[120px] whitespace-pre-wrap rounded-md border border-slate-300 p-3 text-sm text-slate-800">
            {transcript}
            {interim && <span className="opacity-60"> {interim}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
