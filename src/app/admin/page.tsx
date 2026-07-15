"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  Upload, 
  Download, 
  Trash2, 
  Plus, 
  User, 
  BookOpen, 
  Calendar, 
  Search, 
  FileText, 
  Edit, 
  Save, 
  Lock, 
  CheckCircle,
  Database,
  RefreshCw,
  LogOut,
  FolderOpen
} from "lucide-react";
import * as XLSX from "xlsx";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

interface Student {
  id: string;
  student_number: number;
  name: string;
}

interface CounselingLog {
  id: string;
  student_name: string;
  student_number: number;
  date: string;
  category: string;
  content: string;
  action_plan: string;
  created_at?: string;
}

export default function Admin() {
  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [password, setPassword] = useState<string>("");
  const [authError, setAuthError] = useState<string>("");
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);

  // Common UI states
  const [activeTab, setActiveTab] = useState<"students" | "logs">("students");
  const [students, setStudents] = useState<Student[]>([]);
  const [logs, setLogs] = useState<CounselingLog[]>([]);
  const [isSupabaseActive, setIsSupabaseActive] = useState<boolean>(false);

  // Student editor form states
  const [newNumber, setNewNumber] = useState<string>("");
  const [newName, setNewName] = useState<string>("");
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>("");

  // Counseling log form states
  const [logStudentId, setLogStudentId] = useState<string>("");
  const [logDate, setLogDate] = useState<string>("");
  const [logCategory, setLogCategory] = useState<string>("학업");
  const [logContent, setLogContent] = useState<string>("");
  const [logActionPlan, setLogActionPlan] = useState<string>("");
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  // Filters for counseling logs
  const [filterStudentName, setFilterStudentName] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("전체");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Details modal state
  const [selectedLogDetails, setSelectedLogDetails] = useState<CounselingLog | null>(null);

  // Notification popup
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Change Password States
  const [showChangePasswordModal, setShowChangePasswordModal] = useState<boolean>(false);
  const [isGoogleVerified, setIsGoogleVerified] = useState<boolean>(false);
  const [changeCurrentPassword, setChangeCurrentPassword] = useState<string>("");
  const [changeNewPassword, setChangeNewPassword] = useState<string>("");
  const [changeConfirmPassword, setChangeConfirmPassword] = useState<string>("");
  const [changePasswordError, setChangePasswordError] = useState<string>("");
  const [changePasswordLoading, setChangePasswordLoading] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const showNotification = (message: string, type: "success" | "error" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Check login state on mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const res = await fetch("/api/admin/auth");
        const data = await res.json();
        if (data.authenticated) {
          setIsAuthenticated(true);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
      } finally {
        setCheckingAuth(false);
      }
    };
    checkAuthStatus();
    setIsSupabaseActive(isSupabaseConfigured);
  }, []);

  // Fetch Students & Logs when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadStudents();
      loadLogs();
      
      // Set default log date to today
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, "0");
      const d = String(today.getDate()).padStart(2, "0");
      setLogDate(`${y}-${m}-${d}`);
    }
  }, [isAuthenticated]);

  // Google session listener and parameter check
  useEffect(() => {
    const checkGoogleSession = async () => {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session && session.user?.email === "won2020@ocean.ms.kr") {
            setIsGoogleVerified(true);
            
            // Auto-open modal if redirected with parameter
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get("action") === "change_password") {
              setShowChangePasswordModal(true);
              // Clean query parameters from URL
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          }
        } catch (e) {
          console.error("Google session check failed:", e);
        }
      }
    };
    checkGoogleSession();
  }, [isAuthenticated]);

  // --- Core Data Loaders ---
  const loadStudents = async () => {
    let list: Student[] = [];
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from("students")
          .select("*")
          .order("student_number", { ascending: true });
        if (!error && data) {
          list = data;
        }
      } catch (e) {
        console.error(e);
      }
    }

    if (list.length === 0) {
      const local = localStorage.getItem("class_students");
      if (local) {
        try { list = JSON.parse(local); } catch (e) { console.error(e); }
      }
    }

    setStudents(list);
  };

  const loadLogs = async () => {
    let list: CounselingLog[] = [];
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from("counseling_logs")
          .select("*")
          .order("date", { ascending: false });
        if (!error && data) {
          list = data;
        }
      } catch (e) {
        console.error(e);
      }
    }

    if (list.length === 0) {
      const local = localStorage.getItem("counseling_logs");
      if (local) {
        try { list = JSON.parse(local); } catch (e) { console.error(e); }
      }
    }

    setLogs(list);
  };

  // --- Auth Handlers ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsAuthenticated(true);
        showNotification("로그인 성공");
      } else {
        setAuthError(data.message || "비밀번호가 틀렸습니다.");
      }
    } catch (err) {
      setAuthError("서버 연결 실패. 비밀번호를 다시 확인하세요.");
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/auth", { method: "DELETE" });
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.signOut();
      }
      setIsAuthenticated(false);
      setIsGoogleVerified(false);
      setPassword("");
      showNotification("로그아웃 되었습니다.");
    } catch (err) {
      console.error(err);
    }
  };

  const openChangePasswordModal = async () => {
    setChangeCurrentPassword("");
    setChangeNewPassword("");
    setChangeConfirmPassword("");
    setChangePasswordError("");
    setIsGoogleVerified(false);
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {}
    }
    setShowChangePasswordModal(true);
  };

  const closeChangePasswordModal = async () => {
    setShowChangePasswordModal(false);
    setIsGoogleVerified(false);
    setChangeCurrentPassword("");
    setChangeNewPassword("");
    setChangeConfirmPassword("");
    setChangePasswordError("");
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {}
    }
  };

  const handleGoogleVerify = async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        // Sign out first to ensure we request a fresh OAuth login
        await supabase.auth.signOut();
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: window.location.origin + "/admin?action=change_password",
            queryParams: {
              prompt: "select_account" // Forces Google to show the account selector
            }
          },
        });
        if (error) {
          setChangePasswordError("구글 로그인 호출 실패: " + error.message);
        }
      } catch (err) {
        setChangePasswordError("구글 로그인 실패. 설정 상태를 확인해 주세요.");
      }
    } else {
      setChangePasswordError("수파베이스 클라우드가 연동되지 않았습니다.");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePasswordError("");

    if (!isGoogleVerified) {
      setChangePasswordError("관리자 구글 로그인 인증이 완료되지 않았습니다.");
      return;
    }

    if (changeNewPassword !== changeConfirmPassword) {
      setChangePasswordError("새 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    if (changeNewPassword.length < 4) {
      setChangePasswordError("비밀번호는 최소 4자 이상이어야 합니다.");
      return;
    }

    setChangePasswordLoading(true);

    try {
      let token = "";
      if (isSupabaseConfigured && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        token = session?.access_token || "";
      }

      if (!token) {
        setChangePasswordError("구글 로그인 인증 토큰이 존재하지 않습니다. 본인 인증을 다시 진행해 주세요.");
        setChangePasswordLoading(false);
        return;
      }

      const res = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: changeCurrentPassword,
          newPassword: changeNewPassword,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showNotification("비밀번호가 성공적으로 변경되었습니다.");
        await closeChangePasswordModal();
      } else {
        setChangePasswordError(data.message || "비밀번호 변경에 실패했습니다.");
      }
    } catch (err) {
      setChangePasswordError("서버 연결 실패. 네트워크 상태를 확인하세요.");
    } finally {
      setChangePasswordLoading(false);
    }
  };

  // --- Student Management Functions ---
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNumber || !newName) return;

    const num = parseInt(newNumber);
    if (isNaN(num)) {
      showNotification("학번은 숫자만 가능합니다.", "error");
      return;
    }

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from("students")
        .insert({ student_number: num, name: newName });
      if (error) {
        showNotification("학생 등록 실패: " + error.message, "error");
        return;
      }
    } else {
      const newStudent: Student = {
        id: `local-${Date.now()}`,
        student_number: num,
        name: newName
      };
      const updated = [...students, newStudent].sort((a, b) => a.student_number - b.student_number);
      localStorage.setItem("class_students", JSON.stringify(updated));
    }

    setNewNumber("");
    setNewName("");
    showNotification("학생 등록 성공");
    loadStudents();
  };

  const handleStartEditStudent = (student: Student) => {
    setEditingStudentId(student.id);
    setEditName(student.name);
  };

  const handleSaveEditStudent = async (student: Student) => {
    if (!editName.trim()) return;

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from("students")
        .update({ name: editName })
        .eq("id", student.id);
      if (error) {
        showNotification("수정 실패: " + error.message, "error");
        return;
      }
    } else {
      const updated = students.map(s => s.id === student.id ? { ...s, name: editName } : s);
      localStorage.setItem("class_students", JSON.stringify(updated));
    }

    setEditingStudentId(null);
    showNotification("학생 정보 수정 성공");
    loadStudents();
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm("정말 이 학생을 명단에서 삭제하시겠습니까?")) return;

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from("students")
        .delete()
        .eq("id", id);
      if (error) {
        showNotification("삭제 실패: " + error.message, "error");
        return;
      }
    } else {
      const updated = students.filter(s => s.id !== id);
      localStorage.setItem("class_students", JSON.stringify(updated));
    }

    showNotification("학생 명단에서 삭제되었습니다.");
    loadStudents();
  };

  const handleDeleteAllStudents = async () => {
    if (!confirm("모든 학생 데이터를 지우시겠습니까?")) return;

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from("students")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // deletes all
      if (error) {
        showNotification("전체 삭제 실패: " + error.message, "error");
        return;
      }
    } else {
      localStorage.removeItem("class_students");
    }

    showNotification("모든 학생 명단이 지워졌습니다.");
    loadStudents();
  };

  // --- Excel Upload & Download ---
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[];

        if (rawData.length < 2) {
          showNotification("엑셀 파일에 데이터가 비어 있습니다.", "error");
          return;
        }

        const headers = rawData[0].map((h: any) => String(h || "").trim());
        let numIdx = headers.findIndex((h: string) => h.includes("번호") || h.includes("학번") || h.includes("순번"));
        let nameIdx = headers.findIndex((h: string) => h.includes("이름") || h.includes("성명"));

        if (numIdx === -1) numIdx = 0;
        if (nameIdx === -1) nameIdx = 1;

        const parsedStudents: { student_number: number; name: string }[] = [];
        
        for (let i = 1; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row || row.length === 0) continue;
          
          const numberVal = parseInt(row[numIdx]);
          const nameVal = String(row[nameIdx] || "").trim();

          if (!isNaN(numberVal) && nameVal) {
            parsedStudents.push({
              student_number: numberVal,
              name: nameVal
            });
          }
        }

        if (parsedStudents.length === 0) {
          showNotification("파싱 가능한 올바른 학생 목록이 없습니다.", "error");
          return;
        }

        // Sort parsed array
        parsedStudents.sort((a, b) => a.student_number - b.student_number);

        if (isSupabaseConfigured && supabase) {
          // Delete all and insert new
          await supabase.from("students").delete().neq("id", "00000000-0000-0000-0000-000000000000");
          const { error } = await supabase.from("students").insert(parsedStudents);
          
          if (error) {
            showNotification("Supabase 데이터 업로드 실패: " + error.message, "error");
            return;
          }
        } else {
          // LocalStorage save
          const localStudents = parsedStudents.map((s, idx) => ({
            id: `local-${idx}-${Date.now()}`,
            ...s
          }));
          localStorage.setItem("class_students", JSON.stringify(localStudents));
        }

        showNotification(`${parsedStudents.length}명의 학생 명단이 성공적으로 등록되었습니다.`);
        loadStudents();
      } catch (err) {
        showNotification("엑셀 파일 파싱 중 오류가 발생했습니다.", "error");
      }
    };
    reader.readAsBinaryString(file);

    // Reset file input value
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const downloadSampleExcel = () => {
    const data = [
      ["번호", "이름"],
      [1, "김도현"],
      [2, "이서준"],
      [3, "박예은"],
      [4, "최아윤"]
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "학생명단");
    XLSX.writeFile(wb, "오션중_2학년2반_학생명단_양식.xlsx");
  };

  // --- Counseling Log CRUD ---
  const handleSaveLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logStudentId || !logDate || !logContent) {
      showNotification("학생 선택, 상담 날짜, 상담 내용은 필수 항목입니다.", "error");
      return;
    }

    const selectedStudent = students.find(s => s.id === logStudentId);
    if (!selectedStudent) return;

    const newLogData = {
      student_name: selectedStudent.name,
      student_number: selectedStudent.student_number,
      date: logDate,
      category: logCategory,
      content: logContent,
      action_plan: logActionPlan
    };

    if (isSupabaseConfigured && supabase) {
      if (editingLogId) {
        const { error } = await supabase
          .from("counseling_logs")
          .update(newLogData)
          .eq("id", editingLogId);
        if (error) {
          showNotification("상담일지 수정 실패: " + error.message, "error");
          return;
        }
      } else {
        const { error } = await supabase
          .from("counseling_logs")
          .insert(newLogData);
        if (error) {
          showNotification("상담일지 저장 실패: " + error.message, "error");
          return;
        }
      }
    } else {
      // Local Mode
      const localLogs = localStorage.getItem("counseling_logs");
      let currentLogs: CounselingLog[] = [];
      if (localLogs) {
        try { currentLogs = JSON.parse(localLogs); } catch (e) {}
      }

      if (editingLogId) {
        currentLogs = currentLogs.map(l => l.id === editingLogId ? { ...l, ...newLogData } : l);
      } else {
        const newLog: CounselingLog = {
          id: `log-${Date.now()}`,
          ...newLogData
        };
        currentLogs.unshift(newLog);
      }
      localStorage.setItem("counseling_logs", JSON.stringify(currentLogs));
    }

    showNotification(editingLogId ? "상담일지가 수정되었습니다." : "새로운 상담일지가 기록되었습니다.");
    
    // Reset log form states
    setLogStudentId("");
    setLogContent("");
    setLogActionPlan("");
    setEditingLogId(null);
    loadLogs();
  };

  const handleStartEditLog = (log: CounselingLog) => {
    // Find student ID by name and number
    const student = students.find(s => s.name === log.student_name && s.student_number === log.student_number);
    if (student) {
      setLogStudentId(student.id);
    } else {
      // If student is no longer in active list, show feedback
      showNotification("기존 학생 명단에 존재하지 않는 학생입니다. 수동 재생성이 필요할 수 있습니다.", "error");
    }
    
    setLogDate(log.date);
    setLogCategory(log.category);
    setLogContent(log.content);
    setLogActionPlan(log.action_plan);
    setEditingLogId(log.id);
    setActiveTab("logs"); // Move focus or ensure scroll
  };

  const handleDeleteLog = async (id: string) => {
    if (!confirm("정말 이 상담일지를 삭제하시겠습니까? (삭제된 상담 내역은 복구할 수 없습니다)")) return;

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from("counseling_logs")
        .delete()
        .eq("id", id);
      if (error) {
        showNotification("삭제 실패: " + error.message, "error");
        return;
      }
    } else {
      const currentLogs = logs.filter(l => l.id !== id);
      localStorage.setItem("counseling_logs", JSON.stringify(currentLogs));
    }

    showNotification("상담일지가 삭제되었습니다.");
    if (selectedLogDetails?.id === id) {
      setSelectedLogDetails(null);
    }
    loadLogs();
  };

  // --- Counseling Logs Backup (Export/Import) ---
  const exportLogsToJSON = () => {
    if (logs.length === 0) {
      showNotification("백업할 상담 기록이 존재하지 않습니다.", "error");
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0];
    downloadAnchor.setAttribute("download", `오션중_2-2_상담일지_백업_${dateStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showNotification("상담일지가 JSON 파일로 백업되었습니다.");
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const content = evt.target?.result as string;
        const parsedLogs = JSON.parse(content) as CounselingLog[];

        if (!Array.isArray(parsedLogs)) {
          showNotification("올바른 백업 파일 형식이 아닙니다.", "error");
          return;
        }

        if (isSupabaseConfigured && supabase) {
          // Upload to Supabase (Merge by omitting existing or bulk insert)
          // For simplicity, we write import records
          const logsToInsert = parsedLogs.map(({ id, created_at, ...rest }) => rest);
          const { error } = await supabase.from("counseling_logs").insert(logsToInsert);
          
          if (error) {
            showNotification("Supabase 백업 복원 실패: " + error.message, "error");
            return;
          }
        } else {
          // LocalStorage Merge
          const localLogs = localStorage.getItem("counseling_logs");
          let currentLogs: CounselingLog[] = [];
          if (localLogs) {
            try { currentLogs = JSON.parse(localLogs); } catch (e) {}
          }
          
          // Generate new local IDs to avoid collisions
          const imported = parsedLogs.map((l, idx) => ({
            ...l,
            id: `log-${Date.now()}-${idx}`
          }));

          const merged = [...imported, ...currentLogs];
          localStorage.setItem("counseling_logs", JSON.stringify(merged));
        }

        showNotification(`${parsedLogs.length}개의 상담 기록을 성공적으로 복원했습니다.`);
        loadLogs();
      } catch (err) {
        showNotification("백업 파일 분석 중 오류가 발생했습니다.", "error");
      }
    };
    reader.readAsText(file);

    if (importInputRef.current) importInputRef.current.value = "";
  };

  // --- Filters ---
  const filteredLogs = logs.filter(log => {
    const matchesStudent = filterStudentName ? log.student_name === filterStudentName : true;
    const matchesCategory = filterCategory !== "전체" ? log.category === filterCategory : true;
    
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = searchQuery 
      ? log.student_name.includes(searchQuery) || 
        String(log.student_number).includes(searchQuery) ||
        log.content.toLowerCase().includes(searchLower) ||
        (log.action_plan && log.action_plan.toLowerCase().includes(searchLower))
      : true;

    return matchesStudent && matchesCategory && matchesSearch;
  });

  // Login view render
  if (!checkingAuth && !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-slate-100 font-sans relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/30 via-slate-950 to-slate-950 pointer-events-none z-0" />
        
        <div className="relative z-10 w-full max-w-md bg-slate-900/40 backdrop-blur-md border border-slate-800 p-8 rounded-3xl shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto border border-emerald-500/20 shadow-md">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">교사용 관리자 인증</h1>
            <p className="text-xs text-slate-400">교사 비밀번호를 입력하여 관리 권한을 획득하십시오.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 pl-1">관리자 비밀번호</label>
              <input
                type="password"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-emerald-500 rounded-2xl py-3 px-4 text-center font-mono focus:outline-none text-white transition-all placeholder-slate-700"
                autoFocus
              />
            </div>

            {authError && (
              <p className="text-xs font-semibold text-rose-500 text-center pl-1 flex items-center justify-center gap-1">
                ⚠️ {authError}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 font-bold rounded-2xl transition shadow-xl active:scale-[0.98]"
            >
              인증 확인
            </button>
          </form>

          <div className="text-center pt-2">
            <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 font-semibold transition">
              <ArrowLeft className="w-3.5 h-3.5" />
              학급 홈으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950 pointer-events-none z-0" />
      
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl border shadow-xl flex items-center gap-2.5 transition-all text-xs font-bold text-white animate-bounce ${
          notification.type === "success" 
            ? "bg-emerald-600 border-emerald-500 shadow-emerald-950/55" 
            : "bg-rose-600 border-rose-500 shadow-rose-950/55"
        }`}>
          <CheckCircle className="w-4 h-4" />
          <span>{notification.message}</span>
        </div>
      )}

      {/* Nav */}
      <header className="relative z-10 w-full backdrop-blur-md bg-slate-950/60 border-b border-slate-800/80 sticky top-0 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition shadow-sm mr-2">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-sm text-white">
            ⚙️
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">학급 관리 시스템</h1>
            <p className="text-[10px] text-slate-400">교사 전용 대시보드</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Database indicator */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-bold ${
            isSupabaseActive 
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
              : "bg-amber-500/10 border-amber-500/20 text-amber-400"
          }`}>
            <Database className="w-3.5 h-3.5" />
            <span>{isSupabaseActive ? "Supabase 클라우드 연동" : "로컬 브라우저 저장"}</span>
          </div>

          {isSupabaseActive && (
            <button
              onClick={openChangePasswordModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-850 hover:bg-slate-800 hover:text-white transition text-xs font-semibold text-slate-400"
            >
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              비밀번호 변경
            </button>
          )}

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-850 hover:bg-slate-800 hover:text-white transition text-xs font-semibold text-slate-400"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-500" />
            로그아웃
          </button>
        </div>
      </header>

      {/* Main Admin Area */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800/80 mb-8 gap-4">
          <button
            onClick={() => setActiveTab("students")}
            className={`pb-3 px-2 font-bold text-sm border-b-2 transition flex items-center gap-2 ${
              activeTab === "students" 
                ? "border-emerald-500 text-emerald-400" 
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <User className="w-4 h-4" />
            학생 명단 관리
          </button>
          
          <button
            onClick={() => setActiveTab("logs")}
            className={`pb-3 px-2 font-bold text-sm border-b-2 transition flex items-center gap-2 ${
              activeTab === "logs" 
                ? "border-emerald-500 text-emerald-400" 
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            학생 상담일지
          </button>
        </div>

        {/* Tab content 1: 학생 명단 관리 */}
        {activeTab === "students" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left: upload and manually add student form */}
            <div className="lg:col-span-5 space-y-6">
              {/* Excel Import Box */}
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-4">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Upload className="w-4.5 h-4.5 text-emerald-400" />
                  <span>엑셀 파일 일괄 등록</span>
                </div>
                
                <p className="text-xs text-slate-400 leading-relaxed">
                  학생 번호(학번)와 이름 컬럼이 지정된 엑셀 파일(`.xlsx`, `.csv`)을 업로드하여 반 학생들의 명단을 일괄 등록합니다.
                </p>

                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-800 hover:border-emerald-600/60 bg-slate-950/40 rounded-2xl p-8 text-center cursor-pointer transition-all hover:bg-slate-900/20 group"
                >
                  <Upload className="w-8 h-8 mx-auto text-slate-600 group-hover:text-emerald-500 transition mb-3" />
                  <span className="text-xs font-bold text-slate-300 block mb-1 group-hover:text-white transition">엑셀 파일 업로드</span>
                  <span className="text-[10px] text-slate-500">클릭하거나 파일을 드래그하십시오.</span>
                  
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleExcelUpload}
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={downloadSampleExcel}
                    className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    엑셀 양식 다운로드
                  </button>

                  <button
                    onClick={handleDeleteAllStudents}
                    disabled={students.length === 0}
                    className="text-xs font-semibold text-rose-500 hover:text-rose-400 disabled:text-slate-600 flex items-center gap-1.5 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    명단 전체 삭제
                  </button>
                </div>
              </div>

              {/* Add Student Manually Form */}
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-4">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Plus className="w-4.5 h-4.5 text-emerald-400" />
                  <span>개별 학생 추가</span>
                </div>

                <form onSubmit={handleAddStudent} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 pl-1">번호</label>
                      <input
                        type="number"
                        placeholder="예: 5"
                        value={newNumber}
                        onChange={(e) => setNewNumber(e.target.value)}
                        className="w-full bg-slate-950/80 border border-slate-800 focus:border-emerald-500 rounded-xl py-2 px-3 focus:outline-none text-sm text-slate-100"
                        min="1"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 pl-1">이름</label>
                      <input
                        type="text"
                        placeholder="예: 김영희"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="w-full bg-slate-950/80 border border-slate-800 focus:border-emerald-500 rounded-xl py-2 px-3 focus:outline-none text-sm text-slate-100"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700/80 text-white font-bold rounded-xl border border-slate-700 transition text-xs flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4 text-emerald-400" />
                    <span>학생 명단 추가</span>
                  </button>
                </form>
              </div>
            </div>

            {/* Right: Students Table */}
            <div className="lg:col-span-7 bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 shadow-xl flex flex-col min-h-[460px]">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">등록된 학생 목록</span>
                  <span className="text-xs bg-slate-800 text-emerald-400 px-2 py-0.5 rounded-lg border border-slate-750 font-mono">
                    총 {students.length}명
                  </span>
                </div>

                <button 
                  onClick={loadStudents}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                  title="명단 새로고침"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {students.length > 0 ? (
                <div className="flex-1 overflow-y-auto max-h-[450px] pr-1">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800/80 text-slate-400 font-semibold">
                        <th className="py-2.5 pl-3 w-1/4">번호</th>
                        <th className="py-2.5 w-1/2">이름</th>
                        <th className="py-2.5 pr-3 text-right">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {students.map((student) => (
                        <tr key={student.id} className="hover:bg-slate-900/20 group transition">
                          <td className="py-3 pl-3 font-semibold font-mono text-slate-300">
                            {student.student_number}번
                          </td>
                          <td className="py-3">
                            {editingStudentId === student.id ? (
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg px-2 py-0.5 text-xs text-slate-200 focus:outline-none"
                              />
                            ) : (
                              <span className="font-medium text-slate-200">{student.name}</span>
                            )}
                          </td>
                          <td className="py-3 pr-3 text-right">
                            <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition">
                              {editingStudentId === student.id ? (
                                <button
                                  onClick={() => handleSaveEditStudent(student)}
                                  className="p-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20"
                                  title="저장"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleStartEditStudent(student)}
                                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                                  title="수정"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteStudent(student.id)}
                                className="p-1 rounded hover:bg-rose-500/10 text-slate-400 hover:text-rose-400"
                                title="삭제"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex-grow flex flex-col items-center justify-center text-slate-500 text-xs py-12 text-center">
                  <span>📂</span>
                  <p className="mt-2 font-medium">아직 등록된 학생이 없습니다.</p>
                  <p className="text-[10px] mt-1">엑셀 일괄 등록이나 개별 추가로 학생들을 명단에 적재해 주세요.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab content 2: 학생 상담일지 */}
        {activeTab === "logs" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left: 상담일지 작성 폼 */}
            <div className="lg:col-span-5 bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-1">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <FileText className="w-4.5 h-4.5 text-emerald-400" />
                  <span>{editingLogId ? "상담일지 수정하기" : "새 상담일지 기록"}</span>
                </div>
                {editingLogId && (
                  <button
                    onClick={() => {
                      setEditingLogId(null);
                      setLogStudentId("");
                      setLogContent("");
                      setLogActionPlan("");
                    }}
                    className="text-[10px] bg-slate-800 hover:bg-slate-700/80 text-slate-300 font-bold px-2 py-1 rounded transition"
                  >
                    수정 취소
                  </button>
                )}
              </div>

              {students.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-2xl">
                  <span>⚠️</span>
                  <p className="mt-2 font-medium">상담일지를 쓰려면 학생 명단을 먼저 등록해야 합니다.</p>
                </div>
              ) : (
                <form onSubmit={handleSaveLog} className="space-y-4 text-xs font-semibold">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Student Selector */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 pl-1">상담 학생</label>
                      <select
                        value={logStudentId}
                        onChange={(e) => setLogStudentId(e.target.value)}
                        className="w-full bg-slate-950/80 border border-slate-800 focus:border-emerald-500 rounded-xl py-2 px-3 text-slate-100 focus:outline-none"
                      >
                        <option value="">학생 선택</option>
                        {students.map((student) => (
                          <option key={student.id} value={student.id}>
                            {student.student_number}번 {student.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Counseling Category */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 pl-1">상담 분류</label>
                      <select
                        value={logCategory}
                        onChange={(e) => setLogCategory(e.target.value)}
                        className="w-full bg-slate-950/80 border border-slate-800 focus:border-emerald-500 rounded-xl py-2 px-3 text-slate-100 focus:outline-none"
                      >
                        {["학업", "진로", "교우관계", "가정환경", "행동특성", "기타"].map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Date */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 pl-1">상담 날짜</label>
                    <input
                      type="date"
                      value={logDate}
                      onChange={(e) => setLogDate(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-800 focus:border-emerald-500 rounded-xl py-2 px-3 text-slate-100 focus:outline-none"
                    />
                  </div>

                  {/* Content */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 pl-1">상담 내용 상세</label>
                    <textarea
                      placeholder="상담 대화 내용이나 주요 호소 문제를 작성해 주세요."
                      rows={5}
                      value={logContent}
                      onChange={(e) => setLogContent(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-800 focus:border-emerald-500 rounded-xl py-2 px-3 text-slate-100 focus:outline-none leading-relaxed"
                    />
                  </div>

                  {/* Action Plan */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 pl-1">조치 및 지도 계획</label>
                    <textarea
                      placeholder="상담 후속 조치나 지도 계획, 관찰 특이사항을 적어주세요."
                      rows={3}
                      value={logActionPlan}
                      onChange={(e) => setLogActionPlan(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-800 focus:border-emerald-500 rounded-xl py-2 px-3 text-slate-100 focus:outline-none leading-relaxed"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl transition shadow-md flex items-center justify-center gap-1.5"
                  >
                    <Save className="w-4 h-4" />
                    <span>{editingLogId ? "상담일지 수정 완료" : "상담일지 저장"}</span>
                  </button>
                </form>
              )}
            </div>

            {/* Right: 상담기록 리스트 및 필터 */}
            <div className="lg:col-span-7 bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 shadow-xl flex flex-col min-h-[500px]">
              
              {/* Header and export buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800/80 pb-4 mb-5 gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">상담 누적 기록</span>
                  <span className="text-xs bg-slate-800 text-emerald-400 px-2 py-0.5 rounded-lg border border-slate-750 font-mono">
                    검색 결과 {filteredLogs.length}건
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Import Backup */}
                  <button 
                    onClick={() => importInputRef.current?.click()}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-[10px] font-bold text-slate-400 hover:text-white transition flex items-center gap-1"
                    title="상담 데이터 불러오기"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    가져오기
                  </button>
                  <input
                    type="file"
                    ref={importInputRef}
                    onChange={handleImportJSON}
                    accept=".json"
                    className="hidden"
                  />

                  {/* Export Backup */}
                  <button
                    onClick={exportLogsToJSON}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-[10px] font-bold text-slate-400 hover:text-white transition flex items-center gap-1"
                    title="상담 데이터 내보내기"
                  >
                    <Download className="w-3.5 h-3.5" />
                    백업하기
                  </button>
                </div>
              </div>

              {/* Filters Panel */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5 p-3.5 bg-slate-950/40 rounded-2xl border border-slate-900">
                {/* Search query input */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="이름, 내용 검색"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg py-1.5 pl-8 pr-3 text-[11px] focus:outline-none focus:border-emerald-500 text-slate-200"
                  />
                </div>

                {/* Filter by Category */}
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg py-1.5 px-2 text-[11px] focus:outline-none focus:border-emerald-500 text-slate-300 font-bold"
                >
                  <option value="전체">분류: 전체</option>
                  {["학업", "진로", "교우관계", "가정환경", "행동특성", "기타"].map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                {/* Filter by Student name directly */}
                <select
                  value={filterStudentName}
                  onChange={(e) => setFilterStudentName(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg py-1.5 px-2 text-[11px] focus:outline-none focus:border-emerald-500 text-slate-300 font-bold"
                >
                  <option value="">학생: 전체</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.name}>
                      {student.student_number}번 {student.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Logs Cards Grid */}
              {filteredLogs.length > 0 ? (
                <div className="flex-1 overflow-y-auto max-h-[400px] space-y-3.5 pr-1">
                  {filteredLogs.map((log) => (
                    <div 
                      key={log.id} 
                      className="bg-slate-900/50 hover:bg-slate-900 border border-slate-850 rounded-2xl p-4.5 transition-all shadow hover:shadow-lg space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-100 text-xs sm:text-sm">
                            {log.student_number}번 {log.student_name}
                          </span>
                          <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                            {log.category}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold font-mono">
                          <Calendar className="w-3 h-3 text-slate-600" />
                          <span>{log.date}</span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed line-clamp-2 bg-slate-950/20 p-2.5 rounded-xl border border-slate-900/30">
                        {log.content}
                      </p>

                      <div className="flex items-center justify-between border-t border-slate-900 pt-2.5">
                        <button
                          onClick={() => setSelectedLogDetails(log)}
                          className="text-[10px] font-bold text-slate-400 hover:text-emerald-400 transition"
                        >
                          전체 내용 상세 보기 🔍
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleStartEditLog(log)}
                            className="p-1 rounded bg-slate-950 border border-slate-850 hover:border-slate-700 hover:text-white text-slate-400"
                            title="수정"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteLog(log.id)}
                            className="p-1 rounded bg-slate-950 border border-slate-850 hover:border-slate-700 hover:text-rose-400 text-slate-400"
                            title="삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex-grow flex flex-col items-center justify-center text-slate-500 text-xs py-12 text-center">
                  <span>📝</span>
                  <p className="mt-2 font-medium">조건에 부합하는 상담 일지 데이터가 없습니다.</p>
                  <p className="text-[10px] mt-1">새로운 일지를 기록하거나 업로드 파일을 통해 복구하십시오.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Log Details Modal */}
      {selectedLogDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4.5 animate-in fade-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold text-white">
                  {selectedLogDetails.student_number}번 {selectedLogDetails.student_name} 상담 내용
                </span>
                <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                  {selectedLogDetails.category}
                </span>
              </div>
              
              <button
                onClick={() => setSelectedLogDetails(null)}
                className="text-xs text-slate-400 hover:text-white font-bold p-1"
              >
                닫기 ✕
              </button>
            </div>

            <div className="space-y-4 text-xs font-semibold text-slate-300">
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400">
                <Calendar className="w-3.5 h-3.5" />
                <span>상담일: {selectedLogDetails.date}</span>
              </div>

              <div className="space-y-1">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">상담 상세 기록</h4>
                <p className="bg-slate-950 p-4 rounded-2xl border border-slate-850 text-slate-200 whitespace-pre-wrap leading-relaxed text-sm font-normal">
                  {selectedLogDetails.content}
                </p>
              </div>

              {selectedLogDetails.action_plan && (
                <div className="space-y-1">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">조치 및 지도 계획</h4>
                  <p className="bg-slate-950 p-4 rounded-2xl border border-slate-850 text-slate-200 whitespace-pre-wrap leading-relaxed text-sm font-normal">
                    {selectedLogDetails.action_plan}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800 gap-2.5">
              <button
                onClick={() => {
                  handleStartEditLog(selectedLogDetails);
                  setSelectedLogDetails(null);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition"
              >
                상담 수정
              </button>
              <button
                onClick={() => setSelectedLogDetails(null)}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-extrabold text-white">관리자 비밀번호 변경</span>
              </div>
              
              <button
                onClick={closeChangePasswordModal}
                className="text-xs text-slate-400 hover:text-white font-bold p-1"
                disabled={changePasswordLoading}
              >
                닫기 ✕
              </button>
            </div>

            <div className="space-y-4 text-xs font-semibold text-slate-300">
              {!isGoogleVerified ? (
                // Google verification stage
                <div className="space-y-4 py-4 text-center">
                  <p className="text-slate-300 leading-relaxed text-sm">
                    비밀번호를 안전하게 변경하려면 관리자 구글 계정<br />
                    <span className="text-emerald-400 font-extrabold">won2020@ocean.ms.kr</span>으로 로그인하여 본인 인증을 완료해야 합니다.
                  </p>
                  
                  {changePasswordError && (
                    <p className="text-[11px] font-bold text-rose-500">
                      ⚠️ {changePasswordError}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={handleGoogleVerify}
                    className="mt-2 w-full py-3 bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-2xl transition flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                  >
                    {/* Simple Google SVG Icon */}
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.69c-.29 1.5-.1.8-1.5 2.08v3.45h2.42c8.12-7.5 8.12-7.5 8.12-7.38z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.83-2.97c-1.08.73-2.47 1.16-4.1 1.16-3.15 0-5.82-2.13-6.77-5.02H1.38v3.08c1.99 3.96 6.08 6.66 10.62 6.66z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.23 14.26c-.25-.73-.39-1.5-.39-2.3s.14-1.57.39-2.3V6.58H1.38C.5 8.34 0 10.11 0 12s.5 3.66 1.38 5.42l3.85-3.16z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.46 0 3.37 2.7 1.38 6.58l3.85 3.16c.95-2.89 3.62-5 6.77-5z"
                      />
                    </svg>
                    <span>구글 계정으로 로그인 본인 인증</span>
                  </button>

                  <div className="flex justify-end pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={closeChangePasswordModal}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition"
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                // Password change stage
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-2xl p-3.5 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <p className="text-[11px] text-emerald-400 font-bold">
                      구글 인증 완료: won2020@ocean.ms.kr
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 pl-1">현재 비밀번호</label>
                    <input
                      type="password"
                      placeholder="현재 비밀번호 입력"
                      value={changeCurrentPassword}
                      onChange={(e) => setChangeCurrentPassword(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-800 focus:border-emerald-500 rounded-xl py-2.5 px-3 focus:outline-none text-slate-200 font-mono"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 pl-1">변경할 비밀번호</label>
                    <input
                      type="password"
                      placeholder="변경할 비밀번호 입력"
                      value={changeNewPassword}
                      onChange={(e) => setChangeNewPassword(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-800 focus:border-emerald-500 rounded-xl py-2.5 px-3 focus:outline-none text-slate-200 font-mono"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 pl-1">변경할 비밀번호 확인</label>
                    <input
                      type="password"
                      placeholder="변경할 비밀번호 재입력"
                      value={changeConfirmPassword}
                      onChange={(e) => setChangeConfirmPassword(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-800 focus:border-emerald-500 rounded-xl py-2.5 px-3 focus:outline-none text-slate-200 font-mono"
                      required
                    />
                  </div>

                  {changePasswordError && (
                    <p className="text-[11px] font-bold text-rose-500 pl-1">
                      ⚠️ {changePasswordError}
                    </p>
                  )}

                  <div className="flex justify-end pt-2 border-t border-slate-800 gap-2.5">
                    <button
                      type="button"
                      onClick={closeChangePasswordModal}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition"
                      disabled={changePasswordLoading}
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl transition flex items-center gap-1.5"
                      disabled={changePasswordLoading}
                    >
                      {changePasswordLoading ? (
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      <span>비밀번호 변경</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="relative z-10 w-full text-center py-6 border-t border-slate-900/60 bg-slate-950/20 mt-8 text-xs text-slate-500">
        © 2026 오션중학교 2학년 2반. Built beautifully with Next.js, Supabase & Tailwind CSS.
      </footer>
    </div>
  );
}
