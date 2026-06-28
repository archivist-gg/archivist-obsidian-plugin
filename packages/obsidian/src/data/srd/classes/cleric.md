---
archivist: true
entity_type: class
slug: cleric
name: Cleric
compendium: SRD
source: SRD 5.1
---

```class
slug: cleric
name: Cleric
edition: '2014'
source: SRD 5.1
description: |-
  ### Spellcasting 
   
  As a conduit for divine power, you can cast cleric spells. 
   
  #### Cantrips 
   
  At 1st level, you know three cantrips of your choice from the cleric spell list. You learn additional cleric cantrips of your choice at higher levels, as shown in the Cantrips Known column of the Cleric table. 
   
  #### Preparing and Casting Spells 
   
  The Cleric table shows how many spell slots you have to cast your spells of 1st level and higher. To cast one of these spells, you must expend a slot of the spell's level or higher. You regain all expended spell slots when you finish a long rest. 
   
  You prepare the list of cleric spells that are available for you to cast, choosing from the cleric spell list. When you do so, choose a number of cleric spells equal to your Wisdom modifier + your cleric level (minimum of one spell). The spells must be of a level for which you have spell slots. 
   
  For example, if you are a 3rd-level cleric, you have four 
  1st-level and two 2nd-level spell slots. With a Wisdom of 16, your list of prepared spells can include six spells of 1st or 2nd level, in any combination. If you prepare the 1st-level spell *cure wounds*, you can cast it using a 1st-level or 2nd-level slot. Casting the spell doesn't remove it from your list of prepared spells. 
   
  You can change your list of prepared spells when you finish a long rest. Preparing a new list of cleric spells requires time spent in prayer and meditation: at least 1 minute per spell level for each spell on your list. 
   
  #### Spellcasting Ability 
   
  Wisdom is your spellcasting ability for your cleric spells. The power of your spells comes from your devotion to your deity. You use your Wisdom whenever a cleric spell refers to your spellcasting ability. In addition, you use your Wisdom modifier when setting the saving throw DC for a cleric spell you cast and when making an attack roll with one. 
   
  **Spell save DC** = 8 + your proficiency bonus + your Wisdom modifier 
   
  **Spell attack modifier** = your proficiency bonus + your Wisdom modifier 
   
  #### Ritual Casting 
   
  You can cast a cleric spell as a ritual if that spell has the ritual tag and you have the spell prepared. 
   
  #### Spellcasting Focus 
   
  You can use a holy symbol (see chapter 5, “Equipment”) as a spellcasting focus for your cleric spells. 
   
  ### Divine Domain 
   
  Choose one domain related to your deity: Knowledge, Life, Light, Nature, Tempest, Trickery, or War. Each domain is detailed at the end of the class description, and each one provides examples of gods associated with it. Your choice grants you domain spells and other features when you choose it at 1st level. It also grants you additional ways to use Channel Divinity when you gain that feature at 2nd level, and additional benefits at 6th, 8th, and 17th levels. 
   
  #### Domain Spells 
   
  Each domain has a list of spells-its domain spells- that you gain at the cleric levels noted in the domain description. Once you gain a domain spell, you always have it prepared, and it doesn't count against the number of spells you can prepare each day. 
   
  If you have a domain spell that doesn't appear on the cleric spell list, the spell is nonetheless a cleric spell for you. 
   
  ### Channel Divinity 
   
  At 2nd level, you gain the ability to channel divine energy directly from your deity, using that energy to fuel magical effects. You start with two such effects: Turn Undead and an effect determined by your domain. Some domains grant you additional effects as you advance in levels, as noted in the domain description. 
   
  When you use your Channel Divinity, you choose which effect to create. You must then finish a short or long rest to use your Channel Divinity again. 
   
  Some Channel Divinity effects require saving throws. When you use such an effect from this class, the DC equals your cleric spell save DC. 
   
  Beginning at 6th level, you can use your Channel 
   
  Divinity twice between rests, and beginning at 18th level, you can use it three times between rests. When you finish a short or long rest, you regain your expended uses. 
   
  #### Channel Divinity: Turn Undead 
   
  As an action, you present your holy symbol and speak a prayer censuring the undead. Each undead that can see or hear you within 30 feet of you must make a Wisdom saving throw. If the creature fails its saving throw, it is turned for 1 minute or until it takes any damage. 
   
  A turned creature must spend its turns trying to move as far away from you as it can, and it can't willingly move to a space within 30 feet of you. It also can't take reactions. For its action, it can use only the Dash action or try to escape from an effect that prevents it from moving. If there's nowhere to move, the creature can use the Dodge action. 
   
  ### Ability Score Improvement 
   
  When you reach 4th level, and again at 8th, 12th, 16th, and 19th level, you can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1. As normal, you can't increase an ability score above 20 using this feature. 
   
  ### Destroy Undead 
   
  Starting at 5th level, when an undead fails its saving throw against your Turn Undead feature, the creature is instantly destroyed if its challenge rating is at or below a certain threshold, as shown in the Destroy Undead table. 
   
  **Destroy Undead (table)** 
   
  | Cleric Level | Destroys Undead of CR... | 
  |--------------|--------------------------| 
  | 5th          | 1/2 or lower             | 
  | 8th          | 1 or lower               | 
  | 11th         | 2 or lower               | 
  | 14th         | 3 or lower               | 
  | 17th         | 4 or lower               | 
   
  ### Divine Intervention 
   
  Beginning at 10th level, you can call on your deity to intervene on your behalf when your need is great. 
   
  Imploring your deity's aid requires you to use your action. Describe the assistance you seek, and roll percentile dice. If you roll a number equal to or lower than your cleric level, your deity intervenes. The GM chooses the nature of the intervention; the effect of any cleric spell or cleric domain spell would be appropriate. 
   
  If your deity intervenes, you can't use this feature again for 7 days. Otherwise, you can use it again after you finish a long rest. 
   
  At 20th level, your call for intervention succeeds automatically, no roll required.
hit_die: d8
primary_abilities:
  - wis
saving_throws:
  - wis
  - cha
proficiencies:
  armor:
    - light
    - medium
    - shield
  weapons:
    categories:
      - simple
  tools:
    fixed:
      - none
skill_choices:
  count: 2
  from:
    - history
    - insight
    - medicine
    - persuasion
    - religion
starting_equipment:
  - kind: fixed
    items:
      - (*a*) a mace or (*b*) a warhammer (if proficient)
      - (*a*) scale mail, (*b*) leather armor, or (*c*) chain mail (if proficient)
      - (*a*) a light crossbow and 20 bolts or (*b*) any simple weapon
      - (*a*) a priest's pack or (*b*) an explorer's pack
      - A shield and a holy symbol
spellcasting: null
subclass_level: 3
subclass_feature_name: Divine Domains
weapon_mastery: null
epic_boon_level: null
table:
  '1':
    prof_bonus: 2
    feature_ids:
      - '-'
    columns:
      col1: Spellcasting, Divine Domain
      col2: '3'
      col3: '2'
      col4: '-'
      col5: '-'
      col6: '-'
      col7: '-'
      col8: '-'
      col9: '-'
      col10: '-'
  '2':
    prof_bonus: 2
    feature_ids:
      - '-'
    columns:
      col1: Channel Divinity (1/rest), Divine Domain Feature
      col2: '3'
      col3: '3'
      col4: '-'
      col5: '-'
      col6: '-'
      col7: '-'
      col8: '-'
      col9: '-'
      col10: '-'
  '3':
    prof_bonus: 2
    feature_ids:
      - '-'
    columns:
      col1: '-'
      col2: '3'
      col3: '4'
      col4: '2'
      col5: '-'
      col6: '-'
      col7: '-'
      col8: '-'
      col9: '-'
      col10: '-'
  '4':
    prof_bonus: 2
    feature_ids:
      - '-'
    columns:
      col1: Ability Score Improvement
      col2: '4'
      col3: '4'
      col4: '3'
      col5: '-'
      col6: '-'
      col7: '-'
      col8: '-'
      col9: '-'
      col10: '-'
  '5':
    prof_bonus: 3
    feature_ids:
      - '-'
    columns:
      col1: Destroy Undead (CR 1/2)
      col2: '4'
      col3: '4'
      col4: '3'
      col5: '2'
      col6: '-'
      col7: '-'
      col8: '-'
      col9: '-'
      col10: '-'
  '6':
    prof_bonus: 3
    feature_ids:
      - '-'
    columns:
      col1: Channel Divinity (2/rest), Divine Domain Feature
      col2: '4'
      col3: '4'
      col4: '3'
      col5: '3'
      col6: '-'
      col7: '-'
      col8: '-'
      col9: '-'
      col10: '-'
  '7':
    prof_bonus: 3
    feature_ids:
      - '-'
    columns:
      col1: '-'
      col2: '4'
      col3: '4'
      col4: '3'
      col5: '3'
      col6: '1'
      col7: '-'
      col8: '-'
      col9: '-'
      col10: '-'
  '8':
    prof_bonus: 3
    feature_ids:
      - '-'
    columns:
      col1: Ability Score Improvement, Destroy Undead (CR 1), Divine Domain Feature
      col2: '4'
      col3: '4'
      col4: '3'
      col5: '3'
      col6: '2'
      col7: '-'
      col8: '-'
      col9: '-'
      col10: '-'
  '9':
    prof_bonus: 4
    feature_ids:
      - '-'
    columns:
      col1: '-'
      col2: '4'
      col3: '4'
      col4: '3'
      col5: '3'
      col6: '3'
      col7: '1'
      col8: '-'
      col9: '-'
      col10: '-'
  '10':
    prof_bonus: 4
    feature_ids:
      - '-'
    columns:
      col1: Divine Intervention
      col2: '5'
      col3: '4'
      col4: '3'
      col5: '3'
      col6: '3'
      col7: '2'
      col8: '-'
      col9: '-'
      col10: '-'
  '11':
    prof_bonus: 4
    feature_ids:
      - '-'
    columns:
      col1: Destroy Undead (CR 2)
      col2: '5'
      col3: '4'
      col4: '3'
      col5: '3'
      col6: '3'
      col7: '2'
      col8: '1'
      col9: '-'
      col10: '-'
  '12':
    prof_bonus: 4
    feature_ids:
      - '-'
    columns:
      col1: Ability Score Improvement
      col2: '5'
      col3: '4'
      col4: '3'
      col5: '3'
      col6: '3'
      col7: '2'
      col8: '1'
      col9: '-'
      col10: '-'
  '13':
    prof_bonus: 5
    feature_ids:
      - '-'
    columns:
      col1: '-'
      col2: '5'
      col3: '4'
      col4: '3'
      col5: '3'
      col6: '3'
      col7: '2'
      col8: '1'
      col9: '1'
      col10: '-'
  '14':
    prof_bonus: 5
    feature_ids:
      - '-'
    columns:
      col1: Destroy Undead (CR 3)
      col2: '5'
      col3: '4'
      col4: '3'
      col5: '3'
      col6: '3'
      col7: '2'
      col8: '1'
      col9: '1'
      col10: '-'
  '15':
    prof_bonus: 5
    feature_ids:
      - '-'
    columns:
      col1: '-'
      col2: '5'
      col3: '4'
      col4: '3'
      col5: '3'
      col6: '3'
      col7: '2'
      col8: '1'
      col9: '1'
      col10: '1'
  '16':
    prof_bonus: 5
    feature_ids:
      - '-'
    columns:
      col1: Ability Score Improvement
      col2: '5'
      col3: '4'
      col4: '3'
      col5: '3'
      col6: '3'
      col7: '2'
      col8: '1'
      col9: '1'
      col10: '1'
  '17':
    prof_bonus: 6
    feature_ids:
      - '1'
    columns:
      col1: Destroy Undead (CR 4), Divine Domain Feature
      col2: '5'
      col3: '4'
      col4: '3'
      col5: '3'
      col6: '3'
      col7: '2'
      col8: '1'
      col9: '1'
      col10: '1'
  '18':
    prof_bonus: 6
    feature_ids:
      - '1'
    columns:
      col1: Channel Divinity (3/rest)
      col2: '5'
      col3: '4'
      col4: '3'
      col5: '3'
      col6: '3'
      col7: '3'
      col8: '1'
      col9: '1'
      col10: '1'
  '19':
    prof_bonus: 6
    feature_ids:
      - '1'
    columns:
      col1: Ability Score Improvement
      col2: '5'
      col3: '4'
      col4: '3'
      col5: '3'
      col6: '3'
      col7: '3'
      col8: '2'
      col9: '1'
      col10: '1'
  '20':
    prof_bonus: 6
    feature_ids:
      - '1'
    columns:
      col1: Divine Intervention improvement
      col2: '5'
      col3: '4'
      col4: '3'
      col5: '3'
      col6: '3'
      col7: '3'
      col8: '2'
      col9: '2'
      col10: '1'
features_by_level:
  '1':
    - id: spellcasting
      name: Spellcasting
      description: |-
        As a conduit for divine power, you can cast cleric spells. 
         
        #### Cantrips 
         
        At 1st level, you know three cantrips of your choice from the cleric spell list. You learn additional cleric cantrips of your choice at higher levels, as shown in the Cantrips Known column of the Cleric table. 
         
        #### Preparing and Casting Spells 
         
        The Cleric table shows how many spell slots you have to cast your spells of 1st level and higher. To cast one of these spells, you must expend a slot of the spell's level or higher. You regain all expended spell slots when you finish a long rest. 
         
        You prepare the list of cleric spells that are available for you to cast, choosing from the cleric spell list. When you do so, choose a number of cleric spells equal to your Wisdom modifier + your cleric level (minimum of one spell). The spells must be of a level for which you have spell slots. 
         
        For example, if you are a 3rd-level cleric, you have four 
        1st-level and two 2nd-level spell slots. With a Wisdom of 16, your list of prepared spells can include six spells of 1st or 2nd level, in any combination. If you prepare the 1st-level spell *cure wounds*, you can cast it using a 1st-level or 2nd-level slot. Casting the spell doesn't remove it from your list of prepared spells. 
         
        You can change your list of prepared spells when you finish a long rest. Preparing a new list of cleric spells requires time spent in prayer and meditation: at least 1 minute per spell level for each spell on your list. 
         
        #### Spellcasting Ability 
         
        Wisdom is your spellcasting ability for your cleric spells. The power of your spells comes from your devotion to your deity. You use your Wisdom whenever a cleric spell refers to your spellcasting ability. In addition, you use your Wisdom modifier when setting the saving throw DC for a cleric spell you cast and when making an attack roll with one. 
         
        **Spell save DC** = 8 + your proficiency bonus + your Wisdom modifier 
         
        **Spell attack modifier** = your proficiency bonus + your Wisdom modifier 
         
        #### Ritual Casting 
         
        You can cast a cleric spell as a ritual if that spell has the ritual tag and you have the spell prepared. 
         
        #### Spellcasting Focus 
         
        You can use a holy symbol (see chapter 5, “Equipment”) as a spellcasting focus for your cleric spells.
    - id: divine-domain
      name: Divine Domain
      description: |-
        Choose one domain related to your deity: Knowledge, Life, Light, Nature, Tempest, Trickery, or War. Each domain is detailed at the end of the class description, and each one provides examples of gods associated with it. Your choice grants you domain spells and other features when you choose it at 1st level. It also grants you additional ways to use Channel Divinity when you gain that feature at 2nd level, and additional benefits at 6th, 8th, and 17th levels. 
         
        #### Domain Spells 
         
        Each domain has a list of spells-its domain spells- that you gain at the cleric levels noted in the domain description. Once you gain a domain spell, you always have it prepared, and it doesn't count against the number of spells you can prepare each day. 
         
        If you have a domain spell that doesn't appear on the cleric spell list, the spell is nonetheless a cleric spell for you.
    - id: ability-score-improvement
      name: Ability Score Improvement
      description: When you reach 4th level, and again at 8th, 12th, 16th, and 19th level, you can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1. As normal, you can't increase an ability score above 20 using this feature.
  '2':
    - id: channel-divinity
      name: Channel Divinity
      description: |-
        At 2nd level, you gain the ability to channel divine energy directly from your deity, using that energy to fuel magical effects. You start with two such effects: Turn Undead and an effect determined by your domain. Some domains grant you additional effects as you advance in levels, as noted in the domain description. 
         
        When you use your Channel Divinity, you choose which effect to create. You must then finish a short or long rest to use your Channel Divinity again. 
         
        Some Channel Divinity effects require saving throws. When you use such an effect from this class, the DC equals your cleric spell save DC. 
         
        Beginning at 6th level, you can use your Channel 
         
        Divinity twice between rests, and beginning at 18th level, you can use it three times between rests. When you finish a short or long rest, you regain your expended uses. 
         
        #### Channel Divinity: Turn Undead 
         
        As an action, you present your holy symbol and speak a prayer censuring the undead. Each undead that can see or hear you within 30 feet of you must make a Wisdom saving throw. If the creature fails its saving throw, it is turned for 1 minute or until it takes any damage. 
         
        A turned creature must spend its turns trying to move as far away from you as it can, and it can't willingly move to a space within 30 feet of you. It also can't take reactions. For its action, it can use only the Dash action or try to escape from an effect that prevents it from moving. If there's nowhere to move, the creature can use the Dodge action.
  '5':
    - id: destroy-undead
      name: Destroy Undead
      description: |-
        Starting at 5th level, when an undead fails its saving throw against your Turn Undead feature, the creature is instantly destroyed if its challenge rating is at or below a certain threshold, as shown in the Destroy Undead table. 
         
        **Destroy Undead (table)** 
         
        | Cleric Level | Destroys Undead of CR... | 
        |--------------|--------------------------| 
        | 5th          | 1/2 or lower             | 
        | 8th          | 1 or lower               | 
        | 11th         | 2 or lower               | 
        | 14th         | 3 or lower               | 
        | 17th         | 4 or lower               |
  '10':
    - id: divine-intervention
      name: Divine Intervention
      description: |-
        Beginning at 10th level, you can call on your deity to intervene on your behalf when your need is great. 
         
        Imploring your deity's aid requires you to use your action. Describe the assistance you seek, and roll percentile dice. If you roll a number equal to or lower than your cleric level, your deity intervenes. The GM chooses the nature of the intervention; the effect of any cleric spell or cleric domain spell would be appropriate. 
         
        If your deity intervenes, you can't use this feature again for 7 days. Otherwise, you can use it again after you finish a long rest. 
         
        At 20th level, your call for intervention succeeds automatically, no roll required.
resources: []
```
