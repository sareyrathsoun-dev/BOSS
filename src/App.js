import { useState, useEffect, useCallback } from "react";
import { db } from "./firebase";
import { 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  writeBatch, 
  serverTimestamp, 
  query, 
  where 
} from "firebase/firestore";

// ─── MOCK DATA ────────────────────────────────────────────────
const MOCK_USERS = {
  admin1: { uid: "admin1", name: "លោក សុខ ដារ៉ា", role: "admin", email: "admin@school.edu.kh" },
  teacher1: { uid: "teacher1", name: "លោកគ្រូ ចាន់ សុភា", role: "teacher", subject: "គណិតវិទ្យា", classId: "class1", age: 35, gender: "ប្រុស" },
  teacher2: { uid: "teacher2", name: "លោកគ្រូ រ៉ែម សុខលី", role: "teacher", subject: "រូបវិទ្យា", classId: "class2", age: 30, gender: "ស្រី" },
  teacher3: { uid: "teacher3", name: "លោកគ្រូ ហេង វុទ្ធី", role: "teacher", subject: "ជីវវិទ្យា", classId: "class1", age: 40, gender: "ប្រុស" },
};

const MOCK_CLASSES = {
  class1: { id: "class1", name: "ថ្នាក់ទី ១២A" },
  class2: { id: "class2", name: "ថ្នាក់ទី ១១B" },
};

const MOCK_STUDENTS = {
  s1: { id: "s1", name: "គង់ សុភ័ក្ត្រ", age: 17, gender: "ប្រុស", classId: "class1" },
  s2: { id: "s2", name: "លី ច័ន្ទតារា", age: 16, gender: "ស្រី", classId: "class1" },
  s3: { id: "s3", name: "ហោ វណ្ណៈ", age: 17, gender: "ប្រុស", classId: "class1" },
  s4: { id: "s4", name: "ផន សុភារ័ត្ន", age: 16, gender: "ស្រី", classId: "class1" },
  s5: { id: "s5", name: "ទូច មករា", age: 17, gender: "ប្រុស", classId: "class2" },
  s6: { id: "s6", name: "ស្រីពេជ្រ", age: 16, gender: "ស្រី", classId: "class2" },
};

const today = new Date().toISOString().split("T")[0];
const MOCK_SCHEDULES = [
  { id: "sch1", teacherId: "teacher1", classId: "class1", date: today, startTime: "07:30", endTime: "09:00" },
  { id: "sch2", teacherId: "teacher2", classId: "class2", date: today, startTime: "09:00", endTime: "10:30" },
  { id: "sch3", teacherId: "teacher3", classId: "class1", date: today, startTime: "10:30", endTime: "12:00" },
];

// ─── ATTENDANCE STATUS CONFIG ─────────────────────────────────
const STATUS_CONFIG = {
  A:  { label: "A",  full: "Absent",     color: "#ef4444", bg: "#fef2f2", border: "#fca5a5" },
  P:  { label: "P",  full: "Present",    color: "#22c55e", bg: "#f0fdf4", border: "#86efac" },
  Pe: { label: "Pe", full: "Permission", color: "#3b82f6", bg: "#eff6ff", border: "#93c5fd" },
  L:  { label: "L",  full: "Late",       color: "#eab308", bg: "#fefce8", border: "#fde047" },
};

// ─── STYLES ────────────────────────────────────────────────────
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
    const map = { admin: ["#a78bfa", "#2e1065"], teacher: ["#34d399", "#064e3b"], viewer: ["#60a5fa", "#1e3a5f"] };
    const [c, bg] = map[role] || ["#94a3b8", "#1e293b"];
    return { padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600, color: c, background: bg };
  },
  modal: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
  modalCard: { background: "#1e293b", border: "1px solid #334155", borderRadius: 16, padding: 28, width: 420, maxWidth: "90vw" },
  select: { background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "8px 12px", color: "#e2e8f0", fontSize: 13, width: "100%", outline: "none" },
  btnSm: (color) => ({ background: color, color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }),
  alert: (type) => ({ background: type === "success" ? "#052e16" : "#450a0a", border: `1px solid ${type === "success" ? "#16a34a" : "#dc2626"}`, borderRadius: 8, padding: "10px 16px", fontSize: 13, color: type === "success" ? "#86efac" : "#fca5a5", marginBottom: 12 }),
};

