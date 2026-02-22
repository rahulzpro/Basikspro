import { useEffect, useState, useRef, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, Settings, FileText, Mic, LayoutTemplate, ArrowLeft, ArrowRight,
  Loader2, Download, Edit2, Wand2, Play, Pause, Volume2, Captions,
  Image as ImageIcon, RotateCcw, Video, Square
} from "lucide-react";
import {
  useProject, useUpdateProject, useUpdateDialogue,
  useGenerateScript, useRewriteDialogue, useGenerateAudio
} from "@/hooks/use-projects";

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
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/")} className="p-2 hover:bg-white/5 rounded-full text-muted-foreground hover:text-white"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="font-display font-bold text-base text-white hidden sm:block truncate max-w-[200px]">{project.topic !== "Untitled Debate" ? project.topic : "New Debate"}</h1>
        </div>
        <nav>
          <ol className="flex items-center gap-1 sm:gap-4">
            {steps.map((step, idx) => {
              const isActive = currentStep === step.num, isPast = currentStep > step.num;
              const Icon = step.icon;
              return (
                <li key={step.num} className="flex items-center">
                  <button onClick={() => setCurrentStep(step.num)} className={`flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all ${isActive ? "border-primary bg-primary/20 text-primary" : isPast ? "border-primary bg-primary text-white" : "border-white/10 text-gray-500"}`}>
                    {isPast ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </button>
                  <span className={`hidden lg:block ml-2 text-xs font-medium ${isActive ? "text-white" : isPast ? "text-gray-300" : "text-gray-600"}`}>{step.title}</span>
                  {idx < steps.length - 1 && <div className={`w-5 sm:w-10 h-0.5 mx-1 sm:mx-3 rounded-full ${isPast ? "bg-primary" : "bg-white/10"}`} />}
                </li>
              );
            })}
          </ol>
        </nav>
        <div className="w-9" />
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
  const [topic, setTopic] = useState(project.topic === "Untitled Debate" ? "" : project.topic);
  const [duration, setDuration] = useState(project.duration || "medium");
  const [model, setModel] = useState(project.model || "gemini-3-flash-preview");

  return (
    <div className="max-w-xl mx-auto glass-panel p-6 sm:p-10 rounded-3xl">
      <h2 className="text-2xl font-display font-bold text-white mb-1">Configure Debate</h2>
      <p className="text-muted-foreground mb-8 text-sm">Set the topic, duration and AI model.</p>
      <div className="space-y-7">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Debate Topic</label>
          <input type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. AI vs Human Creativity" className="w-full px-4 py-3 rounded-xl glass-input text-base focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Duration</label>
          <div className="grid grid-cols-3 gap-3">
            {[["short","~3 min"],["medium","~7 min"],["long","~12 min"]].map(([d, info]) => (
              <button key={d} onClick={() => setDuration(d)} className={`py-3 rounded-xl font-medium border text-sm flex flex-col items-center gap-0.5 ${duration === d ? "bg-primary/20 border-primary text-primary" : "bg-black/20 border-white/10 text-gray-400 hover:border-white/30"}`}>
                <span className="capitalize">{d}</span><span className="text-[11px] opacity-60">{info}</span>
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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [rewritingId, setRewritingId] = useState<number | null>(null);
  const [rwInstr, setRwInstr] = useState("");

  const saveNames = () => { if (speakerA !== project.speakerAName || speakerB !== project.speakerBName) updateProject.mutate({ id: project.id, speakerAName: speakerA, speakerBName: speakerB }); };

  if (!project.dialogues?.length) return (
    <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto py-16">
      <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mb-6"><FileText className="w-10 h-10 text-primary" /></div>
      <h2 className="text-2xl font-bold text-white mb-3">Generate Script</h2>
      <p className="text-muted-foreground mb-7 text-sm">AI will draft the debate for: <strong className="text-white block mt-1">"{project.topic}"</strong></p>
      <button onClick={() => generateScript.mutateAsync(project.id)} disabled={generateScript.isPending} className="px-7 py-3.5 bg-gradient-to-r from-primary to-indigo-600 text-white font-bold rounded-xl flex items-center gap-2">
        {generateScript.isPending ? <><Loader2 className="w-5 h-5 animate-spin" /> Generating...</> : <>Generate Script with AI</>}
      </button>
    </div>
  );

  const dialogues: any[] = project.dialogues;
  const aD = dialogues.filter(d => d.speaker === "A");
  const bD = dialogues.filter(d => d.speaker === "B");
  const rows = Math.max(aD.length, bD.length);

  const Cell = ({ d, side }: { d: any; side: "A" | "B" }) => {
    if (!d) return <div className="p-4 text-gray-600 text-xs italic">—</div>;
    const col = side === "A" ? "indigo" : "cyan";
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
        <input value={rwInstr} onChange={e => setRwInstr(e.target.value)} placeholder="Make it more aggressive..." className="w-full glass-input p-2 rounded text-white text-xs" autoFocus />
        <div className="flex justify-end gap-2">
          <button onClick={() => setRewritingId(null)} className="px-2 py-1 text-xs text-gray-400">Cancel</button>
          <button onClick={async () => { await rewriteDialogue.mutateAsync({ dialogueId: d.id, projectId: project.id, instructions: rwInstr }); setRewritingId(null); setRwInstr(""); }} disabled={!rwInstr || rewriteDialogue.isPending} className={`px-2 py-1 text-xs text-white rounded bg-gradient-to-r ${col === "indigo" ? "from-indigo-500 to-indigo-700" : "from-cyan-500 to-cyan-700"} flex items-center gap-1`}>
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
          <button onClick={() => setRewritingId(d.id)} className={`p-1 hover:bg-white/10 rounded ${col === "indigo" ? "text-indigo-400" : "text-cyan-400"}`}><Wand2 className="w-3 h-3" /></button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col" style={{ height: "calc(100vh - 130px)" }}>
      <div className="flex justify-between items-center mb-4 shrink-0">
        <div><h2 className="text-xl font-display font-bold text-white">Script Editor</h2><p className="text-muted-foreground text-xs">Hover a cell to edit or AI-rewrite.</p></div>
        <div className="flex gap-2">
          <button onClick={() => generateScript.mutateAsync(project.id)} disabled={generateScript.isPending} className="px-3 py-2 text-xs border border-white/20 text-gray-300 rounded-xl hover:bg-white/5 flex items-center gap-1.5">
            {generateScript.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Regenerate
          </button>
          <button onClick={onNext} className="px-5 py-2 bg-white text-black font-bold rounded-xl text-sm hover:bg-gray-200 flex items-center gap-1.5">Next <ArrowRight className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto rounded-2xl border border-white/10 overflow-hidden">
        <div className="grid grid-cols-2 sticky top-0 z-10">
          <div className="bg-indigo-900/70 backdrop-blur border-b border-r border-white/10 p-3 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0">A</div>
            <input value={speakerA} onChange={e => setSpeakerA(e.target.value)} onBlur={saveNames} className="bg-transparent border-none text-white font-bold focus:outline-none w-full text-sm" />
          </div>
          <div className="bg-cyan-900/70 backdrop-blur border-b border-white/10 p-3 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-cyan-500/30 text-cyan-300 flex items-center justify-center font-bold text-xs shrink-0">B</div>
            <input value={speakerB} onChange={e => setSpeakerB(e.target.value)} onBlur={saveNames} className="bg-transparent border-none text-white font-bold focus:outline-none w-full text-sm" />
          </div>
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="grid grid-cols-2 border-b border-white/5">
            <div className={`border-r border-white/5 min-h-[70px] ${aD[i] ? "bg-indigo-500/[0.04]" : ""}`}><Cell d={aD[i] || null} side="A" /></div>
            <div className={`min-h-[70px] ${bD[i] ? "bg-cyan-500/[0.04]" : ""}`}><Cell d={bD[i] || null} side="B" /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── STEP 3: AUDIO ─────────────────────────────────────────────────────────────
function Step3Audio({ project, onNext }: { project: any; onNext: () => void }) {
  const upd = useUpdateProject();
  const genAudio = useGenerateAudio();
  const [voiceA, setVoiceA] = useState(project.speakerAVoice);
  const [voiceB, setVoiceB] = useState(project.speakerBVoice);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [captionsDone, setCaptionsDone] = useState(false);

  const voices = ["alloy","echo","fable","onyx","nova","shimmer"].map(v => ({ id: v, name: v[0].toUpperCase() + v.slice(1) }));
  const saveVoices = (a: string, b: string) => upd.mutate({ id: project.id, speakerAVoice: a, speakerBVoice: b });
  const allDone = project.dialogues?.every((d: any) => d.audioUrl);

  const genAll = async () => {
    setBusy(true); setProgress(0);
    const total = project.dialogues.length;
    for (let i = 0; i < total; i++) {
      try { await genAudio.mutateAsync({ dialogueId: project.dialogues[i].id, projectId: project.id }); } catch {}
      setProgress(Math.round(((i + 1) / total) * 100));
    }
    setBusy(false);
  };

  const genSRT = () => {
    let srt = "", t = 0;
    (project.dialogues || []).forEach((d: any, i: number) => {
      const dur = Math.max(2, d.text.split(" ").length / 2.5);
      const fmtT = (s: number) => { const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=Math.floor(s%60),ms=Math.floor((s%1)*1000); return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")},${String(ms).padStart(3,"0")}`; };
      srt += `${i+1}\n${fmtT(t)} --> ${fmtT(t+dur)}\n[${d.speaker==="A"?project.speakerAName:project.speakerBName}] ${d.text}\n\n`;
      t += dur + 0.5;
    });
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([srt],{type:"text/plain"}));
    a.download = `${project.topic.replace(/\s+/g,"_")}.srt`; a.click(); setCaptionsDone(true);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex justify-between items-center">
        <div><h2 className="text-2xl font-display font-bold text-white">Voice Synthesis</h2><p className="text-muted-foreground text-sm">Select voices and generate audio.</p></div>
        <button onClick={onNext} disabled={!allDone} className="px-5 py-2 bg-white text-black font-bold rounded-xl text-sm hover:bg-gray-200 disabled:opacity-50 flex items-center gap-1.5">Next <ArrowRight className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[{speaker:"A",name:project.speakerAName,voice:voiceA,color:"indigo",set:(v:string)=>{setVoiceA(v);saveVoices(v,voiceB);}},{speaker:"B",name:project.speakerBName,voice:voiceB,color:"cyan",set:(v:string)=>{setVoiceB(v);saveVoices(voiceA,v);}}].map(sp => (
          <div key={sp.speaker} className={`glass-panel p-4 rounded-2xl border-t-4 ${sp.color==="indigo"?"border-t-indigo-500":"border-t-cyan-500"}`}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-6 h-6 rounded-full ${sp.color==="indigo"?"bg-indigo-500/20 text-indigo-400":"bg-cyan-500/20 text-cyan-400"} flex items-center justify-center font-bold text-xs`}>{sp.speaker}</div>
              <span className="font-bold text-white text-sm">{sp.name}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">{voices.map(v => (<button key={v.id} onClick={()=>sp.set(v.id)} className={`py-2 rounded-lg border text-xs font-medium ${sp.voice===v.id?(sp.color==="indigo"?"bg-indigo-500/20 border-indigo-500 text-indigo-300":"bg-cyan-500/20 border-cyan-500 text-cyan-300"):"bg-black/20 border-white/10 text-gray-400"}`}>{v.name}</button>))}</div>
          </div>
        ))}
      </div>
      <div className="glass-panel p-5 rounded-2xl flex flex-col items-center">
        {busy ? (
          <div className="w-full max-w-sm text-center">
            <p className="text-white font-bold mb-2 text-sm">Generating Audio...</p>
            <div className="h-2.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/10"><div className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all" style={{width:`${progress}%`}} /></div>
            <p className="text-gray-400 text-xs mt-1">{progress}%</p>
          </div>
        ) : (
          <div className="flex gap-3 flex-wrap justify-center">
            <button onClick={genAll} className="px-6 py-2.5 bg-gradient-to-r from-primary to-indigo-600 text-white font-bold rounded-xl text-sm flex items-center gap-2 hover:-translate-y-0.5 transition-all">
              <Volume2 className="w-4 h-4" /> {allDone ? "Regenerate Audio" : "Generate All Audio"}
            </button>
            {allDone && <button onClick={genSRT} className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-xl text-sm flex items-center gap-2">
              <Captions className="w-4 h-4" /> {captionsDone ? "Download Again" : "Captions (SRT)"}
            </button>}
          </div>
        )}
      </div>
      <div className="space-y-1.5 max-h-60 overflow-y-auto">
        {(project.dialogues||[]).map((d: any) => (
          <div key={d.id} className={`flex items-center gap-2 p-2.5 rounded-xl border glass-panel text-xs ${d.speaker==="A"?"border-indigo-500/20 bg-indigo-500/5":"border-cyan-500/20 bg-cyan-500/5"}`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold shrink-0 ${d.speaker==="A"?"bg-indigo-500/20 text-indigo-400":"bg-cyan-500/20 text-cyan-400"}`}>{d.speaker}</div>
            <p className="text-gray-300 flex-1 truncate">{d.text}</p>
            {d.audioUrl ? <span className="text-green-400 flex items-center gap-1 shrink-0"><Check className="w-3 h-3" /> Done</span> : <span className="text-gray-600 shrink-0">Pending</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── STEP 4: VIDEO PREVIEW ─────────────────────────────────────────────────────
type Phase = "idle" | "speaking" | "scoring";
type TextSize = "small" | "medium" | "large";
interface OverlayCfg { roleA: string; roleB: string; textSize: TextSize; showScores: boolean; showTimer: boolean; showTopic: boolean; showWaveform: boolean; showTranscript: boolean; }

function Step4Preview({ project }: { project: any }) {
  const dialogues: any[] = project.dialogues || [];
  const upd = useUpdateProject();
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRecRef = useRef<MediaRecorder | null>(null);

  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [countdown, setCountdown] = useState(0);
  const [style, setStyle] = useState<1|2|3|4>(1);
  const [bg, setBg] = useState(project.backgroundImage || DEMO_BG);
  const [showSettings, setShowSettings] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [cfg, setCfg] = useState<OverlayCfg>({ roleA: "SUPPORTER", roleB: "OPPONENT", textSize: "medium", showScores: true, showTimer: true, showTopic: true, showWaveform: true, showTranscript: true });

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

  // ── Phase-based engine ──
  useEffect(() => {
    if (phase === "idle") return;
    if (phase === "speaking") {
      if (countdown <= 0) { playScoreReveal(); setPhase("scoring"); return; }
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

  const handlePlay = () => {
    if (phase !== "idle") { setPhase("idle"); return; }
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

  const set = <K extends keyof OverlayCfg>(k: K, v: OverlayCfg[K]) => setCfg(c=>({...c,[k]:v}));
  const styleNames = ["","Panel","Bar","News","Arena"];

  const canvasProps = { project, current, isA, cfg, countdown, isSpeaking: phase==="speaking", totA, totB };

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-3" style={{ height: "calc(100vh - 110px)" }}>
      {/* Controls */}
      <div className="flex items-center justify-between gap-2 flex-wrap shrink-0">
        <div>
          <h2 className="text-xl font-display font-bold text-white">Video Canvas</h2>
          <p className="text-muted-foreground text-xs hidden sm:block">Upload BG · Pick style · Adjust overlay</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Style tabs */}
          <div className="flex bg-black/40 rounded-xl border border-white/10 p-0.5 gap-0.5">
            {([1,2,3,4] as const).map(s => (
              <button key={s} onClick={()=>setStyle(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${style===s?"bg-primary text-white":"text-gray-400 hover:text-white"}`}>{styleNames[s]}</button>
            ))}
          </div>
          <button onClick={()=>setShowSettings(!showSettings)} className="px-3 py-2 rounded-xl border border-white/20 text-gray-300 hover:bg-white/5 text-xs flex items-center gap-1.5"><Settings className="w-3.5 h-3.5" /> Overlay</button>
          <button onClick={()=>fileRef.current?.click()} className="px-3 py-2 rounded-xl border border-white/20 text-gray-300 hover:bg-white/5 text-xs flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5" /> BG</button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleBg} />
          <button onClick={handleRecord} className={`px-3 py-2 rounded-xl border text-xs flex items-center gap-1.5 font-bold ${isRecording?"border-red-500 bg-red-500/20 text-red-400":"border-white/20 text-gray-300 hover:bg-white/5"}`}>
            {isRecording ? <><Square className="w-3.5 h-3.5" /> Stop & Save</> : <><Video className="w-3.5 h-3.5" /> Record</>}
          </button>
          <button onClick={()=>{ const a=document.createElement("a"); a.href=bg; a.download="background.jpg"; a.click(); }} className="px-3 py-2 rounded-xl bg-primary text-white font-bold text-xs flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export
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
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Visibility</p>
                {([["showScores","Scores"],["showTopic","Topic"],["showTimer","Timer"],["showWaveform","Waveform"],["showTranscript","Transcript"]] as [keyof OverlayCfg, string][]).map(([k,label])=>(
                  <label key={k} className="flex items-center justify-between cursor-pointer py-0.5">
                    <span className="text-xs text-gray-300">{label}</span>
                    <button onClick={()=>set(k,!cfg[k])} className={`w-9 h-[18px] rounded-full relative transition-all ${cfg[k]?"bg-primary":"bg-white/20"}`}>
                      <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[2px] transition-all ${cfg[k]?"left-[18px]":"left-[2px]"}`} />
                    </button>
                  </label>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Canvas */}
        <div className="flex-1 relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black min-h-0">
          {/* Background - clearly visible */}
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${bg})` }} />
          {/* Light vignette only */}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, transparent 30%, transparent 60%, rgba(0,0,0,0.4) 100%)" }} />

          {/* Render chosen style */}
          {style===1 && <Style1 {...canvasProps} />}
          {style===2 && <Style2 {...canvasProps} />}
          {style===3 && <Style3 {...canvasProps} />}
          {style===4 && <Style4 {...canvasProps} />}

          {/* Score Card Overlay */}
          <AnimatePresence>
            {phase === "scoring" && scoreData[idx] && (
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
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/15">
            <button onClick={handlePrev} className="p-1.5 text-white hover:bg-white/20 rounded-full"><ArrowLeft className="w-4 h-4" /></button>
            <button onClick={handlePlay} className="px-4 py-1 bg-white text-black font-bold rounded-full text-xs hover:bg-gray-200 flex items-center gap-1.5">
              {phase!=="idle" ? <><Pause className="w-3.5 h-3.5"/>Pause</> : <><Play className="w-3.5 h-3.5"/>Play</>}
            </button>
            <button onClick={handleNext} className="p-1.5 text-white hover:bg-white/20 rounded-full"><ArrowRight className="w-4 h-4" /></button>
            <span className="text-gray-400 text-[10px] tabular-nums ml-0.5">{idx+1}/{dialogues.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CANVAS PROPS TYPE ─────────────────────────────────────────────────────────
interface CP { project: any; current: any; isA: boolean; cfg: OverlayCfg; countdown: number; isSpeaking: boolean; totA: number; totB: number; }

// ─── STYLE 1: Reference image layout ──────────────────────────────────────────
// Top-left blue score | center topic | top-right timer+purple score
// Below title: SUPPORTER / OPPONENT text | Center speech bubble
function Style1({ project, current, isA, cfg, countdown, isSpeaking, totA, totB }: CP) {
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
        <motion.div drag dragMomentum={false} className="absolute z-20 cursor-move" style={{ bottom: 55, left: "50%", transform: "translateX(-50%)", width: "min(85%, 560px)" }}>
          <AnimatePresence mode="wait">
            <motion.div key={current.text} initial={{opacity:0,y:12,scale:0.97}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-8,scale:0.97}}
              className="relative bg-gray-900/88 backdrop-blur-md rounded-2xl shadow-2xl border border-white/10"
              style={{ padding: cfg.textSize==="small"?"10px 16px":cfg.textSize==="large"?"18px 28px":"14px 22px" }}>
              {/* Bubble tail */}
              <div className={`absolute -bottom-2.5 ${isA ? "left-10" : "right-10"} w-5 h-5 rotate-45 bg-gray-900/88 border-b border-r border-white/10`} />
              <p className={`text-white font-bold text-center leading-snug ${TEXT_SIZES[cfg.textSize]}`}>{snippet}</p>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </>
  );
}

// ─── STYLE 2: Bottom bar ───────────────────────────────────────────────────────
function Style2({ project, current, isA, cfg, countdown, isSpeaking, totA, totB }: CP) {
  const snippet = current.text.length > 100 ? current.text.slice(0, 98) + "…" : current.text;
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
        <motion.div drag dragMomentum={false} className="absolute bottom-[72px] left-8 right-8 z-20 cursor-move">
          <AnimatePresence mode="wait">
            <motion.div key={current.text} initial={{opacity:0,scale:0.97}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.97}}
              className={`bg-black/75 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl ${BOX_PAD[cfg.textSize]}`}>
              <div className="flex items-center gap-1.5 mb-1"><div className={`w-2 h-2 rounded-full ${isA?"bg-blue-400":"bg-rose-400"}`}/><span className={`text-[10px] font-bold tracking-wider ${isA?"text-blue-400":"text-rose-400"}`}>{isA?project.speakerAName:project.speakerBName}</span></div>
              <p className={`text-white font-bold leading-snug ${TEXT_SIZES[cfg.textSize]}`}>{snippet}</p>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </>
  );
}

// ─── STYLE 3: News Broadcast ───────────────────────────────────────────────────
function Style3({ project, current, isA, cfg, countdown, isSpeaking, totA, totB }: CP) {
  const snippet = current.text.length > 90 ? current.text.slice(0,88)+"…" : current.text;
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
            <div className={`${isA?"bg-blue-600":"bg-rose-600"} px-4 py-2`}>
              <p className="text-white font-black text-sm">{isA?project.speakerAName:project.speakerBName}</p>
              <p className="text-white/70 text-[10px] font-bold tracking-wider">{isA?cfg.roleA:cfg.roleB}</p>
            </div>
            {cfg.showTranscript&&current.text&&<div className="flex-1 bg-gray-900/95 backdrop-blur px-4 py-2 flex items-center"><p className={`text-white font-semibold leading-snug ${TEXT_SIZES[cfg.textSize]}`}>{snippet}</p></div>}
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
function Style4({ project, current, isA, cfg, countdown, isSpeaking, totA, totB }: CP) {
  const snippet = current.text.length > 100 ? current.text.slice(0,98)+"…" : current.text;
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
        <motion.div drag dragMomentum={false} className="absolute bottom-12 left-4 right-4 z-20 cursor-move">
          <AnimatePresence mode="wait">
            <motion.div key={current.text} initial={{opacity:0,y:15}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-15}}
              className={`${BOX_PAD[cfg.textSize]} rounded-xl border shadow-2xl backdrop-blur-lg ${isA?"bg-blue-950/80 border-blue-500/30":"bg-rose-950/80 border-rose-500/30"}`}>
              <div className="flex items-center gap-1.5 mb-1"><div className={`w-1.5 h-1.5 rounded-full ${isA?"bg-blue-400":"bg-rose-400"}`}/><span className={`text-[9px] font-bold tracking-wider uppercase ${isA?"text-blue-400":"text-rose-400"}`}>{isA?project.speakerAName:project.speakerBName}</span></div>
              <p className={`text-white font-bold leading-snug ${TEXT_SIZES[cfg.textSize]}`}>{snippet}</p>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </>
  );
}
