import { useMemberOfWeek } from '../../hooks/useMemberOfWeek';

interface MemberOfTheWeekBannerProps {
  isManagement: boolean;
  userId: string;
  onNominate?: () => void;
}

export function MemberOfTheWeekBanner({ isManagement }: MemberOfTheWeekBannerProps) {
  const { current, loading } = useMemberOfWeek(isManagement);

  if (loading || !current) return null;

  const profile = current.profile;
  if (!profile) return null;

  return (
    <div
      className="relative overflow-hidden bg-linear-to-r from-amber-950 via-amber-900/80 to-yellow-950 border-b border-amber-600/30"
      style={{
        animation: 'motwSlideDown 0.3s ease-out',
      }}
    >
      <style>{`
        @keyframes motwSlideDown {
          from { transform: translateY(-100%); }
          to   { transform: translateY(0); }
        }
        @keyframes motwSparkle {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50%      { opacity: 1;   transform: scale(1.2); }
        }
      `}</style>

      {/* Decorative sparkles */}
      <div className="absolute inset-0 pointer-events-none">
        <span className="absolute top-1 left-[10%] text-amber-300/40 text-lg" style={{ animation: 'motwSparkle 2s ease-in-out infinite' }}>✦</span>
        <span className="absolute top-0 right-[20%] text-amber-300/30 text-sm" style={{ animation: 'motwSparkle 2.5s ease-in-out infinite 0.5s' }}>✦</span>
        <span className="absolute bottom-1 left-[40%] text-yellow-300/25 text-xs" style={{ animation: 'motwSparkle 3s ease-in-out infinite 1s' }}>✦</span>
        <span className="absolute top-1 right-[40%] text-amber-300/35 text-base" style={{ animation: 'motwSparkle 1.8s ease-in-out infinite 0.3s' }}>✦</span>
      </div>

      <div className="relative flex items-center justify-center gap-3 px-4 py-2.5">
        <span className="text-2xl">🌟</span>

        <div className="flex items-center gap-2.5">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full ring-2 ring-amber-400/60" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-amber-700 flex items-center justify-center text-white text-sm font-bold ring-2 ring-amber-400/60">
              {profile.username.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="text-center">
            <p className="text-amber-100 text-sm font-semibold">
              ⭐ Member of the Week
            </p>
            <p className="text-amber-200/80 text-xs">
              {profile.character_name ?? profile.username}
              {profile.character_class ? ` · ${profile.character_class}` : ''}
              {current.reason ? ` — ${current.reason}` : ''}
            </p>
          </div>
        </div>

        <span className="text-2xl">🌟</span>
      </div>
    </div>
  );
}
