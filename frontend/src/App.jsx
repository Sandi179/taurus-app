// src/App.jsx
import { useState, createContext, useContext, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import '../src/styles/main.css';
import api from './utils/api';

// Pages
import Dashboard   from './pages/Dashboard';
import Purchase    from './pages/Purchase';
import Issue       from './pages/Issue';
import Fuel        from './pages/Fuel';
import Trips       from './pages/Trips';
import Invoicing   from './pages/Invoicing';
import Reports     from './pages/Reports';
import Trucks      from './pages/Trucks';
import Drivers     from './pages/Drivers';
import Stock       from './pages/Stock';
import Expenditure from './pages/Expenditure';
import Revenue     from './pages/Revenue';
import Maintenance from './pages/Maintenance';
import Users       from './pages/Users';

// Auth context
const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });

  const login = (userData, access, refresh) => {
    localStorage.setItem('access',  access);
    localStorage.setItem('refresh', refresh);
    localStorage.setItem('user',    JSON.stringify(userData));
    setUser(userData);
  };

  const logout = async () => {
    try { await api.post('/auth/logout/', { refresh: localStorage.getItem('refresh') }); } catch {}
    localStorage.clear();
    setUser(null);
  };

  return <AuthCtx.Provider value={{ user, login, logout }}>{children}</AuthCtx.Provider>;
}

// ── Login Page ──────────────────────────────────────────────
function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [pass,  setPass]  = useState('');
  const [err,   setErr]   = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault(); setErr(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/login/', { email, password: pass });
      login(data.user, data.access, data.refresh);
      nav('/');
    } catch {
      setErr('Invalid email or password.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 40, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, background: 'var(--amber)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800, color: 'var(--navy)', margin: '0 auto 14px' }}>T</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--navy)' }}>Taurus Trade &amp; Logistics</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Enterprise Resource Planning System</div>
        </div>
        {err && <div className="alert alert-danger mb12">{err}</div>}
        <form onSubmit={onSubmit}>
          <div className="fg mb12">
            <label>Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@taurus.com" required autoFocus />
          </div>
          <div className="fg mb16">
            <label>Password</label>
            <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" required />
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginBottom: 12, padding: '6px 10px', background: '#f8fafc', borderRadius: 6, border: '1px solid var(--border)' }}>
            🔑 Default: <strong>admin@taurus.com</strong> / <strong>admin1234</strong>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 14 }} disabled={loading}>
            {loading ? '⏳ Signing in…' : '→ Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Sidebar Navigation ──────────────────────────────────────
const NAV = [
  { section: 'Overview',   items: [{ to:'/',           icon:'⬛', label:'Dashboard'    }] },
  { section: 'Fleet',      items: [
    { to:'/trucks',         icon:'🚛', label:'Trucks'        },
    { to:'/drivers',        icon:'👤', label:'Drivers'       },
    { to:'/trips',          icon:'🗺️', label:'Trips'         },
    { to:'/fuel',           icon:'⛽', label:'Fuel Control'  },
  ]},
  { section: 'Inventory',  items: [
    { to:'/purchase',       icon:'📥', label:'Purchase'      },
    { to:'/issue',          icon:'📤', label:'Issue Items'   },
    { to:'/stock',          icon:'📦', label:'Stock Ledger'  },
  ]},
  { section: 'Finance',    items: [
    { to:'/invoicing',      icon:'🧾', label:'Invoicing'     },
    { to:'/expenditure',    icon:'💸', label:'Expenditure'   },
    { to:'/revenue',        icon:'💰', label:'Revenue'       },
  ]},
  { section: 'Operations', items: [
    { to:'/maintenance',    icon:'🛠️', label:'Maintenance'   },
    { to:'/reports',        icon:'📊', label:'Reports'       },
  ]},
  { section: 'Admin',      items: [
    { to:'/users',          icon:'👥', label:'User Mgmt'     },
  ]},
];

const PAGE_TITLES = {
  '/':            'Dashboard',
  '/trucks':      'Truck Management',
  '/drivers':     'Driver Management',
  '/trips':       'Trip Management',
  '/fuel':        'Fuel Control',
  '/purchase':    'Purchase Entry',
  '/issue':       'Issue Items',
  '/stock':       'Stock Ledger',
  '/invoicing':   'Invoicing',
  '/expenditure': 'Expenditure',
  '/revenue':     'Revenue',
  '/maintenance': 'Maintenance',
  '/reports':     'Reports',
  '/users':       'User Management',
};

function Sidebar() {
  const { logout, user } = useAuth();
  const location = useLocation();

  // Filter Admin section for non-admins
  const nav = NAV.filter(group => {
    if (group.section === 'Admin') return user?.role === 'ADMIN';
    return true;
  });

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-badge">T</div>
        <div className="logo-name">Taurus Trade</div>
        <div className="logo-sub">&amp; Logistics ERP</div>
      </div>
      {nav.map(group => (
        <div className="nav-group" key={group.section}>
          <div className="nav-section-label">{group.section}</div>
          {group.items.map(item => {
            const isActive = location.pathname === item.to;
            return (
              <div key={item.to} className={`nav-item ${isActive ? 'active' : ''}`}
                   onClick={() => window.location.href = item.to}>
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </div>
            );
          })}
        </div>
      ))}
      <div style={{ marginTop: 'auto', padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,.07)' }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginBottom: 6 }}>Signed in as</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', fontWeight: 500, marginBottom: 8 }}>
          {user?.first_name} {user?.last_name}
          <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--amber)', fontWeight: 600 }}>{user?.role}</span>
        </div>
        <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center', color: 'rgba(255,255,255,.5)', borderColor: 'rgba(255,255,255,.1)' }} onClick={logout}>
          Sign Out
        </button>
      </div>
    </aside>
  );
}

