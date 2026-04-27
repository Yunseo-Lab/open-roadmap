import { cn } from './ui/utils';

type ProfileAvatarSize = 'sm' | 'md' | 'lg';

interface ProfileAvatarProps {
  image?: string | null;
  name: string;
  size?: ProfileAvatarSize;
  className?: string;
}

const sizeClasses: Record<ProfileAvatarSize, string> = {
  sm: 'h-[42px] w-[42px] text-xs',
  md: 'h-12 w-12 text-lg',
  lg: 'h-20 w-20 text-2xl',
};

export function ProfileAvatar({
  image,
  name,
  size = 'md',
  className,
}: ProfileAvatarProps) {
  const sizeClass = sizeClasses[size];

  if (image) {
    return (
      <img
        src={image}
        alt=""
        className={cn(sizeClass, 'rounded-full object-cover flex-shrink-0', className)}
      />
    );
  }

  return (
    <div
      className={cn(
        sizeClass,
        'rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center flex-shrink-0 font-medium',
        className,
      )}
    >
      {getInitials(name)}
    </div>
  );
}

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'LM';
}
