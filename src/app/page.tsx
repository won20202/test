"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { 
  Utensils, 
  Flame, 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw, 
  Play, 
  Pause, 
  Settings, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  Clock, 
  UserCheck, 
  AlertCircle 
} from "lucide-react";
import confetti from "canvas-confetti";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

interface Student {
  id: string;
  student_number: number;
  name: string;
}

interface Meal {
  mealType: string;
  dishes: string[];
  calories: string;
  nutrition: string[];
}

export default function Home() {
  // Common states
  const [time, setTime] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [isSupabaseActive, setIsSupabaseActive] = useState<boolean>(false);

  // Meal States
  const [mealDate, setMealDate] = useState<Date>(new Date());
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loadingMeal, setLoadingMeal] = useState<boolean>(true);
  const [mealMessage, setMealMessage] = useState<string>("");
  const [showNutrition, setShowNutrition] = useState<{ [key: number]: boolean }>({});

  // Roulette States
  const [wheelStudents, setWheelStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [avoidDuplicate, setAvoidDuplicate] = useState<boolean>(false);
  const [drawnStudentIds, setDrawnStudentIds] = useState<string[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rotationAngleRef = useRef<number>(0);
  const spinRequestRef = useRef<number | null>(null);

  // Timer States
  const [timerSeconds, setTimerSeconds] = useState<number>(180); // 3 mins default
  const [timerInputMin, setTimerInputMin] = useState<number>(3);
  const [timerInputSec, setTimerInputSec] = useState<number>(0);
  const [timerActive, setTimerActive] = useState<boolean>(false);
  const [timerInitialSeconds, setTimerInitialSeconds] = useState<number>(180);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastTickTimeRef = useRef<number>(0);

  // Sound Synthesizers using Web Audio API
  const getAudioContext = () => {
    if (typeof window === "undefined") return null;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const playTick = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = getAudioContext();
      if (!audioCtx) return;
      
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.05);
    } catch (e) {
      console.error(e);
    }
  };

  const playWin = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = getAudioContext();
      if (!audioCtx) return;

      const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C major chord arpeggio
      notes.forEach((freq, index) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + index * 0.08);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime + index * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + index * 0.08 + 0.4);
        osc.start(audioCtx.currentTime + index * 0.08);
        osc.stop(audioCtx.currentTime + index * 0.08 + 0.4);
      });
    } catch (e) {
      console.error(e);
    }
  };

  const playAlarm = () => {
    try {
      const audioCtx = getAudioContext();
      if (!audioCtx) return;

      // Schedule a 4.5-second ringing alarm (repeating dual beeps)
      for (let i = 0; i < 6; i++) {
        const timeBase = audioCtx.currentTime + i * 0.8;
        
        // High alert beep 1
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        osc1.type = "square";
        osc1.frequency.setValueAtTime(987.77, timeBase); // B5 note
        gain1.gain.setValueAtTime(0.12, timeBase);
        gain1.gain.exponentialRampToValueAtTime(0.001, timeBase + 0.25);
        osc1.start(timeBase);
        osc1.stop(timeBase + 0.25);
        
        // High alert beep 2
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.type = "square";
        osc2.frequency.setValueAtTime(987.77, timeBase + 0.3);
        gain2.gain.setValueAtTime(0.12, timeBase + 0.3);
        gain2.gain.exponentialRampToValueAtTime(0.001, timeBase + 0.55);
        osc2.start(timeBase + 0.3);
        osc2.stop(timeBase + 0.55);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Clock effect
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("ko-KR", {
          hour12: true,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
      setDateStr(
        now.toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "long",
          day: "numeric",
          weekday: "short",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch student list (Supabase with localStorage fallback)
  useEffect(() => {
    const loadStudents = async () => {
      let loadedStudents: Student[] = [];
      setIsSupabaseActive(isSupabaseConfigured);

      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase
            .from("students")
            .select("*")
            .order("student_number", { ascending: true });
          if (!error && data && data.length > 0) {
            loadedStudents = data;
          }
        } catch (e) {
          console.error("Supabase load error, falling back to local:", e);
        }
      }

      // LocalStorage Fallback if empty
      if (loadedStudents.length === 0) {
        const local = localStorage.getItem("class_students");
        if (local) {
          try {
            loadedStudents = JSON.parse(local);
          } catch (e) {
            console.error(e);
          }
        }
      }

      // Default Sample list if both empty
      if (loadedStudents.length === 0) {
        loadedStudents = Array.from({ length: 25 }, (_, i) => ({
          id: `default-${i + 1}`,
          student_number: i + 1,
          name: `홍길동${i + 1}`,
        }));
      }

      setStudents(loadedStudents);
    };

    loadStudents();
  }, []);

  // Filter roulette student list based on duplicates avoidance
  useEffect(() => {
    if (avoidDuplicate) {
      const filtered = students.filter(s => !drawnStudentIds.includes(s.id));
      setWheelStudents(filtered);
    } else {
      setWheelStudents(students);
    }
  }, [students, avoidDuplicate, drawnStudentIds]);

  // Fetch meal info on date change
  useEffect(() => {
    const fetchMeal = async () => {
      setLoadingMeal(true);
      setMealMessage("");
      
      const year = mealDate.getFullYear();
      const month = String(mealDate.getMonth() + 1).padStart(2, "0");
      const day = String(mealDate.getDate()).padStart(2, "0");
      const dateString = `${year}${month}${day}`;

      try {
        const res = await fetch(`/api/meal?date=${dateString}`);
        const data = await res.json();

        if (data.success) {
          setMeals(data.meals || []);
          if (data.meals.length === 0) {
            setMealMessage(data.message || "오늘의 급식이 없습니다. 🍕");
          }
        } else {
          setMeals([]);
          setMealMessage(data.message || "급식 정보를 가져올 수 없습니다.");
        }
      } catch (err) {
        setMeals([]);
        setMealMessage("급식 데이터 호출 오류가 발생했습니다.");
      } finally {
        setLoadingMeal(false);
      }
    };

    fetchMeal();
  }, [mealDate]);

  // Canvas drawing for roulette
  const drawWheel = (angle: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const radius = center - 15;

    ctx.clearRect(0, 0, size, size);

    const list = wheelStudents.length > 0 ? wheelStudents : students;

    if (list.length === 0) {
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, 2 * Math.PI);
      ctx.fillStyle = "#1e293b";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#334155";
      ctx.stroke();
      ctx.fillStyle = "#94a3b8";
      ctx.font = "16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("등록된 학생이 없습니다.", center, center);
      return;
    }

    const sliceAngle = (2 * Math.PI) / list.length;
    
    list.forEach((student, index) => {
      const startAngle = angle + index * sliceAngle;
      const endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, startAngle, endAngle);
      ctx.closePath();

      // Deep Ocean palette
      const colors = [
        "#0f172a", "#1e293b", "#0f766e", "#0d9488", 
        "#0369a1", "#0284c7", "#1e3a8a", "#2563eb",
        "#115e59", "#134e4a", "#075985", "#0c4a6e"
      ];
      ctx.fillStyle = colors[index % colors.length];
      ctx.fill();

      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.stroke();

      // Text
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.fillStyle = "#f8fafc";
      
      // Dynamic font size depending on student count
      let fontSize = "14px";
      if (list.length > 30) fontSize = "10px";
      else if (list.length > 15) fontSize = "12px";

      ctx.font = `bold ${fontSize} sans-serif`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(`${student.student_number} ${student.name}`, radius - 15, 0);
      ctx.restore();
    });

    // Center Hub
    ctx.beginPath();
    ctx.arc(center, center, 22, 0, 2 * Math.PI);
    ctx.fillStyle = "#0f172a";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#10b981"; // Sea emerald accent
    ctx.stroke();

    // Center core light
    ctx.beginPath();
    ctx.arc(center, center, 8, 0, 2 * Math.PI);
    ctx.fillStyle = "#34d399";
    ctx.fill();
  };

  useEffect(() => {
    drawWheel(rotationAngleRef.current);
  }, [wheelStudents, students]);

  // Roulette Spin Handler
  const spinWheel = () => {
    if (isSpinning) return;
    const list = wheelStudents.length > 0 ? wheelStudents : students;
    if (list.length === 0) return;

    getAudioContext(); // pre-unlock AudioContext on user click

    setSelectedStudent(null);
    setIsSpinning(true);

    const spinDuration = 3500; // 3.5 seconds
    const startTimestamp = performance.now();
    const startAngle = rotationAngleRef.current;
    
    // Add 4-7 complete rotations + random angle
    const targetRotation = startAngle + 8 * Math.PI + Math.random() * 2 * Math.PI;
    
    let lastTickAngle = startAngle;
    const tickInterval = (2 * Math.PI) / list.length;

    const animateSpin = (now: number) => {
      const elapsed = now - startTimestamp;
      const progress = Math.min(elapsed / spinDuration, 1);
      
      // Ease out cubic function for smooth stop
      const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
      const currentAngle = startAngle + (targetRotation - startAngle) * easeOut(progress);

      rotationAngleRef.current = currentAngle;
      drawWheel(currentAngle);

      // Play tick sound when moving past a slice, with throttling to prevent audio delay
      if (Math.abs(currentAngle - lastTickAngle) >= tickInterval) {
        const nowMs = performance.now();
        // Play tick sound at most once every 65ms to prevent audio queue overload
        if (nowMs - lastTickTimeRef.current > 65) {
          playTick();
          lastTickTimeRef.current = nowMs;
        }
        lastTickAngle = currentAngle;
      }

      if (progress < 1) {
        spinRequestRef.current = requestAnimationFrame(animateSpin);
      } else {
        setIsSpinning(false);
        spinRequestRef.current = null;

        // Calculate Winner
        // Arrow is pointing from the top (12 o'clock = 3/2 * Math.PI radians)
        const normalizedAngle = (currentAngle % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
        const relativeArrowAngle = (1.5 * Math.PI - normalizedAngle + 2 * Math.PI) % (2 * Math.PI);
        const sliceAngle = (2 * Math.PI) / list.length;
        const winnerIndex = Math.floor(relativeArrowAngle / sliceAngle) % list.length;
        const winner = list[winnerIndex];

        setSelectedStudent(winner);
        playWin();

        // Fireworks Confetti
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ["#10b981", "#06b6d4", "#3b82f6", "#ffffff"]
        });

        // Add to duplicate tracking
        if (avoidDuplicate) {
          setDrawnStudentIds(prev => [...prev, winner.id]);
        }
      }
    };

    spinRequestRef.current = requestAnimationFrame(animateSpin);
  };

  const resetDrawnStudents = () => {
    setDrawnStudentIds([]);
    setSelectedStudent(null);
  };

  // Timer Handlers
  useEffect(() => {
    if (timerActive) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            setTimerActive(false);
            playAlarm();
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [timerActive]);

  const toggleTimer = () => {
    if (timerSeconds <= 0) return;
    getAudioContext(); // pre-unlock AudioContext on user click
    setTimerActive(!timerActive);
  };

  const resetTimer = () => {
    setTimerActive(false);
    setTimerSeconds(timerInitialSeconds);
  };

  const handleTimerInputChange = () => {
    const total = timerInputMin * 60 + timerInputSec;
    setTimerSeconds(total);
    setTimerInitialSeconds(total);
    setTimerActive(false);
  };

  const applyPreset = (minutes: number) => {
    getAudioContext(); // pre-unlock AudioContext on user click
    setTimerInputMin(minutes);
    setTimerInputSec(0);
    setTimerSeconds(minutes * 60);
    setTimerInitialSeconds(minutes * 60);
    setTimerActive(false);
  };

  const formatTimerTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // Timer circle math
  const strokeDash = 2 * Math.PI * 90; // Radius 90 SVG circle
  const strokeDashOffset = timerInitialSeconds > 0 
    ? strokeDash - (timerSeconds / timerInitialSeconds) * strokeDash : strokeDash;

  // Change Date helper
  const adjustMealDate = (days: number) => {
    const newDate = new Date(mealDate);
    newDate.setDate(mealDate.getDate() + days);
    setMealDate(newDate);
  };

  const formatMealDateStr = (date: Date) => {
    return date.toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
      weekday: "short"
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-white">
      {/* Dynamic Background Effect */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/30 via-slate-950 to-slate-950 pointer-events-none z-0" />
      
      {/* Navigation */}
      <header className="relative z-10 w-full backdrop-blur-md bg-slate-950/60 border-b border-slate-800/80 sticky top-0 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-blue-600 flex items-center justify-center font-bold text-lg shadow-lg shadow-emerald-500/20 text-white">
            2-2
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
              오션중학교 2학년 2반
            </h1>
            <p className="text-xs text-slate-400 font-medium">우리들의 활기찬 학급 홈피</p>
          </div>
        </div>

        {/* Live Digital Clock */}
        <div className="flex items-center gap-3 bg-slate-900/80 px-5 py-2 rounded-2xl border border-slate-800/50 shadow-inner">
          <Clock className="w-4 h-4 text-emerald-400 animate-pulse" />
          <div className="text-right">
            <div className="text-sm font-semibold tracking-wider font-mono text-emerald-400">{time || "--:--:--"}</div>
            <div className="text-[10px] text-slate-400 font-medium">{dateStr || "로딩 중..."}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isSupabaseActive && (
            <div className="flex items-center gap-1 text-amber-500 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20 text-xs font-semibold">
              <AlertCircle className="w-3.5 h-3.5" />
              로컬 테스트 모드
            </div>
          )}
          <Link 
            href="/admin" 
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-slate-800 hover:bg-slate-700/80 transition-all border border-slate-700 rounded-xl hover:shadow-lg hover:shadow-slate-900/40"
          >
            <Settings className="w-4 h-4 text-emerald-400" />
            관리자 모드
          </Link>
        </div>
      </header>

      {/* Main Content Dashboard */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Card 1: 오늘의 급식 (Left) */}
          <section className="lg:col-span-4 backdrop-blur-md bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 shadow-2xl flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400">
                  <Utensils className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-white tracking-wide">오늘의 급식</h2>
              </div>
              
              {/* Date controllers */}
              <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
                <button 
                  onClick={() => adjustMealDate(-1)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                  title="이전날"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-slate-300 font-mono px-1">
                  {formatMealDateStr(mealDate)}
                </span>
                <button 
                  onClick={() => adjustMealDate(1)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                  title="다음날"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {loadingMeal ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <div className="w-10 h-10 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                <p className="text-sm text-slate-400 font-medium">NEIS 급식 정보를 불러오는 중...</p>
              </div>
            ) : meals.length > 0 ? (
              <div className="flex-grow space-y-6 overflow-y-auto max-h-[480px] pr-1">
                {meals.map((meal, index) => (
                  <div key={index} className="bg-slate-900/80 rounded-2xl border border-slate-800/60 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold bg-orange-500/10 text-orange-400 px-2.5 py-1 rounded-lg border border-orange-500/20">
                        {meal.mealType}
                      </span>
                      <div className="flex items-center gap-1 text-slate-400 text-xs font-medium">
                        <Flame className="w-3.5 h-3.5 text-orange-500" />
                        <span>{meal.calories}</span>
                      </div>
                    </div>

                    <ul className="space-y-2 text-sm text-slate-300">
                      {meal.dishes.map((dish, dIdx) => (
                        <li key={dIdx} className="flex items-center gap-2 py-1 border-b border-slate-800/40 last:border-b-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-400/70" />
                          <span className="font-semibold">{dish}</span>
                        </li>
                      ))}
                    </ul>

                    {/* Collapsible Nutrition Info */}
                    <div className="pt-2">
                      <button
                        onClick={() => setShowNutrition(prev => ({ ...prev, [index]: !prev[index] }))}
                        className="text-[11px] font-bold text-slate-500 hover:text-slate-300 transition-all flex items-center gap-1"
                      >
                        {showNutrition[index] ? "영양 정보 접기 ▲" : "영양 정보 상세 보기 ▼"}
                      </button>
                      
                      {showNutrition[index] && (
                        <div className="mt-3 p-3 bg-slate-950/80 rounded-xl text-[11px] text-slate-400 grid grid-cols-2 gap-x-3 gap-y-1.5 border border-slate-800/40">
                          {meal.nutrition.map((ntr, nIdx) => (
                            <div key={nIdx} className="truncate">{ntr}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <span className="text-4xl mb-3">🍕</span>
                <p className="text-sm font-semibold text-slate-400">{mealMessage}</p>
                <button 
                  onClick={() => setMealDate(new Date())} 
                  className="mt-4 text-xs font-semibold text-orange-400 hover:underline"
                >
                  오늘 날짜로 이동
                </button>
              </div>
            )}
          </section>

          {/* Card 2: 발표 룰렛 (Center) */}
          <section className="lg:col-span-5 backdrop-blur-md bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 shadow-2xl flex flex-col items-center min-h-[500px]">
            <div className="w-full flex items-center justify-between border-b border-slate-800/80 pb-4 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-white tracking-wide">발표자 추첨 룰렛</h2>
              </div>

              {/* Sound and duplicate controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`p-2 rounded-xl transition ${soundEnabled ? "bg-slate-800 text-emerald-400" : "bg-slate-900/60 text-slate-600"}`}
                  title={soundEnabled ? "효과음 끄기" : "효과음 켜기"}
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Wheel Canvas Container */}
            <div className="relative w-[280px] h-[280px] flex items-center justify-center">
              {/* Target Pointer arrow */}
              <div className="absolute top-[-8px] z-20 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[20px] border-t-emerald-400 drop-shadow-md" />
              
              <canvas
                ref={canvasRef}
                width={280}
                height={280}
                className="rounded-full shadow-2xl bg-slate-950 border border-slate-800"
              />
            </div>

            {/* Selection Result / Winner Panel */}
            <div className="w-full mt-5 min-h-[52px] flex items-center justify-center">
              {isSpinning ? (
                <div className="text-sm font-semibold text-emerald-400 animate-pulse tracking-wide">
                  두구두구... 룰렛 회전 중! 🎡
                </div>
              ) : selectedStudent ? (
                <div className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500/10 via-emerald-500/20 to-emerald-500/10 border border-emerald-500/30 rounded-2xl shadow-lg">
                  <span className="text-xs font-bold text-emerald-400 font-mono">당첨 🎉</span>
                  <span className="text-lg font-black text-white tracking-wider">
                    {selectedStudent.student_number}번 {selectedStudent.name}
                  </span>
                </div>
              ) : (
                <div className="text-xs text-slate-400 text-center font-medium">
                  스핀 버튼을 클릭하여 발표자를 선정하세요!
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="w-full mt-4 space-y-4">
              <button
                onClick={spinWheel}
                disabled={isSpinning || (wheelStudents.length === 0 && students.length === 0)}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-slate-800 disabled:to-slate-800 text-white font-bold rounded-2xl shadow-xl transition-all active:scale-[0.98] disabled:cursor-not-allowed text-sm tracking-wider"
              >
                룰렛 돌리기 (SPIN)
              </button>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950/80 p-3 rounded-2xl border border-slate-900 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-300">
                  <input
                    type="checkbox"
                    checked={avoidDuplicate}
                    onChange={(e) => setAvoidDuplicate(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0 focus:ring-offset-0 w-4 h-4"
                  />
                  <span>한번 뽑힌 학생 제외</span>
                </label>

                {avoidDuplicate && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-400">
                      남은 인원: {wheelStudents.length}명 / 제외됨: {drawnStudentIds.length}명
                    </span>
                    {drawnStudentIds.length > 0 && (
                      <button
                        onClick={resetDrawnStudents}
                        className="text-[10px] bg-slate-800 hover:bg-slate-700/80 text-emerald-400 font-bold px-2 py-1 rounded border border-slate-700 transition"
                      >
                        기록 초기화
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Card 3: 타이머 (Right) */}
          <section className="lg:col-span-4 backdrop-blur-md bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 shadow-2xl flex flex-col items-center min-h-[500px]">
            <div className="w-full flex items-center justify-between border-b border-slate-800/80 pb-4 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                  <Clock className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-white tracking-wide">학급 타이머</h2>
              </div>
            </div>

            {/* Circle Progress Timer Visualizer */}
            <div className="relative w-[210px] h-[210px] flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                {/* Background Ring */}
                <circle
                  cx="105"
                  cy="105"
                  r="90"
                  className="stroke-slate-800 fill-none"
                  strokeWidth="8"
                />
                {/* Foreground Progress Ring */}
                <circle
                  cx="105"
                  cy="105"
                  r="90"
                  className="stroke-blue-500 fill-none transition-all duration-1000"
                  strokeWidth="8"
                  strokeDasharray={strokeDash}
                  strokeDashoffset={strokeDashOffset}
                  strokeLinecap="round"
                />
              </svg>

              {/* Digital Numbers in Circle */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-extrabold font-mono tracking-tight text-white drop-shadow-md">
                  {formatTimerTime(timerSeconds)}
                </span>
                <span className="text-[10px] text-slate-400 font-semibold tracking-wider mt-1">
                  {timerActive ? "집중하는 시간 ⏳" : "대기 중"}
                </span>
              </div>
            </div>

            {/* Presets */}
            <div className="grid grid-cols-4 gap-2 w-full mt-6">
              {[1, 3, 5, 10].map((preset) => (
                <button
                  key={preset}
                  onClick={() => applyPreset(preset)}
                  className="py-1.5 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-300 transition-all active:scale-95"
                >
                  {preset}분
                </button>
              ))}
            </div>

            {/* Custom Input */}
            <div className="flex items-center gap-2 w-full mt-4 bg-slate-950/80 p-2.5 rounded-2xl border border-slate-900">
              <div className="flex items-center gap-1.5 flex-1">
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={timerInputMin}
                  onChange={(e) => setTimerInputMin(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-11 bg-slate-900 border border-slate-800 text-slate-100 text-center rounded-lg py-1 font-mono text-sm focus:outline-none focus:border-blue-500"
                />
                <span className="text-xs text-slate-400 font-semibold">분</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={timerInputSec}
                  onChange={(e) => setTimerInputSec(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-11 bg-slate-900 border border-slate-800 text-slate-100 text-center rounded-lg py-1 font-mono text-sm focus:outline-none focus:border-blue-500"
                />
                <span className="text-xs text-slate-400 font-semibold">초</span>
              </div>

              <button
                onClick={handleTimerInputChange}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition active:scale-95"
              >
                적용
              </button>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3 w-full mt-4">
              <button
                onClick={toggleTimer}
                className={`py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-95 ${
                  timerActive 
                    ? "bg-amber-600 hover:bg-amber-500 shadow-amber-900/20" 
                    : "bg-blue-600 hover:bg-blue-500 shadow-blue-900/20"
                }`}
              >
                {timerActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{timerActive ? "일시정지" : "시작"}</span>
              </button>

              <button
                onClick={resetTimer}
                className="py-3.5 rounded-2xl bg-slate-850 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold text-sm flex items-center justify-center gap-2 transition active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                <span>초기화</span>
              </button>
            </div>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full text-center py-6 border-t border-slate-900/60 bg-slate-950/20 mt-8 text-xs text-slate-500 font-medium">
        © 2026 오션중학교 2학년 2반. Built beautifully with Next.js, Supabase & Tailwind CSS.
      </footer>
    </div>
  );
}
