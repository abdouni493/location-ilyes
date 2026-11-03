import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Mail, Lock, UserIcon, Eye, EyeOff, Globe } from 'lucide-react';
import { supabase } from '../supabase';
import { Language, UserRole, User } from '../types';
import { TRANSLATIONS } from '../constants';
import { DatabaseService } from '../services/DatabaseService';
import { sessionService } from '../utils/sessionService';

interface LoginProps {
  lang: Language;
  // now emit full user object once authenticated
  onLogin: (user: User) => void;
}

interface AdminCount {
  count: number;
}

interface AgencyBranding {
  logo: string;
  name: string;
}

export const Login: React.FC<LoginProps> = ({ lang, onLogin }) => {
  const t = TRANSLATIONS[lang];
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [adminExists, setAdminExists] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [agencyBranding, setAgencyBranding] = useState<AgencyBranding>({
    logo: '',
    name: 'AutoLocation'
  });

  useEffect(() => {
    const checkAdmin = async () => {
      // if we stored a flag locally, skip the network request
      if (localStorage.getItem('signupDone')) {
        setAdminExists(true);
      }
      
      try {
        const { data, error } = await supabase
          .from('admin_count')
          .select('count')
          .single();
        if (data && (data as any).count > 0) {
          setAdminExists(true);
        }
      } catch (err) {
        console.warn('Error checking admin:', err);
      }
    };
    
    const loadAgencyBranding = async () => {
      try {
        const settings = await DatabaseService.getWebsiteSettings();
        if (settings) {
          setAgencyBranding({
            logo: settings.logo || '',
            name: settings.name || 'AutoLocation'
          });
        }
      } catch (err) {
        console.warn('Error loading agency branding:', err);
      }
    };
    
    checkAdmin();
    loadAgencyBranding();
  }, []);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const timestamp = new Date().toLocaleTimeString();
    console.log(`\n[Login] ======= LOGIN/SIGNUP ATTEMPT STARTED at ${timestamp} =======`);
    
    // Prevent double submissions
    if (isSubmitting) {
      console.log('[Login] Form already submitting, ignoring duplicate submission');
      return;
    }
    
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      // SIGNUP FLOW - Always use Supabase Auth
      if (isSigningUp) {
        console.log('[Login] === SIGNUP MODE ===');
        console.log('[Login] Attempting Supabase signup...');
        // create new admin user and profile
        const { data: signData, error: signError } = await supabase.auth.signUp(
          { email, password }
        );
        if (signError) {
          console.log('[Login] Signup error:', signError.message);
          setErrorMessage(signError.message);
          setIsSubmitting(false);
          return;
        }

        // insert into profiles table for role tracking
        if (signData?.user) {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({ id: signData.user.id, username, role: 'admin' });
          if (profileError) {
            console.error('Profile insert error:', profileError);
          }
        }

        // mark signup done so form disappears permanently
        localStorage.setItem('signupDone', 'true');
        setAdminExists(true);

        // automatically sign in the user
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword(
          { email, password }
        );
        if (loginError) {
          console.log('[Login] Auto-signin after signup error:', loginError.message);
          setErrorMessage(loginError.message);
          setIsSubmitting(false);
          return;
        }
        if (loginData.session) {
          const u = loginData.user;
          const role = (u.user_metadata?.role as UserRole) || 'admin';
          const name = (u.user_metadata?.username as string) || u.email || '';
          
          console.log('[Login] === SIGNUP SUCCESSFUL ===');
          console.log('[Login] Signup user:', { name, email: u.email, role });
          console.log('[Login] Session token length:', loginData.session.access_token.length);
          console.log('[Login] localStorage after signup:', {
            has_token: !!localStorage.getItem('supabase.auth.token'),
            has_signup_done: !!localStorage.getItem('signupDone')
          });
          
          // Save session
          await sessionService.createSession(
            loginData.session.access_token,
            loginData.session.refresh_token,
            loginData.session.expires_at || Math.floor(Date.now() / 1000) + 3600,
            u.id,
            u.email || '',
            role,
            name
          );
          
          // CRITICAL: Clear all SDK session data to prevent auto-refresh
          console.log('[Login] Clearing SDK session data to prevent auto-refresh...');
          localStorage.removeItem('supabase.auth.token');
          sessionStorage.clear();
          
          // Clear form
          setEmail('');
          setPassword('');
          setUsername('');
          
          console.log('[Login] Calling onLogin callback...');
          onLogin({ name, email: u.email || '', role, avatar: '' });
        }
        setIsSubmitting(false);
        return;
      }

      // LOGIN FLOW - Determine auth method based on input format
      const credential = email.trim();
      const isEmailInput = credential.includes('@');

      if (!credential || !password) {
        console.log('[Login] Missing credentials - email:', !!credential, 'password:', !!password);
        setErrorMessage(lang === 'fr' 
          ? 'Veuillez entrer vos identifiants.' 
          : 'الرجاء إدخال بيانات الدخول.');
        setIsSubmitting(false);
        return;
      }

      // LOGIN FLOW - All users (admin and workers) use Supabase Auth with email
      // Users must provide email and password to login
      console.log('[Login] === AUTHENTICATION ATTEMPT ===');
      console.log('[Login] Credentials provided - email format:', isEmailInput);
      
      try {
        // For email input: try Supabase Auth first, then fall back to worker RPC
        if (isEmailInput) {
          console.log('[Login] Email authentication for:', credential);
          
          // Try Supabase Auth first (for admin accounts)
          const result = await supabase.auth.signInWithPassword({
            email: credential,
            password
          });
          
          if (result.error) {
            console.log('[Login] Supabase Auth failed:', result.error.message);
            // If Supabase Auth fails, try worker RPC login
            console.log('[Login] Trying worker login via RPC...');
            
            const { data: loginResult, error: rpcError } = await supabase.rpc('login_worker', {
              p_email_or_username: credential,
              p_password: password
            });

            if (rpcError || !loginResult?.success) {
              console.log('[Login] Worker login also failed:', rpcError?.message || loginResult?.error);
              setErrorMessage(lang === 'fr' 
                ? 'Email ou mot de passe incorrect.' 
                : 'البريد الإلكتروني أو كلمة المرور غير صحيحة.');
              setIsSubmitting(false);
              return;
            }

            // Worker RPC login successful
            const worker = loginResult.worker;
            const workerRole = (worker.type as UserRole) || 'worker';
            
            console.log('[Login] === WORKER LOGIN SUCCESSFUL ===');
            console.log('[Login] Worker authenticated:', { name: worker.full_name, email: worker.email, role: workerRole });
            
            // Save worker session to database
            const sessionResult = await sessionService.createSession(
              `worker_token_${Date.now()}`,
              undefined,
              Math.floor(Date.now() / 1000) + (24 * 60 * 60),
              worker.id || `worker_${Date.now()}`,
              worker.email || '',
              workerRole,
              worker.full_name
            );
            
            console.log('[Login] Session saved:', !!sessionResult);
            
            // Clear form
            setEmail('');
            setPassword('');
            setUsername('');
            
            console.log('[Login] Calling onLogin callback...');
            onLogin({
              name: worker.full_name,
              email: worker.email || '',
              role: workerRole,
              avatar: worker.profile_photo || ''
            });
            return;
          }

          if (result.data?.session) {
            const u = result.data.user;
            const role = (u.user_metadata?.role as UserRole) || 'admin';
            const name = (u.user_metadata?.username as string) || u.user_metadata?.full_name || u.email || '';
            
            console.log('[Login] === ADMIN LOGIN SUCCESSFUL ===');
            console.log('[Login] Admin authenticated:', { name, email: u.email, role });
            
            // Save session to database using new session service
            console.log('[Login] Saving session to database...');
            await sessionService.createSession(
              result.data.session.access_token,
              result.data.session.refresh_token,
              result.data.session.expires_at || Math.floor(Date.now() / 1000) + 3600,
              u.id,
              u.email || '',
              role,
              name
            );
            
            // CRITICAL: Clear all SDK session data to prevent auto-refresh
            console.log('[Login] Clearing SDK session data to prevent auto-refresh...');
            localStorage.removeItem('supabase.auth.token');
            sessionStorage.clear();
            
            // Clear form
            setEmail('');
            setPassword('');
            setUsername('');
            
            console.log('[Login] Calling onLogin callback...');
            onLogin({ name, email: u.email || '', role, avatar: '' });
            return;
          }
        } else {
          // For non-email input (username): show error message
          console.log('[Login] Username-based login no longer supported. Please use email.');
          setErrorMessage(lang === 'fr' 
            ? 'Veuillez utiliser votre email pour vous connecter.' 
            : 'يرجى استخدام بريدك الإلكتروني للدخول.');
          setIsSubmitting(false);
          return;
        }
      } catch (error) {
        console.log('[Login] Authentication exception:', error);
        setErrorMessage(lang === 'fr' 
          ? 'Une erreur est survenue lors de la connexion.' 
          : 'حدث خطأ أثناء تسجيل الدخول.');
        setIsSubmitting(false);
        return;
      }
    } catch (error) {
      console.log('[Login] === UNEXPECTED ERROR ===');
      console.log('[Login] Error:', error);
      setErrorMessage(lang === 'fr' 
        ? 'Une erreur est survenue lors de la connexion.' 
        : 'حدث خطأ أثناء تسجيل الدخول.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-saas-bg via-saas-bg to-blue-50">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-0 left-0 w-96 h-96 bg-saas-primary-start rounded-full mix-blend-multiply filter blur-3xl opacity-10"
          animate={{
            x: [0, 100, 0],
            y: [0, 50, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        <motion.div
          className="absolute top-0 right-0 w-96 h-96 bg-saas-primary-via rounded-full mix-blend-multiply filter blur-3xl opacity-10"
          animate={{
            x: [0, -100, 0],
            y: [0, -50, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        <motion.div
          className="absolute bottom-0 left-1/2 w-96 h-96 bg-saas-primary-end rounded-full mix-blend-multiply filter blur-3xl opacity-10"
          animate={{
            x: [0, 50, 0],
            y: [0, 100, 0],
          }}
          transition={{
            duration: 30,
            repeat: Infinity,
            ease: "linear"
          }}
        />
      </div>

      {/* Main login card */}
      <motion.div 
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-10 space-y-10 border border-saas-border shadow-xl">
          
          {/* Agency Logo & Name Section */}
          <motion.div 
            className="text-center space-y-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.8 }}
          >
            {/* Logo */}
            {agencyBranding.logo && (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.3, duration: 0.8, type: "spring", stiffness: 100 }}
                className="flex justify-center mb-2"
              >
                <img 
                  src={agencyBranding.logo} 
                  alt="Logo"
                  className="h-20 w-20 object-contain drop-shadow-lg rounded-xl border border-saas-border"
                />
              </motion.div>
            )}

            {/* Agency Name - First 3 words only */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
            >
              <h1 className="text-4xl font-black tracking-tight bg-linear-to-r from-saas-primary-start via-saas-primary-via to-saas-primary-end bg-clip-text text-transparent uppercase">
                {agencyBranding.name.split(' ').slice(0, 3).join(' ')}
              </h1>
              <motion.p 
                className="text-saas-text-muted font-bold uppercase tracking-[0.3em] text-[11px] mt-3"
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                {t.login}
              </motion.p>
            </motion.div>
          </motion.div>

          {/* Form Section */}
          <motion.form 
            className="space-y-8" 
            onSubmit={handleSubmit}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            <div className="space-y-6">
              {/* when signing up we need a username */}
              {isSigningUp && (
                <motion.div 
                  className="space-y-2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <label className="label-saas">{t.username}</label>
                  <div className="relative group">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-saas-text-muted group-focus-within:text-saas-primary-via transition-colors" size={18} />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="input-saas pl-12"
                      placeholder="Jean Dupont"
                    />
                  </div>
                </motion.div>
              )}

              {/* Email/Username field */}
              <motion.div 
                className="space-y-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
              >
                <label className="label-saas">
                  {isSigningUp 
                    ? t.email 
                    : (lang === 'fr' ? 'Email ou Nom d\'utilisateur' : 'البريد الإلكتروني أو اسم المستخدم')}
                </label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-saas-text-muted group-focus-within:text-saas-primary-via transition-colors" size={18} />
                  <input 
                    type="text" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-saas pl-12"
                    placeholder={isSigningUp ? "admin@autofutur.com" : "john.doe ou john@email.com"}
                  />
                </div>
              </motion.div>

              {/* Password field */}
              <motion.div 
                className="space-y-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                <label className="label-saas">{t.password}</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-saas-text-muted group-focus-within:text-saas-primary-via transition-colors" size={18} />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-saas pl-12 pr-12"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-saas-text-muted hover:text-saas-primary-via transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </motion.div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm"
              >
                {errorMessage}
              </motion.div>
            )}

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={isSubmitting}
              whileHover={{ scale: 1.02, boxShadow: "0 10px 30px rgba(30, 58, 138, 0.2)" }}
              whileTap={{ scale: 0.98 }}
              className="btn-saas-primary w-full text-sm py-4"
            >
              {isSubmitting ? (
                <motion.span
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  {isSigningUp ? t.signup : t.login}...
                </motion.span>
              ) : (
                isSigningUp ? t.signup : t.login
              )}
            </motion.button>
          </motion.form>

          {/* Voir le site public sans se connecter */}
          <motion.button
            type="button"
            onClick={() => navigate('/website')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.8 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm bg-white border-2 border-saas-border text-saas-text-main hover:border-saas-primary-via hover:text-saas-primary-via transition-colors"
          >
            <Globe size={17} />
            {lang === 'fr' ? 'Voir le site web' : 'مشاهدة الموقع الإلكتروني'}
          </motion.button>

          {/* Sign up link */}
          {!adminExists && !isSigningUp && (
            <motion.div 
              className="text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.8 }}
            >
              <button
                onClick={() => setIsSigningUp(true)}
                className="text-sm font-semibold text-saas-primary-via hover:text-saas-primary-via/80 transition-colors"
              >
                {t.signup} ?
              </button>
              <p className="text-xs text-saas-text-muted mt-2">(première connexion uniquement)</p>
            </motion.div>
          )}

          {/* Decorative line */}
          <motion.div
            className="h-0.5 bg-linear-to-r from-saas-primary-start via-saas-primary-via to-saas-primary-end rounded-full"
            animate={{ scaleX: [0, 1, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
        </div>
      </motion.div>
    </div>
  );
};
