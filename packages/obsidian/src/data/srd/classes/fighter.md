---
archivist: true
entity_type: class
slug: fighter
name: Fighter
compendium: SRD
source: SRD 5.1
---

```class
slug: fighter
name: Fighter
edition: '2014'
source: SRD 5.1
description: |-
  ### Fighting Style 
   
  You adopt a particular style of fighting as your specialty. Choose one of the following options. You can't take a Fighting Style option more than once, even if you later get to choose again. 
   
  #### Archery 
   
  You gain a +2 bonus to attack rolls you make with ranged weapons. 
   
  #### Defense 
   
  While you are wearing armor, you gain a +1 bonus to AC. 
   
  #### Dueling 
   
  When you are wielding a melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls with that weapon. 
   
  #### Great Weapon Fighting 
   
  When you roll a 1 or 2 on a damage die for an attack you make with a melee weapon that you are wielding with two hands, you can reroll the die and must use the new roll, even if the new roll is a 1 or a 2. The weapon must have the two-handed or versatile property for you to gain this benefit. 
   
  #### Protection 
   
  When a creature you can see attacks a target other than you that is within 5 feet of you, you can use your reaction to impose disadvantage on the attack roll. You must be wielding a shield. 
   
  #### Two-Weapon Fighting 
   
  When you engage in two-weapon fighting, you can add your ability modifier to the damage of the second attack. 
   
  ### Second Wind 
   
  You have a limited well of stamina that you can draw on to protect yourself from harm. On your turn, you can use a bonus action to regain hit points equal to 1d10 + your fighter level. Once you use this feature, you must finish a short or long rest before you can use it again. 
   
  ### Action Surge 
   
  Starting at 2nd level, you can push yourself beyond your normal limits for a moment. On your turn, you can take one additional action on top of your regular action and a possible bonus action. 
   
  Once you use this feature, you must finish a short or long rest before you can use it again. Starting at 17th level, you can use it twice before a rest, but only once on the same turn. 
   
  ### Martial Archetype 
   
  At 3rd level, you choose an archetype that you strive to emulate in your combat styles and techniques. Choose Champion, Battle Master, or Eldritch Knight, all detailed at the end of the class description. The archetype you choose grants you features at 3rd level and again at 7th, 10th, 15th, and 18th level. 
   
  ### Ability Score Improvement 
   
  When you reach 4th level, and again at 6th, 8th, 12th, 14th, 16th, and 19th level, you can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1. As normal, you can't increase an ability score above 20 using this feature. 
   
  ### Extra Attack 
   
  Beginning at 5th level, you can attack twice, instead of once, whenever you take the Attack action on your turn. 
   
  The number of attacks increases to three when you reach 11th level in this class and to four when you reach 20th level in this class. 
   
  ### Indomitable 
   
  Beginning at 9th level, you can reroll a saving throw that you fail. If you do so, you must use the new roll, and you can't use this feature again until you finish a long rest. 
   
  You can use this feature twice between long rests starting at 13th level and three times between long rests starting at 17th level.
   
  ### Martial Archetypes 
   
  Different fighters choose different approaches to perfecting their fighting prowess. The martial archetype you choose to emulate reflects your approach.
hit_die: d10
primary_abilities:
  - str
  - dex
saving_throws:
  - str
  - con
proficiencies:
  armor:
    - shield
  weapons:
    categories:
      - simple
      - martial
  tools:
    fixed:
      - none
skill_choices:
  count: 2
  from:
    - acrobatics
    - athletics
    - history
    - insight
    - intimidation
    - perception
    - survival
starting_equipment:
  - kind: fixed
    items:
      - (*a*) chain mail or (*b*) leather armor, longbow, and 20 arrows
      - (*a*) a martial weapon and a shield or (*b*) two martial weapons
      - (*a*) a light crossbow and 20 bolts or (*b*) two handaxes
      - (*a*) a dungeoneer's pack or (*b*) an explorer's pack
spellcasting: null
subclass_level: 3
subclass_feature_name: Martial Archetypes
weapon_mastery: null
epic_boon_level: null
table:
  '1':
    prof_bonus: 2
    feature_ids:
      - fighting-style
      - second-wind
  '2':
    prof_bonus: 2
    feature_ids:
      - action-surge-(one-use)
  '3':
    prof_bonus: 2
    feature_ids:
      - martial-archetype
  '4':
    prof_bonus: 2
    feature_ids:
      - ability-score-improvement
  '5':
    prof_bonus: 3
    feature_ids:
      - extra-attack
  '6':
    prof_bonus: 3
    feature_ids:
      - ability-score-improvement
  '7':
    prof_bonus: 3
    feature_ids:
      - martial-archetype-feature
  '8':
    prof_bonus: 3
    feature_ids:
      - ability-score-improvement
  '9':
    prof_bonus: 4
    feature_ids:
      - indomitable-(one-use)
  '10':
    prof_bonus: 4
    feature_ids:
      - martial-archetype-feature
  '11':
    prof_bonus: 4
    feature_ids:
      - extra-attack-(2)
  '12':
    prof_bonus: 4
    feature_ids:
      - ability-score-improvement
  '13':
    prof_bonus: 5
    feature_ids:
      - indomitable-(two-uses)
  '14':
    prof_bonus: 5
    feature_ids:
      - ability-score-improvement
  '15':
    prof_bonus: 5
    feature_ids:
      - martial-archetype-feature
  '16':
    prof_bonus: 5
    feature_ids:
      - ability-score-improvement
  '17':
    prof_bonus: 6
    feature_ids:
      - action-surge-(two-uses)
      - indomitable-(three-uses)
  '18':
    prof_bonus: 6
    feature_ids:
      - martial-archetype-feature
  '19':
    prof_bonus: 6
    feature_ids:
      - ability-score-improvement
  '20':
    prof_bonus: 6
    feature_ids:
      - extra-attack-(3)
features_by_level:
  '1':
    - id: fighting-style
      name: Fighting Style
      description: |-
        You adopt a particular style of fighting as your specialty. Choose one of the following options. You can't take a Fighting Style option more than once, even if you later get to choose again. 
         
        #### Archery 
         
        You gain a +2 bonus to attack rolls you make with ranged weapons. 
         
        #### Defense 
         
        While you are wearing armor, you gain a +1 bonus to AC. 
         
        #### Dueling 
         
        When you are wielding a melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls with that weapon. 
         
        #### Great Weapon Fighting 
         
        When you roll a 1 or 2 on a damage die for an attack you make with a melee weapon that you are wielding with two hands, you can reroll the die and must use the new roll, even if the new roll is a 1 or a 2. The weapon must have the two-handed or versatile property for you to gain this benefit. 
         
        #### Protection 
         
        When a creature you can see attacks a target other than you that is within 5 feet of you, you can use your reaction to impose disadvantage on the attack roll. You must be wielding a shield. 
         
        #### Two-Weapon Fighting 
         
        When you engage in two-weapon fighting, you can add your ability modifier to the damage of the second attack.
    - id: second-wind
      name: Second Wind
      description: You have a limited well of stamina that you can draw on to protect yourself from harm. On your turn, you can use a bonus action to regain hit points equal to 1d10 + your fighter level. Once you use this feature, you must finish a short or long rest before you can use it again.
    - id: ability-score-improvement
      name: Ability Score Improvement
      description: When you reach 4th level, and again at 6th, 8th, 12th, 14th, 16th, and 19th level, you can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1. As normal, you can't increase an ability score above 20 using this feature.
    - id: martial-archetypes
      name: Martial Archetypes
      description: Different fighters choose different approaches to perfecting their fighting prowess. The martial archetype you choose to emulate reflects your approach.
  '2':
    - id: action-surge
      name: Action Surge
      description: |-
        Starting at 2nd level, you can push yourself beyond your normal limits for a moment. On your turn, you can take one additional action on top of your regular action and a possible bonus action. 
         
        Once you use this feature, you must finish a short or long rest before you can use it again. Starting at 17th level, you can use it twice before a rest, but only once on the same turn.
  '3':
    - id: martial-archetype
      name: Martial Archetype
      description: At 3rd level, you choose an archetype that you strive to emulate in your combat styles and techniques. Choose Champion, Battle Master, or Eldritch Knight, all detailed at the end of the class description. The archetype you choose grants you features at 3rd level and again at 7th, 10th, 15th, and 18th level.
  '5':
    - id: extra-attack
      name: Extra Attack
      description: |-
        Beginning at 5th level, you can attack twice, instead of once, whenever you take the Attack action on your turn. 
         
        The number of attacks increases to three when you reach 11th level in this class and to four when you reach 20th level in this class.
  '9':
    - id: indomitable
      name: Indomitable
      description: |-
        Beginning at 9th level, you can reroll a saving throw that you fail. If you do so, you must use the new roll, and you can't use this feature again until you finish a long rest. 
         
        You can use this feature twice between long rests starting at 13th level and three times between long rests starting at 17th level.
resources: []
```
