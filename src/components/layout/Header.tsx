import type { Profile } from '../../types';

interface HeaderProps {
  profile: Profile | null;
  onSignOut: () => void;
}

export function Header({ profile, onSignOut }: HeaderProps) {
  return (
    <header className="bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
          ⚔
        </div>
        <h1 className="text-white font-bold text-lg hidden sm:block">Guild War Manager</h1>
      </div>

      {profile && (
        <div className="flex items-center gap-3">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.username}
              className="w-8 h-8 rounded-full border-2 border-indigo-500"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-indigo-700 flex items-center justify-center text-white text-xs font-bold">
              {profile.username.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="hidden sm:block text-right">
            <p className="text-white text-sm font-medium leading-tight">{profile.username}</p>
            {profile.character_name && (
              <p className="text-slate-400 text-xs leading-tight">
                {profile.character_name}
                {profile.character_class ? ` · ${profile.character_class}` : ''}
              </p>
            )}
          </div>
          {profile.is_management && (
            <span className="bg-indigo-700 text-indigo-100 text-xs px-2 py-0.5 rounded-full font-medium">
              GM
            </span>
          )}
          <button
            onClick={onSignOut}
            className="text-slate-400 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </header>
  );
}
