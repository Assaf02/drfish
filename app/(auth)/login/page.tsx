'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DrFishLogo } from '@/components/icons/DrFishLogo';

const schema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
  rememberMe: z.boolean().optional(),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      const result = await signIn('credentials', {
        email: data.email.toLowerCase(),
        password: data.password,
        redirect: false,
      });
      if (result?.error) {
        toast.error('Identifiants incorrects');
        setIsLoading(false);
        return;
      }
      const sessionRes = await fetch('/api/auth/session');
      const session = await sessionRes.json();
      router.push(session?.user?.role === 'ADMIN' ? '/dashboard' : '/home');
      router.refresh();
    } catch {
      toast.error('Une erreur est survenue');
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center p-6 relative overflow-hidden"
      style={{ background: 'var(--navy)' }}
    >
      {/* Ambient glow */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(46,109,180,0.18) 0%, transparent 65%)', transform: 'translate(30%, -40%)' }} />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(0,180,166,0.1) 0%, transparent 65%)', transform: 'translate(-30%, 40%)' }} />

      {/* Content */}
      <div className="w-full max-w-[380px] relative z-10 animate-fade-in">

        {/* Brand */}
        <div className="text-center mb-9">
          <div className="flex justify-center mb-5">
            <DrFishLogo variant="white" size="lg" animated />
          </div>
          <p className="mt-2 text-[15px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Connectez-vous pour continuer
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-[24px] p-8"
          style={{
            background: '#fff',
            boxShadow: '0 32px 80px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)',
          }}
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

            {/* Email */}
            <div>
              <label className="label">Email</label>
              <input
                {...register('email')}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="vous@drfish.bj"
                className="input-field"
                style={errors.email ? { borderColor: 'var(--red)' } : {}}
              />
              {errors.email && <p className="mt-1.5 text-[12px] font-medium" style={{ color: 'var(--red)' }}>{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="label">Mot de passe</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="input-field pr-12"
                  style={errors.password ? { borderColor: 'var(--red)' } : {}}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'var(--gray-400)' }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p className="mt-1.5 text-[12px] font-medium" style={{ color: 'var(--red)' }}>{errors.password.message}</p>}
            </div>

            {/* Remember me */}
            <div className="flex items-center gap-3 pt-1">
              <input
                {...register('rememberMe')}
                type="checkbox"
                id="remember"
                className="w-[18px] h-[18px] rounded-[5px] cursor-pointer"
                style={{ accentColor: 'var(--navy)' }}
              />
              <label htmlFor="remember" className="text-[14px] font-medium cursor-pointer" style={{ color: 'var(--gray-400)' }}>
                Rester connecté
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full mt-2"
              style={{ borderRadius: 14, fontSize: 15 }}
            >
              {isLoading ? (
                <><Loader2 size={18} className="animate-spin" /> Connexion...</>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[12px] mt-6" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Dr Fish CRM · Cotonou, Bénin · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