// ─── MAIN APP ─────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [attendance, setAttendance] = useState({});
  const [alert, setAlert] = useState(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);

  const showAlert = (msg, type = "success") => {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 3000);
  };

  const login = (uid) => {
    setUser(MOCK_USERS[uid]);
    setPage("dashboard");
  };

  const logout = () => { setUser(null); setPage("dashboard"); };

  if (!user) return <LoginPage onLogin={login} />;

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
      {/* SIDEBAR */}
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
          <div style={styles.tag(user.role)}>{user.role === "admin" ? "អ្នកគ្រប់គ្រង" : "គ្រូបង្រៀន"}</div>
          <button onClick={logout} style={{ ...styles.btnSm("#ef4444"), marginTop: 10, width: "100%" }}>ចាកចេញ</button>
        </div>
      </div>

      {/* MAIN */}
      <div style={styles.main}>
        <div style={styles.topbar}>
          <h1 style={styles.pageTitle}>
            {navItems.find(n => n.id === page)?.icon} {navItems.find(n => n.id === page)?.label}
          </h1>
          <div style={{ fontSize: 12, color: "#64748b" }}>📅 {new Date().toLocaleDateString("km-KH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
        </div>
        <div style={styles.content}>
          {alert && <div style={styles.alert(alert.type)}>{alert.type === "success" ? "✅" : "❌"} {alert.msg}</div>}

          {page === "dashboard" && <Dashboard user={user} attendance={attendance} />}
          {page === "teachers" && user.role === "admin" && <TeachersPage onAlert={showAlert} showAdd={showAddUser} setShowAdd={setShowAddUser} />}
          {page === "students" && user.role === "admin" && <StudentsPage onAlert={showAlert} showAdd={showAddStudent} setShowAdd={setShowAddStudent} />}
          {page === "schedules" && user.role === "admin" && <SchedulesPage onAlert={showAlert} />}
          {page === "reports" && user.role === "admin" && <ReportsPage attendance={attendance} />}
          {page === "take_attendance" && user.role === "teacher" && (
            <TakeAttendancePage user={user} attendance={attendance} setAttendance={setAttendance} onAlert={showAlert} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── LOGIN PAGE ───────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [selected, setSelected] = useState("");
  const users = [
    { uid: "admin1", label: "👑 Admin — លោក សុខ ដារ៉ា" },
    { uid: "teacher1", label: "👨‍🏫 គ្រូ ចាន់ សុភា (គណិតវិទ្យា)" },
    { uid: "teacher2", label: "👩‍🏫 គ្រូ រ៉ែម សុខលី (រូបវិទ្យា)" },
  ];
  return (
    <div style={styles.loginWrap}>
      <div style={styles.loginCard}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 48 }}>🏫</div>
        </div>
        <h2 style={styles.loginTitle}>ប្រព័ន្ធគ្រប់គ្រងអវត្តមាន</h2>
        <p style={styles.loginSub}>School Attendance Management System</p>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 6 }}>ជ្រើសរើសអ្នកប្រើ (DEMO)</label>
          <select style={styles.select} value={selected} onChange={e => setSelected(e.target.value)}>
            <option value="">-- ជ្រើសរើស --</option>
            {users.map(u => <option key={u.uid} value={u.uid}>{u.label}</option>)}
          </select>
        </div>
        <button style={styles.btnPrimary} onClick={() => selected && onLogin(selected)} disabled={!selected}>
          ចូលប្រើប្រាស់
        </button>
        <div style={{ marginTop: 16, padding: 12, background: "#0f172a", borderRadius: 8, fontSize: 11, color: "#475569" }}>
          <strong style={{ color: "#64748b" }}>Firebase Auth:</strong> ក្នុង production, ប្រើ signInWithEmailAndPassword() + role-based Firestore rules
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────
function Dashboard({ user, attendance }) {
  const todaySchedules = MOCK_SCHEDULES.filter(s =>
    user.role === "admin" ? true : s.teacherId === user.uid
  );
  const totalStudents = Object.values(MOCK_STUDENTS).filter(s =>
    user.role === "admin" ? true : s.classId === user.classId
  ).length;

  const submitted = Object.keys(attendance).length;
  const now = new Date();
  const timeStr = now.toTimeString().slice(0, 5);

  return (
    <div>
      <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
        {[
          { val: todaySchedules.length, label: "ម៉ោងរៀនថ្ងៃនេះ", color: "#a78bfa" },
          { val: totalStudents, label: "សិស្សទាំងអស់", color: "#34d399" },
          { val: submitted, label: "បានស្រង់ហើយ", color: "#60a5fa" },
          { val: todaySchedules.length - submitted, label: "មិនទាន់ស្រង់", color: "#f97316" },
        ].map((s, i) => (
          <div key={i} style={styles.statCard(s.color)}>
            <div style={styles.statVal(s.color)}>{s.val}</div>
            <div style={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={styles.card}>
        <div style={styles.cardTitle}>📅 ម៉ោងបង្រៀនថ្ងៃនេះ</div>
        <table style={styles.table}>
          <thead>
            <tr>
              {["គ្រូ", "ថ្នាក់", "ម៉ោង", "ស្ថានភាព"].map(h => <th key={h} style={styles.th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {todaySchedules.map(sch => {
              const teacher = MOCK_USERS[sch.teacherId];
              const cls = MOCK_CLASSES[sch.classId];
              const isActive = timeStr >= sch.startTime && timeStr <= sch.endTime;
              const isPast = timeStr > sch.endTime;
              const hasSubmitted = attendance[sch.id];
              return (
                <tr key={sch.id}>
                  <td style={styles.td}>{teacher?.name}</td>
                  <td style={styles.td}>{cls?.name}</td>
                  <td style={styles.td}>{sch.startTime} – {sch.endTime}</td>
                  <td style={styles.td}>
                    {hasSubmitted
                      ? <span style={styles.badge("#22c55e", "#052e16")}>✅ បានស្រង់</span>
                      : isActive
                        ? <span style={styles.badge("#eab308", "#422006")}>🟡 ចំម៉ោងបង្រៀន</span>
                        : isPast
                          ? <span style={styles.badge("#ef4444", "#450a0a")}>🔴 លើសម៉ោង / A</span>
                          : <span style={styles.badge("#64748b", "#0f172a")}>⏳ មិនទាន់ដល់ម៉ោង</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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

// ─── TEACHERS PAGE ────────────────────────────────────────────
function TeachersPage({ onAlert, showAdd, setShowAdd }) {
  const [teachers, setTeachers] = useState(
    Object.values(MOCK_USERS).filter(u => u.role === "teacher")
  );
  const [form, setForm] = useState({ name: "", age: "", gender: "ប្រុស", subject: "", classId: "class1" });

  const addTeacher = () => {
    if (!form.name || !form.subject) { onAlert("សូមបំពេញព័ត៌មានឱ្យបានគ្រប់!", "error"); return; }
    const newT = { uid: "t" + Date.now(), role: "teacher", ...form };
    setTeachers([...teachers, newT]);
    setShowAdd(false);
    setForm({ name: "", age: "", gender: "ប្រុស", subject: "", classId: "class1" });
    onAlert("បានបន្ថែមគ្រូជោគជ័យ! (Firebase: addDoc collection 'users'))");
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button style={styles.btnSm("#6366f1")} onClick={() => setShowAdd(true)}>+ បន្ថែមគ្រូ</button>
      </div>
      <div style={styles.card}>
        <div style={styles.cardTitle}>👨‍🏫 បញ្ជីគ្រូបង្រៀន</div>
        <table style={styles.table}>
          <thead>
            <tr>{["ឈ្មោះ", "ភេទ", "អាយុ", "មុខវិជ្ជា", "ថ្នាក់", "ស្ថានភាព"].map(h => <th key={h} style={styles.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {teachers.map(t => (
              <tr key={t.uid}>
                <td style={styles.td}><strong style={{ color: "#f1f5f9" }}>{t.name}</strong></td>
                <td style={styles.td}>{t.gender}</td>
                <td style={styles.td}>{t.age} ឆ្នាំ</td>
                <td style={styles.td}><span style={styles.badge("#a78bfa", "#1e1b4b")}>{t.subject}</span></td>
                <td style={styles.td}>{MOCK_CLASSES[t.classId]?.name || "—"}</td>
                <td style={styles.td}><span style={styles.badge("#34d399", "#052e16")}>✓ សកម្ម</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div style={styles.modal}>
          <div style={styles.modalCard}>
            <h3 style={{ color: "#f1f5f9", marginBottom: 16, fontSize: 16 }}>➕ បន្ថែមគ្រូថ្មី</h3>
            {[
              { label: "ឈ្មោះ", key: "name", ph: "ឈ្មោះគ្រូ" },
              { label: "អាយុ", key: "age", ph: "អាយុ" },
              { label: "មុខវិជ្ជា", key: "subject", ph: "មុខវិជ្ជា" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 4 }}>{f.label}</label>
                <input style={styles.input} placeholder={f.ph} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
              </div>
            ))}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 4 }}>ភេទ</label>
              <select style={styles.select} value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                <option>ប្រុស</option><option>ស្រី</option>
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 4 }}>ថ្នាក់</label>
              <select style={styles.select} value={form.classId} onChange={e => setForm({ ...form, classId: e.target.value })}>
                {Object.values(MOCK_CLASSES).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...styles.btnSm("#6366f1"), flex: 1, padding: "10px" }} onClick={addTeacher}>រក្សាទុក</button>
              <button style={{ ...styles.btnSm("#475569"), flex: 1, padding: "10px" }} onClick={() => setShowAdd(false)}>បោះបង់</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── STUDENTS PAGE ────────────────────────────────────────────
function StudentsPage({ onAlert, showAdd, setShowAdd }) {
  const [students, setStudents] = useState(Object.values(MOCK_STUDENTS));
  const [filterClass, setFilterClass] = useState("all");
  const [form, setForm] = useState({ name: "", age: "", gender: "ប្រុស", classId: "class1" });

  const filtered = filterClass === "all" ? students : students.filter(s => s.classId === filterClass);

  const addStudent = () => {
    if (!form.name) { onAlert("សូមបំពេញឈ្មោះ!", "error"); return; }
    setStudents([...students, { id: "s" + Date.now(), ...form }]);
    setShowAdd(false);
    setForm({ name: "", age: "", gender: "ប្រុស", classId: "class1" });
    onAlert("បានបន្ថែមសិស្សជោគជ័យ!");
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, alignItems: "center" }}>
        <select style={{ ...styles.select, width: 180 }} value={filterClass} onChange={e => setFilterClass(e.target.value)}>
          <option value="all">ថ្នាក់ទាំងអស់</option>
          {Object.values(MOCK_CLASSES).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button style={styles.btnSm("#6366f1")} onClick={() => setShowAdd(true)}>+ បន្ថែមសិស្ស</button>
      </div>
      <div style={styles.card}>
        <div style={styles.cardTitle}>👨‍🎓 បញ្ជីសិស្ស ({filtered.length} នាក់)</div>
        <table style={styles.table}>
          <thead>
            <tr>{["#", "ឈ្មោះ", "ភេទ", "អាយុ", "ថ្នាក់"].map(h => <th key={h} style={styles.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr key={s.id}>
                <td style={{ ...styles.td, color: "#475569" }}>{i + 1}</td>
                <td style={styles.td}><strong style={{ color: "#f1f5f9" }}>{s.name}</strong></td>
                <td style={styles.td}>{s.gender}</td>
                <td style={styles.td}>{s.age} ឆ្នាំ</td>
                <td style={styles.td}><span style={styles.badge("#60a5fa", "#1e3a5f")}>{MOCK_CLASSES[s.classId]?.name}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div style={styles.modal}>
          <div style={styles.modalCard}>
            <h3 style={{ color: "#f1f5f9", marginBottom: 16, fontSize: 16 }}>➕ បន្ថែមសិស្សថ្មី</h3>
            {[{ label: "ឈ្មោះ", key: "name", ph: "ឈ្មោះសិស្ស" }, { label: "អាយុ", key: "age", ph: "អាយុ" }].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 4 }}>{f.label}</label>
                <input style={styles.input} placeholder={f.ph} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
              </div>
            ))}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 4 }}>ភេទ</label>
              <select style={styles.select} value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                <option>ប្រុស</option><option>ស្រី</option>
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 4 }}>ថ្នាក់</label>
              <select style={styles.select} value={form.classId} onChange={e => setForm({ ...form, classId: e.target.value })}>
                {Object.values(MOCK_CLASSES).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...styles.btnSm("#6366f1"), flex: 1, padding: "10px" }} onClick={addStudent}>រក្សាទុក</button>
              <button style={{ ...styles.btnSm("#475569"), flex: 1, padding: "10px" }} onClick={() => setShowAdd(false)}>បោះបង់</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SCHEDULES PAGE ───────────────────────────────────────────
function SchedulesPage({ onAlert }) {
  return (
    <div>
      <div style={styles.card}>
        <div style={styles.cardTitle}>📅 ម៉ោងបង្រៀនថ្ងៃនេះ</div>
        <table style={styles.table}>
          <thead>
            <tr>{["គ្រូ", "មុខវិជ្ជា", "ថ្នាក់", "ម៉ោងចាប់ផ្តើម", "ម៉ោងបញ្ចប់", "ថ្ងៃខែ"].map(h => <th key={h} style={styles.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {MOCK_SCHEDULES.map(sch => {
              const t = MOCK_USERS[sch.teacherId];
              return (
                <tr key={sch.id}>
                  <td style={styles.td}><strong style={{ color: "#f1f5f9" }}>{t?.name}</strong></td>
                  <td style={styles.td}><span style={styles.badge("#a78bfa", "#1e1b4b")}>{t?.subject}</span></td>
                  <td style={styles.td}>{MOCK_CLASSES[sch.classId]?.name}</td>
                  <td style={styles.td}><span style={{ color: "#34d399" }}>🕐 {sch.startTime}</span></td>
                  <td style={styles.td}><span style={{ color: "#f97316" }}>🕑 {sch.endTime}</span></td>
                  <td style={styles.td}>{sch.date}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ ...styles.card, background: "#0c1a2e", border: "1px solid #1e3a5f" }}>
        <div style={styles.cardTitle}>⚙️ Firebase Logic — Auto-mark Absent</div>
        <pre style={{ fontSize: 11, color: "#93c5fd", lineHeight: 1.6, overflow: "auto" }}>{`// Firebase Cloud Function (scheduled every 5 min)
exports.autoMarkTeacherAbsent = functions.pubsub
  .schedule("every 5 minutes").onRun(async () => {
    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 5); // "HH:MM"
    const dateStr = now.toISOString().split("T")[0];

    const schedSnap = await db.collection("schedules")
      .where("date", "==", dateStr)
      .where("endTime", "<=", timeStr).get();

    for (const doc of schedSnap.docs) {
      const sch = doc.data();
      // Check if teacher submitted attendance
      const attSnap = await db.collection("attendance")
        .where("scheduleId", "==", doc.id).limit(1).get();
      
      if (attSnap.empty) {
        // Mark teacher as Absent
        await db.collection("teacher_attendance").add({
          teacherId: sch.teacherId,
          scheduleId: doc.id,
          date: dateStr,
          status: "A", // Auto Absent
          markedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }
  });`}</pre>
      </div>
    </div>
  );
}

// ─── REPORTS PAGE ─────────────────────────────────────────────
function ReportsPage({ attendance }) {
  const records = Object.entries(attendance);
  const statusCount = { A: 0, P: 0, Pe: 0, L: 0 };
  records.forEach(([, data]) => {
    Object.values(data).forEach(status => { if (statusCount[status] !== undefined) statusCount[status]++; });
  });
  const total = Object.values(statusCount).reduce((a, b) => a + b, 0);

  return (
    <div>
      <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
          <div key={k} style={styles.statCard(v.color)}>
            <div style={styles.statVal(v.color)}>{statusCount[k]}</div>
            <div style={styles.statLabel}>{v.full}</div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>
              {total ? Math.round(statusCount[k] / total * 100) : 0}%
            </div>
          </div>
        ))}
      </div>

      <div style={styles.card}>
        <div style={styles.cardTitle}>📋 តារាងអវត្តមានសិស្ស (ថ្ងៃនេះ)</div>
        {records.length === 0
          ? <div style={{ color: "#475569", fontSize: 13, textAlign: "center", padding: 24 }}>⚠️ មិនទាន់មានទិន្នន័យ — គ្រូនៅមិនទាន់ស្រង់</div>
          : <table style={styles.table}>
              <thead>
                <tr>{["ម៉ោងរៀន", "សិស្ស", "ស្ថានភាព"].map(h => <th key={h} style={styles.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {records.map(([schedId, data]) =>
                  Object.entries(data).map(([sid, status]) => {
                    const sch = MOCK_SCHEDULES.find(s => s.id === schedId);
                    const st = MOCK_STUDENTS[sid];
                    const cfg = STATUS_CONFIG[status];
                    return (
                      <tr key={`${schedId}-${sid}`}>
                        <td style={styles.td}>{sch?.startTime}–{sch?.endTime}</td>
                        <td style={styles.td}>{st?.name}</td>
                        <td style={styles.td}><span style={styles.badge(cfg.color, cfg.bg)}>{cfg.label} — {cfg.full}</span></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
        }
      </div>
    </div>
  );
}

// ─── TAKE ATTENDANCE PAGE ─────────────────────────────────────
function TakeAttendancePage({ user, attendance, setAttendance, onAlert }) {
  const now = new Date();
  const timeStr = now.toTimeString().slice(0, 5);
  const mySchedules = MOCK_SCHEDULES.filter(s => s.teacherId === user.uid && s.date === today);
  const activeSchedule = mySchedules.find(s => timeStr >= s.startTime && timeStr <= s.endTime);
  const [selected, setSelected] = useState(activeSchedule?.id || mySchedules[0]?.id || null);
  const [localStatus, setLocalStatus] = useState({});

  const schedule = mySchedules.find(s => s.id === selected);
  const isAllowed = schedule && timeStr >= schedule.startTime && timeStr <= schedule.endTime;
  const students = Object.values(MOCK_STUDENTS).filter(s => s.classId === user.classId);

  useEffect(() => {
    if (selected && attendance[selected]) setLocalStatus(attendance[selected]);
    else setLocalStatus({});
  }, [selected]);

  const setStatus = (sid, status) => {
    if (!isAllowed) { onAlert("⏰ មិនទាន់ដល់ម៉ោងបង្រៀនទេ!", "error"); return; }
    setLocalStatus(prev => ({ ...prev, [sid]: status }));
  };

  const submit = () => {
    if (!isAllowed) { onAlert("⏰ មិនទាន់ដល់ម៉ោងបង្រៀនទេ!", "error"); return; }
    const missing = students.filter(s => !localStatus[s.id]);
    if (missing.length > 0) {
      onAlert(`⚠️ ត្រូវស្រង់ ${missing.length} នាក់ទៀត!`, "error"); return;
    }
    setAttendance(prev => ({ ...prev, [selected]: localStatus }));
    onAlert("✅ បានស្រង់អវត្តមានជោគជ័យ! (Firebase: setDoc to 'attendance' collection)");
  };

  return (
    <div>
      <div style={styles.card}>
        <div style={styles.cardTitle}>📋 ជ្រើសម៉ោង</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {mySchedules.map(s => {
            const active = timeStr >= s.startTime && timeStr <= s.endTime;
            const past = timeStr > s.endTime;
            const done = !!attendance[s.id];
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
              {isAllowed ? "✅ ម៉ោងបង្រៀន — អាចស្រង់បាន" : `⏰ ម៉ោងបង្រៀនចាប់ ${schedule.startTime}–${schedule.endTime} — ${timeStr < schedule.startTime ? "មិនទាន់ដល់ម៉ោង" : "ផុតម៉ោងហើយ"}`}
            </div>
          </div>

          <div style={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={styles.cardTitle}>👨‍🎓 បញ្ជីសិស្ស — {MOCK_CLASSES[schedule.classId]?.name}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button style={styles.btnSm("#475569")} onClick={() => {
                  const all = {};
                  students.forEach(s => { all[s.id] = "P"; });
                  setLocalStatus(all);
                }}>✅ P ទាំងអស់</button>
                <button style={{ ...styles.btnSm("#6366f1"), padding: "6px 20px" }} onClick={submit}>
                  💾 Submit
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
              <thead>
                <tr>{["#", "ឈ្មោះ", "ភេទ", "ស្ថានភាព"].map(h => <th key={h} style={styles.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={s.id} style={{ background: localStatus[s.id] ? `${STATUS_CONFIG[localStatus[s.id]]?.bg}20` : "transparent" }}>
                    <td style={{ ...styles.td, color: "#475569" }}>{i + 1}</td>
                    <td style={styles.td}><strong style={{ color: "#f1f5f9" }}>{s.name}</strong></td>
                    <td style={styles.td}>{s.gender}</td>
                    <td style={styles.td}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {Object.keys(STATUS_CONFIG).map(k => (
                          <button key={k} style={styles.statusBtn(k, localStatus[s.id] === k)} onClick={() => setStatus(s.id, k)}>
                            {k}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {mySchedules.length === 0 && (
        <div style={{ ...styles.card, textAlign: "center", color: "#475569", padding: 40 }}>
          📭 មិនមានម៉ោងបង្រៀនថ្ងៃនេះ
        </div>
      )}
    </div>
  );
}