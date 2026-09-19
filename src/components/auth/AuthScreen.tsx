import React, { useState } from 'react';
import { LogIn, UserPlus, Lock, Mail, Building2, Globe, Moon, Sun, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useDirection } from '@/context/DirectionContext';
import { useTheme } from '@/context/ThemeContext';

export const AuthScreen: React.FC = () => {
  const { accounts, signIn, signUp, error, clearError } = useAuth();
  const { language, toggleLanguage, isRTL } = useDirection();
  const { isDark, setTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currency, setCurrency] = useState('SAR');
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isAr = language === 'ar';

  const handleTabChange = (tab: 'signin' | 'signup') => {
    setActiveTab(tab);
    setFormError(null);
    clearError();
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!email.trim()) {
      setFormError(isAr ? 'يرجى إدخال البريد الإلكتروني أو اسم المستخدم' : 'Please enter your email or username');
      return;
    }

    setIsSubmitting(true);
    try {
      await signIn({ email: email.trim(), password, rememberMe });
    } catch (err: any) {
      setFormError(err?.message || (isAr ? 'فشل تسجيل الدخول' : 'Failed to sign in'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) {
      setFormError(isAr ? 'يرجى إدخال اسم الحساب أو الشركة' : 'Please enter your business or account name');
      return;
    }
    if (!email.trim()) {
      setFormError(isAr ? 'يرجى إدخال البريد الإلكتروني أو اسم المستخدم' : 'Please enter your email or username');
      return;
    }

    setIsSubmitting(true);
    try {
      await signUp({
        name: name.trim(),
        email: email.trim(),
        password,
        currency
      });
    } catch (err: any) {
      setFormError(err?.message || (isAr ? 'فشل إنشاء الحساب' : 'Failed to create account'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickAccountSelect = async (accountEmail: string) => {
    setEmail(accountEmail);
    // If the account has no password, attempt auto sign-in
    const target = accounts.find(a => a.email.toLowerCase() === accountEmail.toLowerCase());
    if (target && !target.passwordHash) {
      setIsSubmitting(true);
      try {
        await signIn({ email: accountEmail, rememberMe: true });
      } catch (err: any) {
        setFormError(err?.message);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col justify-between bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-white p-4">
      {/* Top Bar Controls (Language & Theme) */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center border border-emerald-500/40 shadow-sm">
            <img src="/icon.png" alt="App Logo" className="w-full h-full object-cover" />
          </div>
          <span className="font-bold text-sm tracking-tight text-white">
            {isAr ? 'ميزان — لإدارة الفواتير والحسابات' : 'Meezan — Invoicing & Accounts'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleLanguage}
            className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all flex items-center gap-1.5"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{isAr ? 'English' : 'العربية'}</span>
          </button>
          <button
            type="button"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="p-1.5 rounded-md text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all"
            aria-label="Theme toggle"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-300" />}
          </button>
        </div>
      </div>

      {/* Center Auth Card */}
      <div className="w-full max-w-md mx-auto my-auto py-6">
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800/80 rounded-2xl shadow-2xl p-6 sm:p-8 transition-all">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl overflow-hidden mx-auto mb-3 shadow-xl shadow-emerald-500/20 border border-emerald-500/40">
              <img src="/icon.png" alt="App Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              {activeTab === 'signin'
                ? (isAr ? 'تسجيل الدخول إلى حسابك' : 'Sign in to your account')
                : (isAr ? 'إنشاء حساب جديد مستقل' : 'Create a new isolated account')}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {activeTab === 'signin'
                ? (isAr ? 'اختر حسابك للوصول إلى فواتيرك وعملائك المعزولة' : 'Access your isolated invoices, clients and financial records')
                : (isAr ? 'بيانات هذا الحساب ستكون منفصلة بالكامل عن أي حساب آخر' : 'Data in this account is 100% private and isolated')}
            </p>
          </div>

          {/* Tab Selector */}
          <div className="grid grid-cols-2 p-1 bg-slate-950/70 border border-slate-800/80 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => handleTabChange('signin')}
              className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'signin'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{isAr ? 'تسجيل الدخول' : 'Sign In'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('signup')}
              className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'signup'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{isAr ? 'إنشاء حساب' : 'Create Account'}</span>
            </button>
          </div>

          {/* Error Message */}
          {(formError || error) && (
            <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
              <span>{formError || error}</span>
            </div>
          )}

          {/* Quick Account Switcher (if previous accounts exist and in signin mode) */}
          {activeTab === 'signin' && accounts.length > 0 && (
            <div className="mb-5">
              <label className="block text-[11px] font-medium text-slate-400 mb-2">
                {isAr ? 'حسابات مسجلة على هذا الجهاز:' : 'Accounts on this device:'}
              </label>
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {accounts.map(acc => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => handleQuickAccountSelect(acc.email)}
                    className={`w-full text-start p-2 rounded-lg border transition-all flex items-center justify-between text-xs ${
                      email.toLowerCase() === acc.email.toLowerCase()
                        ? 'bg-emerald-500/15 border-emerald-500/50 text-white'
                        : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-emerald-400">
                        {acc.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <div className="font-semibold truncate">{acc.name}</div>
                        <div className="text-[10px] text-slate-500 truncate">{acc.email}</div>
                      </div>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                      {acc.currency}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Form */}
          {activeTab === 'signin' ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {isAr ? 'البريد الإلكتروني أو اسم المستخدم' : 'Email or Username'}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute top-3 start-3" />
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder={isAr ? 'name@company.com' : 'name@company.com'}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-lg py-2.5 ps-9 pe-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {isAr ? 'كلمة المرور (اختياري إن لم تكن محددة)' : 'Password (optional if not set)'}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute top-3 start-3" />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-lg py-2.5 ps-9 pe-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-emerald-500/20"
                  />
                  <span>{isAr ? 'تذكر هذا الحساب على هذا الجهاز' : 'Remember me on this device'}</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold rounded-lg text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>{isSubmitting ? (isAr ? 'جارٍ تسجيل الدخول...' : 'Signing in...') : (isAr ? 'تسجيل الدخول' : 'Sign In')}</span>
                {isRTL ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {isAr ? 'اسم الشركة أو الحساب' : 'Business or Account Name'}
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-500 absolute top-3 start-3" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={isAr ? 'مثال: مؤسسة الأفق التجارية' : 'e.g. Acme Trading Co'}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-lg py-2.5 ps-9 pe-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {isAr ? 'البريد الإلكتروني أو المعرّف' : 'Email or Identifier'}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute top-3 start-3" />
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder={isAr ? 'user@company.com' : 'user@company.com'}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-lg py-2.5 ps-9 pe-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {isAr ? 'كلمة المرور' : 'Password'}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute top-3 start-3" />
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-950/60 border border-slate-800 rounded-lg py-2.5 ps-9 pe-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {isAr ? 'العملة الافتراضية' : 'Default Currency'}
                  </label>
                  <select
                    value={currency}
                    onChange={e => setCurrency(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-lg py-2.5 px-3 text-xs text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  >
                    <option value="SAR">SAR (ر.س)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="AED">AED (د.إ)</option>
                    <option value="KWD">KWD (د.ك)</option>
                    <option value="QAR">QAR (ر.ق)</option>
                    <option value="EGP">EGP (ج.م)</option>
                  </select>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                {isAr
                  ? '✓ سيبدأ هذا الحساب فارغاً تماماً بمعزل عن أي حسابات أخرى.'
                  : '✓ This account will start completely empty, isolated from all other accounts.'}
              </p>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold rounded-lg text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>{isSubmitting ? (isAr ? 'جارٍ إنشاء الحساب...' : 'Creating Account...') : (isAr ? 'إنشاء الحساب والبدء فوراً' : 'Create Account & Get Started')}</span>
                {isRTL ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Footer info */}
      <div className="w-full max-w-md mx-auto text-center py-2">
        <p className="text-[11px] text-slate-500">
          {isAr
            ? 'نظام حسابات متعددة مع عزل تام للبيانات وقاعدة بيانات محلية سحابية Offline-First'
            : 'Multi-tenant architecture with complete data isolation & offline-first capability'}
        </p>
      </div>
    </div>
  );
};

export default AuthScreen;
