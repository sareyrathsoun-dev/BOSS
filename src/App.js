import { useState, useEffect, useCallback } from "react";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db, firebaseConfig } from "./firebase";

// ─── STATUS CONFIG ─────────────────────────────────────────────
const STATUS_CONFIG = {
  A: { label: "A", full: "Absent", color: "#ef4444", bg: "#fef2f2", border: "#fca5a5" },
  P: { label: "P", full: "Present", color: "#22c55e", bg: "#f0fdf4", border: "#86efac" },
  Pe: { label: "Pe", full: "Permission", color: "#3b82f6", bg: "#eff6ff", border: "#93c5fd" },
  L: { label: "L", full: "Late", color: "#eab308", bg: "#fefce8", border: "#fde047" },
};

// Class names are now free-text (Admin types anything). Any new class
// name typed gets saved to the "classes" Firestore collection so it
// appears as a suggestion (datalist) next time.
const DEFAULT_CLASS = "";

const todayStr = () => new Date().toISOString().split("T")[0];
const nowTimeStr = () => new Date().toTimeString().slice(0, 5);

// Fetch known class names from Firestore (for datalist suggestions)
function useClassSuggestions() {
  const [classNames, setClassNames] = useState([]);
  const refresh = useCallback(async () => {
    const snap = await getDocs(collection(db, "classes"));
    setClassNames(snap.docs.map(d => d.data().name).filter(Boolean));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return [classNames, refresh];
}

// If a typed class name isn't in Firestore yet, save it so it becomes
// a suggestion for next time (Admin can freely type new class names).
async function ensureClassExists(name) {
  if (!name || !name.trim()) return;
  const trimmed = name.trim();
  const existing = await getDocs(query(collection(db, "classes"), where("name", "==", trimmed)));
  if (existing.empty) {
    await addDoc(collection(db, "classes"), { name: trimmed, createdAt: serverTimestamp() });
  }
}

// ─── STYLES ─────────────────────────────────────────────────────
const styles = {
  app: { fontFamily: "'Hanuman', 'Khmer OS', 'Battambang', sans-serif", minHeight: "100vh", background: "#0f172a", color: "#e2e8f0" },
  loginWrap: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)" },
  loginCard: { background: "#1e293b", border: "1px solid #334155", borderRadius: 16, padding: 40, width: 380, boxShadow: "0 25px 50px rgba(0,0,0,0.5)" },
  loginTitle: { fontSize: 24, fontWeight: 700, color: "#f1f5f9", marginBottom: 4, textAlign: "center" },
  loginSub: { fontSize: 13, color: "#64748b", textAlign: "center", marginBottom: 28 },
  input: { width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" },
  btnPrimary: { width: "100%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontSize: 15, fontWeight: 600, cursor: "pointer" },
  sidebar: { width: 240, background: "#1e293b", borderRight: "1px solid #334155", display: "flex", flexDirection: "column", minHeight: "100vh" },
  sidebarLogo: { padding: "20px 20px 16px", borderBottom: "1px solid #334155" },
  sidebarTitle: { fontSize: 15, fontWeight: 700, color: "#f1f5f9", margin: 0 },
  sidebarSub: { fontSize: 11, color: "#64748b", margin: 0 },
  navItem: (active) => ({ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", margin: "2px 8px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: active ? 600 : 400, color: active ? "#a78bfa" : "#94a3b8", background: active ? "rgba(139,92,246,0.15)" : "transparent", border: active ? "1px solid rgba(139,92,246,0.3)" : "1px solid transparent", transition: "all 0.15s" }),
  main: { flex: 1, display: "flex", flexDirection: "column", background: "#0f172a" },
  topbar: { background: "#1e293b", borderBottom: "1px solid #334155", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  pageTitle: { fontSize: 18, fontWeight: 700, color: "#f1f5f9", margin: 0 },
  content: { flex: 1, padding: 24, overflowY: "auto" },
  card: { background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 14, fontWeight: 600, color: "#94a3b8", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 },
  statCard: (color) => ({ background: "#1e293b", border: `1px solid ${color}40`, borderRadius: 12, padding: 20, flex: 1 }),
  statVal: (color) => ({ fontSize: 32, fontWeight: 700, color }),
  statLabel: { fontSize: 12, color: "#64748b", marginTop: 2 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { background: "#0f172a", color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #334155" },
  td: { padding: "10px 12px", fontSize: 13, color: "#cbd5e1", borderBottom: "1px solid #1e293b" },
  badge: (color, bg) => ({ display: "inline-block", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, color, background: bg }),
  statusBtn: (status, selected) => ({
    width: 36, height: 36, borderRadius: 8,
    border: selected ? `2px solid ${STATUS_CONFIG[status].color}` : "1px solid #334155",
    background: selected ? STATUS_CONFIG[status].bg : "#0f172a",
    color: selected ? STATUS_CONFIG[status].color : "#64748b",
    fontSize: 12, fontWeight: 700, cursor: "pointer",
    transform: selected ? "scale(1.1)" : "scale(1)",
    transition: "all 0.15s",
    boxShadow: selected ? `0 0 10px ${STATUS_CONFIG[status].color}50` : "none",
  }),
  tag: (role) => {
    const map = { admin: ["#a78bfa", "#2e1065"], teacher: ["#34d399", "#064e3b"] };
    const [c, bg] = map[role] || ["#94a3b8", "#1e293b"];
    return { padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600, color: c, background: bg };
  },
  modal: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
  modalCard: { background: "#1e293b", border: "1px solid #334155", borderRadius: 16, padding: 28, width: 420, maxWidth: "90vw", maxHeight: "85vh", overflowY: "auto" },
  select: { background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "8px 12px", color: "#e2e8f0", fontSize: 13, width: "100%", outline: "none" },
  btnSm: (color) => ({ background: color, color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }),
  alert: (type) => ({ background: type === "success" ? "#052e16" : "#450a0a", border: `1px solid ${type === "success" ? "#16a34a" : "#dc2626"}`, borderRadius: 8, padding: "10px 16px", fontSize: 13, color: type === "success" ? "#86efac" : "#fca5a5", marginBottom: 12 }),
  label: { fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 4 },
  spinner: { textAlign: "center", padding: 60, color: "#64748b" },
};

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [alert, setAlert] = useState(null);

  const showAlert = (msg, type = "success") => {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 3500);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setUser(null);
        setAuthLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, "users", fbUser.uid));
        if (!snap.exists()) {
          showAlert("គណនីនេះមិនមានទិន្នន័យក្នុងប្រព័ន្ធ — សូមទាក់ទង Admin", "error");
          await signOut(auth);
          setUser(null);
        } else {
          setUser({ uid: fbUser.uid, email: fbUser.email, ...snap.data() });
        }
      } catch (err) {
        showAlert("មានបញ្ហាក្នុងការទាញទិន្នន័យអ្នកប្រើ: " + err.message, "error");
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setPage("dashboard");
  };

  if (authLoading) {
    return <div style={{ ...styles.app, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={styles.spinner}>⏳ កំពុងផ្ទុក...</div>
    </div>;
  }

  if (!user) return <LoginPage onAlert={showAlert} />;

  const navItems = user.role === "admin"
    ? [
        { id: "dashboard", icon: "📊", label: "ផ្ទាំងគ្រប់គ្រង" },
        { id: "teachers", icon: "👨‍🏫", label: "គ្រូបង្រៀន" },
        { id: "students", icon: "👨‍🎓", label: "សិស្ស" },
        { id: "schedules", icon: "📅", label: "ម៉ោងរៀន" },
        { id: "reports", icon: "📋", label: "របាយការណ៍" },
      ]
    : [
        { id: "dashboard", icon: "📊", label: "ផ្ទាំងរបស់ខ្ញុំ" },
        { id: "take_attendance", icon: "✅", label: "ស្រង់អវត្តមាន" },
      ];

  return (
    <div style={{ ...styles.app, display: "flex" }}>
      <div style={styles.sidebar}>
        <div style={styles.sidebarLogo}>
          <p style={styles.sidebarTitle}>🏫 School Attend</p>
          <p style={styles.sidebarSub}>ប្រព័ន្ធគ្រប់គ្រងអវត្តមាន</p>
        </div>
        <div style={{ padding: "12px 0", flex: 1 }}>
          {navItems.map(n => (
            <div key={n.id} style={styles.navItem(page === n.id)} onClick={() => setPage(n.id)}>
              <span>{n.icon}</span><span>{n.label}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: 16, borderTop: "1px solid #334155" }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 2 }}>{user.name}</div>
          <div style={{ fontSize: 11, color: "#475569", marginBottom: 6 }}>{user.email}</div>
          <div style={styles.tag(user.role)}>{user.role === "admin" ? "អ្នកគ្រប់គ្រង" : "គ្រូបង្រៀន"}</div>
          <button onClick={logout} style={{ ...styles.btnSm("#ef4444"), marginTop: 10, width: "100%" }}>ចាកចេញ</button>
        </div>
      </div>

      <div style={styles.main}>
        <div style={styles.topbar}>
          <h1 style={styles.pageTitle}>
            {navItems.find(n => n.id === page)?.icon} {navItems.find(n => n.id === page)?.label}
          </h1>
          <div style={{ fontSize: 12, color: "#64748b" }}>📅 {new Date().toLocaleDateString("km-KH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
        </div>
        <div style={styles.content}>
          {alert && <div style={styles.alert(alert.type)}>{alert.type === "success" ? "✅" : "❌"} {alert.msg}</div>}

          {page === "dashboard" && <Dashboard user={user} />}
          {page === "teachers" && user.role === "admin" && <TeachersPage onAlert={showAlert} />}
          {page === "students" && user.role === "admin" && <StudentsPage onAlert={showAlert} />}
          {page === "schedules" && user.role === "admin" && <SchedulesPage />}
          {page === "reports" && user.role === "admin" && <ReportsPage />}
          {page === "take_attendance" && user.role === "teacher" && <TakeAttendancePage user={user} onAlert={showAlert} />}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// LOGIN PAGE — real Firebase Auth (email + password)
// ═══════════════════════════════════════════════════════════════
function LoginPage({ onAlert }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { onAlert("សូមបញ្ចូល Email និង Password", "error"); return; }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      const msg = ["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found"].includes(err.code)
        ? "Email ឬ Password មិនត្រឹមត្រូវ"
        : err.message;
      onAlert(msg, "error");
    }
    setLoading(false);
  };

  return (
    <div style={styles.loginWrap}>
      <div style={styles.loginCard}>
        <div style={{ textAlign: "center", marginBottom: 20 }}><div style={{ fontSize: 48 }}>🏫</div></div>
        <h2 style={styles.loginTitle}>ប្រព័ន្ធគ្រប់គ្រងអវត្តមាន</h2>
        <p style={styles.loginSub}>School Attendance Management System</p>

        <div style={{ marginBottom: 12 }}>
          <label style={styles.label}>Email</label>
          <input style={styles.input} type="email" placeholder="you@school.edu.kh" value={email}
            onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={styles.label}>Password</label>
          <input style={styles.input} type="password" placeholder="••••••••" value={password}
            onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} />
        </div>

        <button style={{ ...styles.btnPrimary, opacity: loading ? 0.6 : 1 }} onClick={handleLogin} disabled={loading}>
          {loading ? "កំពុងចូល..." : "ចូលប្រើប្រាស់"}
        </button>

        <div style={{ marginTop: 16, padding: 12, background: "#0f172a", borderRadius: 8, fontSize: 11, color: "#475569" }}>
          Admin : Email : admin@school.edu.kh | Password : admin123456789
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════
function Dashboard({ user }) {
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState([]);
  const [studentCount, setStudentCount] = useState(0);
  const [attendanceToday, setAttendanceToday] = useState({});

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const date = todayStr();

      let schedSnap;
      if (user.role === "admin") {
        schedSnap = await getDocs(query(collection(db, "schedules"), where("date", "==", date)));
      } else {
        schedSnap = await getDocs(query(collection(db, "schedules"), where("date", "==", date), where("teacherId", "==", user.uid)));
      }
      const scheds = schedSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      let studSnap;
      if (user.role === "admin") studSnap = await getDocs(collection(db, "students"));
      else studSnap = await getDocs(query(collection(db, "students"), where("className", "==", user.className || "")));

      const submittedMap = {};
      for (const s of scheds) {
        const attSnap = await getDocs(query(collection(db, "attendance"), where("scheduleId", "==", s.id), where("date", "==", date)));
        submittedMap[s.id] = !attSnap.empty;
      }

      if (active) {
        setSchedules(scheds);
        setStudentCount(studSnap.size);
        setAttendanceToday(submittedMap);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user]);

  if (loading) return <div style={styles.spinner}>⏳ កំពុងផ្ទុកទិន្នន័យ...</div>;

  const timeStr = nowTimeStr();
  const submittedCount = Object.values(attendanceToday).filter(Boolean).length;

  return (
    <div>
      <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
        {[
          { val: schedules.length, label: "ម៉ោងរៀនថ្ងៃនេះ", color: "#a78bfa" },
          { val: studentCount, label: "សិស្សទាំងអស់", color: "#34d399" },
          { val: submittedCount, label: "បានស្រង់ហើយ", color: "#60a5fa" },
          { val: schedules.length - submittedCount, label: "មិនទាន់ស្រង់", color: "#f97316" },
        ].map((s, i) => (
          <div key={i} style={styles.statCard(s.color)}>
            <div style={styles.statVal(s.color)}>{s.val}</div>
            <div style={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={styles.card}>
        <div style={styles.cardTitle}>📅 ម៉ោងបង្រៀនថ្ងៃនេះ</div>
        {schedules.length === 0
          ? <div style={{ color: "#475569", fontSize: 13, textAlign: "center", padding: 20 }}>📭 មិនមានម៉ោងរៀនកំណត់សម្រាប់ថ្ងៃនេះ</div>
          : <table style={styles.table}>
              <thead><tr>{["គ្រូ", "ថ្នាក់", "ម៉ោង", "ស្ថានភាព"].map(h => <th key={h} style={styles.th}>{h}</th>)}</tr></thead>
              <tbody>
                {schedules.map(sch => {
                  const isActive = timeStr >= sch.startTime && timeStr <= sch.endTime;
                  const isPast = timeStr > sch.endTime;
                  const submitted = attendanceToday[sch.id];
                  return (
                    <tr key={sch.id}>
                      <td style={styles.td}>{sch.teacherName || "—"}</td>
                      <td style={styles.td}>{sch.className || "—"}</td>
                      <td style={styles.td}>{sch.startTime} – {sch.endTime}</td>
                      <td style={styles.td}>
                        {submitted
                          ? <span style={styles.badge("#22c55e", "#052e16")}>✅ បានស្រង់</span>
                          : isActive
                            ? <span style={styles.badge("#eab308", "#422006")}>🟡 ចំម៉ោងបង្រៀន</span>
                            : isPast
                              ? <span style={styles.badge("#ef4444", "#450a0a")}>🔴 លើសម៉ោង</span>
                              : <span style={styles.badge("#64748b", "#0f172a")}>⏳ មិនទាន់ដល់ម៉ោង</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>}
      </div>

      <div style={styles.card}>
        <div style={styles.cardTitle}>📖 ពន្យល់លេខកូដ</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: v.bg, borderRadius: 8, border: `1px solid ${v.border}` }}>
              <span style={{ fontWeight: 700, color: v.color, fontSize: 14 }}>{k}</span>
              <span style={{ fontSize: 12, color: v.color }}>{v.full}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TEACHERS PAGE — Admin creates teacher LOGIN (email+password)
// via a SECONDARY Firebase app so Admin's own session survives.
// ═══════════════════════════════════════════════════════════════
function TeachersPage({ onAlert }) {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [classNames, refreshClasses] = useClassSuggestions();
  const [form, setForm] = useState({
    name: "", age: "", gender: "ប្រុស", subject: "",
    className: DEFAULT_CLASS, startTime: "07:30", endTime: "09:00",
    email: "", password: "",
  });

  const loadTeachers = useCallback(async () => {
    setLoading(true);
    const snap = await getDocs(query(collection(db, "users"), where("role", "==", "teacher")));
    setTeachers(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
    setLoading(false);
  }, []);

  useEffect(() => { loadTeachers(); }, [loadTeachers]);

  const addTeacher = async () => {
    if (!form.name || !form.subject || !form.className.trim() || !form.email || !form.password) {
      onAlert("សូមបំពេញព័ត៌មានឱ្យបានគ្រប់ (រួមទាំងឈ្មោះថ្នាក់ Email/Password)", "error");
      return;
    }
    if (form.password.length < 6) {
      onAlert("Password ត្រូវមានយ៉ាងតិច 6 តួអក្សរ", "error");
      return;
    }
    setSaving(true);

    const secondaryApp = initializeApp(firebaseConfig, "SecondaryTeacherCreate_" + Date.now());
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, form.email, form.password);
      const uid = cred.user.uid;
      const className = form.className.trim();

      await setDoc(doc(db, "users", uid), {
        name: form.name,
        age: Number(form.age) || null,
        gender: form.gender,
        subject: form.subject,
        className,
        startTime: form.startTime,
        endTime: form.endTime,
        role: "teacher",
        email: form.email,
        createdAt: serverTimestamp(),
      });

      await addDoc(collection(db, "schedules"), {
        teacherId: uid,
        teacherName: form.name,
        className,
        date: todayStr(),
        startTime: form.startTime,
        endTime: form.endTime,
      });

      await ensureClassExists(className);
      refreshClasses();

      onAlert(`បានបង្កើតគណនីគ្រូ "${form.name}" ជោគជ័យ! (Email: ${form.email})`);
      setShowAdd(false);
      setForm({ name: "", age: "", gender: "ប្រុស", subject: "", className: DEFAULT_CLASS, startTime: "07:30", endTime: "09:00", email: "", password: "" });
      loadTeachers();
    } catch (err) {
      const msg = err.code === "auth/email-already-in-use" ? "Email នេះមានគណនីរួចហើយ" : err.message;
      onAlert(msg, "error");
    } finally {
      await deleteApp(secondaryApp);
      setSaving(false);
    }
  };

  const deleteTeacher = async (t) => {
    if (!window.confirm(`តើអ្នកប្រាកដថាចង់លុបគ្រូ "${t.name}" មែនទេ?`)) return;
    try {
      // Removes the Firestore profile + any schedules tied to this teacher.
      // NOTE: this does NOT delete their Firebase Auth login — a client app
      // can only delete the currently-signed-in user's own auth account,
      // not someone else's. Deleting another user's login needs the Admin
      // SDK (Cloud Function) or manual removal in Firebase Console.
      await deleteDoc(doc(db, "users", t.uid));
      const schedSnap = await getDocs(query(collection(db, "schedules"), where("teacherId", "==", t.uid)));
      await Promise.all(schedSnap.docs.map(d => deleteDoc(doc(db, "schedules", d.id))));
      onAlert(`បានលុបគ្រូ "${t.name}" ចេញពីទិន្នន័យ។ គណនី Login នៅតែមាន — លុបវាដាច់ដោយឡែកនៅ Firebase Console > Authentication ប្រសិនបើត្រូវការ។`);
      loadTeachers();
    } catch (err) {
      onAlert(err.message, "error");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button style={styles.btnSm("#6366f1")} onClick={() => setShowAdd(true)}>+ បន្ថែមគ្រូ</button>
      </div>
      <div style={styles.card}>
        <div style={styles.cardTitle}>👨‍🏫 បញ្ជីគ្រូបង្រៀន</div>
        {loading ? <div style={styles.spinner}>⏳ កំពុងផ្ទុក...</div> : (
          <table style={styles.table}>
            <thead><tr>{["ឈ្មោះ", "Email", "មុខវិជ្ជា", "ថ្នាក់", "ម៉ោងបង្រៀន", ""].map(h => <th key={h} style={styles.th}>{h}</th>)}</tr></thead>
            <tbody>
              {teachers.map(t => (
                <tr key={t.uid}>
                  <td style={styles.td}><strong style={{ color: "#f1f5f9" }}>{t.name}</strong></td>
                  <td style={{ ...styles.td, color: "#64748b" }}>{t.email}</td>
                  <td style={styles.td}><span style={styles.badge("#a78bfa", "#1e1b4b")}>{t.subject}</span></td>
                  <td style={styles.td}>{t.className || "—"}</td>
                  <td style={styles.td}>{t.startTime} – {t.endTime}</td>
                  <td style={styles.td}><button style={styles.btnSm("#ef4444")} onClick={() => deleteTeacher(t)}>លុប</button></td>
                </tr>
              ))}
              {teachers.length === 0 && (
                <tr><td colSpan={6} style={{ ...styles.td, textAlign: "center", color: "#475569" }}>📭 មិនទាន់មានគ្រូ</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && (
        <div style={styles.modal}>
          <div style={styles.modalCard}>
            <h3 style={{ color: "#f1f5f9", marginBottom: 16, fontSize: 16 }}>➕ បន្ថែមគ្រូថ្មី</h3>

            <div style={{ marginBottom: 12 }}>
              <label style={styles.label}>ឈ្មោះ</label>
              <input style={styles.input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>អាយុ</label>
                <input style={styles.input} value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>ភេទ</label>
                <select style={styles.select} value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                  <option>ប្រុស</option><option>ស្រី</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={styles.label}>មុខវិជ្ជា</label>
              <input style={styles.input} value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={styles.label}>ថ្នាក់ដែលបង្រៀន</label>
              <input style={styles.input} list="class-suggestions-teacher" placeholder="ឧទាហរណ៍: 300 or A4, 402"
                value={form.className} onChange={e => setForm({ ...form, className: e.target.value })} />
              <datalist id="class-suggestions-teacher">
                {classNames.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>ម៉ោងចាប់ផ្តើម</label>
                <input style={styles.input} type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>ម៉ោងបញ្ចប់</label>
                <input style={styles.input} type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} />
              </div>
            </div>
            <div style={{ marginBottom: 12, paddingTop: 8, borderTop: "1px solid #334155" }}>
              <label style={styles.label}>Email (សម្រាប់ចូលប្រើប្រាស់)</label>
              <input style={styles.input} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={styles.label}>Password (យ៉ាងតិច 6 តួអក្សរ)</label>
              <input style={styles.input} type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...styles.btnSm("#6366f1"), flex: 1, padding: "10px", opacity: saving ? 0.6 : 1 }} onClick={addTeacher} disabled={saving}>
                {saving ? "កំពុងរក្សាទុក..." : "រក្សាទុក"}
              </button>
              <button style={{ ...styles.btnSm("#475569"), flex: 1, padding: "10px" }} onClick={() => setShowAdd(false)} disabled={saving}>បោះបង់</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STUDENTS PAGE
// ═══════════════════════════════════════════════════════════════
function StudentsPage({ onAlert }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterClass, setFilterClass] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [classNames, refreshClasses] = useClassSuggestions();
  const [form, setForm] = useState({ name: "", age: "", gender: "ប្រុស", className: DEFAULT_CLASS });

  const loadStudents = useCallback(async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, "students"));
    setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }, []);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  const filtered = filterClass === "all" ? students : students.filter(s => s.className === filterClass);

  const deleteStudent = async (s) => {
    if (!window.confirm(`តើអ្នកប្រាកដថាចង់លុបសិស្ស "${s.name}" មែនទេ?`)) return;
    try {
      await deleteDoc(doc(db, "students", s.id));
      onAlert(`បានលុបសិស្ស "${s.name}" ចេញ`);
      loadStudents();
    } catch (err) {
      onAlert(err.message, "error");
    }
  };

  const addStudent = async () => {
    if (!form.name || !form.className.trim()) { onAlert("សូមបំពេញឈ្មោះ និងឈ្មោះថ្នាក់!", "error"); return; }
    setSaving(true);
    try {
      const className = form.className.trim();
      await addDoc(collection(db, "students"), {
        name: form.name,
        age: Number(form.age) || null,
        gender: form.gender,
        className,
        createdAt: serverTimestamp(),
      });
      await ensureClassExists(className);
      refreshClasses();
      onAlert("បានបន្ថែមសិស្សជោគជ័យ!");
      setShowAdd(false);
      setForm({ name: "", age: "", gender: "ប្រុស", className: DEFAULT_CLASS });
      loadStudents();
    } catch (err) {
      onAlert(err.message, "error");
    }
    setSaving(false);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, alignItems: "center" }}>
        <select style={{ ...styles.select, width: 180 }} value={filterClass} onChange={e => setFilterClass(e.target.value)}>
          <option value="all">ថ្នាក់ទាំងអស់</option>
          {classNames.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button style={styles.btnSm("#6366f1")} onClick={() => setShowAdd(true)}>+ បន្ថែមសិស្ស</button>
      </div>
      <div style={styles.card}>
        <div style={styles.cardTitle}>👨‍🎓 បញ្ជីសិស្ស ({filtered.length} នាក់)</div>
        {loading ? <div style={styles.spinner}>⏳ កំពុងផ្ទុក...</div> : (
          <table style={styles.table}>
            <thead><tr>{["#", "ឈ្មោះ", "ភេទ", "អាយុ", "ថ្នាក់", ""].map(h => <th key={h} style={styles.th}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={s.id}>
                  <td style={{ ...styles.td, color: "#475569" }}>{i + 1}</td>
                  <td style={styles.td}><strong style={{ color: "#f1f5f9" }}>{s.name}</strong></td>
                  <td style={styles.td}>{s.gender}</td>
                  <td style={styles.td}>{s.age ? `${s.age} ឆ្នាំ` : "—"}</td>
                  <td style={styles.td}><span style={styles.badge("#60a5fa", "#1e3a5f")}>{s.className}</span></td>
                  <td style={styles.td}><button style={styles.btnSm("#ef4444")} onClick={() => deleteStudent(s)}>លុប</button></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ ...styles.td, textAlign: "center", color: "#475569" }}>📭 មិនទាន់មានសិស្ស</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && (
        <div style={styles.modal}>
          <div style={styles.modalCard}>
            <h3 style={{ color: "#f1f5f9", marginBottom: 16, fontSize: 16 }}>➕ បន្ថែមសិស្សថ្មី</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={styles.label}>ឈ្មោះ</label>
              <input style={styles.input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={styles.label}>អាយុ</label>
              <input style={styles.input} value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={styles.label}>ភេទ</label>
              <select style={styles.select} value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                <option>ប្រុស</option><option>ស្រី</option>
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={styles.label}>ថ្នាក់</label>
              <input style={styles.input} list="class-suggestions-student" placeholder="ឧទាហរណ៍: 300 or A4, 402"
                value={form.className} onChange={e => setForm({ ...form, className: e.target.value })} />
              <datalist id="class-suggestions-student">
                {classNames.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...styles.btnSm("#6366f1"), flex: 1, padding: "10px", opacity: saving ? 0.6 : 1 }} onClick={addStudent} disabled={saving}>
                {saving ? "កំពុងរក្សាទុក..." : "រក្សាទុក"}
              </button>
              <button style={{ ...styles.btnSm("#475569"), flex: 1, padding: "10px" }} onClick={() => setShowAdd(false)} disabled={saving}>បោះបង់</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SCHEDULES PAGE (read-only; created automatically when Admin
// adds a teacher — see TeachersPage)
// ═══════════════════════════════════════════════════════════════
function SchedulesPage() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "schedules"));
      setSchedules(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    })();
  }, []);

  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>📅 ម៉ោងបង្រៀនទាំងអស់</div>
      {loading ? <div style={styles.spinner}>⏳ កំពុងផ្ទុក...</div> : (
        <table style={styles.table}>
          <thead><tr>{["គ្រូ", "ថ្នាក់", "ម៉ោងចាប់ផ្តើម", "ម៉ោងបញ្ចប់", "ថ្ងៃខែ"].map(h => <th key={h} style={styles.th}>{h}</th>)}</tr></thead>
          <tbody>
            {schedules.map(sch => (
              <tr key={sch.id}>
                <td style={styles.td}><strong style={{ color: "#f1f5f9" }}>{sch.teacherName}</strong></td>
                <td style={styles.td}>{sch.className}</td>
                <td style={styles.td}><span style={{ color: "#34d399" }}>🕐 {sch.startTime}</span></td>
                <td style={styles.td}><span style={{ color: "#f97316" }}>🕑 {sch.endTime}</span></td>
                <td style={styles.td}>{sch.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div style={{ fontSize: 11, color: "#475569", marginTop: 12 }}>
        💡 ម៉ោងរៀនត្រូវបានបង្កើតដោយស្វ័យប្រវត្តិនៅពេល Admin បន្ថែមគ្រូថ្មីនៅទំព័រ "គ្រូបង្រៀន"។
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// REPORTS PAGE
// ═══════════════════════════════════════════════════════════════
function ReportsPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const snap = await getDocs(query(collection(db, "attendance"), where("date", "==", todayStr())));
      setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    })();
  }, []);

  const statusCount = { A: 0, P: 0, Pe: 0, L: 0 };
  records.forEach(r => { if (statusCount[r.status] !== undefined) statusCount[r.status]++; });
  const total = records.length;

  return (
    <div>
      <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
          <div key={k} style={styles.statCard(v.color)}>
            <div style={styles.statVal(v.color)}>{statusCount[k]}</div>
            <div style={styles.statLabel}>{v.full}</div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{total ? Math.round(statusCount[k] / total * 100) : 0}%</div>
          </div>
        ))}
      </div>

      <div style={styles.card}>
        <div style={styles.cardTitle}>📋 តារាងអវត្តមានសិស្ស (ថ្ងៃនេះ)</div>
        {loading ? <div style={styles.spinner}>⏳ កំពុងផ្ទុក...</div> :
          records.length === 0
            ? <div style={{ color: "#475569", fontSize: 13, textAlign: "center", padding: 24 }}>⚠️ មិនទាន់មានទិន្នន័យ — គ្រូនៅមិនទាន់ស្រង់</div>
            : <table style={styles.table}>
                <thead><tr>{["សិស្ស", "ថ្នាក់", "ស្ថានភាព", "ម៉ោងស្រង់"].map(h => <th key={h} style={styles.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {records.map(r => {
                    const cfg = STATUS_CONFIG[r.status];
                    return (
                      <tr key={r.id}>
                        <td style={styles.td}>{r.studentName}</td>
                        <td style={styles.td}>{r.className}</td>
                        <td style={styles.td}><span style={styles.badge(cfg.color, cfg.bg)}>{cfg.label} — {cfg.full}</span></td>
                        <td style={styles.td}>{r.submittedAt?.toDate ? r.submittedAt.toDate().toLocaleTimeString("km-KH") : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAKE ATTENDANCE PAGE (Teacher) — writes real docs to Firestore,
// time-locked to the teacher's own schedule window.
// ═══════════════════════════════════════════════════════════════
function TakeAttendancePage({ user, onAlert }) {
  const [schedules, setSchedules] = useState([]);
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [localStatus, setLocalStatus] = useState({});
  const [submittedSchedules, setSubmittedSchedules] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const timeStr = nowTimeStr();
  const date = todayStr();

  useEffect(() => {
    (async () => {
      setLoading(true);
      const schedSnap = await getDocs(query(collection(db, "schedules"), where("teacherId", "==", user.uid), where("date", "==", date)));
      const scheds = schedSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSchedules(scheds);

      const studSnap = await getDocs(query(collection(db, "students"), where("className", "==", user.className || "")));
      setStudents(studSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const submittedMap = {};
      for (const s of scheds) {
        const attSnap = await getDocs(query(collection(db, "attendance"), where("scheduleId", "==", s.id), where("date", "==", date)));
        submittedMap[s.id] = !attSnap.empty;
      }
      setSubmittedSchedules(submittedMap);

      const active = scheds.find(s => timeStr >= s.startTime && timeStr <= s.endTime);
      setSelected(active?.id || scheds[0]?.id || null);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const schedule = schedules.find(s => s.id === selected);
  const isAllowed = schedule && timeStr >= schedule.startTime && timeStr <= schedule.endTime && !submittedSchedules[selected];

  const setStatus = (sid, status) => {
    if (!isAllowed) { onAlert("⏰ មិនទាន់ដល់ម៉ោងបង្រៀន ឬបានស្រង់រួចហើយ!", "error"); return; }
    setLocalStatus(prev => ({ ...prev, [sid]: status }));
  };

  const submit = async () => {
    if (!isAllowed) { onAlert("⏰ មិនទាន់ដល់ម៉ោងបង្រៀនទេ!", "error"); return; }
    const missing = students.filter(s => !localStatus[s.id]);
    if (missing.length > 0) { onAlert(`⚠️ ត្រូវស្រង់ ${missing.length} នាក់ទៀត!`, "error"); return; }

    setSubmitting(true);
    try {
      const batch = writeBatch(db);
      students.forEach(s => {
        const ref = doc(collection(db, "attendance"));
        batch.set(ref, {
          scheduleId: schedule.id,
          studentId: s.id,
          studentName: s.name,
          className: s.className,
          teacherId: user.uid,
          status: localStatus[s.id],
          date,
          submittedAt: serverTimestamp(),
        });
      });
      await batch.commit();
      setSubmittedSchedules(prev => ({ ...prev, [schedule.id]: true }));
      onAlert("✅ បានស្រង់អវត្តមានជោគជ័យ!");
    } catch (err) {
      onAlert(err.message, "error");
    }
    setSubmitting(false);
  };

  if (loading) return <div style={styles.spinner}>⏳ កំពុងផ្ទុកទិន្នន័យ...</div>;

  if (schedules.length === 0) {
    return <div style={{ ...styles.card, textAlign: "center", color: "#475569", padding: 40 }}>📭 មិនមានម៉ោងបង្រៀនថ្ងៃនេះ</div>;
  }

  return (
    <div>
      <div style={styles.card}>
        <div style={styles.cardTitle}>📋 ជ្រើសម៉ោង</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {schedules.map(s => {
            const active = timeStr >= s.startTime && timeStr <= s.endTime;
            const past = timeStr > s.endTime;
            const done = submittedSchedules[s.id];
            return (
              <button key={s.id} onClick={() => setSelected(s.id)} style={{
                padding: "10px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600,
                background: selected === s.id ? "#312e81" : "#0f172a",
                color: selected === s.id ? "#a78bfa" : "#94a3b8",
                border: selected === s.id ? "2px solid #6366f1" : "1px solid #334155",
              }}>
                {done ? "✅" : active ? "🟡" : past ? "🔴" : "⏳"} {s.startTime}–{s.endTime}
              </button>
            );
          })}
        </div>
      </div>

      {schedule && (
        <>
          <div style={{ ...styles.card, border: isAllowed ? "1px solid #16a34a" : "1px solid #dc2626", background: isAllowed ? "#052e16" : "#450a0a", marginBottom: 8 }}>
            <div style={{ fontSize: 13, color: isAllowed ? "#86efac" : "#fca5a5" }}>
              {submittedSchedules[selected]
                ? "✅ បានស្រង់អវត្តមានរួចហើយសម្រាប់ម៉ោងនេះ"
                : isAllowed
                  ? "✅ ម៉ោងបង្រៀន — អាចស្រង់បាន"
                  : `⏰ ម៉ោងបង្រៀនចាប់ ${schedule.startTime}–${schedule.endTime} — ${timeStr < schedule.startTime ? "មិនទាន់ដល់ម៉ោង" : "ផុតម៉ោងហើយ"}`}
            </div>
          </div>

          <div style={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={styles.cardTitle}>👨‍🎓 បញ្ជីសិស្ស — {schedule.className}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button style={styles.btnSm("#475569")} disabled={!isAllowed} onClick={() => {
                  const all = {}; students.forEach(s => { all[s.id] = "P"; }); setLocalStatus(all);
                }}>✅ P ទាំងអស់</button>
                <button style={{ ...styles.btnSm("#6366f1"), padding: "6px 20px", opacity: submitting || !isAllowed ? 0.6 : 1 }} onClick={submit} disabled={submitting || !isAllowed}>
                  {submitting ? "កំពុងរក្សាទុក..." : "💾 Submit"}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 12, padding: "8px 0", borderBottom: "1px solid #334155" }}>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: v.color }} />
                  <span style={{ color: "#64748b" }}>{k} = {v.full}</span>
                </div>
              ))}
            </div>

            <table style={styles.table}>
              <thead><tr>{["#", "ឈ្មោះ", "ភេទ", "ស្ថានភាព"].map(h => <th key={h} style={styles.th}>{h}</th>)}</tr></thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={s.id} style={{ background: localStatus[s.id] ? `${STATUS_CONFIG[localStatus[s.id]]?.bg}20` : "transparent" }}>
                    <td style={{ ...styles.td, color: "#475569" }}>{i + 1}</td>
                    <td style={styles.td}><strong style={{ color: "#f1f5f9" }}>{s.name}</strong></td>
                    <td style={styles.td}>{s.gender}</td>
                    <td style={styles.td}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {Object.keys(STATUS_CONFIG).map(k => (
                          <button key={k} style={styles.statusBtn(k, localStatus[s.id] === k)} onClick={() => setStatus(s.id, k)} disabled={!isAllowed}>{k}</button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {students.length === 0 && (
                  <tr><td colSpan={4} style={{ ...styles.td, textAlign: "center", color: "#475569" }}>📭 មិនមានសិស្សក្នុងថ្នាក់នេះ — សូម Admin បន្ថែមសិស្ស</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
