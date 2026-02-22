import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, Settings, FileText, Mic, LayoutTemplate, ArrowLeft, ArrowRight,
  Loader2, Download, Upload, Edit2, Wand2, Play, Pause,
  Volume2, Captions, Image as ImageIcon, RotateCcw, Type
} from "lucide-react";
import {
  useProject, useUpdateProject, useUpdateDialogue,
  useGenerateScript, useRewriteDialogue, useGenerateAudio
} from "@/hooks/use-projects";

// ==========================================
// CONSTANTS & HELPERS
// ==========================================
const DEMO_BG = "https://images.unsplash.com/photo-1577563908411-5077b6dc7624?q=80&w=2070&auto=format&fit=crop";

const AI_MODELS = [
  { name: "ChatGPT", color: "#10a37f", logo: "GPT" },
  { name: "Gemini", color: "#4285f4", logo: "G" },
  { name: "Grok", color: "#1d1d1f", logo: "X" },
  { name: "DeepSeek", color: "#0066ff", logo: "DS" },
  { name: "Claude", color: "#d97706", logo: "C" },
];

const TEXT_SIZES = {
  small: "text-xs sm:text-sm",
  medium: "text-sm sm:text-lg",
  large: "text-lg sm:text-2xl",
};

const BOX_PAD = {
  small: "px-4 py-2",
  medium: "px-6 py-4",
  large: "px-8 py-5",
};

function hashText(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) - h) + text.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function generateScoresForDialogue(text: string) {
  const h = hashText(text);
  return AI_MODELS.map((m, i) => ({
    ...m,
    score: +(6.0 + ((h * (i + 7)) % 35) / 10).toFixed(1),
  }));
}

function getDialogueDuration(text: string): number {
  const words = text.split(/\s+/).length;
  return Math.max(5, Math.min(45, Math.round(words / 2.5)));
}

