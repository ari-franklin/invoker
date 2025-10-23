import { useEffect, useRef, useState } from 'react';
import { saveToNotion } from './lib/supabaseClient';

export default function App() {
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [listening, setListening] = useState(false);
  const [title, setTitle] = useState('');
  const [labels, setLabels] = useState('');
  const [statusValue, setStatusValue] = useState('To Do');
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
    await handleSaveToNotion(text);
  }

  const handleSaveToNotion = async (text: string) => {
    if (!text.trim()) {
      setMessage('No speech captured');
      return;
    }
    
    // Use custom title or default to a timestamp
    const noteTitle = title.trim() || `Voice note ${new Date().toLocaleString()}`;
    
    setMessage('Saving to Notion…');
    try {
      const result = await saveToNotion({
        title: noteTitle,
        content: text,
        labels: labels.split(',').map(l => l.trim()).filter(Boolean),
        status: statusValue
      });
      
      setMessage('Saved to Notion');
      setInterim('');
      setTranscript('');
      setTitle(''); // Reset title for next note
      setLabels(''); // Reset labels for next note
      return result;
    } catch (e) {
      setStatus('error');
      setMessage(`Error: ${e instanceof Error ? e.message : 'Failed to save to Notion'}`);
      throw e;
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Voice to Notion</h1>
        <p className="mt-1 text-sm text-slate-500">Start speaking, stop to save.</p>
        
        <div className="mt-6 space-y-4">
          {/* Title Input */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-slate-700">Title</label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title (optional)"
              className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          
          {/* Labels Input */}
          <div>
            <label htmlFor="labels" className="block text-sm font-medium text-slate-700">Labels (comma separated)</label>
            <input
              type="text"
              id="labels"
              value={labels}
              onChange={(e) => setLabels(e.target.value)}
              placeholder="work, personal, ideas"
              className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          
          {/* Status Select */}
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-slate-700">Status</label>
            <select
              id="status"
              value={statusValue}
              onChange={(e) => setStatusValue(e.target.value)}
              className="mt-1 block w-full rounded-md border-slate-300 py-2 pl-3 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            >
              <option>To Do</option>
              <option>In Progress</option>
              <option>Done</option>
              <option>On Hold</option>
            </select>
          </div>
          
          {/* Status Indicator */}
          <div className="flex items-center gap-2 pt-2">
            <span 
              className={`inline-flex h-2 w-2 rounded-full ${
                status === 'ok' ? 'bg-emerald-500' : 
                status === 'error' ? 'bg-rose-500' : 
                'bg-amber-500'
              }`}
            ></span>
            <span className="text-sm text-slate-600">
              {status === 'idle' ? 'Ready to record' : 
               status === 'ok' ? (listening ? '🎤 Listening...' : '✅ Ready') : 
               '❌ Error'}
            </span>
          </div>
          
          {/* Status Message */}
          {message && (
            <p className="text-sm text-slate-500 break-all">{message}</p>
          )}
          
          {/* Record Button */}
          <div className="pt-2">
            {!listening ? (
              <button 
                onClick={start} 
                className="w-full inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                🎤 Start Recording
              </button>
            ) : (
              <button 
                onClick={stop} 
                className="w-full inline-flex items-center justify-center rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
              >
                ⬛ Stop & Save to Notion
              </button>
            )}
          </div>
          
          {/* Transcript Preview */}
          {(transcript || interim) && (
            <div className="mt-4 rounded-lg border border-slate-200 p-4 bg-slate-50">
              <h3 className="text-sm font-medium text-slate-700 mb-2">Transcript Preview</h3>
              <p className="text-sm text-slate-900">
                {transcript} 
                <span className="text-slate-400">{interim}</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
