import { formatBossName, formatGp, formatXp, achievementLabel, dropLabel, maxedSkills } from './osrs-format';
import { RpActivity } from '../../../shared/services/rune-profile.service';

describe('osrs-format', () => {
  it('title-cases boss metrics, keeping small words lowercase after the first', () => {
    expect(formatBossName('king_black_dragon')).toBe('King Black Dragon');
    expect(formatBossName('tombs_of_amascut')).toBe('Tombs of Amascut');
    expect(formatBossName('the_corrupted_gauntlet')).toBe('The Corrupted Gauntlet');
    expect(formatBossName('theatre_of_blood_hard_mode')).toBe('Theatre of Blood Hard Mode');
  });

  it('abbreviates gp', () => {
    expect(formatGp(950)).toBe('950 gp');
    expect(formatGp(12_400)).toBe('12K gp');
    expect(formatGp(3_250_000)).toBe('3.3M gp');
    expect(formatGp(1_500_000_000)).toBe('1.5B gp');
  });

  it('counts skills at 99, ignoring overall', () => {
    expect(maxedSkills({ overall: { level: 2000 }, attack: { level: 99 }, magic: { level: 98 } })).toEqual({ maxed: 1, total: 2 });
    expect(maxedSkills({})).toEqual({ maxed: 0, total: 0 });
  });

  it('abbreviates xp', () => {
    expect(formatXp(13_034_431)).toBe('13M');
    expect(formatXp(200_000_000)).toBe('200M');
  });

  it('labels activities', () => {
    const levelUp = { type: 'level_up', createdAt: '', data: { name: 'Slayer', level: 99 }, enriched: {} } as RpActivity;
    expect(achievementLabel(levelUp)).toBe('Slayer 99');
    const drop = { type: 'valuable_drop', createdAt: '', data: { itemId: 1, value: 2_000_000 }, enriched: { itemName: 'Dragon pickaxe' } } as RpActivity;
    expect(dropLabel(drop)).toBe('Dragon pickaxe — 2.0M gp');
  });
});