function fmtTimer(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// ==========================================
// MAIN WIZARD
// ==========================================
export default function Wizard() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id || "0");
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialStep = parseInt(searchParams.get("step") || "1");
  const [currentStep, setCurrentStep] = useState(initialStep);
  const { data: project, isLoading } = useProject(projectId);

  useEffect(() => {
    const newUrl = `/projects/${projectId}?step=${currentStep}`;
    if (location !== newUrl) window.history.replaceState(null, "", newUrl);
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
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => setLocation("/")} className="p-2 hover:bg-white/5 rounded-full transition-colors text-muted-foreground hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-display font-bold text-xl text-white hidden sm:block">
            {project.topic !== "Untitled Debate" ? project.topic : "New Debate"}
          </h1>
        </div>
        <nav className="flex items-center">
          <ol className="flex items-center gap-2 sm:gap-6">
            {steps.map((step, idx) => {
              const isActive = currentStep === step.num;
              const isPast = currentStep > step.num;
              const Icon = step.icon;
              return (
                <li key={step.num} className="flex items-center">
                  <button onClick={() => setCurrentStep(step.num)} className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 ${isActive ? "border-primary bg-primary/20 text-primary shadow-[0_0_15px_rgba(124,58,237,0.4)]" : isPast ? "border-primary bg-primary text-white" : "border-white/10 bg-transparent text-gray-500 hover:border-white/30"}`}>
                    {isPast ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </button>
                  <span className={`hidden md:block ml-3 text-sm font-medium ${isActive ? "text-white" : isPast ? "text-gray-300" : "text-gray-600"}`}>{step.title}</span>
                  {idx < steps.length - 1 && <div className={`w-8 sm:w-16 h-0.5 mx-2 sm:mx-4 rounded-full ${isPast ? "bg-primary" : "bg-white/10"}`} />}
                </li>
              );
            })}
          </ol>
        </nav>
        <div className="w-10" />
      </header>

      <main className="flex-1 p-6 lg:p-12 overflow-x-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div key={currentStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="h-full">
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

// ==========================================
// STEP 1: SETUP
// ==========================================
function Step1Setup({ project, onNext }: { project: any; onNext: () => void }) {
  const updateProject = useUpdateProject();
  const [topic, setTopic] = useState(project.topic === "Untitled Debate" ? "" : project.topic);
  const [duration, setDuration] = useState(project.duration || "medium");
  const [model, setModel] = useState(project.model || "gemini-3-flash-preview");

  const handleSave = async () => {
    if (!topic.trim()) return;
    await updateProject.mutateAsync({ id: project.id, topic, duration, model });
    onNext();
  };

  const durationInfo: Record<string, string> = { short: "~3 min", medium: "~7 min", long: "~12 min" };

  return (
    <div className="max-w-2xl mx-auto glass-panel p-8 sm:p-12 rounded-3xl">
      <h2 className="text-3xl font-display font-bold text-white mb-2">Configure Your Debate</h2>
      <p className="text-muted-foreground mb-10">Define the core parameters for the AI to generate the script.</p>
      <div className="space-y-8">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Debate Topic</label>
          <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Artificial Intelligence vs Human Creativity" className="w-full px-5 py-4 rounded-xl glass-input text-lg focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">Script Duration</label>
          <div className="grid grid-cols-3 gap-4">
            {["short", "medium", "long"].map((d) => (
              <button key={d} onClick={() => setDuration(d)} className={`py-4 px-4 rounded-xl font-medium capitalize border transition-all flex flex-col items-center gap-1 ${duration === d ? "bg-primary/20 border-primary text-primary" : "bg-black/20 border-white/10 text-gray-400 hover:border-white/30"}`}>
                <span className="text-base">{d}</span>
                <span className="text-xs opacity-70">{durationInfo[d]}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">AI Model</label>
          <div className="space-y-3">
            {[
              { id: "gemini-3-flash-preview", name: "Gemini 3 Flash", badge: "Fast", desc: "Faster generation, great for standard debates." },
              { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro", badge: "Smart", desc: "Deeper reasoning, more nuanced arguments." },
            ].map((m) => (
              <div key={m.id} onClick={() => setModel(m.id)} className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center ${model === m.id ? "bg-primary/10 border-primary shadow-[0_0_10px_rgba(124,58,237,0.2)]" : "bg-black/20 border-white/10 hover:border-white/30"}`}>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center mr-4 shrink-0 ${model === m.id ? "border-primary" : "border-gray-500"}`}>
                  {model === m.id && <div className="w-2.5 h-2.5 bg-primary rounded-full" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className={`font-semibold ${model === m.id ? "text-white" : "text-gray-300"}`}>{m.name}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${model === m.id ? "bg-primary/20 text-primary" : "bg-white/10 text-gray-400"}`}>{m.badge}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="pt-6 flex justify-end">
          <button onClick={handleSave} disabled={!topic.trim() || updateProject.isPending} className="flex items-center px-8 py-3.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {updateProject.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
            Continue to Script <ArrowRight className="w-5 h-5 ml-2" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// STEP 2: SCRIPT EDITOR — TABLE LAYOUT
// ==========================================
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
  const [rewriteInstruction, setRewriteInstruction] = useState("");

  const saveSpeakerNames = () => {
    if (speakerA !== project.speakerAName || speakerB !== project.speakerBName)
      updateProject.mutate({ id: project.id, speakerAName: speakerA, speakerBName: speakerB });
  };
  const handleSaveEdit = async (dialogueId: number) => {
    await updateDialogue.mutateAsync({ id: dialogueId, projectId: project.id, text: editText });
    setEditingId(null);
  };
  const handleRewrite = async (dialogueId: number) => {
    if (!rewriteInstruction) return;
    await rewriteDialogue.mutateAsync({ dialogueId, projectId: project.id, instructions: rewriteInstruction });
    setRewritingId(null);
    setRewriteInstruction("");
  };

  if (!project.dialogues || project.dialogues.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-20">
        <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(124,58,237,0.3)]">
          <FileText className="w-12 h-12 text-primary" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-4">Generate Script</h2>
        <p className="text-muted-foreground mb-8 text-lg">
          Let AI draft the initial debate based on your topic:<br />
          <strong className="text-white mt-2 block">"{project.topic}"</strong>
        </p>
        <button onClick={() => generateScript.mutateAsync(project.id)} disabled={generateScript.isPending} className="px-8 py-4 bg-gradient-to-r from-primary to-indigo-600 text-white font-bold rounded-xl text-lg hover:shadow-lg hover:shadow-primary/50 transition-all hover:-translate-y-1 flex items-center">
          {generateScript.isPending ? <><Loader2 className="w-6 h-6 animate-spin mr-3" /> Generating...</> : <>Generate Script with AI</>}
        </button>
      </div>
    );
  }

  const dialogues: any[] = project.dialogues;
  const aDialogues = dialogues.filter((d: any) => d.speaker === "A");
  const bDialogues = dialogues.filter((d: any) => d.speaker === "B");
  const maxRows = Math.max(aDialogues.length, bDialogues.length);

  const DialogueCell = ({ dialogue, side }: { dialogue: any | null; side: "A" | "B" }) => {
    if (!dialogue) return <div className="p-4 text-gray-600 italic text-sm">—</div>;
    const isEditing = editingId === dialogue.id;
    const isRewriting = rewritingId === dialogue.id;
    const color = side === "A" ? "indigo" : "cyan";

    if (isEditing) return (
      <div className="p-3 space-y-2">
        <textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="w-full h-28 glass-input p-3 rounded-lg resize-none text-white text-sm" autoFocus />
        <div className="flex justify-end gap-2">
          <button onClick={() => setEditingId(null)} className="px-3 py-1 text-xs text-gray-400 hover:text-white">Cancel</button>
          <button onClick={() => handleSaveEdit(dialogue.id)} disabled={updateDialogue.isPending} className="px-3 py-1 text-xs bg-primary text-white rounded-lg">{updateDialogue.isPending ? "Saving..." : "Save"}</button>
        </div>
      </div>
    );
    if (isRewriting) return (
      <div className="p-3 space-y-2">
        <div className="p-2 bg-black/30 rounded text-gray-400 text-xs line-clamp-2">"{dialogue.text}"</div>
        <input value={rewriteInstruction} onChange={(e) => setRewriteInstruction(e.target.value)} placeholder="e.g. Make it more aggressive..." className="w-full glass-input p-2 rounded-lg text-white text-sm" autoFocus />
        <div className="flex justify-end gap-2">
          <button onClick={() => setRewritingId(null)} className="px-3 py-1 text-xs text-gray-400 hover:text-white">Cancel</button>
          <button onClick={() => handleRewrite(dialogue.id)} disabled={rewriteDialogue.isPending || !rewriteInstruction} className={`px-3 py-1 text-xs bg-gradient-to-r ${color === "indigo" ? "from-indigo-500 to-indigo-700" : "from-cyan-500 to-cyan-700"} text-white rounded-lg flex items-center gap-1`}>
            {rewriteDialogue.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />} AI Rewrite
          </button>
        </div>
      </div>
    );
    return (
      <div className="p-4 group relative">
        <p className="text-gray-100 text-sm leading-relaxed">{dialogue.text}</p>
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          <button onClick={() => { setEditingId(dialogue.id); setEditText(dialogue.text); }} className="p-1.5 text-xs text-gray-400 hover:text-white hover:bg-white/10 rounded"><Edit2 className="w-3 h-3" /></button>
          <button onClick={() => setRewritingId(dialogue.id)} className={`p-1.5 text-xs hover:bg-white/10 rounded ${color === "indigo" ? "text-indigo-400" : "text-cyan-400"}`}><Wand2 className="w-3 h-3" /></button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto flex flex-col h-[calc(100vh-140px)]">
      <div className="flex justify-between items-end mb-6 shrink-0">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">Script Editor</h2>
          <p className="text-muted-foreground">Edit dialogs or ask AI to rewrite any line.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => generateScript.mutateAsync(project.id)} disabled={generateScript.isPending} className="px-4 py-2 text-sm border border-white/20 text-gray-300 rounded-xl hover:bg-white/5 flex items-center gap-2">
            {generateScript.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Regenerate
          </button>
          <button onClick={onNext} className="px-6 py-2.5 bg-white text-black font-bold rounded-xl hover:bg-gray-200 flex items-center">Next: Audio <ArrowRight className="w-4 h-4 ml-2" /></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto rounded-2xl border border-white/10 overflow-hidden">
        <div className="grid grid-cols-2 sticky top-0 z-10">
          <div className="bg-indigo-900/60 backdrop-blur-md border-b border-r border-white/10 p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-sm shrink-0">A</div>
            <input value={speakerA} onChange={(e) => setSpeakerA(e.target.value)} onBlur={saveSpeakerNames} className="bg-transparent border-none text-white font-bold focus:outline-none w-full text-lg" placeholder="Speaker A Name" />
          </div>
          <div className="bg-cyan-900/60 backdrop-blur-md border-b border-white/10 p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-cyan-500/30 text-cyan-300 flex items-center justify-center font-bold text-sm shrink-0">B</div>
            <input value={speakerB} onChange={(e) => setSpeakerB(e.target.value)} onBlur={saveSpeakerNames} className="bg-transparent border-none text-white font-bold focus:outline-none w-full text-lg" placeholder="Speaker B Name" />
          </div>
        </div>
        {Array.from({ length: maxRows }).map((_, i) => (
          <div key={i} className="grid grid-cols-2 border-b border-white/5 hover:bg-white/[0.02]">
            <div className={`border-r border-white/5 min-h-[80px] ${aDialogues[i] ? "bg-indigo-500/[0.04]" : ""}`}><DialogueCell dialogue={aDialogues[i] || null} side="A" /></div>
            <div className={`min-h-[80px] ${bDialogues[i] ? "bg-cyan-500/[0.04]" : ""}`}><DialogueCell dialogue={bDialogues[i] || null} side="B" /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// STEP 3: AUDIO GENERATION + CAPTIONS
// ==========================================
function Step3Audio({ project, onNext }: { project: any; onNext: () => void }) {
  const updateProject = useUpdateProject();
  const generateAudio = useGenerateAudio();
  const [voiceA, setVoiceA] = useState(project.speakerAVoice);
  const [voiceB, setVoiceB] = useState(project.speakerBVoice);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [progress, setProgress] = useState(0);
  const [captionsGenerated, setCaptionsGenerated] = useState(false);

  const voices = [
    { id: "alloy", name: "Alloy", desc: "Neutral" }, { id: "echo", name: "Echo", desc: "Warm" },
    { id: "fable", name: "Fable", desc: "Expressive" }, { id: "onyx", name: "Onyx", desc: "Deep" },
    { id: "nova", name: "Nova", desc: "Energetic" }, { id: "shimmer", name: "Shimmer", desc: "Clear" },
  ];

  const handleSaveVoices = (vA: string, vB: string) => updateProject.mutate({ id: project.id, speakerAVoice: vA, speakerBVoice: vB });

  const handleGenerateAll = async () => {
    setIsGeneratingAll(true); setProgress(0);
    const total = project.dialogues.length;
    for (let i = 0; i < total; i++) {
      try { await generateAudio.mutateAsync({ dialogueId: project.dialogues[i].id, projectId: project.id }); } catch (e) { console.error("Audio gen failed", e); }
      setProgress(Math.round(((i + 1) / total) * 100));
    }
    setIsGeneratingAll(false);
  };

  const handleGenerateCaptions = () => {
    const dialogues: any[] = project.dialogues;
    let srt = "", currentTime = 0;
    dialogues.forEach((d, i) => {
      const dur = Math.max(2, d.text.split(" ").length / 2.5);
      const start = currentTime, end = currentTime + dur;
      const fmt = (s: number) => {
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60), ms = Math.floor((s % 1) * 1000);
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
      };
      const name = d.speaker === "A" ? project.speakerAName : project.speakerBName;
      srt += `${i + 1}\n${fmt(start)} --> ${fmt(end)}\n[${name}] ${d.text}\n\n`;
      currentTime = end + 0.5;
    });
    const blob = new Blob([srt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${project.topic.replace(/\s+/g, "_")}_captions.srt`; a.click();
    URL.revokeObjectURL(url); setCaptionsGenerated(true);
  };

  const allAudioGenerated = project.dialogues?.every((d: any) => d.audioUrl);
  const dialogues: any[] = project.dialogues || [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div><h2 className="text-3xl font-display font-bold text-white mb-2">Voice Synthesis</h2><p className="text-muted-foreground">Select voices and generate audio.</p></div>
        <button onClick={onNext} disabled={!allAudioGenerated} className="px-6 py-2.5 bg-white text-black font-bold rounded-xl hover:bg-gray-200 flex items-center disabled:opacity-50">Next: Preview <ArrowRight className="w-4 h-4 ml-2" /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel p-5 rounded-2xl border-t-4 border-t-indigo-500">
          <div className="flex items-center gap-2 mb-4"><div className="w-7 h-7 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm">A</div><div><h3 className="font-bold text-white">{project.speakerAName}</h3></div></div>
          <div className="grid grid-cols-3 gap-2">{voices.map(v => (<button key={v.id} onClick={() => { setVoiceA(v.id); handleSaveVoices(v.id, voiceB); }} className={`p-2.5 rounded-xl border text-left transition-all ${voiceA === v.id ? "bg-indigo-500/20 border-indigo-500" : "bg-black/20 border-white/10 hover:border-white/30"}`}><div className={`font-semibold text-sm ${voiceA === v.id ? "text-indigo-300" : "text-gray-300"}`}>{v.name}</div><div className="text-xs text-gray-500">{v.desc}</div></button>))}</div>
        </div>
        <div className="glass-panel p-5 rounded-2xl border-t-4 border-t-cyan-500">
          <div className="flex items-center gap-2 mb-4"><div className="w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm">B</div><div><h3 className="font-bold text-white">{project.speakerBName}</h3></div></div>
          <div className="grid grid-cols-3 gap-2">{voices.map(v => (<button key={v.id} onClick={() => { setVoiceB(v.id); handleSaveVoices(voiceA, v.id); }} className={`p-2.5 rounded-xl border text-left transition-all ${voiceB === v.id ? "bg-cyan-500/20 border-cyan-500" : "bg-black/20 border-white/10 hover:border-white/30"}`}><div className={`font-semibold text-sm ${voiceB === v.id ? "text-cyan-300" : "text-gray-300"}`}>{v.name}</div><div className="text-xs text-gray-500">{v.desc}</div></button>))}</div>
        </div>
      </div>
      <div className="glass-panel p-6 rounded-2xl flex flex-col items-center text-center">
        {isGeneratingAll ? (
          <div className="w-full max-w-md">
            <h3 className="text-lg font-bold text-white mb-3">Synthesizing Voices...</h3>
            <div className="h-3 w-full bg-black/40 rounded-full overflow-hidden mb-2 border border-white/10"><div className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all duration-300" style={{ width: `${progress}%` }} /></div>
            <p className="text-sm text-gray-400">{progress}% Complete</p>
          </div>
        ) : (
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <button onClick={handleGenerateAll} className="px-7 py-3 bg-gradient-to-r from-primary to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-primary/40 transition-all hover:-translate-y-0.5 flex items-center gap-2">
              <Volume2 className="w-5 h-5" /> {allAudioGenerated ? "Regenerate All Audio" : "Generate All Audio"}
            </button>
            {allAudioGenerated && (
              <button onClick={handleGenerateCaptions} className="px-7 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-xl hover:shadow-lg transition-all hover:-translate-y-0.5 flex items-center gap-2">
                <Captions className="w-5 h-5" /> {captionsGenerated ? "Download Again" : "Generate Captions (SRT)"}
              </button>
            )}
          </div>
        )}
      </div>
      <div className="space-y-2 max-h-72 overflow-y-auto">
        {dialogues.map((d: any) => (
          <div key={d.id} className={`flex items-center gap-3 p-3 rounded-xl border glass-panel ${d.speaker === "A" ? "border-indigo-500/20 bg-indigo-500/5" : "border-cyan-500/20 bg-cyan-500/5"}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${d.speaker === "A" ? "bg-indigo-500/20 text-indigo-400" : "bg-cyan-500/20 text-cyan-400"}`}>{d.speaker}</div>
            <p className="text-gray-300 text-sm flex-1 truncate">{d.text}</p>
            {d.audioUrl ? <span className="text-green-400 flex items-center gap-1 text-xs shrink-0"><Check className="w-3.5 h-3.5" /> Done</span> : <span className="text-gray-600 text-xs shrink-0">Pending</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// STEP 4: VIDEO PREVIEW / CANVAS
// ==========================================

type OverlayStyle = 1 | 2 | 3 | 4;
type PlayState = "idle" | "countdown" | "scoreCard";
type TextSize = "small" | "medium" | "large";

interface OverlaySettings {
  roleA: string;
  roleB: string;
  textSize: TextSize;
  showScores: boolean;
  showTimer: boolean;
  showTopic: boolean;
  showWaveform: boolean;
  showTranscript: boolean;
}

interface DialogueScore {
  modelScores: { name: string; color: string; logo: string; score: number }[];
  avg: number;
  speaker: string;
}

interface CanvasProps {
  project: any;
  current: any;
  isASpeaking: boolean;
  settings: OverlaySettings;
  countdownSec: number;
  isPlaying: boolean;
  cumulativeA: number;
  cumulativeB: number;
}

// ---- Waveform animation bars ----
function WaveformBars({ color, side }: { color: string; side: "left" | "right" }) {
  const bars = [3, 6, 10, 7, 12, 5, 8, 11, 4, 9, 6, 13, 7, 5, 10];
  return (
    <div className={`flex items-end gap-0.5 h-8 ${side === "right" ? "flex-row-reverse" : ""}`}>
      {bars.map((h, i) => (
        <motion.div key={i} animate={{ height: [`${h * 4}%`, `${Math.min(100, h * 8)}%`, `${h * 4}%`] }} transition={{ repeat: Infinity, duration: 0.3 + i * 0.04, ease: "easeInOut" }} className={`w-[3px] rounded-full ${color}`} />
      ))}
    </div>
  );
}

// ---- Score Card (white grid with AI model logos) ----
function ScoreCardOverlay({ scores, speakerName, avg, isA }: { scores: { name: string; color: string; logo: string; score: number }[]; speakerName: string; avg: number; isA: boolean }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.85, opacity: 0 }} transition={{ type: "spring", damping: 20 }} className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl max-w-lg w-full mx-6">
        {/* Header */}
        <div className="text-center mb-5">
          <span className={`inline-block px-5 py-1.5 rounded-full text-sm font-bold text-white ${isA ? "bg-blue-600" : "bg-rose-600"}`}>
            {speakerName}'s Argument Score
          </span>
        </div>
        {/* AI Model Grid */}
        <div className="grid grid-cols-5 gap-3 mb-5">
          {scores.map((s, i) => (
            <motion.div key={s.name} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.12 }} className="flex flex-col items-center">
              <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-[10px] mb-1.5 shadow-lg" style={{ backgroundColor: s.color }}>{s.logo}</div>
              <span className="text-[9px] text-gray-500 font-medium leading-none">{s.name}</span>
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.12 + 0.3 }} className="text-base font-black text-gray-800 mt-0.5">{s.score.toFixed(1)}</motion.span>
            </motion.div>
          ))}
        </div>
        {/* Average */}
        <div className="bg-gray-50 rounded-2xl p-4 text-center border border-gray-100">
          <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Average Score</span>
          <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.7, type: "spring" }} className="text-5xl font-black text-gray-900 mt-1">
            {avg.toFixed(1)}
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---- Step 4 Main Component ----
function Step4Preview({ project }: { project: any }) {
  const dialogues: any[] = project.dialogues || [];
  const updateProject = useUpdateProject();
  const fileRef = useRef<HTMLInputElement>(null);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [style, setStyle] = useState<OverlayStyle>(1);
  const [bgImage, setBgImage] = useState(project.backgroundImage || DEMO_BG);
  const [editingSettings, setEditingSettings] = useState(false);
  const [settings, setSettings] = useState<OverlaySettings>({
    roleA: "SUPPORTER",
    roleB: "OPPONENT",
    textSize: "medium",
    showScores: true,
    showTimer: true,
    showTopic: true,
    showWaveform: true,
    showTranscript: true,
  });

  // Playback state machine
  const [playState, setPlayState] = useState<PlayState>("idle");
  const [countdownSec, setCountdownSec] = useState(0);
  const timerRef = useRef<any>(null);
  const scoreTimerRef = useRef<any>(null);

  // Pre-compute scores for all dialogues
  const allScores: DialogueScore[] = useMemo(() => {
    return dialogues.map((d: any) => {
      const modelScores = generateScoresForDialogue(d.text);
      const avg = +(modelScores.reduce((s, m) => s + m.score, 0) / modelScores.length).toFixed(1);
      return { modelScores, avg, speaker: d.speaker };
    });
  }, [dialogues]);

  // Cumulative scores up to current index (only for completed points)
  const completedIdx = playState === "scoreCard" ? currentIdx : currentIdx - 1;
  const cumulativeA = useMemo(() => {
    return allScores.filter((s, i) => i <= completedIdx && s.speaker === "A").reduce((sum, s) => +(sum + s.avg).toFixed(1), 0);
  }, [allScores, completedIdx]);
  const cumulativeB = useMemo(() => {
    return allScores.filter((s, i) => i <= completedIdx && s.speaker === "B").reduce((sum, s) => +(sum + s.avg).toFixed(1), 0);
  }, [allScores, completedIdx]);

  const current = dialogues[currentIdx] || { text: "No dialogues available.", speaker: "A" };
  const isASpeaking = current.speaker === "A";

  // Start countdown for current dialogue
  const startCountdown = useCallback(() => {
    clearInterval(timerRef.current);
    clearTimeout(scoreTimerRef.current);
    if (!dialogues[currentIdx]) { setPlayState("idle"); return; }
    const dur = getDialogueDuration(dialogues[currentIdx].text);
    setCountdownSec(dur);
    setPlayState("countdown");

    timerRef.current = setInterval(() => {
      setCountdownSec(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          // Show score card
          setPlayState("scoreCard");
          // After 3.5 seconds, move to next
          scoreTimerRef.current = setTimeout(() => {
            setCurrentIdx(ci => {
              const next = ci + 1;
              if (next >= dialogues.length) {
                setPlayState("idle");
                return ci;
              }
              return next;
            });
          }, 3500);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [currentIdx, dialogues]);

  // When currentIdx changes during playback, start new countdown
  useEffect(() => {
    if (playState === "countdown" || (playState === "scoreCard" && currentIdx > 0)) {
      // Only auto-start if we're in active playback
    }
  }, [currentIdx]);

  // After score card timeout updates currentIdx, restart countdown
  useEffect(() => {
    if (playState === "idle") return;
    // When idx changes and we're not in scoreCard, start countdown
    if (playState !== "scoreCard") {
      startCountdown();
    }
  }, [currentIdx]);

  const handlePlay = () => {
    if (playState !== "idle") {
      // Pause
      clearInterval(timerRef.current);
      clearTimeout(scoreTimerRef.current);
      setPlayState("idle");
    } else {
      // Start
      startCountdown();
    }
  };

  const handlePrev = () => {
    clearInterval(timerRef.current);
    clearTimeout(scoreTimerRef.current);
    setPlayState("idle");
    setCurrentIdx(Math.max(0, currentIdx - 1));
  };

  const handleNext = () => {
    clearInterval(timerRef.current);
    clearTimeout(scoreTimerRef.current);
    setPlayState("idle");
    setCurrentIdx(Math.min(dialogues.length - 1, currentIdx + 1));
  };

  // Cleanup
  useEffect(() => {
    return () => { clearInterval(timerRef.current); clearTimeout(scoreTimerRef.current); };
  }, []);

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setBgImage(dataUrl);
      updateProject.mutate({ id: project.id, backgroundImage: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  const updateSetting = <K extends keyof OverlaySettings>(key: K, val: OverlaySettings[K]) => setSettings(s => ({ ...s, [key]: val }));

  const canvasProps: CanvasProps = {
    project, current, isASpeaking, settings,
    countdownSec, isPlaying: playState === "countdown",
    cumulativeA, cumulativeB,
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col h-[calc(100vh-130px)] gap-4">
      {/* Top Controls */}
      <div className="flex items-center justify-between shrink-0 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">Video Canvas</h2>
          <p className="text-muted-foreground text-sm">Upload background, choose style, adjust overlay elements.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Style Switcher */}
          <div className="flex bg-black/40 rounded-xl border border-white/10 p-1 gap-0.5">
            {([1, 2, 3, 4] as OverlayStyle[]).map(s => (
              <button key={s} onClick={() => setStyle(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${style === s ? "bg-primary text-white" : "text-gray-400 hover:text-white"}`}>
                {s === 1 ? "Panel" : s === 2 ? "Bar" : s === 3 ? "News" : "Arena"}
              </button>
            ))}
          </div>
          <button onClick={() => setEditingSettings(!editingSettings)} className="px-3 py-2 rounded-xl border border-white/20 text-gray-300 hover:bg-white/5 text-xs flex items-center gap-1.5">
            <Settings className="w-3.5 h-3.5" /> {editingSettings ? "Close" : "Overlay"}
          </button>
          <button onClick={() => fileRef.current?.click()} className="px-3 py-2 rounded-xl border border-white/20 text-gray-300 hover:bg-white/5 text-xs flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5" /> BG
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
          <button className="px-4 py-2 bg-primary text-white font-bold rounded-xl shadow-[0_0_15px_rgba(124,58,237,0.4)] text-xs flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Settings Panel */}
        <AnimatePresence>
          {editingSettings && (
            <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "260px" }} exit={{ opacity: 0, width: 0 }} className="glass-panel rounded-2xl p-4 overflow-y-auto shrink-0 space-y-4" style={{ minWidth: "260px" }}>
              <h3 className="text-white font-bold text-xs uppercase tracking-wider">Overlay Settings</h3>

              {/* Text Size */}
              <div className="space-y-2">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Text Size</label>
                <div className="flex gap-1">
                  {(["small", "medium", "large"] as TextSize[]).map(sz => (
                    <button key={sz} onClick={() => updateSetting("textSize", sz)} className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize ${settings.textSize === sz ? "bg-primary text-white" : "bg-white/10 text-gray-400 hover:text-white"}`}>{sz}</button>
                  ))}
                </div>
              </div>

              {/* Roles */}
              <div className="space-y-2">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Roles</label>
                <div><label className="text-[10px] text-indigo-400 block mb-0.5">{project.speakerAName}</label><input value={settings.roleA} onChange={e => updateSetting("roleA", e.target.value)} className="w-full glass-input px-2 py-1.5 rounded-lg text-white text-xs" /></div>
                <div><label className="text-[10px] text-red-400 block mb-0.5">{project.speakerBName}</label><input value={settings.roleB} onChange={e => updateSetting("roleB", e.target.value)} className="w-full glass-input px-2 py-1.5 rounded-lg text-white text-xs" /></div>
              </div>

              {/* Scores Info */}
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Live Scores (Auto)</label>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-blue-400 font-bold">{project.speakerAName}: {cumulativeA.toFixed(1)}</span>
                  <span className="text-gray-600">|</span>
                  <span className="text-rose-400 font-bold">{project.speakerBName}: {cumulativeB.toFixed(1)}</span>
                </div>
                <p className="text-[9px] text-gray-600">Scored by ChatGPT, Gemini, Grok, DeepSeek, Claude avg</p>
              </div>

              {/* Toggles */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Elements</label>
                {([
                  { key: "showScores" as const, label: "Scores" },
                  { key: "showTopic" as const, label: "Topic" },
                  { key: "showTimer" as const, label: "Timer" },
                  { key: "showWaveform" as const, label: "Waveform" },
                  { key: "showTranscript" as const, label: "Transcript" },
                ]).map(({ key, label }) => (
                  <label key={key} className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs text-gray-300">{label}</span>
                    <button onClick={() => updateSetting(key, !settings[key])} className={`w-9 h-[18px] rounded-full transition-all relative ${settings[key] ? "bg-primary" : "bg-white/20"}`}>
                      <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[2px] transition-all ${settings[key] ? "left-[18px]" : "left-[2px]"}`} />
                    </button>
                  </label>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Canvas */}
        <div className="flex-1 relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black min-h-0">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${bgImage})`, opacity: 0.7 }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />

          {/* Canvas Style */}
          {style === 1 && <CanvasStyle1 {...canvasProps} />}
          {style === 2 && <CanvasStyle2 {...canvasProps} />}
          {style === 3 && <CanvasStyle3 {...canvasProps} />}
          {style === 4 && <CanvasStyle4 {...canvasProps} />}

          {/* Score Card Overlay */}
          <AnimatePresence>
            {playState === "scoreCard" && allScores[currentIdx] && (
              <ScoreCardOverlay
                scores={allScores[currentIdx].modelScores}
                speakerName={isASpeaking ? project.speakerAName : project.speakerBName}
                avg={allScores[currentIdx].avg}
                isA={isASpeaking}
              />
            )}
          </AnimatePresence>

          {/* Playback Controls */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 z-50">
            <button onClick={handlePrev} className="p-1 text-white hover:bg-white/20 rounded-full"><ArrowLeft className="w-4 h-4" /></button>
            <button onClick={handlePlay} className="px-4 py-1 bg-white text-black font-bold rounded-full text-xs hover:bg-gray-200 flex items-center gap-1.5">
              {playState !== "idle" ? <><Pause className="w-3.5 h-3.5" /> Pause</> : <><Play className="w-3.5 h-3.5" /> Play</>}
            </button>
            <button onClick={handleNext} className="p-1 text-white hover:bg-white/20 rounded-full"><ArrowRight className="w-4 h-4" /></button>
            <span className="text-gray-400 text-[10px] ml-1">{currentIdx + 1}/{dialogues.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// STYLE 1 — Side Score Panels + Golden Topic Bar
// ==========================================
function CanvasStyle1({ project, current, isASpeaking, settings, countdownSec, isPlaying, cumulativeA, cumulativeB }: CanvasProps) {
  return (
    <>
      {/* TOP: Topic + Countdown Timer */}
      {settings.showTopic && (
        <motion.div drag dragMomentum={false} className="absolute top-0 left-0 right-0 flex items-center z-20 cursor-move">
          <div className="flex-1 bg-gradient-to-r from-amber-600/90 to-yellow-500/90 backdrop-blur-sm py-2.5 px-6 flex items-center justify-center">
            <span className="text-black font-black text-xs sm:text-sm tracking-widest uppercase text-center">{project.topic}</span>
          </div>
          {settings.showTimer && (
            <div className="bg-black/90 px-5 py-2.5 font-mono text-white font-bold text-lg shrink-0 tabular-nums">
              {fmtTimer(countdownSec)}
            </div>
          )}
        </motion.div>
      )}

      {/* LEFT: Speaker A Panel */}
      {settings.showScores && (
        <motion.div drag dragMomentum={false} className="absolute left-0 top-11 bottom-12 w-[72px] z-20 cursor-move">
          <div className={`flex flex-col items-center w-full h-full bg-blue-600/85 backdrop-blur-sm py-3 px-1 transition-all duration-500 ${isASpeaking && isPlaying ? "brightness-125 shadow-[0_0_40px_rgba(59,130,246,0.8)]" : ""}`}>
            <div className="text-white font-black text-2xl tabular-nums">{cumulativeA.toFixed(1)}</div>
            <div className="w-8 h-0.5 bg-white/30 my-1.5" />
            <div className="text-white font-bold text-[10px] text-center flex-1 flex items-center" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>{project.speakerAName}</div>
            {settings.showWaveform && isASpeaking && isPlaying && <div className="mt-1"><WaveformBars color="bg-white/80" side="left" /></div>}
            <div className="text-white/60 font-bold text-[8px] tracking-wider mt-1" style={{ writingMode: "vertical-rl" }}>{settings.roleA}</div>
          </div>
        </motion.div>
      )}

      {/* RIGHT: Speaker B Panel */}
      {settings.showScores && (
        <motion.div drag dragMomentum={false} className="absolute right-0 top-11 bottom-12 w-[72px] z-20 cursor-move">
          <div className={`flex flex-col items-center w-full h-full bg-rose-600/85 backdrop-blur-sm py-3 px-1 transition-all duration-500 ${!isASpeaking && isPlaying ? "brightness-125 shadow-[0_0_40px_rgba(239,68,68,0.8)]" : ""}`}>
            <div className="text-white font-black text-2xl tabular-nums">{cumulativeB.toFixed(1)}</div>
            <div className="w-8 h-0.5 bg-white/30 my-1.5" />
            <div className="text-white font-bold text-[10px] text-center flex-1 flex items-center" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>{project.speakerBName}</div>
            {settings.showWaveform && !isASpeaking && isPlaying && <div className="mt-1"><WaveformBars color="bg-white/80" side="right" /></div>}
            <div className="text-white/60 font-bold text-[8px] tracking-wider mt-1" style={{ writingMode: "vertical-rl" }}>{settings.roleB}</div>
          </div>
        </motion.div>
      )}

      {/* ACTIVE SPEAKER BADGE */}
      <motion.div drag dragMomentum={false} className="absolute top-14 left-1/2 -translate-x-1/2 z-20 cursor-move">
        <AnimatePresence mode="wait">
          <motion.div key={current.speaker} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className={`px-4 py-1.5 rounded-full font-bold text-xs tracking-wider ${isASpeaking ? "bg-blue-600/90 text-white border border-blue-400/50" : "bg-rose-600/90 text-white border border-rose-400/50"}`}>
            {isASpeaking ? `${project.speakerAName}` : `${project.speakerBName}`}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* TRANSCRIPT */}
      {settings.showTranscript && (
        <motion.div drag dragMomentum={false} className="absolute bottom-12 left-[76px] right-[76px] z-20 cursor-move">
          <AnimatePresence mode="wait">
            <motion.div key={current.text} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className={`relative ${BOX_PAD[settings.textSize]} rounded-2xl backdrop-blur-lg border shadow-2xl ${isASpeaking ? "bg-blue-900/60 border-blue-400/40" : "bg-rose-900/60 border-rose-400/40"}`}>
              <div className={`absolute -top-2 ${isASpeaking ? "left-6" : "right-6"} w-4 h-4 rotate-45 ${isASpeaking ? "bg-blue-900/80 border-t border-l border-blue-400/40" : "bg-rose-900/80 border-t border-r border-rose-400/40"}`} />
              <p className={`text-white font-bold leading-snug text-center drop-shadow-lg ${TEXT_SIZES[settings.textSize]}`}>{current.text}</p>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </>
  );
}

// ==========================================
// STYLE 2 — Bottom Bar + Clean HUD
// ==========================================
function CanvasStyle2({ project, current, isASpeaking, settings, countdownSec, isPlaying, cumulativeA, cumulativeB }: CanvasProps) {
  return (
    <>
      {settings.showTopic && (
        <motion.div drag dragMomentum={false} className="absolute top-4 left-1/2 -translate-x-1/2 z-20 cursor-move">
          <div className="flex items-center gap-3 bg-black/70 backdrop-blur-md rounded-2xl border border-white/10 px-5 py-2">
            <span className="text-white font-bold text-xs tracking-wide uppercase">{project.topic}</span>
            {settings.showTimer && <><div className="w-px h-4 bg-white/30" /><span className="text-yellow-400 font-mono font-bold text-sm tabular-nums">{fmtTimer(countdownSec)}</span></>}
          </div>
        </motion.div>
      )}

      {settings.showWaveform && isPlaying && (
        <>
          {isASpeaking && <motion.div drag dragMomentum={false} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute left-6 top-1/2 -translate-y-1/2 z-20 cursor-move flex flex-col items-center gap-2"><div className="text-indigo-300 text-[10px] font-bold">{project.speakerAName}</div><WaveformBars color="bg-indigo-400" side="left" /></motion.div>}
          {!isASpeaking && <motion.div drag dragMomentum={false} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute right-6 top-1/2 -translate-y-1/2 z-20 cursor-move flex flex-col items-center gap-2"><div className="text-cyan-300 text-[10px] font-bold">{project.speakerBName}</div><WaveformBars color="bg-cyan-400" side="right" /></motion.div>}
        </>
      )}

      {settings.showScores && (
        <motion.div drag dragMomentum={false} className="absolute bottom-12 left-0 right-0 z-20 cursor-move">
          <div className="flex items-stretch">
            <div className={`flex-1 flex items-center gap-3 px-5 py-2.5 bg-blue-700/80 backdrop-blur-sm transition-all ${isASpeaking && isPlaying ? "brightness-125" : "brightness-75"}`}>
              <div><div className="text-white font-black text-xl tabular-nums">{cumulativeA.toFixed(1)}</div><div className="text-blue-200 text-[10px] font-bold tracking-wider">{settings.roleA}</div></div>
              <div className="flex-1"><div className="text-white font-bold text-xs">{project.speakerAName}</div></div>
              {isASpeaking && isPlaying && settings.showWaveform && <WaveformBars color="bg-blue-200" side="left" />}
            </div>
            <div className="w-px bg-white/20" />
            <div className={`flex-1 flex items-center gap-3 px-5 py-2.5 bg-rose-700/80 backdrop-blur-sm flex-row-reverse transition-all ${!isASpeaking && isPlaying ? "brightness-125" : "brightness-75"}`}>
              <div className="text-right"><div className="text-white font-black text-xl tabular-nums">{cumulativeB.toFixed(1)}</div><div className="text-rose-200 text-[10px] font-bold tracking-wider">{settings.roleB}</div></div>
              <div className="flex-1 text-right"><div className="text-white font-bold text-xs">{project.speakerBName}</div></div>
              {!isASpeaking && isPlaying && settings.showWaveform && <WaveformBars color="bg-rose-200" side="right" />}
            </div>
          </div>
        </motion.div>
      )}

      {settings.showTranscript && (
        <motion.div drag dragMomentum={false} className="absolute bottom-[72px] left-10 right-10 z-20 cursor-move">
          <AnimatePresence mode="wait">
            <motion.div key={current.text} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} className={`bg-black/75 backdrop-blur-xl border border-white/10 rounded-2xl ${BOX_PAD[settings.textSize]} shadow-2xl`}>
              <div className="flex items-center gap-2 mb-1.5"><div className={`w-2 h-2 rounded-full ${isASpeaking ? "bg-blue-400" : "bg-rose-400"}`} /><span className={`text-[10px] font-bold tracking-wider ${isASpeaking ? "text-blue-400" : "text-rose-400"}`}>{isASpeaking ? project.speakerAName : project.speakerBName}</span></div>
              <p className={`text-white font-bold leading-snug ${TEXT_SIZES[settings.textSize]}`}>{current.text}</p>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </>
  );
}

// ==========================================
// STYLE 3 — News Broadcast
// ==========================================
function CanvasStyle3({ project, current, isASpeaking, settings, countdownSec, isPlaying, cumulativeA, cumulativeB }: CanvasProps) {
  return (
    <>
      {/* LIVE Badge */}
      <motion.div drag dragMomentum={false} className="absolute top-4 left-4 z-20 cursor-move">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-red-600 px-3 py-1 rounded">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-white font-black text-xs tracking-wider">LIVE</span>
          </div>
          {settings.showTimer && (
            <div className="bg-black/80 px-3 py-1 rounded font-mono text-white font-bold text-sm tabular-nums">{fmtTimer(countdownSec)}</div>
          )}
        </div>
      </motion.div>

      {/* Topic Bar - top right */}
      {settings.showTopic && (
        <motion.div drag dragMomentum={false} className="absolute top-4 right-4 z-20 cursor-move">
          <div className="bg-white/95 backdrop-blur px-4 py-1.5 rounded shadow-lg">
            <span className="text-gray-900 font-black text-xs tracking-wider uppercase">{project.topic}</span>
          </div>
        </motion.div>
      )}

      {/* Waveform - side of speaking person */}
      {settings.showWaveform && isPlaying && (
        <motion.div drag dragMomentum={false} className={`absolute ${isASpeaking ? "left-5" : "right-5"} top-1/2 -translate-y-1/2 z-20 cursor-move`}>
          <WaveformBars color={isASpeaking ? "bg-blue-400" : "bg-rose-400"} side={isASpeaking ? "left" : "right"} />
        </motion.div>
      )}

      {/* Lower Third - News style name plate */}
      <motion.div drag dragMomentum={false} className="absolute bottom-12 left-0 right-0 z-20 cursor-move">
        <div className="flex flex-col">
          {/* Speaker Name Plate */}
          <div className="flex items-stretch">
            <div className={`${isASpeaking ? "bg-blue-600" : "bg-rose-600"} px-5 py-2`}>
              <div className="text-white font-black text-sm">{isASpeaking ? project.speakerAName : project.speakerBName}</div>
              <div className="text-white/70 text-[10px] font-bold tracking-wider">{isASpeaking ? settings.roleA : settings.roleB}</div>
            </div>
            {/* Transcript */}
            {settings.showTranscript && (
              <div className={`flex-1 bg-gray-900/95 backdrop-blur px-5 py-2 flex items-center`}>
                <p className={`text-white font-semibold leading-snug ${TEXT_SIZES[settings.textSize]}`}>{current.text}</p>
              </div>
            )}
          </div>

          {/* Score Ticker */}
          {settings.showScores && (
            <div className="flex">
              <div className="bg-blue-800/90 px-4 py-1 flex items-center gap-2">
                <span className="text-blue-200 text-[10px] font-bold">{project.speakerAName}</span>
                <span className="text-white font-black text-sm tabular-nums">{cumulativeA.toFixed(1)}</span>
              </div>
              <div className="bg-gray-800/90 px-2 py-1 flex items-center"><span className="text-gray-400 text-[10px] font-bold">VS</span></div>
              <div className="bg-rose-800/90 px-4 py-1 flex items-center gap-2">
                <span className="text-rose-200 text-[10px] font-bold">{project.speakerBName}</span>
                <span className="text-white font-black text-sm tabular-nums">{cumulativeB.toFixed(1)}</span>
              </div>
              <div className="flex-1 bg-gray-900/90 px-3 py-1 flex items-center">
                <span className="text-gray-500 text-[9px] font-medium tracking-wider">SCORED BY CHATGPT + GEMINI + GROK + DEEPSEEK + CLAUDE</span>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

// ==========================================
// STYLE 4 — Arena / VS Battle
// ==========================================
function CanvasStyle4({ project, current, isASpeaking, settings, countdownSec, isPlaying, cumulativeA, cumulativeB }: CanvasProps) {
  return (
    <>
      {/* Dynamic side glow */}
      <div className={`absolute inset-0 z-10 pointer-events-none transition-all duration-700 ${isASpeaking && isPlaying ? "bg-gradient-to-r from-blue-600/20 via-transparent to-transparent" : !isASpeaking && isPlaying ? "bg-gradient-to-l from-rose-600/20 via-transparent to-transparent" : ""}`} />

      {/* Topic + Timer - top center */}
      {settings.showTopic && (
        <motion.div drag dragMomentum={false} className="absolute top-4 left-1/2 -translate-x-1/2 z-20 cursor-move">
          <div className="flex items-center gap-2">
            <span className="text-white/70 font-bold text-[10px] tracking-widest uppercase">{project.topic}</span>
            {settings.showTimer && <div className="bg-yellow-500/90 px-3 py-0.5 rounded font-mono text-black font-black text-sm tabular-nums">{fmtTimer(countdownSec)}</div>}
          </div>
        </motion.div>
      )}

      {/* VS Badge - center */}
      <motion.div drag dragMomentum={false} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 cursor-move">
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-[0_0_40px_rgba(245,158,11,0.5)]">
            <span className="text-white font-black text-xl">VS</span>
          </div>
        </div>
      </motion.div>

      {/* Speaker A Card - left */}
      {settings.showScores && (
        <motion.div drag dragMomentum={false} className="absolute left-4 top-1/2 -translate-y-1/2 z-20 cursor-move">
          <div className={`bg-blue-600/80 backdrop-blur-lg rounded-2xl p-4 border border-blue-400/30 transition-all duration-500 min-w-[100px] ${isASpeaking && isPlaying ? "shadow-[0_0_40px_rgba(59,130,246,0.6)] scale-105" : "opacity-80"}`}>
            <div className="text-white font-black text-3xl text-center tabular-nums">{cumulativeA.toFixed(1)}</div>
            <div className="w-full h-px bg-white/30 my-2" />
            <div className="text-white font-bold text-xs text-center">{project.speakerAName}</div>
            <div className="text-blue-200 text-[9px] font-bold text-center tracking-wider mt-0.5">{settings.roleA}</div>
            {settings.showWaveform && isASpeaking && isPlaying && <div className="mt-2 flex justify-center"><WaveformBars color="bg-white/70" side="left" /></div>}
          </div>
        </motion.div>
      )}

      {/* Speaker B Card - right */}
      {settings.showScores && (
        <motion.div drag dragMomentum={false} className="absolute right-4 top-1/2 -translate-y-1/2 z-20 cursor-move">
          <div className={`bg-rose-600/80 backdrop-blur-lg rounded-2xl p-4 border border-rose-400/30 transition-all duration-500 min-w-[100px] ${!isASpeaking && isPlaying ? "shadow-[0_0_40px_rgba(239,68,68,0.6)] scale-105" : "opacity-80"}`}>
            <div className="text-white font-black text-3xl text-center tabular-nums">{cumulativeB.toFixed(1)}</div>
            <div className="w-full h-px bg-white/30 my-2" />
            <div className="text-white font-bold text-xs text-center">{project.speakerBName}</div>
            <div className="text-rose-200 text-[9px] font-bold text-center tracking-wider mt-0.5">{settings.roleB}</div>
            {settings.showWaveform && !isASpeaking && isPlaying && <div className="mt-2 flex justify-center"><WaveformBars color="bg-white/70" side="right" /></div>}
          </div>
        </motion.div>
      )}

      {/* Transcript - bottom ticker style */}
      {settings.showTranscript && (
        <motion.div drag dragMomentum={false} className="absolute bottom-12 left-4 right-4 z-20 cursor-move">
          <AnimatePresence mode="wait">
            <motion.div key={current.text} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className={`${BOX_PAD[settings.textSize]} rounded-xl border shadow-2xl ${isASpeaking ? "bg-blue-950/80 border-blue-500/30 backdrop-blur-lg" : "bg-rose-950/80 border-rose-500/30 backdrop-blur-lg"}`}>
              <div className="flex items-center gap-2 mb-1"><div className={`w-1.5 h-1.5 rounded-full ${isASpeaking ? "bg-blue-400" : "bg-rose-400"}`} /><span className={`text-[9px] font-bold tracking-wider uppercase ${isASpeaking ? "text-blue-400" : "text-rose-400"}`}>{isASpeaking ? project.speakerAName : project.speakerBName}</span></div>
              <p className={`text-white font-bold leading-snug ${TEXT_SIZES[settings.textSize]}`}>{current.text}</p>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </>
  );
}
