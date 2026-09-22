// CupidX Curated Avatar Collection

export const FREE_AVATARS = ['😊', '😎'];

export interface AvatarCategory {
  name: string;
  emojis: string[];
}

export const VIP_AVATAR_CATEGORIES: AvatarCategory[] = [
  {
    name: 'Confident',
    emojis: ['😎', '🫡', '🤠', '👑'],
  },
  {
    name: 'Fun',
    emojis: ['😂', '🤪', '🥳', '😜'],
  },
  {
    name: 'Cute',
    emojis: ['🥰', '😊', '😇', '🐰'],
  },
  {
    name: 'Mysterious',
    emojis: ['😈', '👽', '🖤', '🌙'],
  },
  {
    name: 'Energetic',
    emojis: ['🔥', '⚡', '🚀', '💥'],
  },
  {
    name: 'Creative',
    emojis: ['🎨', '🎧', '🎮', '🎸'],
  },
  {
    name: 'Chaotic',
    emojis: ['🤯', '👹', '💀'],
  },
  {
    name: 'Romantic',
    emojis: ['❤️', '💘', '🌹', '💋'],
  },
];

// Flattened list of all VIP emojis
export const ALL_VIP_AVATARS = VIP_AVATAR_CATEGORIES.flatMap((c) => c.emojis);

// Helper to check if an emoji requires VIP
export function isVipAvatar(emoji: string): boolean {
  return !FREE_AVATARS.includes(emoji);
}
