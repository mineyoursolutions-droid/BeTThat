import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessagesSquare, Lock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ChatBubble from '@/components/chat/ChatBubble';
import ChatComposer from '@/components/chat/ChatComposer';

const CLOSED = ['settled', 'cancelled'];

export default function MatchChat({ match, user }) {
  const isPlayer = Boolean(user && (match.creator_id === user.id || match.challenger_id === user.id));
  const [messages, setMessages] = useState(null);
  const endRef = useRef(null);

  useEffect(() => {
    if (!isPlayer) {
      setMessages(null);
      return;
    }
    let active = true;
    base44.entities.MatchMessage.filter({ match_id: match.id }, { sort: 'created_date', limit: 100 }).then((page) => {
      if (active) setMessages(page.items || []);
    });

    const unsubscribe = base44.entities.MatchMessage.subscribe((event) => {
      if (event.type !== 'create' || event.data?.match_id !== match.id) return;
      setMessages((prev) => {
        const list = prev || [];
        if (list.some((m) => m.id === event.data.id)) return list;
        return [...list, event.data];
      });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [match.id, isPlayer]);

  useEffect(() => {
    if (messages && messages.length) endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages]);

  const heading = (
    <div className="flex items-center gap-2">
      <MessagesSquare className="h-4 w-4 text-primary" />
      <h2 className="text-[14px] font-semibold">Player thread</h2>
    </div>
  );

  if (!isPlayer) {
    return (
      <div className="mt-3 rounded-2xl border border-border bg-card p-5">
        {heading}
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-border/80 bg-background/60 p-3.5">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            {user
              ? 'Private player comms. Only the two players in this match can read or post here.'
              : 'Private player comms. Sign in as a player in this match to coordinate.'}
          </p>
        </div>
        {!user ? (
          <Link to="/login" className="mt-3 inline-block text-[11.5px] font-semibold text-primary hover:underline">
            Sign in
          </Link>
        ) : null}
      </div>
    );
  }

  const closed = CLOSED.includes(match.status);

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        {heading}
        <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">P2P</span>
      </div>

      <div className="max-h-[320px] min-h-[140px] space-y-2.5 overflow-y-auto p-3.5">
        {messages === null ? (
          <>
            <div className="h-9 w-2/3 animate-pulse rounded-xl bg-secondary" />
            <div className="ml-auto h-9 w-1/2 animate-pulse rounded-xl bg-secondary" />
          </>
        ) : messages.length === 0 ? (
          <p className="py-6 text-center text-[11.5px] leading-relaxed text-muted-foreground">
            No messages yet. Lock in the lobbies, swap gamertags and confirm the ruleset here.
          </p>
        ) : (
          messages.map((message) => (
            <ChatBubble key={message.id} message={message} mine={message.sender_id === user.id} />
          ))
        )}
        <div ref={endRef} />
      </div>

      {closed ? (
        <div className="border-t border-border px-4 py-3 text-[11px] text-muted-foreground">
          This match is closed — the thread is read-only.
        </div>
      ) : (
        <ChatComposer
          match={match}
          onSent={(message) =>
            setMessages((prev) => {
              const list = prev || [];
              if (list.some((m) => m.id === message.id)) return list;
              return [...list, message];
            })
          }
        />
      )}
    </div>
  );
}