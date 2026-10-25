import { RpActivity } from '../../../shared/services/rune-profile.service';

/** Small, pure formatting helpers shared by the OSRS panels. */

export function formatBossName(metric: string): string {
  return metric.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString();
}

export function formatGp(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B gp`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M gp`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K gp`;
  return `${value} gp`;
}

export function formatXp(xp: number): string {
  if (xp >= 1_000_000_000) return `${(xp / 1_000_000_000).toFixed(1)}B`;
  if (xp >= 1_000_000) return `${Math.floor(xp / 1_000_000)}M`;
  if (xp >= 1_000) return `${Math.floor(xp / 1_000)}K`;
  return `${xp}`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function itemImageUrl(itemId: number): string {
  return `https://static.runelite.net/cache/item/icon/${itemId}.png`;
}

export function skillIconUrl(skill: string): string {
  const lower = skill.toLowerCase();
  return `osrs/skills/${lower === 'runecraft' ? 'runecrafting' : lower}_icon.webp`;
}

export function achievementIcon(activity: RpActivity): string {
  switch (activity.type) {
    case 'level_up': return skillIconUrl(activity.data.name);
    case 'quest_completed': return 'osrs/icons/quests-icon.webp';
    case 'achievement_diary_tier_completed': return 'osrs/icons/diary-icon.webp';
    case 'combat_achievement_tier_completed':
    case 'combat_achievement_tier_reached': return 'osrs/icons/combat-achievements-icon.webp';
    default: return 'osrs/icons/skills-icon.webp';
  }
}

export function achievementLabel(activity: RpActivity): string {
  switch (activity.type) {
    case 'level_up': return `${activity.data.name} ${activity.data.level}`;
    case 'quest_completed': return activity.enriched.questName;
    case 'achievement_diary_tier_completed':
      return `${activity.enriched.areaName} ${activity.enriched.tierName ?? ''} Diary`.trim();
    case 'combat_achievement_tier_completed':
    case 'combat_achievement_tier_reached': return `${activity.enriched.tierName} Combat Achievements`;
    case 'xp_milestone': return `${activity.data.name} ${formatXp(activity.data.xp)} XP`;
    default: return 'Achievement';
  }
}

export function dropIcon(activity: RpActivity): string {
  if (activity.type === 'valuable_drop' || activity.type === 'new_item_obtained') {
    return itemImageUrl(activity.data.itemId);
  }
  return itemImageUrl(0);
}

export function dropLabel(activity: RpActivity): string {
  if (activity.type === 'valuable_drop') {
    return `${activity.enriched.itemName ?? 'Unknown'} — ${formatGp(activity.data.value)}`;
  }
  if (activity.type === 'new_item_obtained') {
    return activity.enriched.itemName ?? 'New collection log entry';
  }
  return 'Unknown drop';
}
