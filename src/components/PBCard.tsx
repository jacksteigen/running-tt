interface PBCardProps {
  distance: string;
  time: string;
  verified?: boolean;
}

export default function PBCard({ distance, time, verified }: PBCardProps) {
  return (
    <div className="bg-white border border-stone/40 overflow-hidden">
      <div className="bg-midnight text-white px-4 py-2 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em]">
          {distance}
        </p>
        {verified && (
          <span
            className="inline-flex items-center gap-1 text-[10px] text-trail"
            title="Verified"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-trail" />
            verified
          </span>
        )}
      </div>
      <div className="px-4 py-5">
        <p className="text-3xl font-mono font-semibold tracking-tight tabular-nums">
          {time}
        </p>
        <p className="text-[10px] uppercase tracking-[0.2em] text-dust mt-1">
          Personal best
        </p>
      </div>
    </div>
  );
}
