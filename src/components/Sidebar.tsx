'use client';

import React from 'react';
import { UserCheck, Sparkles, Target, Users, Briefcase } from 'lucide-react';
import { CreatorProfile } from '../types/mediamind';

interface SidebarProps {
  profile: CreatorProfile;
  onChange: (updatedProfile: CreatorProfile) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ profile, onChange }) => {
  const handleChange = (field: keyof CreatorProfile, value: string) => {
    onChange({ ...profile, [field]: value });
  };

  return (
    <aside className="w-full lg:w-80 flex-shrink-0">
      <div className="glass-card p-6 border border-slate-800/80 sticky top-6 shadow-xl">
        <div className="flex items-center gap-2 mb-2 pb-3 border-b border-slate-800">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-bold text-slate-100">Creator Profile</h2>
        </div>
        <p className="text-xs text-slate-400 mb-6">
          This profile guides every generated post to match your authentic voice.
        </p>

        <div className="space-y-4 text-xs">
          {/* User Type */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-indigo-400" /> User type
            </label>
            <select
              value={profile.user_type}
              onChange={(e) => handleChange('user_type', e.target.value)}
              className="w-full glass-input rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none"
            >
              <option value="Individual">Individual</option>
              <option value="Creator / Influencer">Creator / Influencer</option>
              <option value="Business / Brand">Business / Brand</option>
              <option value="Organization">Organization</option>
            </select>
          </div>

          {/* Name */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Name</label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g. Aisha Sharma or Wild Trails Co."
              className="w-full glass-input rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none"
            />
          </div>

          {/* Profession */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-indigo-400" /> Profession
            </label>
            <input
              type="text"
              value={profile.profession}
              onChange={(e) => handleChange('profession', e.target.value)}
              placeholder="e.g. Wildlife photographer"
              className="w-full glass-input rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none"
            />
          </div>

          {/* Content Type */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-indigo-400" /> Social media content to generate
            </label>
            <select
              value={profile.content_type}
              onChange={(e) => handleChange('content_type', e.target.value)}
              className="w-full glass-input rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none"
            >
              <option value="Social post">Social post</option>
              <option value="Promotional post">Promotional post</option>
              <option value="Educational post">Educational post</option>
              <option value="Storytelling post">Storytelling post</option>
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
              placeholder="e.g. Nature lovers and aspiring photographers"
              className="w-full glass-input rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none"
            />
          </div>

          {/* Target Age Group */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Target age group</label>
            <select
              value={profile.target_age_group}
              onChange={(e) => handleChange('target_age_group', e.target.value)}
              className="w-full glass-input rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none"
            >
              <option value="13–17">13–17</option>
              <option value="18–24">18–24</option>
              <option value="25–34">25–34</option>
              <option value="35–44">35–44</option>
              <option value="45–54">45–54</option>
              <option value="55+">55+</option>
              <option value="All ages">All ages</option>
            </select>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800 text-xs text-indigo-300/80 flex items-center justify-center gap-1.5 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Powered by AI</span>
        </div>
      </div>
    </aside>
  );
};
