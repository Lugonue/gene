# combat/formulas — формулы боя (ЗАГЛУШКА)

Все числа и формулы игры собраны здесь. Остальной код `core` не содержит собственных боевых констант и
вызывает только функции этого модуля, поэтому модуль можно полностью заменить, сохранив сигнатуры.

| Функция | Что считает |
|---|---|
| `woundStageFor(part)` | стадия раны по доле hp: >75% none, >50% bruised, >25% wounded, иначе crippled |
| `woundModifiers(creature, attackTag)` | множители точности/урона (раны атакующих частей + зрение), уклонения (`stance`), сдвиг FOV, стоимость движения |
| `attackingParts(creature, tag)` | чем наносится атака: оружие/кулак — основная рука, укус/когти — части с тегом |
| `moveCostMultiplier(creature)` | замедление от искалеченных ног |
| `fovRadius(creature)` | радиус обзора (8 + ранения головы + `sensors`) |
| `chooseHitPart(rng, ctx)` | взвешенный выбор части тела цели, навык смещает к `vital` |
| `hitChance` / `rollHit(rng, ctx)` | точность против уклонения, с учётом ран, прочности оружия, второй руки двуручного оружия, улучшений бионики |
| `projectileBreaks(rng, breakChance, hit)` | поломка боеприпаса после выстрела (при промахе — реже) |
| `rollDamage(rng, ctx)` | урон оружия × навык × раны × прочность × `strength` × множитель типа урона |
| `damageTypeMultiplier(type, material)` | огонь ×1.5 по органике, молния ×1.5 по бионике, иначе ×1 |
| `SLOW_DURATION`, `SLOW_COST_MUL` | замедление холодом: 40 aut, действия ×2 (механизм — модуль времени) |
| `armourAbsorb(rng, ctx, armour)` | поглощение бронёй (прочность, навык брони) + встроенная защита бионики |
| `hitSeverity`, `splitDamage` | тяжесть попадания, деление урона между частью и общим HP |
| `durabilityEfficiency(item)` | пороговая кривая: ≥75% → 100%, ≥50% → 85%, ≥25% → 65%, >0 → 40%, 0 → сломан |
| `durabilityWear(ctx, item, role)` | износ оружия и брони за попадание |
| `repairAmount`, `treatOneStage`, `potionHeal` | ремкомплект, бинт, зелье |
| `regenTick(creature, elapsed)`, `organicHealCap` | регенерация органики (бионика не регенерирует) |
| `partMaxHp(def, material, scale)` | hp части с учётом материала |
| `skillLevelFromXp`, `SKILL_XP`, `killXp` | кривая навыков и источники опыта |
| `studyStatusFor`, `STUDY_GAIN` | изученность типов предметов |
| `wantsToFlee(rng, creature, trait?)` | желание монстра отступить (с учётом черты фракции: трусливые раньше, бесстрашные никогда) |
| `TRACK_TIME` | сколько aut фракция с чертой `relentless` идёт по следу невидимого игрока |
| `monsterThreat(input)` | угроза монстра: урон × навыки + hp, броня, уклонение; × скорость и черта фракции |
| `levelThreatBudget(depth)` | бюджет угрозы уровня (включая отряд вожака) |

Физические типы урона (`slash`, `pierce`, `blunt`) влияют только на сообщения; магические — см. `damageTypeMultiplier`.
