import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, Settings, FileText, Mic, LayoutTemplate, ArrowLeft, ArrowRight,
  Loader2, Download, Edit2, Wand2, Play, Pause, Volume2, Captions,
  Image as ImageIcon, RotateCcw, Video, Square, Upload, RefreshCw, AlignJustify
} from "lucide-react";
import {
  useProject, useUpdateProject, useUpdateDialogue,
  useGenerateScript, useRewriteDialogue, useGenerateAudio, useGenerateTranscript
} from "@/hooks/use-projects";
import { api, buildUrl } from "@shared/routes";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const DEMO_BG = "https://images.unsplash.com/photo-1577563908411-5077b6dc7624?q=80&w=2070&auto=format&fit=crop";

// AI models that "score" each argument (Gemini, Claude, ElevenLabs, DeepSeek, Grok)
const AI_MODELS = [
  { name: "Gemini",     color: "#4285f4", bg: "#e8f0fe", logo: "G"  },
  { name: "Claude",     color: "#d97706", bg: "#fef3e2", logo: "C"  },
  { name: "ElevenLabs", color: "#5a4fcf", bg: "#ede9fe", logo: "11" },
  { name: "DeepSeek",   color: "#0066ff", bg: "#e5f0ff", logo: "DS" },
  { name: "Grok",       color: "#111827", bg: "#f3f4f6", logo: "X"  },
];

const TEXT_SIZES = { small: "text-xs sm:text-sm", medium: "text-sm sm:text-xl", large: "text-xl sm:text-3xl" };
const BOX_PAD   = { small: "px-3 py-2", medium: "px-5 py-3", large: "px-7 py-4" };

// Audio provider configs (no OpenAI as primary)
const AUDIO_PROVIDERS = [
  { id: "gemini", name: "Gemini TTS", badge: "Google", desc: "8 expressive AI voices" },
  { id: "elevenlabs", name: "ElevenLabs", badge: "Pro", desc: "Ultra-realistic voices" },
];
const GEMINI_VOICES = [
  { id: "Kore", name: "Kore" }, { id: "Charon", name: "Charon" },
  { id: "Fenrir", name: "Fenrir" }, { id: "Aoede", name: "Aoede" },
  { id: "Puck", name: "Puck" }, { id: "Leda", name: "Leda" },
  { id: "Zephyr", name: "Zephyr" }, { id: "Orus", name: "Orus" },
];
const ELEVENLABS_VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam" },
  { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam" },
];
function getVoicesForProvider(provider: string) {
  if (provider === "elevenlabs") return ELEVENLABS_VOICES;
  return GEMINI_VOICES;
}

// Duration options in minutes
const DURATION_OPTIONS = [1, 5, 8, 15, 20, 25, 30, 40];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function hashText(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) { h = ((h << 5) - h) + text.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}
function genScores(text: string) {
  const h = hashText(text);
  return AI_MODELS.map((m, i) => ({ ...m, score: +(6.2 + ((h * (i + 7)) % 32) / 10).toFixed(1) }));
}
function dialogueDuration(text: string) { return Math.max(5, Math.min(45, Math.round(text.split(/\s+/).length / 2.5))); }
function fmt(s: number) { return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; }

// Web Audio tones
function playTone(freq: number, dur: number, vol = 0.25, type: OscillatorType = "sine") {
  try {
    const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ac.createOscillator(); const g = ac.createGain();
    osc.type = type; osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    osc.connect(g); g.connect(ac.destination);
    osc.start(); osc.stop(ac.currentTime + dur);
  } catch { /* audio blocked */ }
}
function playScoreReveal() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 0.18, 0.3, "triangle"), i * 110)); }
function playCountdownBeep() { playTone(440, 0.08, 0.18); }
function playTransition() { [880, 1100].forEach((f, i) => setTimeout(() => playTone(f, 0.12, 0.2), i * 90)); }

// ─── WAVEFORM BARS ─────────────────────────────────────────────────────────────
function WaveformBars({ color }: { color: string }) {
  const heights = [30, 60, 100, 70, 120, 50, 80, 110, 40, 90, 60, 130, 70, 50, 100];
  return (
    <div className="flex items-end gap-px h-7">
      {heights.map((h, i) => (
        <motion.div key={i} className={`w-[3px] rounded-full ${color}`}
          animate={{ height: [`${h * 0.3}%`, `${Math.min(100, h * 0.7)}%`, `${h * 0.3}%`] }}
          transition={{ repeat: Infinity, duration: 0.35 + i * 0.04, ease: "easeInOut" }} />
      ))}
    </div>
  );
}