function Topbar() {
  const location = useLocation();
  const { user } = useAuth();
  const title    = PAGE_TITLES[location.pathname] || 'Taurus ERP';
  const today    = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' });
  const initials = user ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() : 'U';

  return (
    <div className="topbar">
      <div className="topbar-title">{title}</div>
      <div className="tb-pill">{today}</div>
      <div className="tb-pill">GH₵ · Ghana Cedi</div>
      <div className="topbar-avatar" title={`${user?.first_name} ${user?.last_name} (${user?.role})`}>{initials}</div>
    </div>
  );
}

function ProtectedLayout({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="layout">
      <Sidebar />
      <div className="main-wrap">
        <Topbar />
        <div className="page-body">{children}</div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 3500, style: { fontFamily: 'Inter, sans-serif', fontSize: 13 } }} />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/"            element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
          <Route path="/purchase"    element={<ProtectedLayout><Purchase /></ProtectedLayout>} />
          <Route path="/issue"       element={<ProtectedLayout><Issue /></ProtectedLayout>} />
          <Route path="/fuel"        element={<ProtectedLayout><Fuel /></ProtectedLayout>} />
          <Route path="/trips"       element={<ProtectedLayout><Trips /></ProtectedLayout>} />
          <Route path="/invoicing"   element={<ProtectedLayout><Invoicing /></ProtectedLayout>} />
          <Route path="/reports"     element={<ProtectedLayout><Reports /></ProtectedLayout>} />
          <Route path="/trucks"      element={<ProtectedLayout><Trucks /></ProtectedLayout>} />
          <Route path="/drivers"     element={<ProtectedLayout><Drivers /></ProtectedLayout>} />
          <Route path="/stock"       element={<ProtectedLayout><Stock /></ProtectedLayout>} />
          <Route path="/expenditure" element={<ProtectedLayout><Expenditure /></ProtectedLayout>} />
          <Route path="/revenue"     element={<ProtectedLayout><Revenue /></ProtectedLayout>} />
          <Route path="/maintenance" element={<ProtectedLayout><Maintenance /></ProtectedLayout>} />
          <Route path="/users"       element={<ProtectedLayout><Users /></ProtectedLayout>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
