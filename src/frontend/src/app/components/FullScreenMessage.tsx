interface FullScreenMessageProps {
  title: string;
  body: string;
}

export function FullScreenMessage({ title, body }: FullScreenMessageProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center">
        <h1 className="text-2xl mb-3">{title}</h1>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
