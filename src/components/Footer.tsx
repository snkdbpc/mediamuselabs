'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  Sparkles,
  Crown,
  Cpu,
  ShieldCheck,
  ArrowUp,
  Folder,
  Globe,
  Code2,
  HardDrive,
  Info,
  X,
} from 'lucide-react';
import logoImg from '../app/mediamuselabs_logo.png';

interface FooterProps {
  isPro?: boolean;
  onTogglePro?: () => void;
  onOpenSavedProjectsModal?: () => void;
  savedProjectsCount?: number;
}

export const Footer: React.FC<FooterProps> = ({
  isPro = false,
  onTogglePro,
  onOpenSavedProjectsModal,
  savedProjectsCount = 0,
}) => {
  const [activeInfoModal, setActiveInfoModal] = useState<'privacy' | 'terms' | 'tech' | null>(null);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const currentYear = new Date().getFullYear();

  return (
    <>
      <footer className="relative z-10 w-full mt-auto border-t border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        {/* Subtle top ambient glow divider */}
        <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-12 md:py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10">
            {/* Column 1: Brand & Overview (4 cols on lg) */}
            <div className="lg:col-span-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="relative w-11 h-11 rounded-xl overflow-hidden shadow-lg shadow-indigo-500/20 border border-indigo-500/30 flex-shrink-0 bg-slate-900">
                  <Image
                    src={logoImg}
                    alt="Media Muse Labs Logo"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-black tracking-tight text-gradient">
                      Media Muse Labs
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 text-indigo-400" /> v1.2
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium">
                    Next-Gen Visual Storytelling & Social Studio
                  </p>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-sm">
                Intelligently cluster raw visual albums using vision transformers, score photo aesthetics with multimodal AI, and automatically generate captivating, platform-specific social media campaigns.
              </p>

              {/* Real-time System Status Pill */}
              <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-slate-900/90 border border-emerald-500/30 text-[11px] text-emerald-300 shadow-inner">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="font-semibold">AI Neural Engine Operational</span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400">SigLIP & Florence-2</span>
              </div>

              {/* Pro Status or Upgrade Trigger in Footer */}
              <div className="pt-1">
                {onTogglePro && (
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-slate-900/90 via-indigo-950/30 to-purple-950/30 border border-slate-800 flex items-center justify-between gap-3 max-w-sm">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded-lg ${isPro ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-400'}`}>
                        <Crown className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                          <span>{isPro ? 'Pro Membership Active' : 'Free Tier (30 Photos)'}</span>
                          {isPro && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              ∞ Data
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400">
                          {isPro ? 'Unlimited high-res uploads enabled' : 'Unlock infinite uploads & 1GB batch payloads'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={onTogglePro}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        isPro
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                          : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      }`}
                    >
                      {isPro ? 'Manage' : 'Upgrade'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Column 2: Core Capabilities (3 cols on lg) */}
            <div className="lg:col-span-3 space-y-3">
              <h4 className="text-xs font-bold tracking-wider text-slate-200 uppercase flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-indigo-400" /> AI Capabilities
              </h4>
              <ul className="space-y-2 text-xs text-slate-400">
                <li className="flex items-start gap-2 hover:text-slate-200 transition-colors">
                  <span className="text-indigo-400 font-mono mt-0.5">›</span>
                  <span><strong>SigLIP Clustering:</strong> Dense semantic embedding & community grouping.</span>
                </li>
                <li className="flex items-start gap-2 hover:text-slate-200 transition-colors">
                  <span className="text-indigo-400 font-mono mt-0.5">›</span>
                  <span><strong>Florence-2 Aesthetics:</strong> Multi-aspect visual quality scoring & best shot picking.</span>
                </li>
                <li className="flex items-start gap-2 hover:text-slate-200 transition-colors">
                  <span className="text-indigo-400 font-mono mt-0.5">›</span>
                  <span><strong>Multi-Platform Studio:</strong> Tailored generation for Facebook, Instagram & X (Twitter).</span>
                </li>
                <li className="flex items-start gap-2 hover:text-slate-200 transition-colors">
                  <span className="text-indigo-400 font-mono mt-0.5">›</span>
                  <span><strong>Full EXIF & GPS:</strong> Camera lens, exposure, timestamp & coordinates extraction.</span>
                </li>
              </ul>
            </div>

            {/* Column 3: Cloud & Storage Stack (3 cols on lg) */}
            <div className="lg:col-span-3 space-y-3">
              <h4 className="text-xs font-bold tracking-wider text-slate-200 uppercase flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-purple-400" /> Infrastructure
              </h4>
              <ul className="space-y-2 text-xs text-slate-400">
                <li className="flex items-center justify-between p-2 rounded-lg bg-slate-900/50 border border-slate-800/80">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-400" />
                    <span>Cloudflare R2 Bucket</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Parallel Sync</span>
                </li>
                <li className="flex items-center justify-between p-2 rounded-lg bg-slate-900/50 border border-slate-800/80">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>Supabase DB & Auth</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Projects & Presets</span>
                </li>
                <li className="flex items-center justify-between p-2 rounded-lg bg-slate-900/50 border border-slate-800/80">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    <span>Google OAuth 2.0</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Secure Identity</span>
                </li>
                <li className="flex items-center justify-between p-2 rounded-lg bg-slate-900/50 border border-slate-800/80">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-pink-400" />
                    <span>Meta Graph & Twitter v2</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Direct Publish</span>
                </li>
              </ul>
            </div>

            {/* Column 4: Quick Navigation & Actions (2 cols on lg) */}
            <div className="lg:col-span-2 space-y-3">
              <h4 className="text-xs font-bold tracking-wider text-slate-200 uppercase flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-pink-400" /> Quick Access
              </h4>
              <div className="flex flex-col space-y-2 text-xs">
                {onOpenSavedProjectsModal && (
                  <button
                    onClick={onOpenSavedProjectsModal}
                    className="flex items-center gap-1.5 text-slate-400 hover:text-indigo-300 text-left transition-colors"
                  >
                    <Folder className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Saved Projects</span>
                    {savedProjectsCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 ml-auto">
                        {savedProjectsCount}
                      </span>
                    )}
                  </button>
                )}

                <button
                  onClick={() => setActiveInfoModal('tech')}
                  className="flex items-center gap-1.5 text-slate-400 hover:text-indigo-300 text-left transition-colors"
                >
                  <Code2 className="w-3.5 h-3.5 text-purple-400" />
                  <span>Architecture</span>
                </button>

                <button
                  onClick={() => setActiveInfoModal('privacy')}
                  className="flex items-center gap-1.5 text-slate-400 hover:text-indigo-300 text-left transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Privacy & EXIF</span>
                </button>

                <button
                  onClick={() => setActiveInfoModal('terms')}
                  className="flex items-center gap-1.5 text-slate-400 hover:text-indigo-300 text-left transition-colors"
                >
                  <Info className="w-3.5 h-3.5 text-amber-400" />
                  <span>Terms & Ethics</span>
                </button>

                <button
                  onClick={scrollToTop}
                  className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 px-3 py-1.5 rounded-lg transition-all w-fit shadow-sm"
                >
                  <ArrowUp className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Back to top</span>
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Copyright & Tech Stack Row */}
          <div className="mt-12 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-2 flex-wrap">
              <span>© {currentYear} Media Muse Labs. All rights reserved.</span>
              <span className="hidden sm:inline text-slate-700">•</span>
              <span className="flex items-center gap-1 text-slate-400">
                Crafted for Visual Creators & Storytellers
              </span>
            </div>

            <div className="flex items-center gap-4 text-[11px] text-slate-400">
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                Next.js 15 & React 19
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                Tailwind CSS
              </span>
              <button
                onClick={scrollToTop}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors"
                title="Scroll back to top"
                aria-label="Scroll back to top"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Info Modals for Privacy, Terms, and Architecture */}
      {activeInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 relative">
            <button
              onClick={() => setActiveInfoModal(null)}
              className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>

            {activeInfoModal === 'privacy' && (
              <>
                <div className="flex items-center gap-2.5 text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                  <h3 className="text-lg font-bold text-slate-100">Privacy & EXIF Metadata Policy</h3>
                </div>
                <div className="text-xs text-slate-300 space-y-2.5 leading-relaxed">
                  <p>
                    <strong>Full Data Sovereignty:</strong> Media Muse Labs extracts EXIF tags (camera, lens, ISO, timestamp, and GPS coordinates) solely to curate clusters and craft authentic storytelling captions.
                  </p>
                  <p>
                    <strong>Zero AI Training Retention:</strong> Your private images are never ingested or retained to train third-party foundation models.
                  </p>
                  <p>
                    <strong>Secure Cloud Sync:</strong> Full-resolution assets are transmitted via encrypted TLS and stored in your dedicated bucket namespace.
                  </p>
                </div>
              </>
            )}

            {activeInfoModal === 'terms' && (
              <>
                <div className="flex items-center gap-2.5 text-amber-400">
                  <Info className="w-5 h-5" />
                  <h3 className="text-lg font-bold text-slate-100">Terms of Service & Usage</h3>
                </div>
                <div className="text-xs text-slate-300 space-y-2.5 leading-relaxed">
                  <p>
                    <strong>Creator Copyright:</strong> You retain 100% full intellectual property and commercial copyright of all uploaded visual media and AI-generated social copy.
                  </p>
                  <p>
                    <strong>Platform Publishing:</strong> Publishing to Meta (Facebook, Instagram) and X (Twitter) adheres strictly to the official API policies and rate limits of each provider.
                  </p>
                </div>
              </>
            )}

            {activeInfoModal === 'tech' && (
              <>
                <div className="flex items-center gap-2.5 text-purple-400">
                  <Code2 className="w-5 h-5" />
                  <h3 className="text-lg font-bold text-slate-100">AI & System Architecture</h3>
                </div>
                <div className="text-xs text-slate-300 space-y-2.5 leading-relaxed">
                  <p>
                    <strong>Clustering Engine:</strong> Powered by Google&apos;s SigLIP vision-language embeddings and semantic affinity graph community detection.
                  </p>
                  <p>
                    <strong>Aesthetic Scoring:</strong> Powered by Microsoft&apos;s Florence-2 multimodal vision model for fine-grained aesthetic and quality ranking.
                  </p>
                  <p>
                    <strong>Streaming Social Generation:</strong> High-throughput server-sent event (SSE) streaming with multi-platform style adaptation.
                  </p>
                </div>
              </>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setActiveInfoModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
