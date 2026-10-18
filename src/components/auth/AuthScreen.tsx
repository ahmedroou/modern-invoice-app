import React, { useState } from 'react';
import { Globe, Moon, Sun, ArrowRight, ArrowLeft, Eye, EyeOff, CheckCircle2, FileText, Wallet } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useDirection } from '@/context/DirectionContext';
import { useTheme } from '@/context/ThemeContext';
import { AppLogo } from '@/components/common/AppLogo';

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

  const [showPassword, setShowPassword] = useState(false);
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
    <div className="auth-screen flex flex-col px-4 sm:px-8 py-5">
      <header className="w-full max-w-6xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-3"><AppLogo className="w-10 h-10 rounded-xl" /><span className="text-lg font-bold">{isAr ? 'ميزان' : 'Meezan'}</span></div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={toggleLanguage} className="flex items-center gap-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2"><Globe className="w-4 h-4" />{isAr ? 'English' : 'العربية'}</button>
          <button type="button" onClick={() => setTheme(isDark ? 'light' : 'dark')} aria-label={isAr ? 'تغيير المظهر' : 'Toggle theme'} className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg">{isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}</button>
        </div>
      </header>
      <main className="w-full max-w-5xl mx-auto flex-1 grid lg:grid-cols-2 gap-10 lg:gap-20 items-center py-8">
        <section className="hidden lg:block">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950 rounded-full px-3 py-1.5 mb-6"><CheckCircle2 className="w-3.5 h-3.5" />{isAr ? 'مساحة واحدة لإدارة أعمالك' : 'One workspace for your business'}</span>
          <h1 className="text-4xl font-bold leading-relaxed">{isAr ? 'حسابات واضحة.' : 'Clear accounts.'}<br /><span className="text-emerald-600 dark:text-emerald-400">{isAr ? 'وقرارات واثقة.' : 'Confident decisions.'}</span></h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-8 mt-4">{isAr ? 'من أول فاتورة إلى آخر دفعة، ميزان يجمع تفاصيل عملك في تجربة بسيطة ومنظمة.' : 'From your first invoice to your latest payment, Meezan brings your business together in one simple, organised experience.'}</p>
          <div className="space-y-5 mt-8">{[
            { icon: FileText, title: isAr ? 'فواتير دون تعقيد' : 'Effortless invoicing', text: isAr ? 'حساب تلقائي ومتابعة واضحة لكل فاتورة.' : 'Automatic calculations and a clear status for every invoice.' },
            { icon: Wallet, title: isAr ? 'كل رصيد في مكانه' : 'Every balance in view', text: isAr ? 'عملاء، دفعات، ومصروفات في مساحة مترابطة.' : 'Customers, payments, and expenses in one connected workspace.' }
          ].map(feature => <div key={feature.title} className="flex items-start gap-3"><span className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 text-emerald-600"><feature.icon className="w-5 h-5" /></span><div><h2 className="font-bold text-sm">{feature.title}</h2><p className="text-xs text-slate-500 mt-2">{feature.text}</p></div></div>)}</div>
        </section>
        <section className="auth-panel w-full max-w-md mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8">
          <AppLogo className="w-14 h-14 rounded-2xl mb-5" />
          <h2 className="text-2xl font-bold">{activeTab === 'signin' ? (isAr ? 'أهلًا بعودتك' : 'Welcome back') : (isAr ? 'لنبدأ مع ميزان' : 'Get started with Meezan')}</h2>
          <p className="text-xs leading-6 text-slate-500 mt-2 mb-5">{isAr ? 'اختر حسابك أو أنشئ مساحة جديدة لأعمالك.' : 'Choose your account or create a new workspace.'}</p>
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl mb-5">{(['signin', 'signup'] as const).map(tab => <button type="button" key={tab} onClick={() => handleTabChange(tab)} aria-pressed={activeTab === tab} className={`rounded-lg py-2.5 text-xs font-bold ${activeTab === tab ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 shadow-sm' : 'text-slate-500'}`}>{tab === 'signin' ? (isAr ? 'تسجيل الدخول' : 'Sign in') : (isAr ? 'إنشاء حساب' : 'Create account')}</button>)}</div>
          {(formError || error) && <div role="alert" className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-xs leading-6">{formError || error}</div>}
          {activeTab === 'signin' && accounts.length > 0 && <div className="mb-4"><p className="text-[11px] text-slate-500 mb-2">{isAr ? 'حساباتك على هذا الجهاز' : 'Accounts on this device'}</p><div className="space-y-2 max-h-28 overflow-y-auto">{accounts.map(account => <button key={account.id} type="button" disabled={isSubmitting} onClick={() => handleQuickAccountSelect(account.email)} className="w-full flex items-center gap-2 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 rounded-xl p-2 text-start"><span className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center font-bold">{account.name.charAt(0)}</span><span className="min-w-0 text-xs"><span className="block font-semibold truncate">{account.name}</span><bdi className="block text-[10px] text-slate-500 truncate">{account.email}</bdi></span></button>)}</div></div>}
          <form onSubmit={activeTab === 'signin' ? handleSignIn : handleSignUp} className="space-y-4">
            {activeTab === 'signup' && <div><label htmlFor="account-name" className="block text-xs font-semibold mb-2">{isAr ? 'اسم الشركة أو الحساب' : 'Business or account name'}</label><input id="account-name" autoComplete="organization" required value={name} onChange={event => setName(event.target.value)} placeholder={isAr ? 'مؤسسة الأفق التجارية' : 'Acme Trading Co'} className="auth-input" /></div>}
            <div><label htmlFor="account-email" className="block text-xs font-semibold mb-2">{isAr ? 'البريد الإلكتروني أو اسم المستخدم' : 'Email or username'}</label><input id="account-email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} placeholder="name@company.com" className="auth-input" /></div>
            <div><label htmlFor="account-password" className="block text-xs font-semibold mb-2">{isAr ? 'كلمة المرور' : 'Password'}</label><div className="relative"><input id="account-password" autoComplete={activeTab === 'signin' ? 'current-password' : 'new-password'} type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} placeholder={isAr ? 'اختياري للحسابات دون كلمة مرور' : 'Optional for accounts without a password'} className="auth-input pe-11" /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? (isAr ? 'إخفاء كلمة المرور' : 'Hide password') : (isAr ? 'إظهار كلمة المرور' : 'Show password')} className="absolute end-3 top-3 text-slate-500">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div></div>
            {activeTab === 'signup' && <div><label htmlFor="account-currency" className="block text-xs font-semibold mb-2">{isAr ? 'عملة الحساب' : 'Account currency'}</label><select id="account-currency" value={currency} onChange={event => setCurrency(event.target.value)} className="auth-input">{['SAR', 'USD', 'EUR', 'AED', 'KWD', 'QAR', 'EGP'].map(value => <option key={value} value={value}>{value}</option>)}</select></div>}
            {activeTab === 'signin' && <label className="flex items-center gap-2 text-xs text-slate-500"><input type="checkbox" checked={rememberMe} onChange={event => setRememberMe(event.target.checked)} className="accent-emerald-600" />{isAr ? 'تذكرني على هذا الجهاز' : 'Remember me on this device'}</label>}
            <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50">{isSubmitting ? (isAr ? 'جارٍ المتابعة…' : 'Please wait…') : activeTab === 'signin' ? (isAr ? 'تسجيل الدخول' : 'Sign in') : (isAr ? 'إنشاء الحساب' : 'Create account')}{isRTL ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}</button>
          </form>
        </section>
      </main>
      <footer className="text-center text-[11px] text-slate-500 py-2">{isAr ? 'ميزان · إدارة الحسابات والفواتير بدقة وتوازن' : 'Meezan · Invoicing and accounts, in balance'}</footer>
    </div>
  );
};
