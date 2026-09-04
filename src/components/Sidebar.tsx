'use client';

import React, { useState } from 'react';
import {
  UserCheck,
  Sparkles,
  Target,
  Users,
  Briefcase,
  Bookmark,
  Check,
  Save,
  Loader2,
  Share2,
  Crown,
  Infinity as InfinityIcon,
  Globe,
} from 'lucide-react';
import { CreatorProfile, UserPreset } from '../types/mediamind';

export interface LanguageOption {
  value: string;
  label: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: 'English', label: 'English' },
  { value: 'Spanish', label: 'Spanish (Español)' },
  { value: 'French', label: 'French (Français)' },
  { value: 'German', label: 'German (Deutsch)' },
  { value: 'Italian', label: 'Italian (Italiano)' },
  { value: 'Portuguese', label: 'Portuguese (Português)' },
  { value: 'Hindi', label: 'Hindi (हिन्दी)' },
  { value: 'Japanese', label: 'Japanese (日本語)' },
  { value: 'Korean', label: 'Korean (한국어)' },
  { value: 'Chinese (Simplified)', label: 'Chinese - Simplified (简体中文)' },
  { value: 'Chinese (Traditional)', label: 'Chinese - Traditional (繁體中文)' },
  { value: 'Arabic', label: 'Arabic (العربية)' },
  { value: 'Bengali', label: 'Bengali (বাংলা)' },
  { value: 'Russian', label: 'Russian (Русский)' },
  { value: 'Dutch', label: 'Dutch (Nederlands)' },
  { value: 'Turkish', label: 'Turkish (Türkçe)' },
  { value: 'Polish', label: 'Polish (Polski)' },
  { value: 'Swedish', label: 'Swedish (Svenska)' },
  { value: 'Vietnamese', label: 'Vietnamese (Tiếng Việt)' },
  { value: 'Indonesian', label: 'Indonesian (Bahasa Indonesia)' },
  { value: 'Thai', label: 'Thai (ไทย)' },
  { value: 'Greek', label: 'Greek (Ελληνικά)' },
  { value: 'Hebrew', label: 'Hebrew (עברית)' },
  { value: 'Ukrainian', label: 'Ukrainian (Українська)' },
  { value: 'Romanian', label: 'Romanian (Română)' },
  { value: 'Czech', label: 'Czech (Čeština)' },
  { value: 'Danish', label: 'Danish (Dansk)' },
  { value: 'Finnish', label: 'Finnish (Suomi)' },
  { value: 'Norwegian', label: 'Norwegian (Norsk)' },
  { value: 'Hungarian', label: 'Hungarian (Magyar)' },
  { value: 'Marathi', label: 'Marathi (मराठी)' },
  { value: 'Telugu', label: 'Telugu (తెలుగు)' },
  { value: 'Tamil', label: 'Tamil (தமிழ்)' },
  { value: 'Gujarati', label: 'Gujarati (ગુજરાતી)' },
  { value: 'Urdu', label: 'Urdu (اردو)' },
];

interface SidebarProps {
  profile: CreatorProfile;
  onChange: (updatedProfile: CreatorProfile) => void;
  userPresets?: UserPreset[];
  isSigned?: boolean;
  selectedPresetId?: string | null;
  onSelectPreset?: (preset: UserPreset | null) => void;
  savePresetOnNextStep?: boolean;
  onToggleSavePresetOnNextStep?: (save: boolean) => void;
  onManualSavePreset?: (presetName: string) => Promise<boolean>;
  isPro?: boolean;
  onTogglePro?: (isPro: boolean) => void;
}

const AGE_GROUP_OPTIONS = ['13-17', '18-24', '25-34', '35-44', '45-54', '55+', 'All ages'];
const normalizeAge = (s: string) => (s || '').replace(/[\u2013\u2014]/g, '-').trim();

