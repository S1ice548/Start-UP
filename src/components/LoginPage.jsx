import React, { useState } from 'react';
import { Lock, Mail, Eye, EyeOff, LogIn, ShieldCheck } from 'lucide-react';

export default function LoginPage({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const USER_ACCOUNTS = [
    { id: 'admin', email: 'admin@neenoi.com', password: 'admin123', name: 'Admin User', role: 'admin' },
    { id: 'user1', email: 'user1@neenoi.com', password: 'user123', name: 'User 1', role: 'user' },
    { id: 'user2', email: 'user2@neenoi.com', password: 'user234', name: 'User 2', role: 'user' },
    { id: 'user3', email: 'user3@neenoi.com', password: 'user345', name: 'User 3', role: 'user' },
    { id: 'user1', email: 'user@example.com', password: 'user123', name: 'User 1', role: 'user' }
  ];

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    await new Promise(resolve => setTimeout(resolve, 800));

    const matchedUser = USER_ACCOUNTS.find(
      account => account.email.toLowerCase() === email.trim().toLowerCase() && account.password === password
    );

    if (matchedUser) {
      setLoading(false);
      onLoginSuccess({
        id: matchedUser.id,
        email: matchedUser.email,
        name: matchedUser.name,
        role: matchedUser.role,
        loginTime: new Date().toISOString()
      });
      return;
    }

    setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-slate-100 flex items-center justify-center p-4">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl opacity-30 animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Login Container */}
      <div className="relative w-full max-w-md">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center shadow-md shadow-indigo-500/25 text-white">
              <ShieldCheck className="w-7 h-7" />
            </div>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-1">
            หนี้น้อย (Nee Noi)
          </h1>
          <p className="text-sm text-slate-500 font-semibold">
            ระบบจัดการหนี้อัจฉริยะ | Smart Debt Management System
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* Main Card */}
          <div className="bg-white p-6 space-y-5 border border-slate-200 shadow-xl rounded-2xl">
            
            {/* Email Field */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-indigo-600" />
                อีเมล
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="กรอกอีเมลของคุณ"
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all font-medium text-sm"
                required
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-indigo-600" />
                รหัสผ่าน
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่าน"
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all font-medium text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                <span>⚠️</span>
                {error}
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white font-extrabold rounded-xl transition-all shadow-md shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogIn className="w-5 h-5" />
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </button>

          </div>
        </form>

        {/* Demo Credentials Info */}
        <div className="mt-6 p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200 space-y-2">
          <p className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
            💡 ข้อมูลทดสอบ (Demo Credentials):
          </p>
          <div className="space-y-1.5 text-xs text-indigo-950 font-mono font-semibold">
            <div>
              <span className="text-indigo-600 font-bold">Admin:</span> admin@neenoi.com / admin123
            </div>
            <div>
              <span className="text-indigo-600 font-bold">User 1:</span> user1@neenoi.com / user123
            </div>
            <div>
              <span className="text-indigo-600 font-bold">User 2:</span> user2@neenoi.com / user234
            </div>
            <div>
              <span className="text-indigo-600 font-bold">User 3:</span> user3@neenoi.com / user345
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <p className="text-center text-xs text-slate-500 mt-6 font-medium">
          ระบบเข้าสู่ระบบปลอดภัย | Secure Login System
        </p>

      </div>
    </div>
  );
}
