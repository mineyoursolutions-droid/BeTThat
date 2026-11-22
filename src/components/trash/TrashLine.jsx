const SIDE_STYLE = {
  creator: { label: 'Creator', className: 'text-primary' },
  challenger: { label: 'Challenger', className: 'text-win' },
  spectator: { label: 'Spectator', className: 'text-muted-foreground' },
};

export default function TrashLine({ post }) {
  const side = SIDE_STYLE[post.side] || SIDE_STYLE.spectator;
  const time = post.created_date
    ? new Date(post.created_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="rounded-xl border border-border/70 bg-background/60 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[12px] font-semibold text-foreground">{post.user_handle}</span>
          <span className={`text-[9.5px] font-bold uppercase tracking-[0.1em] ${side.className}`}>{side.label}</span>
        </p>
        <span className="nums shrink-0 text-[9.5px] text-muted-foreground">{time}</span>
      </div>
      <p className="mt-1 whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-muted-foreground">{post.body}</p>
    </div>
  );
}