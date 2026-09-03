'use client';

import React from 'react';
import Image from 'next/image';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { CreatorProfile, GoogleAccountStatus } from '../types/mediamind';
import { getGoogleLoginUrl } from '../lib/api';
import logoImg from '../app/mediamuselabs_logo.png';

interface HeaderProps {
  creatorProfile: CreatorProfile;
  googleStatus: GoogleAccountStatus;
  connectionId: string;
}

export const Header: React.FC<HeaderProps> = ({ creatorProfile, googleStatus, connectionId }) => {
  const profileLabel = creatorProfile.name || creatorProfile.profession || 'your visual story';
  const googleLoginUrl = getGoogleLoginUrl(connectionId);

  const handleGoogleLogin = (e: React.MouseEvent) => {
    e.preventDefault();
    const width = 540;
    const height = 650;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    window.open(
      googleLoginUrl,
      'MediaMuseLabsGoogleAuth',
      `width=${width},height=${height},left=${left},top=${top},status=no,toolbar=no,menubar=no`
    );
  };

  return (
    <header className="relative z-10 w-full mb-8 pt-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 glass-card border border-slate-800/80 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="relative w-14 h-14 rounded-2xl overflow-hidden shadow-lg shadow-indigo-500/20 border border-indigo-500/30 flex-shrink-0 bg-slate-900">
            <Image
              src={logoImg}
              alt="Media Muse Labs Logo"
              className="w-full h-full object-cover"
              priority
            />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-3xl font-extrabold tracking-tight text-gradient">
                Media Muse Labs
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-400" /> Powered by AI
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              Organize <span className="font-semibold text-slate-200">{profileLabel}</span> and create tailored social media content for your audience.
            </p>
          </div>
        </div>

        {/* Right side Actions: Google Auth */}
        <div className="flex items-center gap-3 self-end md:self-auto">
          {/* Google Account Status / Login */}
          {googleStatus.connected ? (
            <div className="flex items-center gap-3 bg-slate-900/80 border border-emerald-500/30 px-4 py-2 rounded-xl text-xs font-medium text-emerald-300 shadow-md">
              {googleStatus.picture ? (
                <img
                  src={googleStatus.picture}
                  alt={googleStatus.name || 'Google Profile'}
                  className="w-7 h-7 rounded-full border border-emerald-400 object-cover"
                />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              )}
              <div className="flex flex-col">
                <span className="font-semibold text-slate-100">
                  {googleStatus.name || googleStatus.email || 'Connected'}
                </span>
                <span className="text-[10px] text-emerald-400">Google Account Sync Active</span>
              </div>
            </div>
          ) : (
            <button
              onClick={handleGoogleLogin}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm transition-all duration-200 shadow-md shadow-slate-900/20 hover:scale-[1.02] active:scale-[0.98]"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Connect with Google</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
