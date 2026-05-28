---
archivist: true
entity_type: class
slug: rogue
name: Rogue
compendium: SRD
source: SRD 5.1
---

```class
slug: rogue
name: Rogue
edition: '2014'
source: SRD 5.1
description: |-
  ### Expertise 
   
  At 1st level, choose two of your skill proficiencies, or one of your skill proficiencies and your proficiency with thieves' tools. Your proficiency bonus is doubled for any ability check you make that uses either of the chosen proficiencies. 
   
  At 6th level, you can choose two more of your proficiencies (in skills or with thieves' tools) to gain this benefit. 
   
  ### Sneak Attack 
   
  Beginning at 1st level, you know how to strike subtly and exploit a foe's distraction. Once per turn, you can deal an extra 1d6 damage to one creature you hit with an attack if you have advantage on the attack roll. The attack must use a finesse or a ranged weapon. 
   
  You don't need advantage on the attack roll if another enemy of the target is within 5 feet of it, that enemy isn't incapacitated, and you don't have disadvantage on the attack roll. 
   
  The amount of the extra damage increases as you gain levels in this class, as shown in the Sneak Attack column of the Rogue table. 
   
  ### Thieves' Cant 
   
  During your rogue training you learned thieves' cant, a secret mix of dialect, jargon, and code that allows you to hide messages in seemingly normal conversation. Only another creature that knows thieves' cant understands such messages. It takes four times longer to convey such a message than it does to speak the same idea plainly. 
   
  In addition, you understand a set of secret signs and symbols used to convey short, simple messages, such as whether an area is dangerous or the territory of a thieves' guild, whether loot is nearby, or whether the people in an area are easy marks or will provide a safe house for thieves on the run. 
   
  ### Cunning Action 
   
  Starting at 2nd level, your quick thinking and agility allow you to move and act quickly. You can take a bonus action on each of your turns in combat. This action can be used only to take the Dash, Disengage, or Hide action. 
   
  ### Roguish Archetype 
   
  At 3rd level, you choose an archetype that you emulate in the exercise of your rogue abilities: Thief, Assassin, or Arcane Trickster, all detailed at the end of the class description. Your archetype choice grants you features at 3rd level and then again at 9th, 13th, and 17th level. 
   
  ### Ability Score Improvement 
   
  When you reach 4th level, and again at 8th, 10th, 12th, 16th, and 19th level, you can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1. As normal, you can't increase an ability score above 20 using this feature. 
   
  ### Uncanny Dodge 
   
  Starting at 5th level, when an attacker that you can see hits you with an attack, you can use your reaction to halve the attack's damage against you. 
   
  ### Evasion 
   
  Beginning at 7th level, you can nimbly dodge out of the way of certain area effects, such as a red dragon's fiery breath or an *ice storm* spell. When you are subjected to an effect that allows you to make a Dexterity saving throw to take only half damage, you instead take no damage if you succeed on the saving throw, and only half damage if you fail. 
   
  ### Reliable Talent 
   
  By 11th level, you have refined your chosen skills until they approach perfection. Whenever you make an ability check that lets you add your proficiency bonus, you can treat a d20 roll of 9 or lower as a 10. 
   
  ### Blindsense 
   
  Starting at 14th level, if you are able to hear, you are aware of the location of any hidden or invisible creature within 10 feet of you. 
   
  ### Slippery Mind 
   
  By 15th level, you have acquired greater mental strength. You gain proficiency in Wisdom saving throws. 
   
  ### Elusive 
   
  Beginning at 18th level, you are so evasive that attackers rarely gain the upper hand against you. No attack roll has advantage against you while you aren't incapacitated. 
   
  ### Stroke of Luck 
   
  At 20th level, you have an uncanny knack for succeeding when you need to. If your attack misses a target within range, you can turn the miss into a hit. Alternatively, if you fail an ability check, you can treat the d20 roll as a 20. 
   
  Once you use this feature, you can't use it again until you finish a short or long rest. 
   
  ### Roguish Archetypes 
   
  Rogues have many features in common, including their emphasis on perfecting their skills, their precise and deadly approach to combat, and their increasingly quick reflexes. But different rogues steer those talents in varying directions, embodied by the rogue archetypes. Your choice of archetype is a reflection of your focus-not necessarily an indication of your chosen profession, but a description of your preferred techniques.
hit_die: d8
primary_abilities:
  - dex
saving_throws:
  - dex
  - int
proficiencies:
  armor:
    - light
  weapons:
    categories:
      - simple
    fixed:
      - hand-crossbows
      - longswords
      - rapiers
      - shortswords
  tools:
    fixed:
      - thieves-tools
skill_choices:
  count: 4
  from:
    - acrobatics
    - athletics
    - deception
    - insight
    - intimidation
    - investigation
    - perception
    - performance
    - persuasion
    - sleight-of-hand
    - stealth
starting_equipment:
  - kind: fixed
    items:
      - (*a*) a rapier or (*b*) a shortsword
      - (*a*) a shortbow and quiver of 20 arrows or (*b*) a shortsword
      - (*a*) a burglar's pack, (*b*) a dungeoneer's pack, or (*c*) an explorer's pack
      - (*a*) Leather armor, two daggers, and thieves' tools
spellcasting: null
subclass_level: 3
subclass_feature_name: Roguish Archetypes
weapon_mastery: null
epic_boon_level: null
table:
  '1':
    prof_bonus: 2
    feature_ids:
      - expertise
      - sneak-attack
      - thieves-cant
    columns:
      col1: 1d6
  '2':
    prof_bonus: 2
    feature_ids:
      - cunning-action
    columns:
      col1: 1d6
  '3':
    prof_bonus: 2
    feature_ids:
      - roguish-archetype
    columns:
      col1: 2d6
  '4':
    prof_bonus: 2
    feature_ids:
      - ability-score-improvement
    columns:
      col1: 2d6
  '5':
    prof_bonus: 3
    feature_ids:
      - uncanny-dodge
    columns:
      col1: 3d6
  '6':
    prof_bonus: 3
    feature_ids:
      - expertise
    columns:
      col1: 3d6
  '7':
    prof_bonus: 3
    feature_ids:
      - evasion
    columns:
      col1: 4d6
  '8':
    prof_bonus: 3
    feature_ids:
      - ability-score-improvement
    columns:
      col1: 4d6
  '9':
    prof_bonus: 4
    feature_ids:
      - roguish-archetype-feature
    columns:
      col1: 5d6
  '10':
    prof_bonus: 4
    feature_ids:
      - ability-score-improvement
    columns:
      col1: 5d6
  '11':
    prof_bonus: 4
    feature_ids:
      - reliable-talent
    columns:
      col1: 6d6
  '12':
    prof_bonus: 4
    feature_ids:
      - ability-score-improvement
    columns:
      col1: 6d6
  '13':
    prof_bonus: 5
    feature_ids:
      - roguish-archetype-feature
    columns:
      col1: 7d6
  '14':
    prof_bonus: 5
    feature_ids:
      - blindsense
    columns:
      col1: 7d6
  '15':
    prof_bonus: 5
    feature_ids:
      - slippery-mind
    columns:
      col1: 8d6
  '16':
    prof_bonus: 5
    feature_ids:
      - ability-score-improvement
    columns:
      col1: 8d6
  '17':
    prof_bonus: 6
    feature_ids:
      - roguish-archetype-feature
    columns:
      col1: 9d6
  '18':
    prof_bonus: 6
    feature_ids:
      - elusive
    columns:
      col1: 9d6
  '19':
    prof_bonus: 6
    feature_ids:
      - ability-score-improvement
    columns:
      col1: 10d6
  '20':
    prof_bonus: 6
    feature_ids:
      - stroke-of-luck
    columns:
      col1: 10d6
features_by_level:
  '1':
    - id: expertise
      name: Expertise
      description: |-
        At 1st level, choose two of your skill proficiencies, or one of your skill proficiencies and your proficiency with thieves' tools. Your proficiency bonus is doubled for any ability check you make that uses either of the chosen proficiencies. 
         
        At 6th level, you can choose two more of your proficiencies (in skills or with thieves' tools) to gain this benefit.
    - id: sneak-attack
      name: Sneak Attack
      description: |-
        Beginning at 1st level, you know how to strike subtly and exploit a foe's distraction. Once per turn, you can deal an extra 1d6 damage to one creature you hit with an attack if you have advantage on the attack roll. The attack must use a finesse or a ranged weapon. 
         
        You don't need advantage on the attack roll if another enemy of the target is within 5 feet of it, that enemy isn't incapacitated, and you don't have disadvantage on the attack roll. 
         
        The amount of the extra damage increases as you gain levels in this class, as shown in the Sneak Attack column of the Rogue table.
    - id: thieves-cant
      name: Thieves' Cant
      description: |-
        During your rogue training you learned thieves' cant, a secret mix of dialect, jargon, and code that allows you to hide messages in seemingly normal conversation. Only another creature that knows thieves' cant understands such messages. It takes four times longer to convey such a message than it does to speak the same idea plainly. 
         
        In addition, you understand a set of secret signs and symbols used to convey short, simple messages, such as whether an area is dangerous or the territory of a thieves' guild, whether loot is nearby, or whether the people in an area are easy marks or will provide a safe house for thieves on the run.
    - id: ability-score-improvement
      name: Ability Score Improvement
      description: When you reach 4th level, and again at 8th, 10th, 12th, 16th, and 19th level, you can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1. As normal, you can't increase an ability score above 20 using this feature.
    - id: roguish-archetypes
      name: Roguish Archetypes
      description: Rogues have many features in common, including their emphasis on perfecting their skills, their precise and deadly approach to combat, and their increasingly quick reflexes. But different rogues steer those talents in varying directions, embodied by the rogue archetypes. Your choice of archetype is a reflection of your focus-not necessarily an indication of your chosen profession, but a description of your preferred techniques.
  '2':
    - id: cunning-action
      name: Cunning Action
      description: Starting at 2nd level, your quick thinking and agility allow you to move and act quickly. You can take a bonus action on each of your turns in combat. This action can be used only to take the Dash, Disengage, or Hide action.
  '3':
    - id: roguish-archetype
      name: Roguish Archetype
      description: 'At 3rd level, you choose an archetype that you emulate in the exercise of your rogue abilities: Thief, Assassin, or Arcane Trickster, all detailed at the end of the class description. Your archetype choice grants you features at 3rd level and then again at 9th, 13th, and 17th level.'
  '5':
    - id: uncanny-dodge
      name: Uncanny Dodge
      description: Starting at 5th level, when an attacker that you can see hits you with an attack, you can use your reaction to halve the attack's damage against you.
  '7':
    - id: evasion
      name: Evasion
      description: Beginning at 7th level, you can nimbly dodge out of the way of certain area effects, such as a red dragon's fiery breath or an *ice storm* spell. When you are subjected to an effect that allows you to make a Dexterity saving throw to take only half damage, you instead take no damage if you succeed on the saving throw, and only half damage if you fail.
  '11':
    - id: reliable-talent
      name: Reliable Talent
      description: By 11th level, you have refined your chosen skills until they approach perfection. Whenever you make an ability check that lets you add your proficiency bonus, you can treat a d20 roll of 9 or lower as a 10.
  '14':
    - id: blindsense
      name: Blindsense
      description: Starting at 14th level, if you are able to hear, you are aware of the location of any hidden or invisible creature within 10 feet of you.
  '15':
    - id: slippery-mind
      name: Slippery Mind
      description: By 15th level, you have acquired greater mental strength. You gain proficiency in Wisdom saving throws.
  '18':
    - id: elusive
      name: Elusive
      description: Beginning at 18th level, you are so evasive that attackers rarely gain the upper hand against you. No attack roll has advantage against you while you aren't incapacitated.
  '20':
    - id: stroke-of-luck
      name: Stroke of Luck
      description: |-
        At 20th level, you have an uncanny knack for succeeding when you need to. If your attack misses a target within range, you can turn the miss into a hit. Alternatively, if you fail an ability check, you can treat the d20 roll as a 20. 
         
        Once you use this feature, you can't use it again until you finish a short or long rest.
resources: []
```
