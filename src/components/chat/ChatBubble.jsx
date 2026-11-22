import ChatAttachment from '@/components/chat/ChatAttachment';

export default function ChatBubble({ message, mine }) {
  const time = message.created_date ? new Date(message.created_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`selectable-text max-w-[85%] rounded-xl px-3 py-2 ${mine ? 'bg-primary/10 text-foreground' : 'bg-secondary text-foreground'} ${message._pending ? 'opacity-60' : ''}`}>
        {!mine ? <p className="mb-1 text-sm font-semibold uppercase tracking-[0.1em] text-primary">{message.sender_handle}</p> : null}
        {message.body ? <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.body}</p> : null}
        {message.file_uri ? (
          <div className="mt-1.5">
            <ChatAttachment uri={message.file_uri} kind={message.file_kind} />
          </div>
        ) : null}
        <p className="mt-1 text-right text-sm text-muted-foreground">{message._pending ? 'Sending…' : time}</p>
      </div>
    </div>
  );
}