// ─── SCORE CARD (full-page white grid) ─────────────────────────────────────────
interface ModelScore { name: string; color: string; bg: string; logo: string; score: number; }
function ScoreCardPage({ scores, speakerName, avg, isA, totalA, totalB, nameA, nameB }: {
  scores: ModelScore[]; speakerName: string; avg: number; isA: boolean;
  totalA: number; totalB: number; nameA: string; nameB: string;
}) {
  const [animScore, setAnimScore] = useState(0);

  useEffect(() => {
    playScoreReveal();
    let v = 0; const step = avg / 25;
    const t = setInterval(() => { v = Math.min(avg, +(v + step).toFixed(1)); setAnimScore(v); if (v >= avg) clearInterval(t); }, 60);
    return () => clearInterval(t);
  }, [avg]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}>
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: "spring", damping: 18, stiffness: 220 }}
        className="rounded-3xl overflow-hidden shadow-2xl w-full max-w-md mx-4"
        style={{ background: "white", backgroundImage: "linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)", backgroundSize: "28px 28px" }}>

        {/* Header */}
        <div className={`${isA ? "bg-blue-600" : "bg-rose-600"} px-6 py-3 flex items-center justify-between`}>
          <span className="text-white font-black text-base">{speakerName}'s Argument</span>
          <span className="text-white/80 text-xs font-bold uppercase tracking-wider">AI Score</span>
        </div>

        {/* Model scores */}
        <div className="px-5 py-5">
          <div className="grid grid-cols-5 gap-2 mb-5">
            {scores.map((s, i) => (
              <motion.div key={s.name} className="flex flex-col items-center"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.12, type: "spring" }}>
                <div className="w-11 h-11 rounded-full flex items-center justify-center font-black text-xs text-white shadow-lg mb-1"
                  style={{ backgroundColor: s.color }}>{s.logo}</div>
                <span className="text-[9px] text-gray-500 font-semibold text-center leading-tight">{s.name}</span>
                <motion.span className="text-sm font-black text-gray-800 mt-0.5"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.12 + 0.35 }}>
                  {s.score.toFixed(1)}
                </motion.span>
                {/* Animated bar chart */}
                <div className="w-full mt-1.5 bg-gray-100 rounded-full overflow-hidden" style={{ height: 3 }}>
                  <motion.div className="h-full rounded-full" style={{ backgroundColor: s.color }}
                    initial={{ width: "0%" }} animate={{ width: `${(s.score / 10) * 100}%` }}
                    transition={{ delay: i * 0.12 + 0.5, duration: 0.75, ease: "easeOut" }} />
                </div>
              </motion.div>
            ))}
          </div>

          {/* Average */}
          <div className="rounded-2xl p-4 text-center mb-4" style={{ backgroundColor: isA ? "#eff6ff" : "#fff1f2" }}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Average Score</p>
            <motion.div className="text-5xl font-black tabular-nums" style={{ color: isA ? "#2563eb" : "#e11d48" }}
              initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ delay: 0.6, type: "spring", stiffness: 300 }}>
              {animScore.toFixed(1)}
            </motion.div>
          </div>

          {/* Running totals */}
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 bg-blue-50 rounded-xl px-3 py-2">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-xs text-blue-700 font-bold truncate">{nameA}</span>
              <span className="ml-auto text-blue-700 font-black text-sm tabular-nums">{totalA.toFixed(1)}</span>
            </div>
            <div className="flex-1 flex items-center gap-2 bg-rose-50 rounded-xl px-3 py-2">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="text-xs text-rose-700 font-bold truncate">{nameB}</span>
              <span className="ml-auto text-rose-700 font-black text-sm tabular-nums">{totalB.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── WIZARD ROOT ───────────────────────────────────────────────────────────────
export default function Wizard() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id || "0");
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const [currentStep, setCurrentStep] = useState(parseInt(searchParams.get("step") || "1"));
  const { data: project, isLoading } = useProject(projectId);

  useEffect(() => {
    const url = `/projects/${projectId}?step=${currentStep}`;
    if (location !== url) window.history.replaceState(null, "", url);
  }, [currentStep, projectId, location]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-12 h-12 text-primary animate-spin" /></div>;
  if (!project) return <div className="min-h-screen flex items-center justify-center text-white">Project not found</div>;

  const steps = [
    { num: 1, title: "Setup", icon: Settings },
    { num: 2, title: "Script", icon: FileText },
    { num: 3, title: "Audio", icon: Mic },
    { num: 4, title: "Preview", icon: LayoutTemplate },
  ];

  return (
    <div className="min-h-screen flex flex-col max-w-[1600px] mx-auto">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-white/5 px-4 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 shrink-0">
          <button onClick={() => setLocation("/")} className="p-2 hover:bg-white/5 rounded-xl text-muted-foreground hover:text-white transition-colors"><ArrowLeft className="w-4 h-4" /></button>
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-primary to-indigo-600 rounded-lg flex items-center justify-center">
              <Video className="w-3.5 h-3.5 text-white" />
            </div>
            <h1 className="font-display font-bold text-sm text-white truncate max-w-[180px]">{project.topic !== "Untitled Debate" ? project.topic : "New Debate"}</h1>
          </div>
        </div>
        <nav className="flex-1 flex justify-center">
          <ol className="flex items-center bg-black/30 rounded-xl border border-white/5 p-1 gap-0.5">
            {steps.map((step) => {
              const isActive = currentStep === step.num, isPast = currentStep > step.num;
              const Icon = step.icon;
              return (
                <li key={step.num}>
                  <button onClick={() => setCurrentStep(step.num)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isActive ? "bg-primary text-white shadow-md shadow-primary/30" : isPast ? "text-primary hover:bg-white/5" : "text-gray-500 hover:text-gray-300 hover:bg-white/5"}`}>
                    {isPast ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{step.title}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
        <div className="w-9 shrink-0" />
      </header>

      <main className="flex-1 p-4 sm:p-6 lg:p-10 overflow-x-hidden">
        <AnimatePresence mode="wait">
          <motion.div key={currentStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }} className="h-full">
            {currentStep === 1 && <Step1Setup project={project} onNext={() => setCurrentStep(2)} />}
            {currentStep === 2 && <Step2Script project={project} onNext={() => setCurrentStep(3)} />}
            {currentStep === 3 && <Step3Audio project={project} onNext={() => setCurrentStep(4)} />}
            {currentStep === 4 && <Step4Preview project={project} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

// ─── STEP 1: SETUP ─────────────────────────────────────────────────────────────
function Step1Setup({ project, onNext }: { project: any; onNext: () => void }) {
  const upd = useUpdateProject();
  const ctxFileRef = useRef<HTMLInputElement>(null);
  const [topic, setTopic] = useState(project.topic === "Untitled Debate" ? "" : project.topic);
  const [duration, setDuration] = useState(project.duration || "8");
  const [model, setModel] = useState(project.model || "gemini-3-flash-preview");
  const [contextText, setContextText] = useState(() => localStorage.getItem(`ctx-${project.id}`) || "");
  const [ctxFileName, setCtxFileName] = useState("");

  const handleContextFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setCtxFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const cleaned = text.slice(0, 8000); // limit
      setContextText(cleaned);
      localStorage.setItem(`ctx-${project.id}`, cleaned);
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-xl mx-auto glass-panel p-6 sm:p-10 rounded-3xl">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-indigo-600/20 rounded-xl flex items-center justify-center ring-1 ring-primary/20">
          <Settings className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-display font-bold text-white">Configure Debate</h2>
          <p className="text-muted-foreground text-xs">Set topic, duration, model & context</p>
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-5" />
      <div className="space-y-7">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Debate Topic</label>
          <input type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. AI vs Human Creativity" className="w-full px-4 py-3 rounded-xl glass-input text-base focus:outline-none" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Duration (minutes)</label>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
            {DURATION_OPTIONS.map(d => (
              <button key={d} onClick={() => setDuration(String(d))} className={`py-2.5 rounded-xl font-bold text-sm border transition-all ${duration === String(d) ? "bg-primary/20 border-primary text-primary" : "bg-black/20 border-white/10 text-gray-400 hover:border-white/30"}`}>
                {d}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">AI Model</label>
          <div className="space-y-2">
            {[["gemini-3-flash-preview","Gemini 3 Flash","Fast"],["gemini-3.1-pro-preview","Gemini 3.1 Pro","Smart"]].map(([mid, name, badge]) => (
              <div key={mid} onClick={() => setModel(mid)} className={`p-3 rounded-xl border cursor-pointer flex items-center gap-3 ${model === mid ? "bg-primary/10 border-primary" : "bg-black/20 border-white/10 hover:border-white/30"}`}>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${model === mid ? "border-primary" : "border-gray-500"}`}>{model === mid && <div className="w-2 h-2 bg-primary rounded-full" />}</div>
                <div className="flex-1"><span className={`font-semibold text-sm ${model === mid ? "text-white" : "text-gray-300"}`}>{name}</span></div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${model === mid ? "bg-primary/20 text-primary" : "bg-white/10 text-gray-500"}`}>{badge}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Context File <span className="text-gray-500 font-normal">(optional — .txt or .pdf)</span></label>
          <div className="space-y-2">
            <button onClick={() => ctxFileRef.current?.click()} className="w-full py-3 border-2 border-dashed border-white/20 rounded-xl text-gray-400 hover:border-primary/50 hover:text-white transition-all flex items-center justify-center gap-2 text-sm">
              <Upload className="w-4 h-4" />
              {ctxFileName ? <span className="text-primary font-medium">{ctxFileName}</span> : <span>Upload .txt or .pdf for AI context</span>}
            </button>
            <input ref={ctxFileRef} type="file" accept=".txt,.pdf,.md,.doc,.docx" className="hidden" onChange={handleContextFile} />
            {contextText && (
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-primary font-bold uppercase tracking-wider">Context Preview</span>
                  <button onClick={() => { setContextText(""); setCtxFileName(""); localStorage.removeItem(`ctx-${project.id}`); }} className="text-[10px] text-gray-500 hover:text-red-400">Clear</button>
                </div>
                <p className="text-gray-400 text-xs leading-relaxed line-clamp-3">{contextText}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button onClick={async () => { if (!topic.trim()) return; await upd.mutateAsync({ id: project.id, topic, duration, model }); onNext(); }} disabled={!topic.trim() || upd.isPending} className="flex items-center px-7 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 disabled:opacity-50">
            {upd.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Continue <ArrowRight className="w-4 h-4 ml-2" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── STEP 2: SCRIPT EDITOR ─────────────────────────────────────────────────────
function Step2Script({ project, onNext }: { project: any; onNext: () => void }) {
  const generateScript = useGenerateScript();
  const updateProject = useUpdateProject();
  const updateDialogue = useUpdateDialogue();
  const rewriteDialogue = useRewriteDialogue();
  const [speakerA, setSpeakerA] = useState(project.speakerAName);
  const [speakerB, setSpeakerB] = useState(project.speakerBName);
  const [narrator, setNarrator] = useState(project.speakerNarratorName || "Narrator");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [rewritingId, setRewritingId] = useState<number | null>(null);
  const [rwInstr, setRwInstr] = useState("");

  const saveNames = () => {
    const updates: any = { id: project.id };
    if (speakerA !== project.speakerAName) updates.speakerAName = speakerA;
    if (speakerB !== project.speakerBName) updates.speakerBName = speakerB;
    if (narrator !== project.speakerNarratorName) updates.speakerNarratorName = narrator;
    if (Object.keys(updates).length > 1) updateProject.mutate(updates);
  };

  if (!project.dialogues?.length) return (
    <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto py-16">
      <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-indigo-600/20 rounded-full flex items-center justify-center mb-6 ring-2 ring-primary/10">
        <FileText className="w-10 h-10 text-primary" />
      </div>
      <h2 className="text-2xl font-display font-bold text-white mb-3">Generate Script</h2>
      <p className="text-muted-foreground mb-7 text-sm leading-relaxed">AI will draft the debate with narrator intro for each argument round.</p>
      <div className="glass-panel rounded-xl px-5 py-3 mb-7 border border-primary/10">
        <p className="text-primary text-xs font-bold tracking-wider uppercase mb-0.5">Topic</p>
        <p className="text-white text-sm font-medium">"{project.topic}"</p>
      </div>
      <button onClick={() => generateScript.mutateAsync({ projectId: project.id, context: localStorage.getItem(`ctx-${project.id}`) || undefined })} disabled={generateScript.isPending} className="px-7 py-3.5 bg-gradient-to-r from-primary to-indigo-600 text-white font-bold rounded-xl flex items-center gap-2 hover:shadow-[0_0_25px_rgba(124,58,237,0.4)] transition-shadow">
        {generateScript.isPending ? <><Loader2 className="w-5 h-5 animate-spin" /> Generating...</> : <><Wand2 className="w-5 h-5" /> Generate Script with AI</>}
      </button>
    </div>
  );

  const dialogues: any[] = [...(project.dialogues || [])].sort((a: any, b: any) => a.sequence - b.sequence);

  const speakerColor = (s: string) => s === "A" ? "indigo" : s === "B" ? "cyan" : "amber";
  const getSpeakerName = (s: string) => s === "A" ? speakerA : s === "B" ? speakerB : narrator;

  const Cell = ({ d }: { d: any }) => {
    const col = speakerColor(d.speaker);
    const gradientFrom = col === "indigo" ? "from-indigo-500 to-indigo-700" : col === "cyan" ? "from-cyan-500 to-cyan-700" : "from-amber-500 to-amber-700";
    const textCol = col === "indigo" ? "text-indigo-400" : col === "cyan" ? "text-cyan-400" : "text-amber-400";

    if (editingId === d.id) return (
      <div className="p-3 space-y-2">
        <textarea value={editText} onChange={e => setEditText(e.target.value)} className="w-full h-24 glass-input p-2 rounded-lg resize-none text-white text-sm" autoFocus />
        <div className="flex justify-end gap-2">
          <button onClick={() => setEditingId(null)} className="px-2 py-1 text-xs text-gray-400">Cancel</button>
          <button onClick={async () => { await updateDialogue.mutateAsync({ id: d.id, projectId: project.id, text: editText }); setEditingId(null); }} disabled={updateDialogue.isPending} className="px-2 py-1 text-xs bg-primary text-white rounded">{updateDialogue.isPending ? "..." : "Save"}</button>
        </div>
      </div>
    );
    if (rewritingId === d.id) return (
      <div className="p-3 space-y-2">
        <div className="p-2 bg-black/30 rounded text-gray-400 text-[11px] line-clamp-2">"{d.text}"</div>
        <input value={rwInstr} onChange={e => setRwInstr(e.target.value)} placeholder={d.speaker === "N" ? "Make it more dramatic..." : "Make it more aggressive..."} className="w-full glass-input p-2 rounded text-white text-xs" autoFocus />
        <div className="flex justify-end gap-2">
          <button onClick={() => setRewritingId(null)} className="px-2 py-1 text-xs text-gray-400">Cancel</button>
          <button onClick={async () => { await rewriteDialogue.mutateAsync({ dialogueId: d.id, projectId: project.id, instructions: rwInstr }); setRewritingId(null); setRwInstr(""); }} disabled={!rwInstr || rewriteDialogue.isPending} className={`px-2 py-1 text-xs text-white rounded bg-gradient-to-r ${gradientFrom} flex items-center gap-1`}>
            {rewriteDialogue.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />} AI Rewrite
          </button>
        </div>
      </div>
    );
    return (
      <div className="p-3 group relative">
        <p className="text-gray-100 text-xs sm:text-sm leading-relaxed">{d.text}</p>
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-1">
          <button onClick={() => { setEditingId(d.id); setEditText(d.text); }} className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded"><Edit2 className="w-3 h-3" /></button>
          <button onClick={() => setRewritingId(d.id)} className={`p-1 hover:bg-white/10 rounded ${textCol}`}><Wand2 className="w-3 h-3" /></button>
        </div>
      </div>
    );
  };

  // Group dialogues into rounds: narrator (optional) + A/B pair
  const rounds: { narrator?: any; speakerA?: any; speakerB?: any }[] = [];
  let cur: { narrator?: any; speakerA?: any; speakerB?: any } = {};
  for (const d of dialogues) {
    if (d.speaker === "N") {
      if (cur.speakerA || cur.speakerB || cur.narrator) { rounds.push(cur); cur = {}; }
      cur.narrator = d;
    } else if (d.speaker === "A") {
      if (cur.speakerA) { rounds.push(cur); cur = { narrator: undefined }; }
      cur.speakerA = d;
    } else {
      cur.speakerB = d;
      rounds.push(cur); cur = {};
    }
  }
  if (cur.narrator || cur.speakerA || cur.speakerB) rounds.push(cur);

  return (
    <div className="max-w-4xl mx-auto flex flex-col" style={{ height: "calc(100vh - 130px)" }}>
      <div className="flex justify-between items-center mb-4 shrink-0">
        <div>
          <h2 className="text-xl font-display font-bold text-white">Script Editor</h2>
          <p className="text-muted-foreground text-xs">Click any line to edit • AI-rewrite available</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Speaker name editor */}
          <div className="hidden sm:flex items-center gap-1.5 glass-panel px-3 py-1.5 rounded-xl border border-white/10">
            <span className="w-4 h-4 rounded-full bg-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-[9px]">A</span>
            <input value={speakerA} onChange={e=>setSpeakerA(e.target.value)} onBlur={saveNames} className="bg-transparent text-white text-xs font-bold w-20 focus:outline-none" />
            <span className="text-white/20">|</span>
            <span className="w-4 h-4 rounded-full bg-cyan-500/30 text-cyan-300 flex items-center justify-center font-bold text-[9px]">B</span>
            <input value={speakerB} onChange={e=>setSpeakerB(e.target.value)} onBlur={saveNames} className="bg-transparent text-white text-xs font-bold w-20 focus:outline-none" />
            <span className="text-white/20">|</span>
            <span className="w-4 h-4 rounded-full bg-amber-500/30 text-amber-300 flex items-center justify-center font-bold text-[9px]">N</span>
            <input value={narrator} onChange={e=>setNarrator(e.target.value)} onBlur={saveNames} className="bg-transparent text-amber-300 text-xs font-bold w-16 focus:outline-none" />
          </div>
          <button onClick={() => generateScript.mutateAsync({ projectId: project.id, context: localStorage.getItem(`ctx-${project.id}`) || undefined })} disabled={generateScript.isPending} className="px-3 py-2 text-xs border border-white/20 text-gray-300 rounded-xl hover:bg-white/5 flex items-center gap-1.5">
            {generateScript.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Regenerate
          </button>
          <button onClick={onNext} className="px-5 py-2 bg-white text-black font-bold rounded-xl text-sm hover:bg-gray-200 flex items-center gap-1.5">Next <ArrowRight className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {rounds.map((round, i) => (
          <div key={i} className="rounded-2xl border border-white/10 overflow-hidden glass-panel">
            {/* Argument heading */}
            <div className="px-4 py-2.5 bg-white/5 border-b border-white/10 flex items-center gap-2">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Argument {i + 1}</span>
              {round.narrator && <span className="text-[9px] text-amber-500/70 ml-auto">with narrator intro</span>}
            </div>

            {/* Narrator line (full-width, amber) */}
            {round.narrator && (
              <div className="border-b border-amber-500/15 bg-amber-500/[0.04] px-4 py-1 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-[9px] shrink-0">N</span>
                <span className="text-amber-400/60 text-[10px] font-bold">{narrator}</span>
              </div>
            )}
            {round.narrator && <div className="border-b border-amber-500/10"><Cell d={round.narrator} /></div>}

            {/* A and B side by side */}
            <div className="grid grid-cols-2">
              <div className="border-r border-white/5">
                <div className="px-3 py-1.5 border-b border-indigo-500/20 bg-indigo-500/[0.04] flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-[9px]">A</span>
                  <span className="text-indigo-300/70 text-[10px] font-bold">{speakerA}</span>
                </div>
                {round.speakerA ? <Cell d={round.speakerA} /> : <div className="p-4 text-gray-600 text-xs italic text-center">—</div>}
              </div>
              <div>
                <div className="px-3 py-1.5 border-b border-cyan-500/20 bg-cyan-500/[0.04] flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-[9px]">B</span>
                  <span className="text-cyan-300/70 text-[10px] font-bold">{speakerB}</span>
                </div>
                {round.speakerB ? <Cell d={round.speakerB} /> : <div className="p-4 text-gray-600 text-xs italic text-center">—</div>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── STEP 3: AUDIO ─────────────────────────────────────────────────────────────
function Step3Audio({ project, onNext }: { project: any; onNext: () => void }) {
  const upd = useUpdateProject();
  const queryClient = useQueryClient();
  const genTranscript = useGenerateTranscript();
  const defaultProvider = (project.audioProvider === "openai" || !project.audioProvider) ? "gemini" : project.audioProvider;
  const [provider, setProvider] = useState(defaultProvider);
  const voices = getVoicesForProvider(provider);
  const [voiceA, setVoiceA] = useState(project.speakerAVoice || voices[0]?.id);
  const [voiceB, setVoiceB] = useState(project.speakerBVoice || voices[1]?.id);
  const [voiceN, setVoiceN] = useState(project.speakerNarratorVoice || voices[2]?.id);
  const [generating, setGenerating] = useState<Set<number>>(new Set());
  const [genProgress, setGenProgress] = useState(0);
  const [genBusy, setGenBusy] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [captionsDone, setCaptionsDone] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const sortedDialogues: any[] = [...(project.dialogues || [])].sort((a, b) => a.sequence - b.sequence);
  const allDone = sortedDialogues.every((d: any) => d.audioUrl);
  const doneCount = sortedDialogues.filter((d: any) => d.audioUrl).length;

  const saveVoice = (key: string, val: string) => upd.mutate({ id: project.id, [key]: val });

  const switchProvider = (p: string) => {
    setProvider(p);
    const v = getVoicesForProvider(p);
    const a = v[0]?.id; const b = v[1]?.id; const n = v[2]?.id;
    setVoiceA(a); setVoiceB(b); setVoiceN(n);
    upd.mutate({ id: project.id, audioProvider: p, speakerAVoice: a, speakerBVoice: b, speakerNarratorVoice: n });
  };

  const genOne = async (dialogueId: number) => {
    setGenerating(prev => new Set(prev).add(dialogueId));
    try {
      await fetch(buildUrl(api.ai.generateAudio.path, { id: dialogueId }), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", credentials: "include",
      });
      queryClient.invalidateQueries({ queryKey: [api.projects.get.path, project.id] });
    } finally {
      setGenerating(prev => { const s = new Set(prev); s.delete(dialogueId); return s; });
    }
  };

  const genAll = async () => {
    setGenBusy(true); setGenProgress(0);
    const total = sortedDialogues.length;
    let done = 0;
    // parallel generation
    await Promise.allSettled(sortedDialogues.map(async (d: any) => {
      setGenerating(prev => new Set(prev).add(d.id));
      try {
        await fetch(buildUrl(api.ai.generateAudio.path, { id: d.id }), {
          method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", credentials: "include",
        });
      } finally {
        done++;
        setGenProgress(Math.round((done / total) * 100));
        setGenerating(prev => { const s = new Set(prev); s.delete(d.id); return s; });
      }
    }));
    queryClient.invalidateQueries({ queryKey: [api.projects.get.path, project.id] });
    setGenBusy(false);
  };

  const playAudio = (d: any) => {
    if (playingId === d.id) { audioRef.current?.pause(); setPlayingId(null); return; }
    audioRef.current?.pause();
    const audio = new Audio(d.audioUrl); audioRef.current = audio;
    audio.onended = () => setPlayingId(null);
    audio.play(); setPlayingId(d.id);
  };

  const syncTranscripts = async () => {
    const withAudio = sortedDialogues.filter((d: any) => d.audioUrl && !d.transcript);
    await Promise.allSettled(withAudio.map((d: any) =>
      genTranscript.mutateAsync({ dialogueId: d.id, projectId: project.id })
    ));
  };

  const genSRT = () => {
    let srt = "", t = 0;
    sortedDialogues.forEach((d: any, i: number) => {
      const dur = Math.max(2, d.text.split(" ").length / 2.5);
      const fmtT = (s: number) => { const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=Math.floor(s%60),ms=Math.floor((s%1)*1000); return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")},${String(ms).padStart(3,"0")}`; };
      const name = d.speaker==="A" ? project.speakerAName : d.speaker==="B" ? project.speakerBName : project.speakerNarratorName;
      const txt = d.transcript || d.text;
      srt += `${i+1}\n${fmtT(t)} --> ${fmtT(t+dur)}\n[${name}] ${txt}\n\n`;
      t += dur + 0.5;
    });
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([srt],{type:"text/plain"}));
    a.download = `${project.topic.replace(/\s+/g,"_")}.srt`; a.click(); setCaptionsDone(true);
  };

  const speakerCfg = [
    { speaker:"A", name:project.speakerAName, voice:voiceA, colorBorder:"border-t-indigo-500", colorBg:"bg-indigo-500/20", colorText:"text-indigo-400", setVoice:(v:string)=>{setVoiceA(v);saveVoice("speakerAVoice",v);} },
    { speaker:"B", name:project.speakerBName, voice:voiceB, colorBorder:"border-t-cyan-500", colorBg:"bg-cyan-500/20", colorText:"text-cyan-400", setVoice:(v:string)=>{setVoiceB(v);saveVoice("speakerBVoice",v);} },
    { speaker:"N", name:project.speakerNarratorName||"Narrator", voice:voiceN, colorBorder:"border-t-amber-500", colorBg:"bg-amber-500/20", colorText:"text-amber-400", setVoice:(v:string)=>{setVoiceN(v);saveVoice("speakerNarratorVoice",v);} },
  ];

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-5" style={{ height: "calc(100vh - 130px)" }}>
      <div className="flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-violet-500/20 to-indigo-600/20 rounded-xl flex items-center justify-center ring-1 ring-violet-500/20">
            <Mic className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h2 className="text-xl font-display font-bold text-white">Voice Synthesis</h2>
            <p className="text-muted-foreground text-xs">Pick provider & voices, generate in parallel</p>
          </div>
        </div>
        <button onClick={onNext} disabled={!allDone} className="px-5 py-2 bg-white text-black font-bold rounded-xl text-sm hover:bg-gray-200 disabled:opacity-40 flex items-center gap-1.5">Next <ArrowRight className="w-4 h-4" /></button>
      </div>

      {/* Provider + Voice config row */}
      <div className="glass-panel rounded-2xl p-4 shrink-0 space-y-4">
        {/* Provider tabs */}
        <div className="flex gap-1.5 p-1 bg-black/30 rounded-xl">
          {AUDIO_PROVIDERS.map(p => (
            <button key={p.id} onClick={() => switchProvider(p.id)} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${provider===p.id?"bg-primary text-white shadow":"text-gray-400 hover:text-white"}`}>
              {p.name} <span className="opacity-50 font-normal">— {p.desc}</span>
            </button>
          ))}
        </div>

        {/* 3-speaker voice dropdowns */}
        <div className="grid grid-cols-3 gap-3">
          {speakerCfg.map(sp => (
            <div key={sp.speaker} className={`rounded-xl border-t-2 ${sp.colorBorder} glass-panel p-3`}>
              <div className="flex items-center gap-1.5 mb-2">
                <span className={`w-5 h-5 rounded-full ${sp.colorBg} ${sp.colorText} flex items-center justify-center font-bold text-[9px]`}>{sp.speaker}</span>
                <span className="text-white font-bold text-xs truncate">{sp.name}</span>
              </div>
              <select value={sp.voice} onChange={e => sp.setVoice(e.target.value)}
                className="w-full bg-black/40 border border-white/10 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-white/30 cursor-pointer">
                {voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={genAll} disabled={genBusy} className="px-5 py-2 bg-gradient-to-r from-primary to-indigo-600 text-white font-bold rounded-xl text-sm flex items-center gap-2 hover:-translate-y-0.5 transition-all disabled:opacity-50">
            <Volume2 className="w-4 h-4" />
            {genBusy ? `Generating… ${genProgress}%` : allDone ? "Regenerate All" : "Generate All (Parallel)"}
          </button>
          {allDone && (
            <>
              <button onClick={syncTranscripts} disabled={genTranscript.isPending} className="px-4 py-2 bg-violet-600/80 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 hover:bg-violet-600">
                <AlignJustify className="w-3.5 h-3.5" /> {genTranscript.isPending ? "Syncing…" : "Sync Transcripts"}
              </button>
              <button onClick={genSRT} className="px-4 py-2 bg-emerald-600/80 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 hover:bg-emerald-600">
                <Captions className="w-3.5 h-3.5" /> {captionsDone ? "Download Again" : "Export SRT"}
              </button>
            </>
          )}
          <span className="ml-auto text-gray-500 text-xs">{doneCount}/{sortedDialogues.length} ready</span>
        </div>

        {/* Progress bar when busy */}
        {genBusy && (
          <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300" style={{width:`${genProgress}%`}} />
          </div>
        )}
      </div>

      {/* Per-dialogue list */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
        {sortedDialogues.map((d: any) => {
          const isGen = generating.has(d.id);
          const isPlay = playingId === d.id;
          const borderCol = d.speaker==="A" ? "border-indigo-500/20 bg-indigo-500/[0.03]" : d.speaker==="B" ? "border-cyan-500/20 bg-cyan-500/[0.03]" : "border-amber-500/20 bg-amber-500/[0.03]";
          const badgeCol = d.speaker==="A" ? "bg-indigo-500/20 text-indigo-400" : d.speaker==="B" ? "bg-cyan-500/20 text-cyan-400" : "bg-amber-500/20 text-amber-400";
          return (
            <div key={d.id} className={`flex items-center gap-2 p-2.5 rounded-xl border glass-panel text-xs ${borderCol}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold shrink-0 ${badgeCol}`}>{d.speaker}</div>
              <p className="text-gray-300 flex-1 line-clamp-1">{d.transcript || d.text}</p>
              <div className="flex items-center gap-1.5 shrink-0">
                {d.audioUrl && (
                  <button onClick={() => playAudio(d)} className={`p-1 rounded-full ${isPlay?"bg-primary/30 text-primary":"text-gray-500 hover:text-white hover:bg-white/10"}`}>
                    {isPlay ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  </button>
                )}
                <button onClick={() => genOne(d.id)} disabled={isGen} className="p-1 rounded-full text-gray-500 hover:text-white hover:bg-white/10 disabled:opacity-40">
                  {isGen ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                </button>
                {d.audioUrl ? <Check className="w-3 h-3 text-green-400" /> : <span className="text-gray-600 text-[10px]">—</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── STEP 4: VIDEO PREVIEW ─────────────────────────────────────────────────────
type Phase = "idle" | "speaking" | "scoring";
type TextSize = "small" | "medium" | "large";
interface OverlayCfg { roleA: string; roleB: string; textSize: TextSize; showScores: boolean; showTimer: boolean; showTopic: boolean; showWaveform: boolean; showTranscript: boolean; bgOpacity: number; subBottom: number; subWidth: number; subBgOpacity: number; speakerAImage: string; speakerBImage: string; }

function Step4Preview({ project }: { project: any }) {
  const dialogues: any[] = project.dialogues || [];
  const upd = useUpdateProject();
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRecRef = useRef<MediaRecorder | null>(null);

  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [countdown, setCountdown] = useState(0);
  const [style, setStyle] = useState<1|2|3|4|5|6>(1);
  const [bg, setBg] = useState(project.backgroundImage || DEMO_BG);
  const [showSettings, setShowSettings] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [cfg, setCfg] = useState<OverlayCfg>({ roleA: "SUPPORTER", roleB: "OPPONENT", textSize: "medium", showScores: true, showTimer: true, showTopic: true, showWaveform: true, showTranscript: true, bgOpacity: 100, subBottom: 12, subWidth: 80, subBgOpacity: 80, speakerAImage: "", speakerBImage: "" });
  const [wordIdx, setWordIdx] = useState(-1);
  const wordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const spkAImgRef = useRef<HTMLInputElement>(null);
  const spkBImgRef = useRef<HTMLInputElement>(null);

  // Pre-compute scores for all dialogues
  const scoreData = useMemo(() => dialogues.map(d => {
    const ms = genScores(d.text);
    return { modelScores: ms, avg: +(ms.reduce((s,m)=>s+m.score,0)/ms.length).toFixed(1), speaker: d.speaker };
  }), [dialogues]);

  // Cumulative scores (only completed arguments)
  const completedTill = phase === "scoring" ? idx : idx - 1;
  const totA = useMemo(() => scoreData.filter((_,i)=>i<=completedTill&&scoreData[i].speaker==="A").reduce((s,d)=>+(s+d.avg).toFixed(1),0), [scoreData,completedTill]);
  const totB = useMemo(() => scoreData.filter((_,i)=>i<=completedTill&&scoreData[i].speaker==="B").reduce((s,d)=>+(s+d.avg).toFixed(1),0), [scoreData,completedTill]);

  const current = dialogues[idx] || { text: "", speaker: "A" };
  const isA = current.speaker === "A";
  const isNarrator = current.speaker === "N";

  // ── Phase-based engine ──
  useEffect(() => {
    if (phase === "idle") return;
    if (phase === "speaking") {
      if (countdown <= 0) {
        // If audio URL exists, audio's onended handles advancement
        if (dialogues[idx]?.audioUrl) return;
        // Narrator lines skip scoring
        if (isNarrator) {
          const next = idx + 1;
          if (next >= dialogues.length) { setPhase("idle"); return; }
          setIdx(next);
          setCountdown(dialogueDuration(dialogues[next].text));
          playTransition();
          return;
        }
        playScoreReveal(); setPhase("scoring"); return;
      }
      if (countdown <= 3) playCountdownBeep();
      const t = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
    if (phase === "scoring") {
      const t = setTimeout(() => {
        const next = idx + 1;
        if (next >= dialogues.length) { setPhase("idle"); return; }
        setIdx(next);
        setCountdown(dialogueDuration(dialogues[next].text));
        playTransition();
        setPhase("speaking");
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [phase, countdown]);

  // ── Word-by-word subtitle reveal ──
  useEffect(() => {
    if (wordTimerRef.current) clearInterval(wordTimerRef.current);
    if (phase === "speaking" && current.text) {
      const words = current.text.split(" ");
      const totalSecs = dialogueDuration(current.text);
      const msPerWord = Math.max(150, (totalSecs * 1000) / words.length);
      setWordIdx(0);
      let w = 0;
      wordTimerRef.current = setInterval(() => {
        w++;
        setWordIdx(w);
        if (w >= words.length && wordTimerRef.current) clearInterval(wordTimerRef.current);
      }, msPerWord);
    } else {
      setWordIdx(-1);
    }
    return () => { if (wordTimerRef.current) clearInterval(wordTimerRef.current); };
  }, [phase, idx]);

  // ── Preview audio playback: play actual generated audio per dialogue ──
  useEffect(() => {
    if (previewAudioRef.current) { previewAudioRef.current.pause(); previewAudioRef.current = null; }
    if (phase !== "speaking") return;
    const dl = dialogues[idx];
    if (!dl?.audioUrl) return;
    const audio = new Audio(dl.audioUrl);
    previewAudioRef.current = audio;
    const isN = dl.speaker === "N";
    audio.onended = () => {
      const next = idx + 1;
      if (isN) {
        if (next >= dialogues.length) { setPhase("idle"); return; }
        setIdx(next); setCountdown(dialogueDuration(dialogues[next].text)); playTransition();
      } else { playScoreReveal(); setPhase("scoring"); }
    };
    audio.play().catch(() => { /* blocked or missing – timer fallback handles it */ });
    return () => { audio.pause(); };
  }, [phase, idx]);

  const handlePlay = () => {
    if (phase !== "idle") {
      previewAudioRef.current?.pause();
      previewAudioRef.current = null;
      setPhase("idle"); return;
    }
    if (!dialogues[idx]) return;
    setCountdown(dialogueDuration(dialogues[idx].text));
    setPhase("speaking");
  };
  const handlePrev = () => { setPhase("idle"); setIdx(i => Math.max(0, i-1)); };
  const handleNext = () => { setPhase("idle"); setIdx(i => Math.min(dialogues.length-1, i+1)); };

  const handleBg = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const r = new FileReader(); r.onload = ev => { const url = ev.target?.result as string; setBg(url); upd.mutate({ id: project.id, backgroundImage: url }); }; r.readAsDataURL(file);
  };

  const handleRecord = async () => {
    if (isRecording) { mediaRecRef.current?.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const rec = new MediaRecorder(stream); const chunks: Blob[] = [];
      rec.ondataavailable = e => { if (e.data.size>0) chunks.push(e.data); };
      rec.onstop = () => { stream.getTracks().forEach(t=>t.stop()); const blob=new Blob(chunks,{type:"video/webm"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`debate_${Date.now()}.webm`; a.click(); setIsRecording(false); };
      rec.start(); mediaRecRef.current = rec; setIsRecording(true);
      // auto-play
      if (phase === "idle") { setCountdown(dialogueDuration(dialogues[idx]?.text||"")); setPhase("speaking"); }
    } catch { alert("Screen recording cancelled."); }
  };

  const handleSpeakerImg = (speaker: "A" | "B") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const r = new FileReader(); r.onload = ev => set(speaker === "A" ? "speakerAImage" : "speakerBImage", ev.target?.result as string); r.readAsDataURL(file);
  };

  const set = <K extends keyof OverlayCfg>(k: K, v: OverlayCfg[K]) => setCfg(c=>({...c,[k]:v}));
  const styleNames = ["","Panel","Bar","News","Arena","Split","Podcast"];

  const canvasProps = { project, current, isA, isNarrator, cfg, countdown, isSpeaking: phase==="speaking", totA, totB, wordIdx };

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-2.5" style={{ height: "calc(100vh - 100px)" }}>
      {/* Controls toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500/20 to-teal-600/20 rounded-lg flex items-center justify-center ring-1 ring-emerald-500/20">
            <LayoutTemplate className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base font-display font-bold text-white leading-tight">Video Canvas</h2>
            <p className="text-muted-foreground text-[10px] hidden sm:block">Style · Overlay · Background · Record</p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {/* Style tabs */}
          <div className="flex bg-black/40 rounded-lg border border-white/10 p-0.5 gap-0.5">
            {([1,2,3,4,5,6] as const).map(s => (
              <button key={s} onClick={()=>setStyle(s)} className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${style===s?"bg-primary text-white shadow-md shadow-primary/30":"text-gray-500 hover:text-white"}`}>{styleNames[s]}</button>
            ))}
          </div>
          <div className="w-px h-5 bg-white/10 mx-0.5 hidden sm:block" />
          <button onClick={()=>setShowSettings(!showSettings)} className={`px-2.5 py-1.5 rounded-lg border text-[10px] flex items-center gap-1 font-medium transition-all ${showSettings?"border-primary bg-primary/10 text-primary":"border-white/10 text-gray-400 hover:text-white hover:bg-white/5"}`}><Settings className="w-3 h-3" /> Overlay</button>
          <button onClick={()=>fileRef.current?.click()} className="px-2.5 py-1.5 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 text-[10px] flex items-center gap-1 font-medium"><ImageIcon className="w-3 h-3" /> BG</button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleBg} />
          <input ref={spkAImgRef} type="file" accept="image/*" className="hidden" onChange={handleSpeakerImg("A")} />
          <input ref={spkBImgRef} type="file" accept="image/*" className="hidden" onChange={handleSpeakerImg("B")} />
          <button onClick={handleRecord} className={`px-2.5 py-1.5 rounded-lg border text-[10px] flex items-center gap-1 font-bold transition-all ${isRecording?"border-red-500 bg-red-500/20 text-red-400 animate-pulse":"border-white/10 text-gray-400 hover:text-white hover:bg-white/5"}`}>
            {isRecording ? <><Square className="w-3 h-3" /> Stop</> : <><Video className="w-3 h-3" /> Record</>}
          </button>
          <button onClick={()=>{ const a=document.createElement("a"); a.href=bg; a.download="background.jpg"; a.click(); }} className="px-2.5 py-1.5 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 text-[10px] flex items-center gap-1 font-medium">
            <Download className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-3 min-h-0">
        {/* Settings Panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div initial={{opacity:0,width:0}} animate={{opacity:1,width:"240px"}} exit={{opacity:0,width:0}} className="glass-panel rounded-2xl p-3 overflow-y-auto shrink-0 space-y-4" style={{minWidth:"240px"}}>
              <p className="text-white font-bold text-xs uppercase tracking-wider">Overlay</p>
              <div className="space-y-1.5">
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Text Size</p>
                <div className="flex gap-1">
                  {(["small","medium","large"] as TextSize[]).map(sz=>(
                    <button key={sz} onClick={()=>set("textSize",sz)} className={`flex-1 py-1 rounded-lg text-xs font-medium capitalize ${cfg.textSize===sz?"bg-primary text-white":"bg-white/10 text-gray-400"}`}>{sz}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Roles</p>
                <div><p className="text-[10px] text-indigo-400 mb-0.5">{project.speakerAName}</p><input value={cfg.roleA} onChange={e=>set("roleA",e.target.value)} className="w-full glass-input px-2 py-1.5 rounded text-white text-xs" /></div>
                <div><p className="text-[10px] text-rose-400 mb-0.5">{project.speakerBName}</p><input value={cfg.roleB} onChange={e=>set("roleB",e.target.value)} className="w-full glass-input px-2 py-1.5 rounded text-white text-xs" /></div>
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Scores (Live)</p>
                <div className="text-xs space-y-0.5">
                  <div className="flex justify-between"><span className="text-blue-400">{project.speakerAName}</span><span className="text-white font-bold tabular-nums">{totA.toFixed(1)}</span></div>
                  <div className="flex justify-between"><span className="text-rose-400">{project.speakerBName}</span><span className="text-white font-bold tabular-nums">{totB.toFixed(1)}</span></div>
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">BG Opacity</p>
                <div className="flex items-center gap-2">
                  <input type="range" min={0} max={100} value={cfg.bgOpacity} onChange={e => set("bgOpacity", parseInt(e.target.value))} className="flex-1 accent-primary h-1.5" />
                  <span className="text-xs text-gray-400 tabular-nums w-8 text-right">{cfg.bgOpacity}%</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Subtitle Position</p>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-gray-500 w-10">Bottom</span>
                  <input type="range" min={5} max={60} value={cfg.subBottom} onChange={e => set("subBottom", parseInt(e.target.value))} className="flex-1 accent-primary h-1.5" />
                  <span className="text-xs text-gray-400 tabular-nums w-8 text-right">{cfg.subBottom}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-gray-500 w-10">Width</span>
                  <input type="range" min={30} max={100} value={cfg.subWidth} onChange={e => set("subWidth", parseInt(e.target.value))} className="flex-1 accent-primary h-1.5" />
                  <span className="text-xs text-gray-400 tabular-nums w-8 text-right">{cfg.subWidth}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-gray-500 w-10">BG</span>
                  <input type="range" min={0} max={100} value={cfg.subBgOpacity} onChange={e => set("subBgOpacity", parseInt(e.target.value))} className="flex-1 accent-primary h-1.5" />
                  <span className="text-xs text-gray-400 tabular-nums w-8 text-right">{cfg.subBgOpacity}%</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Visibility</p>
                {([["showScores","Scores"],["showTopic","Topic"],["showTimer","Timer"],["showWaveform","Waveform"],["showTranscript","Transcript"]] as [keyof OverlayCfg, string][]).map(([k,label])=>(
                  <label key={k} className="flex items-center justify-between cursor-pointer py-0.5">
                    <span className="text-xs text-gray-300">{label}</span>
                    <button onClick={()=>set(k,!cfg[k] as any)} className={`w-9 h-[18px] rounded-full relative transition-all ${cfg[k]?"bg-primary":"bg-white/20"}`}>
                      <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[2px] transition-all ${cfg[k]?"left-[18px]":"left-[2px]"}`} />
                    </button>
                  </label>
                ))}
              </div>
              {/* Speaker images for Split/Podcast styles */}
              <div className="space-y-1.5">
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Speaker Images</p>
                <p className="text-[9px] text-gray-500">Used in Split & Podcast styles</p>
                <div className="flex flex-col gap-1.5">
                  <button onClick={() => spkAImgRef.current?.click()}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs hover:bg-indigo-500/20 transition-all">
                    <ImageIcon className="w-3 h-3" />
                    {cfg.speakerAImage ? <span className="text-indigo-400">✓ {project.speakerAName}</span> : <span>{project.speakerAName}</span>}
                  </button>
                  <button onClick={() => spkBImgRef.current?.click()}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs hover:bg-rose-500/20 transition-all">
                    <ImageIcon className="w-3 h-3" />
                    {cfg.speakerBImage ? <span className="text-rose-400">✓ {project.speakerBName}</span> : <span>{project.speakerBName}</span>}
                  </button>
                  {(cfg.speakerAImage || cfg.speakerBImage) && (
                    <button onClick={() => { set("speakerAImage",""); set("speakerBImage",""); }} className="text-[9px] text-gray-500 hover:text-red-400 text-left">Clear images</button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Canvas */}
        <div className="flex-1 relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black min-h-0">
          {/* Background - clearly visible */}
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${bg})`, opacity: cfg.bgOpacity / 100 }} />
          {/* Light vignette only */}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, transparent 30%, transparent 60%, rgba(0,0,0,0.4) 100%)" }} />

          {/* Render chosen style */}
          {style===1 && <Style1 {...canvasProps} />}
          {style===2 && <Style2 {...canvasProps} />}
          {style===3 && <Style3 {...canvasProps} />}
          {style===4 && <Style4 {...canvasProps} />}
          {style===5 && <Style5 {...canvasProps} />}
          {style===6 && <Style6 {...canvasProps} />}

          {/* Score Card Overlay (not for narrator) */}
          <AnimatePresence>
            {phase === "scoring" && scoreData[idx] && !isNarrator && (
              <ScoreCardPage
                scores={scoreData[idx].modelScores}
                speakerName={isA ? project.speakerAName : project.speakerBName}
                avg={scoreData[idx].avg} isA={isA}
                totalA={totA} totalB={totB}
                nameA={project.speakerAName} nameB={project.speakerBName}
              />
            )}
          </AnimatePresence>

          {/* Playback bar */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 bg-black/75 backdrop-blur-xl px-2.5 py-1.5 rounded-full border border-white/10 shadow-xl">
            <button onClick={handlePrev} className="p-1 text-white/70 hover:bg-white/20 hover:text-white rounded-full transition-colors"><ArrowLeft className="w-3.5 h-3.5" /></button>
            <button onClick={handlePlay} className={`px-4 py-1 font-bold rounded-full text-xs flex items-center gap-1.5 transition-all ${phase!=="idle" ? "bg-red-500 text-white hover:bg-red-600" : "bg-white text-black hover:bg-gray-200"}`}>
              {phase!=="idle" ? <><Pause className="w-3 h-3"/>Stop</> : <><Play className="w-3 h-3"/>Play</>}
            </button>
            <button onClick={handleNext} className="p-1 text-white/70 hover:bg-white/20 hover:text-white rounded-full transition-colors"><ArrowRight className="w-3.5 h-3.5" /></button>
            <div className="w-px h-4 bg-white/15" />
            <span className="text-gray-500 text-[9px] font-bold tabular-nums">{idx+1}/{dialogues.length}</span>
            {phase==="speaking" && <span className="text-primary text-[9px] font-mono font-bold tabular-nums">{fmt(countdown)}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CANVAS PROPS TYPE ─────────────────────────────────────────────────────────
interface CP { project: any; current: any; isA: boolean; isNarrator: boolean; cfg: OverlayCfg; countdown: number; isSpeaking: boolean; totA: number; totB: number; wordIdx: number; }

// ─── SUBTITLE HELPER ───────────────────────────────────────────────────────────
function SubtitleText({ text, wordIdx, isSpeaking, textClass, italicize }: { text: string; wordIdx: number; isSpeaking: boolean; textClass: string; italicize?: boolean }) {
  const words = text.split(" ");
  const visibleCount = isSpeaking && wordIdx >= 0 ? Math.min(wordIdx, words.length) : words.length;
  return (
    <p className={`font-bold leading-snug ${italicize ? "italic" : ""} ${textClass}`}>
      {words.map((word, i) => (
        <span key={i} className={`transition-opacity duration-150 ${i < visibleCount ? "opacity-100" : "opacity-0"}`}>
          {word}{i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </p>
  );
}

// ─── STYLE 1: Reference image layout ──────────────────────────────────────────
// Top-left blue score | center topic | top-right timer+purple score
// Below title: SUPPORTER / OPPONENT text | Center speech bubble
function Style1({ project, current, isA, isNarrator, cfg, countdown, isSpeaking, totA, totB, wordIdx }: CP) {
  // Only show a snippet of text (2 lines max)
  const snippet = current.text.length > 80 ? current.text.slice(0, 78) + "…" : current.text;
  return (
    <>
      {/* ── TOP BAR ── */}
      <motion.div drag dragMomentum={false} className="absolute top-0 left-0 right-0 z-20 cursor-move flex items-stretch">
        {/* Left: Score A */}
        {cfg.showScores && (
          <div className="bg-blue-700/90 backdrop-blur-sm px-4 py-2.5 flex items-center justify-center min-w-[70px]">
            <span className="text-white font-black text-xl tabular-nums">{totA.toFixed(1)}</span>
          </div>
        )}
        {/* Center: Topic */}
        {cfg.showTopic && (
          <div className="flex-1 bg-gray-900/85 backdrop-blur-sm flex items-center justify-center px-4 py-2.5">
            <span className="text-white font-black text-xs sm:text-sm tracking-widest uppercase text-center leading-tight">{project.topic}</span>
          </div>
        )}
        {/* Right: Timer + Score B */}
        <div className="flex items-stretch">
          {cfg.showTimer && (
            <div className="bg-gray-700/90 backdrop-blur-sm px-3 py-2.5 flex items-center justify-center">
              <span className="text-white font-mono font-bold text-base tabular-nums">{fmt(countdown)}</span>
            </div>
          )}
          {cfg.showScores && (
            <div className="bg-purple-700/90 backdrop-blur-sm px-4 py-2.5 flex items-center justify-center min-w-[70px]">
              <span className="text-white font-black text-xl tabular-nums">{totB.toFixed(1)}</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── SUPPORTER / OPPONENT LABELS ── */}
      <motion.div drag dragMomentum={false} className="absolute z-20 cursor-move" style={{ top: 52, left: 0, right: 0 }}>
        <div className="flex justify-between px-4 sm:px-10">
          <span className={`font-black text-lg sm:text-2xl tracking-widest transition-all duration-300 ${isA && isSpeaking ? "text-blue-400 drop-shadow-[0_0_12px_rgba(96,165,250,0.9)]" : "text-blue-400/60"}`} style={{ fontStyle: "italic" }}>{cfg.roleA}</span>
          <span className={`font-black text-lg sm:text-2xl tracking-widest transition-all duration-300 ${!isA && isSpeaking ? "text-rose-400 drop-shadow-[0_0_12px_rgba(251,113,133,0.9)]" : "text-rose-400/60"}`} style={{ fontStyle: "italic" }}>{cfg.roleB}</span>
        </div>
      </motion.div>

      {/* ── WAVEFORM on speaking side ── */}
      {cfg.showWaveform && isSpeaking && (
        <motion.div drag dragMomentum={false} initial={{opacity:0}} animate={{opacity:1}} className={`absolute top-24 z-20 cursor-move ${isA ? "left-4" : "right-4"}`}>
          <WaveformBars color={isA ? "bg-blue-400" : "bg-rose-400"} />
        </motion.div>
      )}

      {/* ── TRANSCRIPT BUBBLE ── */}
      {cfg.showTranscript && current.text && (
        <motion.div drag dragMomentum={false} className="absolute z-20 cursor-move"
          style={{ bottom: `${cfg.subBottom}%`, left: "50%", transform: "translateX(-50%)", width: `${cfg.subWidth}%`, maxWidth: 640 }}>
          <AnimatePresence mode="wait">
            <motion.div key={current.text} initial={{opacity:0,y:12,scale:0.97}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-8,scale:0.97}}
              className={`relative backdrop-blur-md rounded-2xl shadow-2xl border ${isNarrator ? "border-amber-500/30" : "border-white/10"}`}
              style={{ padding: cfg.textSize==="small"?"10px 16px":cfg.textSize==="large"?"18px 28px":"14px 22px", backgroundColor: isNarrator ? `rgba(69,26,3,${cfg.subBgOpacity/100})` : `rgba(10,10,20,${cfg.subBgOpacity/100})` }}>
              <div className={`absolute -bottom-2.5 ${isNarrator?"left-1/2 -translate-x-1/2":isA?"left-10":"right-10"} w-5 h-5 rotate-45 border-b border-r ${isNarrator?"border-amber-500/30":"border-white/10"}`} style={{ backgroundColor: isNarrator ? `rgba(69,26,3,${cfg.subBgOpacity/100})` : `rgba(10,10,20,${cfg.subBgOpacity/100})` }} />
              {isNarrator && <div className="flex items-center gap-1.5 mb-1 justify-center"><div className="w-1.5 h-1.5 rounded-full bg-amber-400" /><span className="text-[9px] font-bold tracking-wider uppercase text-amber-400">{project.speakerNarratorName}</span></div>}
              <SubtitleText text={current.text} wordIdx={wordIdx} isSpeaking={isSpeaking} textClass={`text-white text-center ${TEXT_SIZES[cfg.textSize]}`} italicize={isNarrator} />
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </>
  );
}

// ─── STYLE 2: Bottom bar ───────────────────────────────────────────────────────
function Style2({ project, current, isA, isNarrator, cfg, countdown, isSpeaking, totA, totB, wordIdx }: CP) {
  return (
    <>
      {cfg.showTopic && (
        <motion.div drag dragMomentum={false} className="absolute top-4 left-1/2 -translate-x-1/2 z-20 cursor-move">
          <div className="bg-black/60 backdrop-blur rounded-2xl border border-white/10 px-5 py-2 flex items-center gap-3">
            <span className="text-white font-bold text-xs uppercase tracking-wide">{project.topic}</span>
            {cfg.showTimer && <><div className="w-px h-4 bg-white/20"/><span className="text-yellow-400 font-mono font-bold text-sm tabular-nums">{fmt(countdown)}</span></>}
          </div>
        </motion.div>
      )}
      {cfg.showWaveform && isSpeaking && (
        <motion.div drag dragMomentum={false} initial={{opacity:0}} animate={{opacity:1}} className={`absolute top-1/2 -translate-y-1/2 z-20 cursor-move ${isA?"left-5":"right-5"}`}>
          <WaveformBars color={isA?"bg-blue-400":"bg-rose-400"} />
        </motion.div>
      )}
      {cfg.showScores && (
        <motion.div drag dragMomentum={false} className="absolute bottom-12 left-0 right-0 z-20 cursor-move">
          <div className="flex">
            <div className={`flex-1 flex items-center gap-3 px-5 py-2.5 bg-blue-700/85 backdrop-blur-sm transition-all ${isA&&isSpeaking?"brightness-110":""}`}>
              <span className="text-white font-black text-xl tabular-nums">{totA.toFixed(1)}</span>
              <div><p className="text-white font-bold text-xs">{project.speakerAName}</p><p className="text-blue-200 text-[10px] tracking-wider">{cfg.roleA}</p></div>
              {isA&&isSpeaking&&cfg.showWaveform&&<div className="ml-auto"><WaveformBars color="bg-blue-200"/></div>}
            </div>
            <div className="w-px bg-white/10"/>
            <div className={`flex-1 flex items-center gap-3 px-5 py-2.5 bg-rose-700/85 backdrop-blur-sm flex-row-reverse transition-all ${!isA&&isSpeaking?"brightness-110":""}`}>
              <span className="text-white font-black text-xl tabular-nums">{totB.toFixed(1)}</span>
              <div className="text-right"><p className="text-white font-bold text-xs">{project.speakerBName}</p><p className="text-rose-200 text-[10px] tracking-wider">{cfg.roleB}</p></div>
              {!isA&&isSpeaking&&cfg.showWaveform&&<div className="mr-auto"><WaveformBars color="bg-rose-200"/></div>}
            </div>
          </div>
        </motion.div>
      )}
      {cfg.showTranscript && current.text && (
        <motion.div drag dragMomentum={false} className="absolute z-20 cursor-move"
          style={{ bottom: `calc(${cfg.subBottom}% + 44px)`, left: `${(100-cfg.subWidth)/2}%`, right: `${(100-cfg.subWidth)/2}%` }}>
          <AnimatePresence mode="wait">
            <motion.div key={current.text} initial={{opacity:0,scale:0.97}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.97}}
              className={`backdrop-blur-xl border rounded-2xl shadow-2xl ${BOX_PAD[cfg.textSize]} ${isNarrator ? "border-amber-500/20" : "border-white/10"}`}
              style={{ backgroundColor: isNarrator ? `rgba(69,26,3,${cfg.subBgOpacity/100})` : `rgba(0,0,0,${cfg.subBgOpacity/100})` }}>
              <div className="flex items-center gap-1.5 mb-1"><div className={`w-2 h-2 rounded-full ${isNarrator?"bg-amber-400":isA?"bg-blue-400":"bg-rose-400"}`}/><span className={`text-[10px] font-bold tracking-wider ${isNarrator?"text-amber-400":isA?"text-blue-400":"text-rose-400"}`}>{isNarrator?project.speakerNarratorName:isA?project.speakerAName:project.speakerBName}</span></div>
              <SubtitleText text={current.text} wordIdx={wordIdx} isSpeaking={isSpeaking} textClass={TEXT_SIZES[cfg.textSize]} italicize={isNarrator} />
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </>
  );
}

// ─── STYLE 3: News Broadcast ───────────────────────────────────────────────────
function Style3({ project, current, isA, isNarrator, cfg, countdown, isSpeaking, totA, totB, wordIdx }: CP) {
  const activeName = isNarrator ? project.speakerNarratorName : isA ? project.speakerAName : project.speakerBName;
  const activeRole = isNarrator ? "NARRATOR" : isA ? cfg.roleA : cfg.roleB;
  return (
    <>
      <motion.div drag dragMomentum={false} className="absolute top-4 left-4 z-20 cursor-move flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-red-600 px-3 py-1 rounded"><div className="w-2 h-2 rounded-full bg-white animate-pulse"/><span className="text-white font-black text-xs tracking-wider">LIVE</span></div>
        {cfg.showTimer&&<div className="bg-black/80 backdrop-blur px-3 py-1 rounded font-mono text-white font-bold text-sm tabular-nums">{fmt(countdown)}</div>}
      </motion.div>
      {cfg.showTopic&&<motion.div drag dragMomentum={false} className="absolute top-4 right-4 z-20 cursor-move"><div className="bg-white/95 px-4 py-1.5 rounded shadow-lg"><span className="text-gray-900 font-black text-xs tracking-wider uppercase">{project.topic}</span></div></motion.div>}
      {cfg.showWaveform&&isSpeaking&&<motion.div drag dragMomentum={false} className={`absolute top-1/2 -translate-y-1/2 z-20 cursor-move ${isA?"left-5":"right-5"}`} initial={{opacity:0}} animate={{opacity:1}}><WaveformBars color={isA?"bg-blue-400":"bg-rose-400"}/></motion.div>}
      <motion.div drag dragMomentum={false} className="absolute bottom-12 left-0 right-0 z-20 cursor-move">
        <div className="flex flex-col">
          <div className="flex items-stretch">
            <div className={`${isNarrator?"bg-amber-600":isA?"bg-blue-600":"bg-rose-600"} px-4 py-2`}>
              <p className="text-white font-black text-sm">{activeName}</p>
              <p className="text-white/70 text-[10px] font-bold tracking-wider">{activeRole}</p>
            </div>
            {cfg.showTranscript&&current.text&&<div className="flex-1 backdrop-blur px-4 py-2 flex items-center" style={{backgroundColor:`rgba(10,10,20,${cfg.subBgOpacity/100})`}}><SubtitleText text={current.text} wordIdx={wordIdx} isSpeaking={isSpeaking} textClass={`text-white font-semibold leading-snug ${TEXT_SIZES[cfg.textSize]}`} italicize={isNarrator} /></div>}
          </div>
          {cfg.showScores&&<div className="flex text-xs">
            <div className="bg-blue-800/90 px-4 py-1 flex items-center gap-2"><span className="text-blue-200 font-bold">{project.speakerAName}</span><span className="text-white font-black tabular-nums">{totA.toFixed(1)}</span></div>
            <div className="bg-gray-800/90 px-2 py-1 flex items-center"><span className="text-gray-400 font-bold">VS</span></div>
            <div className="bg-rose-800/90 px-4 py-1 flex items-center gap-2"><span className="text-rose-200 font-bold">{project.speakerBName}</span><span className="text-white font-black tabular-nums">{totB.toFixed(1)}</span></div>
            <div className="flex-1 bg-gray-900/90 px-3 py-1 flex items-center"><span className="text-gray-500 text-[9px] tracking-wider">GEMINI · CLAUDE · ELEVENLABS · DEEPSEEK · GROK AVG</span></div>
          </div>}
        </div>
      </motion.div>
    </>
  );
}

// ─── STYLE 4: Arena / VS ───────────────────────────────────────────────────────
function Style4({ project, current, isA, isNarrator, cfg, countdown, isSpeaking, totA, totB, wordIdx }: CP) {
  return (
    <>
      {/* Side glow */}
      <div className={`absolute inset-0 z-10 pointer-events-none transition-all duration-700 ${isA&&isSpeaking?"bg-gradient-to-r from-blue-600/25 via-transparent to-transparent":!isA&&isSpeaking?"bg-gradient-to-l from-rose-600/25 via-transparent to-transparent":""}`}/>
      {cfg.showTopic&&<motion.div drag dragMomentum={false} className="absolute top-4 left-1/2 -translate-x-1/2 z-20 cursor-move flex items-center gap-2">
        <span className="text-white/70 font-bold text-[10px] tracking-widest uppercase">{project.topic}</span>
        {cfg.showTimer&&<div className="bg-yellow-500/90 px-3 py-0.5 rounded font-mono text-black font-black text-sm tabular-nums">{fmt(countdown)}</div>}
      </motion.div>}
      {/* VS */}
      <motion.div drag dragMomentum={false} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 cursor-move">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.5)]">
          <span className="text-white font-black text-lg">VS</span>
        </div>
      </motion.div>
      {cfg.showScores&&<>
        <motion.div drag dragMomentum={false} className="absolute left-4 top-1/2 -translate-y-1/2 z-20 cursor-move">
          <div className={`bg-blue-600/80 backdrop-blur-lg rounded-2xl p-4 border border-blue-400/30 min-w-[90px] text-center transition-all ${isA&&isSpeaking?"shadow-[0_0_35px_rgba(59,130,246,0.6)] scale-105":"opacity-80"}`}>
            <div className="text-white font-black text-3xl tabular-nums">{totA.toFixed(1)}</div>
            <div className="w-full h-px bg-white/30 my-2"/>
            <div className="text-white font-bold text-xs">{project.speakerAName}</div>
            <div className="text-blue-200 text-[9px] tracking-wider mt-0.5">{cfg.roleA}</div>
            {cfg.showWaveform&&isA&&isSpeaking&&<div className="mt-2 flex justify-center"><WaveformBars color="bg-white/70"/></div>}
          </div>
        </motion.div>
        <motion.div drag dragMomentum={false} className="absolute right-4 top-1/2 -translate-y-1/2 z-20 cursor-move">
          <div className={`bg-rose-600/80 backdrop-blur-lg rounded-2xl p-4 border border-rose-400/30 min-w-[90px] text-center transition-all ${!isA&&isSpeaking?"shadow-[0_0_35px_rgba(239,68,68,0.6)] scale-105":"opacity-80"}`}>
            <div className="text-white font-black text-3xl tabular-nums">{totB.toFixed(1)}</div>
            <div className="w-full h-px bg-white/30 my-2"/>
            <div className="text-white font-bold text-xs">{project.speakerBName}</div>
            <div className="text-rose-200 text-[9px] tracking-wider mt-0.5">{cfg.roleB}</div>
            {cfg.showWaveform&&!isA&&isSpeaking&&<div className="mt-2 flex justify-center"><WaveformBars color="bg-white/70"/></div>}
          </div>
        </motion.div>
      </>}
      {cfg.showTranscript&&current.text&&(
        <motion.div drag dragMomentum={false} className="absolute z-20 cursor-move"
          style={{ bottom: `${cfg.subBottom}%`, left: `${(100-cfg.subWidth)/2}%`, right: `${(100-cfg.subWidth)/2}%` }}>
          <AnimatePresence mode="wait">
            <motion.div key={current.text} initial={{opacity:0,y:15}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-15}}
              className={`${BOX_PAD[cfg.textSize]} rounded-xl border shadow-2xl backdrop-blur-lg ${isNarrator?"border-amber-500/30":isA?"border-blue-500/30":"border-rose-500/30"}`}
              style={{ backgroundColor: isNarrator?`rgba(69,26,3,${cfg.subBgOpacity/100})`:isA?`rgba(3,15,69,${cfg.subBgOpacity/100})`:`rgba(69,3,15,${cfg.subBgOpacity/100})` }}>
              <div className="flex items-center gap-1.5 mb-1"><div className={`w-1.5 h-1.5 rounded-full ${isNarrator?"bg-amber-400":isA?"bg-blue-400":"bg-rose-400"}`}/><span className={`text-[9px] font-bold tracking-wider uppercase ${isNarrator?"text-amber-400":isA?"text-blue-400":"text-rose-400"}`}>{isNarrator?project.speakerNarratorName:isA?project.speakerAName:project.speakerBName}</span></div>
              <SubtitleText text={current.text} wordIdx={wordIdx} isSpeaking={isSpeaking} textClass={`text-white leading-snug ${TEXT_SIZES[cfg.textSize]}`} italicize={isNarrator} />
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </>
  );
}

// ─── STYLE 5: Split — speaker portrait panels on sides, transcript center ──────
function Style5({ project, current, isA, isNarrator, cfg, countdown, isSpeaking, totA, totB, wordIdx }: CP) {
  return (
    <>
      {/* Topic + Timer top center */}
      {cfg.showTopic && (
        <motion.div drag dragMomentum={false} className="absolute top-4 left-1/2 -translate-x-1/2 z-20 cursor-move">
          <div className="bg-black/70 backdrop-blur-md border border-white/10 rounded-2xl px-5 py-2 flex items-center gap-3">
            <span className="text-white font-bold text-xs">{project.topic}</span>
            {cfg.showTimer && <><div className="w-px h-4 bg-white/20"/><span className="text-yellow-400 font-mono font-bold text-sm tabular-nums">{fmt(countdown)}</span></>}
          </div>
        </motion.div>
      )}

      {/* Speaker A — left portrait card */}
      <motion.div drag dragMomentum={false} className="absolute left-3 top-1/2 -translate-y-1/2 z-20 cursor-move">
        <motion.div
          animate={{ scale: isA && isSpeaking && !isNarrator ? 1.06 : 1 }}
          transition={{ duration: 0.3 }}
          className={`rounded-2xl overflow-hidden border-2 transition-all duration-300 ${isA && isSpeaking && !isNarrator ? "border-blue-400 shadow-[0_0_32px_rgba(59,130,246,0.55)]" : "border-white/10 opacity-75"}`}
          style={{ width: 120 }}>
          {cfg.speakerAImage ? (
            <img src={cfg.speakerAImage} alt={project.speakerAName} className="w-full object-cover" style={{ height: 150 }} />
          ) : (
            <div className="w-full flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-900" style={{ height: 150 }}>
              <span className="text-white font-black text-5xl">{project.speakerAName?.[0]?.toUpperCase()}</span>
            </div>
          )}
          <div className="bg-blue-700/90 backdrop-blur px-3 py-2">
            <p className="text-white font-bold text-xs truncate">{project.speakerAName}</p>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-blue-200 text-[9px]">{cfg.roleA}</span>
              {cfg.showScores && <span className="text-white font-black text-sm tabular-nums">{totA.toFixed(1)}</span>}
            </div>
          </div>
          {isA && isSpeaking && !isNarrator && cfg.showWaveform && (
            <div className="bg-blue-900/90 py-1.5 flex justify-center">
              <WaveformBars color="bg-blue-300" />
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* Speaker B — right portrait card */}
      <motion.div drag dragMomentum={false} className="absolute right-3 top-1/2 -translate-y-1/2 z-20 cursor-move">
        <motion.div
          animate={{ scale: !isA && isSpeaking && !isNarrator ? 1.06 : 1 }}
          transition={{ duration: 0.3 }}
          className={`rounded-2xl overflow-hidden border-2 transition-all duration-300 ${!isA && isSpeaking && !isNarrator ? "border-rose-400 shadow-[0_0_32px_rgba(239,68,68,0.55)]" : "border-white/10 opacity-75"}`}
          style={{ width: 120 }}>
          {cfg.speakerBImage ? (
            <img src={cfg.speakerBImage} alt={project.speakerBName} className="w-full object-cover" style={{ height: 150 }} />
          ) : (
            <div className="w-full flex items-center justify-center bg-gradient-to-br from-rose-600 to-rose-900" style={{ height: 150 }}>
              <span className="text-white font-black text-5xl">{project.speakerBName?.[0]?.toUpperCase()}</span>
            </div>
          )}
          <div className="bg-rose-700/90 backdrop-blur px-3 py-2">
            <p className="text-white font-bold text-xs truncate">{project.speakerBName}</p>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-rose-200 text-[9px]">{cfg.roleB}</span>
              {cfg.showScores && <span className="text-white font-black text-sm tabular-nums">{totB.toFixed(1)}</span>}
            </div>
          </div>
          {!isA && isSpeaking && !isNarrator && cfg.showWaveform && (
            <div className="bg-rose-900/90 py-1.5 flex justify-center">
              <WaveformBars color="bg-rose-300" />
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* Transcript — center bottom */}
      {cfg.showTranscript && current.text && (
        <motion.div drag dragMomentum={false} className="absolute z-20 cursor-move"
          style={{ bottom: `${cfg.subBottom}%`, left: `${(100 - cfg.subWidth) / 2}%`, right: `${(100 - cfg.subWidth) / 2}%` }}>
          <AnimatePresence mode="wait">
            <motion.div key={current.text} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className={`${BOX_PAD[cfg.textSize]} rounded-2xl shadow-2xl backdrop-blur-xl border ${isNarrator ? "border-amber-500/30" : isA ? "border-blue-500/30" : "border-rose-500/30"}`}
              style={{ backgroundColor: isNarrator ? `rgba(69,26,3,${cfg.subBgOpacity / 100})` : isA ? `rgba(3,15,69,${cfg.subBgOpacity / 100})` : `rgba(69,3,15,${cfg.subBgOpacity / 100})` }}>
              <div className="flex items-center gap-1.5 mb-1">
                <div className={`w-2 h-2 rounded-full ${isNarrator ? "bg-amber-400" : isA ? "bg-blue-400" : "bg-rose-400"}`} />
                <span className={`text-[10px] font-bold tracking-wider ${isNarrator ? "text-amber-400" : isA ? "text-blue-400" : "text-rose-400"}`}>
                  {isNarrator ? project.speakerNarratorName : isA ? project.speakerAName : project.speakerBName}
                </span>
              </div>
              <SubtitleText text={current.text} wordIdx={wordIdx} isSpeaking={isSpeaking} textClass={`text-white ${TEXT_SIZES[cfg.textSize]}`} italicize={isNarrator} />
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </>
  );
}

// ─── STYLE 6: Podcast — centered avatar with animated equalizer ───────────────
function Style6({ project, current, isA, isNarrator, cfg, countdown, isSpeaking, totA, totB, wordIdx }: CP) {
  const activeName = isNarrator ? (project.speakerNarratorName || "Narrator") : isA ? project.speakerAName : project.speakerBName;
  const accentGrad = isNarrator ? "from-amber-500 to-orange-600" : isA ? "from-blue-500 to-indigo-700" : "from-rose-500 to-pink-700";
  const accentRing = isNarrator ? "ring-amber-400" : isA ? "ring-blue-400" : "ring-rose-400";
  const activeImg = isNarrator ? "" : isA ? cfg.speakerAImage : cfg.speakerBImage;

  return (
    <>
      {/* Radial dark vignette */}
      <div className="absolute inset-0 z-10 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, transparent 25%, rgba(0,0,0,0.65) 100%)" }} />

      {/* Top: Topic + Timer */}
      <motion.div drag dragMomentum={false} className="absolute top-4 left-1/2 -translate-x-1/2 z-20 cursor-move flex items-center gap-2">
        {cfg.showTopic && (
          <div className="bg-black/70 backdrop-blur border border-white/10 rounded-2xl px-5 py-2">
            <span className="text-white font-bold text-xs tracking-wide">{project.topic}</span>
          </div>
        )}
        {cfg.showTimer && (
          <div className="bg-black/70 backdrop-blur border border-white/10 rounded-xl px-3 py-2">
            <span className="text-yellow-400 font-mono font-bold text-sm tabular-nums">{fmt(countdown)}</span>
          </div>
        )}
      </motion.div>

      {/* Center: Avatar + name + equalizer */}
      <motion.div drag dragMomentum={false} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 cursor-move flex flex-col items-center">
        <motion.div
          animate={isSpeaking ? { scale: [1, 1.05, 1] } : { scale: 1 }}
          transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
          className={`w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-gradient-to-br ${accentGrad} flex items-center justify-center shadow-2xl ring-4 ring-offset-2 ring-offset-transparent ${isSpeaking ? accentRing : "ring-white/10"} overflow-hidden border-2 border-white/20`}>
          {activeImg ? (
            <img src={activeImg} alt={activeName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-white font-black text-5xl">{activeName[0]?.toUpperCase()}</span>
          )}
        </motion.div>
        <motion.div className="mt-3 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <p className="text-white font-black text-base drop-shadow-lg">{activeName}</p>
          <p className={`text-[10px] font-bold tracking-wider mt-0.5 ${isNarrator ? "text-amber-300" : isA ? "text-blue-300" : "text-rose-300"}`}>
            {isNarrator ? "NARRATOR" : isA ? cfg.roleA : cfg.roleB}
          </p>
        </motion.div>
        {cfg.showWaveform && isSpeaking && (
          <div className="mt-3">
            <WaveformBars color={isNarrator ? "bg-amber-400" : isA ? "bg-blue-400" : "bg-rose-400"} />
          </div>
        )}
      </motion.div>

      {/* Score pills — left side */}
      {cfg.showScores && (
        <motion.div drag dragMomentum={false} className="absolute left-4 top-1/2 -translate-y-1/2 z-20 cursor-move space-y-2">
          <div className={`bg-blue-600/80 backdrop-blur rounded-xl px-3 py-1.5 flex items-center gap-2 transition-all ${isA && isSpeaking && !isNarrator ? "ring-2 ring-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.4)]" : ""}`}>
            <span className="text-blue-200 text-[9px] font-bold truncate max-w-[60px]">{project.speakerAName}</span>
            <span className="text-white font-black text-sm tabular-nums ml-auto">{totA.toFixed(1)}</span>
          </div>
          <div className={`bg-rose-600/80 backdrop-blur rounded-xl px-3 py-1.5 flex items-center gap-2 transition-all ${!isA && !isNarrator && isSpeaking ? "ring-2 ring-rose-400 shadow-[0_0_20px_rgba(239,68,68,0.4)]" : ""}`}>
            <span className="text-rose-200 text-[9px] font-bold truncate max-w-[60px]">{project.speakerBName}</span>
            <span className="text-white font-black text-sm tabular-nums ml-auto">{totB.toFixed(1)}</span>
          </div>
        </motion.div>
      )}

      {/* Transcript bottom */}
      {cfg.showTranscript && current.text && (
        <motion.div drag dragMomentum={false} className="absolute z-20 cursor-move"
          style={{ bottom: `${cfg.subBottom}%`, left: `${(100 - cfg.subWidth) / 2}%`, right: `${(100 - cfg.subWidth) / 2}%` }}>
          <AnimatePresence mode="wait">
            <motion.div key={current.text} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
              className={`${BOX_PAD[cfg.textSize]} rounded-2xl shadow-2xl backdrop-blur-xl border ${isNarrator ? "border-amber-500/30" : isA ? "border-blue-500/30" : "border-rose-500/30"}`}
              style={{ backgroundColor: `rgba(0,0,0,${cfg.subBgOpacity / 100})` }}>
              <SubtitleText text={current.text} wordIdx={wordIdx} isSpeaking={isSpeaking} textClass={`text-white text-center ${TEXT_SIZES[cfg.textSize]}`} italicize={isNarrator} />
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </>
  );
}