export const Sidebar: React.FC<SidebarProps> = ({
  profile,
  onChange,
  userPresets = [],
  isSigned = false,
  selectedPresetId = null,
  onSelectPreset,
  savePresetOnNextStep = true,
  onToggleSavePresetOnNextStep,
  onManualSavePreset,
  isPro = false,
  onTogglePro,
}) => {
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [presetInputName, setPresetInputName] = useState(profile.preset_name || profile.name || '');

  const handleChange = (field: keyof CreatorProfile, value: any) => {
    onChange({ ...profile, [field]: value });
  };

  const handleTogglePublishing = (platform: string) => {
    const current = profile.publishing_preference || { facebook: true, instagram: true, twitter: true };
    const next = { ...current, [platform]: !current[platform] };
    handleChange('publishing_preference', next);
  };

  const handleToggleAgeGroup = (rawAge: string) => {
    const age = normalizeAge(rawAge);
    const existing = (
      profile.target_age_groups && profile.target_age_groups.length > 0
        ? profile.target_age_groups
        : [profile.target_age_group || 'All ages']
    ).map(normalizeAge);

    let next: string[];
    if (age === 'All ages') {
      next = ['All ages'];
    } else {
      const filtered = existing.filter((a) => a !== 'All ages');
      if (filtered.includes(age)) {
        next = filtered.filter((a) => a !== age);
        if (next.length === 0) next = ['All ages'];
      } else {
        next = [...filtered, age];
      }
    }

    // Atomic update so both target_age_groups and target_age_group are updated simultaneously
    onChange({
      ...profile,
      target_age_groups: next,
      target_age_group: next[0] || 'All ages',
    });
  };

  const handlePresetSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val || val === 'custom') {
      onSelectPreset?.(null);
      return;
    }
    const found = userPresets.find((p) => p.id === val);
    if (found) {
      onSelectPreset?.(found);
      setPresetInputName(found.name);
    }
  };

  const handleQuickSavePreset = async () => {
    if (!onManualSavePreset) return;
    const nameToUse = presetInputName.trim() || profile.name.trim() || 'My Preset';
    setIsSavingPreset(true);
    setSaveSuccessMsg(null);
    try {
      const ok = await onManualSavePreset(nameToUse);
      if (ok) {
        setSaveSuccessMsg('Preset saved!');
        setTimeout(() => setSaveSuccessMsg(null), 2500);
      }
    } finally {
      setIsSavingPreset(false);
    }
  };

  const publishingPrefs = profile.publishing_preference || { facebook: true, instagram: true, twitter: true };
  const currentAgeGroups = profile.target_age_groups || [profile.target_age_group || 'All ages'];

  return (
    <aside className="w-full lg:w-80 flex-shrink-0">
      <div className="glass-card p-6 border border-slate-800/80 sticky top-6 shadow-xl space-y-5">
        {/* Title */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-slate-100">Creator & Presets</h2>
          </div>
          {isSigned && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Cloud Sync
            </span>
          )}
        </div>

        {/* Pro Membership Card */}
        <div
          className={`p-3.5 rounded-2xl border transition-all duration-200 ${
            isPro
              ? 'bg-gradient-to-br from-amber-500/15 via-purple-900/20 to-indigo-950/40 border-amber-500/40 shadow-lg shadow-amber-500/5'
              : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isPro
                    ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Crown className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs text-slate-100">Pro Plan</span>
                  {isPro ? (
                    <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                      UNLIMITED
                    </span>
                  ) : (
                    <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      Free Tier
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 truncate">
                  {isPro ? 'Infinite data upload active' : 'Max 30 photos / 300MB'}
                </p>
              </div>
            </div>

            {onTogglePro && (
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-2">
                <input
                  type="checkbox"
                  checked={isPro}
                  onChange={(e) => onTogglePro(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-amber-500 peer-checked:to-purple-600"></div>
              </label>
            )}
          </div>

          {isPro && (
            <div className="mt-2 pt-2 border-t border-amber-500/20 text-[10px] text-amber-200/90 flex items-center gap-1.5">
              <InfinityIcon className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span>Upload unlimited photos with zero size caps</span>
            </div>
          )}
        </div>

        {/* User Presets Dropdown (Supabase user_presets) */}
        {isSigned && (
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <label className="block text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5 text-indigo-400" /> Saved Presets
              </span>
              <span className="text-[10px] text-slate-500">{userPresets.length} saved</span>
            </label>

            <select
              value={selectedPresetId || 'custom'}
              onChange={handlePresetSelect}
              className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
            >
              <option value="custom">-- Custom Configuration --</option>
              {userPresets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.user_type || 'Individual'} • {p.language || 'English'})
                </option>
              ))}
            </select>

            {/* Save Preset on Next Step Checkbox */}
            {onToggleSavePresetOnNextStep && (
              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-300 select-none">
                  <input
                    type="checkbox"
                    checked={savePresetOnNextStep}
                    onChange={(e) => onToggleSavePresetOnNextStep(e.target.checked)}
                    className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
                  />
                  <span>Save preset on next step</span>
                </label>

                {onManualSavePreset && (
                  <button
                    type="button"
                    onClick={handleQuickSavePreset}
                    disabled={isSavingPreset}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors disabled:opacity-50"
                  >
                    {isSavingPreset ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : saveSuccessMsg ? (
                      <span className="text-emerald-400 flex items-center gap-0.5">
                        <Check className="w-3 h-3" /> Saved!
                      </span>
                    ) : (
                      <>
                        <Save className="w-3 h-3" /> Save now
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="space-y-4 text-xs">
          {/* User Type */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-indigo-400" /> User type
            </label>
            <select
              value={profile.user_type}
              onChange={(e) => handleChange('user_type', e.target.value)}
              className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
            >
              <option value="Individual">Individual</option>
              <option value="Creator / Influencer">Creator / Influencer</option>
              <option value="Business / Brand">Business / Brand</option>
              <option value="Organization">Organization</option>
            </select>
          </div>

          {/* Professional Account Toggle */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80">
            <div>
              <span className="block text-slate-200 font-medium text-xs">Professional Account</span>
              <span className="text-[10px] text-slate-400">Tailors posts for commercial audience</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(profile.professional)}
                onChange={(e) => handleChange('professional', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Name / Brand */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Name / Brand</label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g. Aisha Sharma or Wild Trails Co."
              className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
            />
          </div>

          {/* Profession */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-indigo-400" /> Profession / Focus
            </label>
            <input
              type="text"
              value={profile.profession}
              onChange={(e) => handleChange('profession', e.target.value)}
              placeholder="e.g. Wildlife photographer, Safari guide"
              className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
            />
          </div>

          {/* Publishing Preferences */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
              <Share2 className="w-3.5 h-3.5 text-indigo-400" /> Publishing Platforms
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'facebook', label: 'Facebook' },
                { id: 'instagram', label: 'Instagram' },
                { id: 'twitter', label: 'X (Twitter)' },
              ].map((plat) => {
                const isSelected = Boolean(publishingPrefs[plat.id]);
                return (
                  <button
                    key={plat.id}
                    type="button"
                    onClick={() => handleTogglePublishing(plat.id)}
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all ${
                      isSelected
                        ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-200'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    {plat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Post Language */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-indigo-400" /> Post Language
            </label>
            <select
              value={profile.language || 'English'}
              onChange={(e) => handleChange('language', e.target.value)}
              className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
            >
              {LANGUAGE_OPTIONS.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          {/* Content Type */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-indigo-400" /> Tone & Content Type
            </label>
            <select
              value={profile.content_type}
              onChange={(e) => handleChange('content_type', e.target.value)}
              className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
            >
              <option value="Social post">Social post</option>
              <option value="Storytelling post">Storytelling post</option>
              <option value="Educational post">Educational post</option>
              <option value="Promotional post">Promotional post</option>
              <option value="Product showcase">Product showcase</option>
              <option value="Event announcement">Event announcement</option>
            </select>
          </div>

          {/* Target Audience */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-400" /> Target audience
            </label>
            <input
              type="text"
              value={profile.target_audience}
              onChange={(e) => handleChange('target_audience', e.target.value)}
              placeholder="e.g. Wildlife enthusiasts & conservationists"
              className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
            />
          </div>

          {/* Target Age Groups */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5 flex items-center justify-between">
              <span>Target Age Groups</span>
              <span className="text-[10px] text-slate-400 font-normal">
                {currentAgeGroups.map(normalizeAge).join(', ')}
              </span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {AGE_GROUP_OPTIONS.map((age) => {
                const isSelected = currentAgeGroups.some(
                  (a) => normalizeAge(a) === normalizeAge(age)
                );
                return (
                  <button
                    key={age}
                    type="button"
                    onClick={() => handleToggleAgeGroup(age)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-150 ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400'
                        : 'bg-slate-900/90 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    {age}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <span className="flex items-center gap-1 text-indigo-400">
            <Sparkles className="w-3.5 h-3.5" />
            MediaMuse AI Engine
          </span>
          <span className="text-[10px] text-slate-500">Ready</span>
        </div>
      </div>
    </aside>
  );
};
