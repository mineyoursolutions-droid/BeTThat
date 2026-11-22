import { useEffect, useRef, useState } from 'react';
import { Flame } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import TrashLine from '@/components/trash/TrashLine';
import TrashTalkComposer from '@/components/trash/TrashTalkComposer';

export default function TrashTalk({ match, user }) {
  const [posts, setPosts] = useState(null);
  const endRef = useRef(null);

  useEffect(() => {
    let active = true;
    base44.entities.TrashTalk.filter({ match_id: match.id }, { sort: '-created_date', limit: 60 }).then((page) => {
      if (active) setPosts((page.items || []).slice().reverse());
    });

    const unsubscribe = base44.entities.TrashTalk.subscribe((event) => {
      if (event.type !== 'create' || event.data?.match_id !== match.id) return;
      setPosts((prev) => {
        const list = prev || [];
        if (list.some((p) => p.id === event.data.id)) return list;
        return [...list, event.data];
      });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [match.id]);

  useEffect(() => {
    if (posts && posts.length) endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [posts]);

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-live" />
          <h2 className="text-[14px] font-semibold">Trash talk</h2>
        </div>
        <span className="text-[10.5px] text-muted-foreground">Players and spectators · keep it about the match</span>
      </div>

      <div className="mt-4 max-h-[280px] space-y-2 overflow-y-auto">
        {posts === null ? (
          <>
            <div className="h-12 w-full animate-pulse rounded-xl bg-secondary" />
            <div className="h-12 w-3/4 animate-pulse rounded-xl bg-secondary" />
          </>
        ) : posts.length === 0 ? (
          <p className="py-6 text-center text-[12px] leading-relaxed text-muted-foreground">
            No banter yet. Set the tone before the first round drops.
          </p>
        ) : (
          posts.map((post) => <TrashLine key={post.id} post={post} />)
        )}
        <div ref={endRef} />
      </div>

      <TrashTalkComposer
        match={match}
        user={user}
        onPosted={(post, replacedTempId) =>
          setPosts((prev) => {
            let list = prev || [];
            if (replacedTempId) list = list.filter((p) => p.id !== replacedTempId);
            if (!post) return list;
            if (list.some((p) => p.id === post.id)) return list;
            return [...list, post];
          })
        }
      />
    </div>
  );
}