import { useEffect, useState, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, Settings, FileText, Mic, LayoutTemplate, ArrowLeft, ArrowRight,
  Loader2, Download, Upload, Edit2, X, Wand2, Play, Pause, Plus, Minus,
  Volume2, Captions, Image as ImageIcon, RotateCcw
} from "lucide-react";
import {
  useProject, useUpdateProject, useUpdateDialogue,
  useGenerateScript, useRewriteDialogue, useGenerateAudio
} from "@/hooks/use-projects";

const DEMO_BG = "https://images.unsplash.com/photo-1577563908411-5077b6dc7624?q=80&w=2070&auto=format&fit=crop";

export default function Wizard() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id || "0");
  const [location, setLocation] = useLocation();

  const searchParams = new URLSearchParams(window.location.search);
  const initialStep = parseInt(searchParams.get("step") || "1");
  const [currentStep, setCurrentStep] = useState(initialStep);

  const { data: project, isLoading: isProjectLoading } = useProject(projectId);

  useEffect(() => {
    const newUrl = `/projects/${projectId}?step=${currentStep}`;
    if (location !== newUrl) {
      window.history.replaceState(null, "", newUrl);
    }
  }, [currentStep, projectId, location]);

  if (isProjectLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  if (!project) {
    return <div className="min-h-screen flex items-center justify-center text-white">Project not found</div>;
  }

  const steps = [
    { num: 1, title: "Setup", icon: Settings },
    { num: 2, title: "Script", icon: FileText },
    { num: 3, title: "Audio", icon: Mic },
    { num: 4, title: "Preview", icon: LayoutTemplate },
  ];

  return (
    <div className="min-h-screen flex flex-col max-w-[1600px] mx-auto">
      {/* Header / Stepper */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setLocation("/")}
            className="p-2 hover:bg-white/5 rounded-full transition-colors text-muted-foreground hover:text-white"
          >
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
                  <button
                    onClick={() => setCurrentStep(step.num)}
                    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 ${
                      isActive
                        ? "border-primary bg-primary/20 text-primary shadow-[0_0_15px_rgba(124,58,237,0.4)]"
                        : isPast
                          ? "border-primary bg-primary text-white"
                          : "border-white/10 bg-transparent text-gray-500 hover:border-white/30"
                    }`}
                  >
                    {isPast ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </button>
                  <span className={`hidden md:block ml-3 text-sm font-medium ${isActive ? "text-white" : isPast ? "text-gray-300" : "text-gray-600"}`}>
                    {step.title}
                  </span>
                  {idx < steps.length - 1 && (
                    <div className={`w-8 sm:w-16 h-0.5 mx-2 sm:mx-4 rounded-full ${isPast ? "bg-primary" : "bg-white/10"}`} />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="w-10" />
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 lg:p-12 overflow-x-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="h-full"
          >
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

  const durationInfo: Record<string, string> = {
    short: "~3 min · 6-8 exchanges",
    medium: "~7 min · 14-16 exchanges",
    long: "~12 min · 24-28 exchanges",
  };

  return (
    <div className="max-w-2xl mx-auto glass-panel p-8 sm:p-12 rounded-3xl">
      <h2 className="text-3xl font-display font-bold text-white mb-2">Configure Your Debate</h2>
      <p className="text-muted-foreground mb-10">Define the core parameters for the AI to generate the script.</p>

      <div className="space-y-8">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Debate Topic</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Artificial Intelligence vs Human Creativity"
            className="w-full px-5 py-4 rounded-xl glass-input text-lg focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">Script Duration</label>
          <div className="grid grid-cols-3 gap-4">
            {["short", "medium", "long"].map((d) => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={`py-4 px-4 rounded-xl font-medium capitalize border transition-all flex flex-col items-center gap-1 ${
                  duration === d
                    ? "bg-primary/20 border-primary text-primary"
                    : "bg-black/20 border-white/10 text-gray-400 hover:border-white/30"
                }`}
              >
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
              <div
                key={m.id}
                onClick={() => setModel(m.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center ${
                  model === m.id
                    ? "bg-primary/10 border-primary shadow-[0_0_10px_rgba(124,58,237,0.2)]"
                    : "bg-black/20 border-white/10 hover:border-white/30"
                }`}
              >
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
          <button
            onClick={handleSave}
            disabled={!topic.trim() || updateProject.isPending}
            className="flex items-center px-8 py-3.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updateProject.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
            Continue to Script
            <ArrowRight className="w-5 h-5 ml-2" />
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

  const handleGenerate = () => generateScript.mutateAsync(project.id);

  const saveSpeakerNames = () => {
    if (speakerA !== project.speakerAName || speakerB !== project.speakerBName) {
      updateProject.mutate({ id: project.id, speakerAName: speakerA, speakerBName: speakerB });
    }
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
        <button
          onClick={handleGenerate}
          disabled={generateScript.isPending}
          className="px-8 py-4 bg-gradient-to-r from-primary to-indigo-600 text-white font-bold rounded-xl text-lg hover:shadow-lg hover:shadow-primary/50 transition-all hover:-translate-y-1 flex items-center"
        >
          {generateScript.isPending ? (
            <><Loader2 className="w-6 h-6 animate-spin mr-3" /> Generating Script...</>
          ) : (
            <>Generate Script with AI</>
          )}
        </button>
      </div>
    );
  }

  // Pair dialogues: [A, B] per round
  const dialogues: any[] = project.dialogues;
  const aDialogues = dialogues.filter((d: any) => d.speaker === "A");
  const bDialogues = dialogues.filter((d: any) => d.speaker === "B");
  const maxRows = Math.max(aDialogues.length, bDialogues.length);

  const DialogueCell = ({ dialogue, side }: { dialogue: any | null; side: "A" | "B" }) => {
    if (!dialogue) return <div className="p-4 text-gray-600 italic text-sm">—</div>;
    const isEditing = editingId === dialogue.id;
    const isRewriting = rewritingId === dialogue.id;
    const color = side === "A" ? "indigo" : "cyan";

    if (isEditing) {
      return (
        <div className="p-3 space-y-2">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full h-28 glass-input p-3 rounded-lg resize-none text-white text-sm"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditingId(null)} className="px-3 py-1 text-xs text-gray-400 hover:text-white">Cancel</button>
            <button
              onClick={() => handleSaveEdit(dialogue.id)}
              disabled={updateDialogue.isPending}
              className="px-3 py-1 text-xs bg-primary text-white rounded-lg"
            >
              {updateDialogue.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      );
    }

    if (isRewriting) {
      return (
        <div className="p-3 space-y-2">
          <div className="p-2 bg-black/30 rounded text-gray-400 text-xs line-clamp-2">"{dialogue.text}"</div>
          <input
            value={rewriteInstruction}
            onChange={(e) => setRewriteInstruction(e.target.value)}
            placeholder="e.g. Make it more aggressive..."
            className="w-full glass-input p-2 rounded-lg text-white text-sm"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setRewritingId(null)} className="px-3 py-1 text-xs text-gray-400 hover:text-white">Cancel</button>
            <button
              onClick={() => handleRewrite(dialogue.id)}
              disabled={rewriteDialogue.isPending || !rewriteInstruction}
              className={`px-3 py-1 text-xs bg-gradient-to-r ${color === "indigo" ? "from-indigo-500 to-indigo-700" : "from-cyan-500 to-cyan-700"} text-white rounded-lg flex items-center gap-1`}
            >
              {rewriteDialogue.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />} AI Rewrite
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 group relative">
        <p className="text-gray-100 text-sm leading-relaxed">{dialogue.text}</p>
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          <button
            onClick={() => { setEditingId(dialogue.id); setEditText(dialogue.text); }}
            className="p-1.5 text-xs text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
            title="Edit"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          <button
            onClick={() => setRewritingId(dialogue.id)}
            className={`p-1.5 text-xs hover:bg-white/10 rounded transition-colors ${color === "indigo" ? "text-indigo-400 hover:text-indigo-200" : "text-cyan-400 hover:text-cyan-200"}`}
            title="AI Rewrite"
          >
            <Wand2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto flex flex-col h-[calc(100vh-140px)]">
      {/* Header */}
      <div className="flex justify-between items-end mb-6 shrink-0">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">Script Editor</h2>
          <p className="text-muted-foreground">Edit dialogs or ask AI to rewrite any line. Hover a cell to see options.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={generateScript.isPending}
            className="px-4 py-2 text-sm border border-white/20 text-gray-300 rounded-xl hover:bg-white/5 flex items-center gap-2"
          >
            {generateScript.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            Regenerate
          </button>
          <button
            onClick={onNext}
            className="px-6 py-2.5 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors flex items-center"
          >
            Next: Audio <ArrowRight className="w-4 h-4 ml-2" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-white/10 overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-2 sticky top-0 z-10">
          <div className="bg-indigo-900/60 backdrop-blur-md border-b border-r border-white/10 p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-sm shrink-0">A</div>
            <input
              value={speakerA}
              onChange={(e) => setSpeakerA(e.target.value)}
              onBlur={saveSpeakerNames}
              className="bg-transparent border-none text-white font-bold focus:outline-none w-full text-lg"
              placeholder="Speaker A Name"
            />
          </div>
          <div className="bg-cyan-900/60 backdrop-blur-md border-b border-white/10 p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-cyan-500/30 text-cyan-300 flex items-center justify-center font-bold text-sm shrink-0">B</div>
            <input
              value={speakerB}
              onChange={(e) => setSpeakerB(e.target.value)}
              onBlur={saveSpeakerNames}
              className="bg-transparent border-none text-white font-bold focus:outline-none w-full text-lg"
              placeholder="Speaker B Name"
            />
          </div>
        </div>

        {/* Rows */}
        {Array.from({ length: maxRows }).map((_, i) => {
          const dA = aDialogues[i] || null;
          const dB = bDialogues[i] || null;
          return (
            <div key={i} className="grid grid-cols-2 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
              <div className={`border-r border-white/5 min-h-[80px] ${dA ? "bg-indigo-500/[0.04]" : ""}`}>
                <DialogueCell dialogue={dA} side="A" />
              </div>
              <div className={`min-h-[80px] ${dB ? "bg-cyan-500/[0.04]" : ""}`}>
                <DialogueCell dialogue={dB} side="B" />
              </div>
            </div>
          );
        })}
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
    { id: "alloy", name: "Alloy", desc: "Neutral" },
    { id: "echo", name: "Echo", desc: "Warm" },
    { id: "fable", name: "Fable", desc: "Expressive" },
    { id: "onyx", name: "Onyx", desc: "Deep" },
    { id: "nova", name: "Nova", desc: "Energetic" },
    { id: "shimmer", name: "Shimmer", desc: "Clear" },
  ];

  const handleSaveVoices = (vA: string, vB: string) => {
    updateProject.mutate({ id: project.id, speakerAVoice: vA, speakerBVoice: vB });
  };

  const handleGenerateAll = async () => {
    setIsGeneratingAll(true);
    setProgress(0);
    const total = project.dialogues.length;
    for (let i = 0; i < total; i++) {
      try {
        await generateAudio.mutateAsync({ dialogueId: project.dialogues[i].id, projectId: project.id });
      } catch (e) {
        console.error("Audio gen failed for dialogue", project.dialogues[i].id);
      }
      setProgress(Math.round(((i + 1) / total) * 100));
    }
    setIsGeneratingAll(false);
  };

  const handleGenerateCaptions = () => {
    // Build SRT from dialogue text with estimated timing
    const dialogues: any[] = project.dialogues;
    let srt = "";
    let currentTime = 0;
    const WORDS_PER_SEC = 2.5; // ~150 wpm

    dialogues.forEach((d, i) => {
      const wordCount = d.text.split(" ").length;
      const duration = Math.max(2, wordCount / WORDS_PER_SEC);
      const start = currentTime;
      const end = currentTime + duration;

      const fmt = (s: number) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = Math.floor(s % 60);
        const ms = Math.floor((s % 1) * 1000);
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
      };

      const speakerName = d.speaker === "A" ? project.speakerAName : project.speakerBName;
      srt += `${i + 1}\n${fmt(start)} --> ${fmt(end)}\n[${speakerName}] ${d.text}\n\n`;
      currentTime = end + 0.5;
    });

    const blob = new Blob([srt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.topic.replace(/\s+/g, "_")}_captions.srt`;
    a.click();
    URL.revokeObjectURL(url);
    setCaptionsGenerated(true);
  };

  const allAudioGenerated = project.dialogues?.every((d: any) => d.audioUrl);
  const dialogues: any[] = project.dialogues || [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-display font-bold text-white mb-2">Voice Synthesis</h2>
          <p className="text-muted-foreground">Select voices and generate audio for your debate.</p>
        </div>
        <button
          onClick={onNext}
          disabled={!allAudioGenerated}
          className="px-6 py-2.5 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors flex items-center disabled:opacity-50"
          title={!allAudioGenerated ? "Generate all audio first" : ""}
        >
          Next: Preview <ArrowRight className="w-4 h-4 ml-2" />
        </button>
      </div>

      {/* Voice Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Speaker A */}
        <div className="glass-panel p-5 rounded-2xl border-t-4 border-t-indigo-500">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm">A</div>
            <div>
              <h3 className="font-bold text-white">{project.speakerAName}</h3>
              <p className="text-xs text-indigo-400">Select voice persona</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {voices.map((v) => (
              <button
                key={v.id}
                onClick={() => { setVoiceA(v.id); handleSaveVoices(v.id, voiceB); }}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  voiceA === v.id
                    ? "bg-indigo-500/20 border-indigo-500"
                    : "bg-black/20 border-white/10 hover:border-white/30"
                }`}
              >
                <div className={`font-semibold text-sm ${voiceA === v.id ? "text-indigo-300" : "text-gray-300"}`}>{v.name}</div>
                <div className="text-xs text-gray-500">{v.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Speaker B */}
        <div className="glass-panel p-5 rounded-2xl border-t-4 border-t-cyan-500">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm">B</div>
            <div>
              <h3 className="font-bold text-white">{project.speakerBName}</h3>
              <p className="text-xs text-cyan-400">Select voice persona</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {voices.map((v) => (
              <button
                key={v.id}
                onClick={() => { setVoiceB(v.id); handleSaveVoices(voiceA, v.id); }}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  voiceB === v.id
                    ? "bg-cyan-500/20 border-cyan-500"
                    : "bg-black/20 border-white/10 hover:border-white/30"
                }`}
              >
                <div className={`font-semibold text-sm ${voiceB === v.id ? "text-cyan-300" : "text-gray-300"}`}>{v.name}</div>
                <div className="text-xs text-gray-500">{v.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col items-center text-center">
        {isGeneratingAll ? (
          <div className="w-full max-w-md">
            <h3 className="text-lg font-bold text-white mb-3">Synthesizing Voices...</h3>
            <div className="h-3 w-full bg-black/40 rounded-full overflow-hidden mb-2 border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-400">{progress}% Complete</p>
          </div>
        ) : (
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <button
              onClick={handleGenerateAll}
              className="px-7 py-3 bg-gradient-to-r from-primary to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-primary/40 transition-all hover:-translate-y-0.5 flex items-center gap-2"
            >
              <Volume2 className="w-5 h-5" />
              {allAudioGenerated ? "Regenerate All Audio" : "Generate All Audio"}
            </button>
            {allAudioGenerated && (
              <button
                onClick={handleGenerateCaptions}
                className="px-7 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-emerald-500/30 transition-all hover:-translate-y-0.5 flex items-center gap-2"
              >
                <Captions className="w-5 h-5" />
                {captionsGenerated ? "Download Again" : "Generate Captions (SRT)"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Dialogue Audio Status - Alternating Layout */}
      <div className="space-y-2 max-h-72 overflow-y-auto">
        {dialogues.map((d: any) => {
          const isA = d.speaker === "A";
          return (
            <div
              key={d.id}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                isA
                  ? "glass-panel border-indigo-500/20 bg-indigo-500/5"
                  : "glass-panel border-cyan-500/20 bg-cyan-500/5"
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                isA ? "bg-indigo-500/20 text-indigo-400" : "bg-cyan-500/20 text-cyan-400"
              }`}>
                {d.speaker}
              </div>
              <p className="text-gray-300 text-sm flex-1 truncate">{d.text}</p>
              {d.audioUrl ? (
                <span className="text-green-400 flex items-center gap-1 text-xs shrink-0">
                  <Check className="w-3.5 h-3.5" /> Done
                </span>
              ) : (
                <span className="text-gray-600 text-xs shrink-0">Pending</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==========================================
// STEP 4: VIDEO PREVIEW / CANVAS
// ==========================================

type OverlayStyle = 1 | 2;

interface OverlaySettings {
  scoreA: number;
  scoreB: number;
  roleA: string;
  roleB: string;
  showScores: boolean;
  showTimer: boolean;
  showTopic: boolean;
  showWaveform: boolean;
  showTranscript: boolean;
}

function WaveformBars({ color, side }: { color: string; side: "left" | "right" }) {
  const bars = [3, 6, 10, 7, 12, 5, 8, 11, 4, 9, 6, 13, 7, 5, 10];
  return (
    <div className={`flex items-end gap-0.5 h-8 ${side === "right" ? "flex-row-reverse" : ""}`}>
      {bars.map((h, i) => (
        <motion.div
          key={i}
          animate={{ height: [`${h * 4}%`, `${Math.min(100, h * 8)}%`, `${h * 4}%`] }}
          transition={{ repeat: Infinity, duration: 0.3 + i * 0.04, ease: "easeInOut" }}
          className={`w-[3px] rounded-full ${color}`}
        />
      ))}
    </div>
  );
}

function Step4Preview({ project }: { project: any }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [style, setStyle] = useState<OverlayStyle>(1);
  const [bgImage, setBgImage] = useState(project.backgroundImage || DEMO_BG);
  const [settings, setSettings] = useState<OverlaySettings>({
    scoreA: 12.5,
    scoreB: 7.2,
    roleA: "SUPPORTER",
    roleB: "OPPONENT",
    showScores: true,
    showTimer: true,
    showTopic: true,
    showWaveform: true,
    showTranscript: true,
  });
  const [editingSettings, setEditingSettings] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const updateProject = useUpdateProject();
  const intervalRef = useRef<any>(null);

  const dialogues: any[] = project.dialogues || [];
  const current = dialogues[currentIdx] || { text: "No dialogues available.", speaker: "A" };
  const isASpeaking = current.speaker === "A";

  // Timer: counts up from 00:00 during playback
  const [timerSec, setTimerSec] = useState(0);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => setTimerSec((s) => s + 1), 1000);
      intervalRef.current = setInterval(() => {
        setCurrentIdx((prev) => (prev + 1) % (dialogues.length || 1));
      }, 5000);
    } else {
      clearInterval(timerRef.current);
      clearInterval(intervalRef.current);
    }
    return () => { clearInterval(timerRef.current); clearInterval(intervalRef.current); };
  }, [isPlaying, dialogues.length]);

  const fmtTimer = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

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

  const updateSetting = <K extends keyof OverlaySettings>(key: K, val: OverlaySettings[K]) => {
    setSettings((s) => ({ ...s, [key]: val }));
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col h-[calc(100vh-130px)] gap-4">
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">Video Canvas</h2>
          <p className="text-muted-foreground text-sm">Customize overlay style, edit labels, upload background.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Style Switcher */}
          <div className="flex bg-black/40 rounded-xl border border-white/10 p-1 gap-1">
            {([1, 2] as OverlayStyle[]).map((s) => (
              <button
                key={s}
                onClick={() => setStyle(s)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  style === s ? "bg-primary text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                Style {s}
              </button>
            ))}
          </div>
          {/* Settings toggle */}
          <button
            onClick={() => setEditingSettings(!editingSettings)}
            className="px-4 py-2 rounded-xl border border-white/20 text-gray-300 hover:bg-white/5 text-sm flex items-center gap-2"
          >
            <Settings className="w-4 h-4" /> {editingSettings ? "Close" : "Edit Overlay"}
          </button>
          {/* Upload BG */}
          <button
            onClick={() => fileRef.current?.click()}
            className="px-4 py-2 rounded-xl border border-white/20 text-gray-300 hover:bg-white/5 text-sm flex items-center gap-2"
          >
            <ImageIcon className="w-4 h-4" /> Background
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
          {/* Export */}
          <button className="px-5 py-2 bg-primary text-white font-bold rounded-xl shadow-[0_0_20px_rgba(124,58,237,0.4)] hover:shadow-[0_0_30px_rgba(124,58,237,0.6)] transition-all text-sm flex items-center gap-2">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Settings Panel */}
        <AnimatePresence>
          {editingSettings && (
            <motion.div
              initial={{ opacity: 0, x: -20, width: 0 }}
              animate={{ opacity: 1, x: 0, width: "280px" }}
              exit={{ opacity: 0, x: -20, width: 0 }}
              className="glass-panel rounded-2xl p-4 overflow-y-auto shrink-0 space-y-5"
              style={{ minWidth: "280px" }}
            >
              <h3 className="text-white font-bold text-sm uppercase tracking-wider">Overlay Settings</h3>

              {/* Roles */}
              <div className="space-y-2">
                <label className="text-xs text-gray-400 uppercase tracking-wider">Speaker Roles</label>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-indigo-400 mb-1 block">{project.speakerAName} Role</label>
                    <input
                      value={settings.roleA}
                      onChange={(e) => updateSetting("roleA", e.target.value)}
                      className="w-full glass-input px-3 py-2 rounded-lg text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-red-400 mb-1 block">{project.speakerBName} Role</label>
                    <input
                      value={settings.roleB}
                      onChange={(e) => updateSetting("roleB", e.target.value)}
                      className="w-full glass-input px-3 py-2 rounded-lg text-white text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Scores */}
              <div className="space-y-2">
                <label className="text-xs text-gray-400 uppercase tracking-wider">Scores</label>
                <div className="space-y-2">
                  {(["A", "B"] as const).map((sp) => {
                    const key = sp === "A" ? "scoreA" : "scoreB";
                    const score = settings[key] as number;
                    return (
                      <div key={sp} className="flex items-center gap-2">
                        <span className={`text-xs w-20 ${sp === "A" ? "text-indigo-400" : "text-red-400"}`}>
                          {sp === "A" ? project.speakerAName : project.speakerBName}
                        </span>
                        <button
                          onClick={() => updateSetting(key, Math.max(0, +(score - 0.5).toFixed(1)))}
                          className="w-6 h-6 rounded bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-white font-mono text-sm w-10 text-center">{score.toFixed(1)}</span>
                        <button
                          onClick={() => updateSetting(key, Math.min(20, +(score + 0.5).toFixed(1)))}
                          className="w-6 h-6 rounded bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2">
                <label className="text-xs text-gray-400 uppercase tracking-wider">Visible Elements</label>
                {(
                  [
                    { key: "showScores", label: "Score Panels" },
                    { key: "showTopic", label: "Topic Bar" },
                    { key: "showTimer", label: "Timer" },
                    { key: "showWaveform", label: "Waveform" },
                    { key: "showTranscript", label: "Transcript" },
                  ] as { key: keyof OverlaySettings; label: string }[]
                ).map(({ key, label }) => (
                  <label key={key} className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm text-gray-300">{label}</span>
                    <button
                      onClick={() => updateSetting(key, !settings[key])}
                      className={`w-10 h-5 rounded-full transition-all relative ${settings[key] ? "bg-primary" : "bg-white/20"}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${settings[key] ? "left-5" : "left-0.5"}`} />
                    </button>
                  </label>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Canvas */}
        <div className="flex-1 relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black min-h-0">
          {/* Background */}
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${bgImage})`, opacity: 0.7 }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />

          {style === 1 ? (
            <CanvasStyle1
              project={project}
              current={current}
              isASpeaking={isASpeaking}
              settings={settings}
              timerSec={timerSec}
              isPlaying={isPlaying}
            />
          ) : (
            <CanvasStyle2
              project={project}
              current={current}
              isASpeaking={isASpeaking}
              settings={settings}
              timerSec={timerSec}
              isPlaying={isPlaying}
            />
          )}

          {/* Playback Controls */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/70 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 z-50">
            <button
              onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
              className="p-1.5 text-white hover:bg-white/20 rounded-full transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="px-5 py-1.5 bg-white text-black font-bold rounded-full text-sm hover:bg-gray-200 flex items-center gap-2"
            >
              {isPlaying ? <><Pause className="w-4 h-4" /> Pause</> : <><Play className="w-4 h-4" /> Play</>}
            </button>
            <button
              onClick={() => setCurrentIdx(Math.min(dialogues.length - 1, currentIdx + 1))}
              className="p-1.5 text-white hover:bg-white/20 rounded-full transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
            <span className="text-gray-400 text-xs ml-2">
              {currentIdx + 1} / {dialogues.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// CANVAS STYLE 1 — Debate Panel Overlay
// (Matches reference image: side score panels + top topic bar + speech bubble)
// ==========================================
function CanvasStyle1({
  project, current, isASpeaking, settings, timerSec, isPlaying
}: {
  project: any; current: any; isASpeaking: boolean;
  settings: OverlaySettings; timerSec: number; isPlaying: boolean;
}) {
  const fmtTimer = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <>
      {/* === TOP BAR: Topic + Timer === */}
      {settings.showTopic && (
        <motion.div
          drag dragMomentum={false}
          className="absolute top-0 left-0 right-0 flex items-center justify-between z-20 cursor-move px-0"
        >
          {/* Topic Banner */}
          <div className="flex-1 bg-gradient-to-r from-amber-500/90 to-yellow-400/90 backdrop-blur-sm py-2 px-6 flex items-center justify-center">
            <span className="text-black font-black text-sm sm:text-base tracking-widest uppercase text-center">
              {project.topic}
            </span>
          </div>
          {/* Timer */}
          {settings.showTimer && (
            <div className="bg-black/90 backdrop-blur-sm px-5 py-2 font-mono text-white font-bold text-lg shrink-0">
              {fmtTimer(timerSec)}
            </div>
          )}
        </motion.div>
      )}

      {/* === LEFT PANEL: Speaker A (SUPPORTER) === */}
      {settings.showScores && (
        <motion.div
          drag dragMomentum={false}
          className="absolute left-0 top-10 bottom-14 w-20 flex flex-col items-center justify-between py-6 z-20 cursor-move"
        >
          <div className={`flex flex-col items-center w-full h-full bg-blue-600/80 backdrop-blur-sm py-4 px-2 transition-all duration-500 ${isASpeaking && isPlaying ? "brightness-110 shadow-[0_0_30px_rgba(59,130,246,0.7)]" : ""}`}>
            {/* Score */}
            <div className="text-white font-black text-3xl">{settings.scoreA.toFixed(1)}</div>
            <div className="w-10 h-0.5 bg-white/40 my-2" />
            {/* Speaker Name */}
            <div className="text-white font-bold text-xs text-center" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
              {project.speakerAName}
            </div>
            {/* Waveform */}
            {settings.showWaveform && isASpeaking && isPlaying && (
              <div className="mt-auto">
                <WaveformBars color="bg-white" side="left" />
              </div>
            )}
            {/* Role Label */}
            <div className="mt-auto text-white/80 font-bold text-[10px] tracking-widest" style={{ writingMode: "vertical-rl" }}>
              {settings.roleA}
            </div>
          </div>
        </motion.div>
      )}

      {/* === RIGHT PANEL: Speaker B (OPPONENT) === */}
      {settings.showScores && (
        <motion.div
          drag dragMomentum={false}
          className="absolute right-0 top-10 bottom-14 w-20 flex flex-col items-center z-20 cursor-move"
        >
          <div className={`flex flex-col items-center w-full h-full bg-rose-600/80 backdrop-blur-sm py-4 px-2 transition-all duration-500 ${!isASpeaking && isPlaying ? "brightness-110 shadow-[0_0_30px_rgba(239,68,68,0.7)]" : ""}`}>
            {/* Score */}
            <div className="text-white font-black text-3xl">{settings.scoreB.toFixed(1)}</div>
            <div className="w-10 h-0.5 bg-white/40 my-2" />
            {/* Speaker Name */}
            <div className="text-white font-bold text-xs text-center" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
              {project.speakerBName}
            </div>
            {/* Waveform */}
            {settings.showWaveform && !isASpeaking && isPlaying && (
              <div className="mt-auto">
                <WaveformBars color="bg-white" side="right" />
              </div>
            )}
            {/* Role Label */}
            <div className="mt-auto text-white/80 font-bold text-[10px] tracking-widest" style={{ writingMode: "vertical-rl" }}>
              {settings.roleB}
            </div>
          </div>
        </motion.div>
      )}

      {/* === CENTER: Active Speaker Indicator (above transcript) === */}
      <motion.div
        drag dragMomentum={false}
        className="absolute top-16 left-1/2 -translate-x-1/2 z-20 cursor-move"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={current.speaker}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className={`px-5 py-2 rounded-full font-bold text-sm tracking-wider ${
              isASpeaking
                ? "bg-blue-600/90 text-white border border-blue-400/50"
                : "bg-rose-600/90 text-white border border-rose-400/50"
            }`}
          >
            {isASpeaking ? `${project.speakerAName} · ${settings.roleA}` : `${project.speakerBName} · ${settings.roleB}`}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* === TRANSCRIPT / SPEECH BUBBLE === */}
      {settings.showTranscript && (
        <motion.div
          drag dragMomentum={false}
          className="absolute bottom-16 left-20 right-20 z-20 cursor-move"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={current.text}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`relative px-8 py-5 rounded-2xl backdrop-blur-lg border shadow-2xl ${
                isASpeaking
                  ? "bg-blue-900/60 border-blue-400/40"
                  : "bg-rose-900/60 border-rose-400/40"
              }`}
            >
              {/* Speech bubble arrow */}
              <div className={`absolute -top-2.5 ${isASpeaking ? "left-8" : "right-8"} w-5 h-5 rotate-45 ${
                isASpeaking ? "bg-blue-900/80 border-t border-l border-blue-400/40" : "bg-rose-900/80 border-t border-r border-rose-400/40"
              }`} />
              <p className="text-white text-base sm:text-xl font-bold leading-snug text-center drop-shadow-lg">
                {current.text}
              </p>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </>
  );
}

// ==========================================
// CANVAS STYLE 2 — Bottom Bar + Clean HUD
// ==========================================
function CanvasStyle2({
  project, current, isASpeaking, settings, timerSec, isPlaying
}: {
  project: any; current: any; isASpeaking: boolean;
  settings: OverlaySettings; timerSec: number; isPlaying: boolean;
}) {
  const fmtTimer = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <>
      {/* === TOP: Topic + Timer === */}
      {settings.showTopic && (
        <motion.div
          drag dragMomentum={false}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-20 cursor-move"
        >
          <div className="flex items-center gap-3 bg-black/70 backdrop-blur-md rounded-2xl border border-white/10 px-6 py-2.5">
            <span className="text-white font-bold text-sm tracking-wide uppercase">{project.topic}</span>
            {settings.showTimer && (
              <>
                <div className="w-px h-4 bg-white/30" />
                <span className="text-yellow-400 font-mono font-bold text-sm">{fmtTimer(timerSec)}</span>
              </>
            )}
          </div>
        </motion.div>
      )}

      {/* === SIDE WAVEFORM INDICATORS === */}
      {settings.showWaveform && isPlaying && (
        <>
          {isASpeaking && (
            <motion.div
              drag dragMomentum={false}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="absolute left-6 top-1/2 -translate-y-1/2 z-20 cursor-move flex flex-col items-center gap-2"
            >
              <div className="text-indigo-300 text-xs font-bold tracking-wider">{project.speakerAName}</div>
              <WaveformBars color="bg-indigo-400" side="left" />
            </motion.div>
          )}
          {!isASpeaking && (
            <motion.div
              drag dragMomentum={false}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="absolute right-6 top-1/2 -translate-y-1/2 z-20 cursor-move flex flex-col items-center gap-2"
            >
              <div className="text-cyan-300 text-xs font-bold tracking-wider">{project.speakerBName}</div>
              <WaveformBars color="bg-cyan-400" side="right" />
            </motion.div>
          )}
        </>
      )}

      {/* === BOTTOM BAR: Scores + Role Labels === */}
      {settings.showScores && (
        <motion.div
          drag dragMomentum={false}
          className="absolute bottom-14 left-0 right-0 z-20 cursor-move"
        >
          <div className="flex items-stretch">
            {/* Speaker A bar */}
            <div className={`flex-1 flex items-center gap-4 px-6 py-3 bg-blue-700/80 backdrop-blur-sm transition-all ${isASpeaking && isPlaying ? "brightness-110" : "brightness-75"}`}>
              <div>
                <div className="text-white font-black text-2xl">{settings.scoreA.toFixed(1)}</div>
                <div className="text-blue-200 text-xs font-bold tracking-wider">{settings.roleA}</div>
              </div>
              <div className="flex-1">
                <div className="text-white font-bold text-sm">{project.speakerAName}</div>
              </div>
              {isASpeaking && isPlaying && settings.showWaveform && (
                <WaveformBars color="bg-blue-200" side="left" />
              )}
            </div>
            {/* Divider */}
            <div className="w-px bg-white/20" />
            {/* Speaker B bar */}
            <div className={`flex-1 flex items-center gap-4 px-6 py-3 bg-rose-700/80 backdrop-blur-sm flex-row-reverse transition-all ${!isASpeaking && isPlaying ? "brightness-110" : "brightness-75"}`}>
              <div className="text-right">
                <div className="text-white font-black text-2xl">{settings.scoreB.toFixed(1)}</div>
                <div className="text-rose-200 text-xs font-bold tracking-wider">{settings.roleB}</div>
              </div>
              <div className="flex-1 text-right">
                <div className="text-white font-bold text-sm">{project.speakerBName}</div>
              </div>
              {!isASpeaking && isPlaying && settings.showWaveform && (
                <WaveformBars color="bg-rose-200" side="right" />
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* === TRANSCRIPT — Center card === */}
      {settings.showTranscript && (
        <motion.div
          drag dragMomentum={false}
          className="absolute bottom-32 left-12 right-12 z-20 cursor-move"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={current.text}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="bg-black/75 backdrop-blur-xl border border-white/10 rounded-2xl px-8 py-5 shadow-2xl"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full ${isASpeaking ? "bg-blue-400" : "bg-rose-400"}`} />
                <span className={`text-xs font-bold tracking-wider ${isASpeaking ? "text-blue-400" : "text-rose-400"}`}>
                  {isASpeaking ? project.speakerAName : project.speakerBName}
                </span>
              </div>
              <p className="text-white text-lg sm:text-2xl font-bold leading-snug">{current.text}</p>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </>
  );
}
