// Шаблоны сообщений (ЗАГЛУШКА с правильным каркасом). Синтаксис описан в README.md, раздел «Шаблоны сообщений».
//
// {role.case}        — словоформа роли в падеже (nom/gen/dat/acc/ins/prep)
// {^role.case}       — то же с заглавной буквы
// {verb:ключ}        — глагол, согласованный с подлежащим события (лицо и число)
// {verb:ключ@role}   — глагол, согласованный с указанной ролью
// {adj:ключ@role}    — краткое прилагательное/причастие, согласованное с родом роли
//
// Роли: attacker, target, victim, creature — существа; part / tpart — часть тела (tpart — «чья»:
// «твою левую руку» / «левую руку гоблина»); weapon / aweapon — оружие или естественная атака
// (aweapon — атакующего; в дальнем бою — снаряд); projectile — снаряд в сообщениях о выстреле; caster — заклинатель, spell — заклинание; armour / tarmour — броня (tarmour — цели); item / oitem — предмет (oitem — владельца).
// Также подставляются {label}, {material}, {pct}, {eff}, {skill}, {level}, {category}, {list}, {count}.

import type { Case, Gender, RejectReasonKey } from './types'

/** Глаголы настоящего времени: [2 л. ед. ч., 3 л. ед. ч., 3 л. мн. ч.]. */
export const VERBS: Record<string, [string, string, string]> = {
  бить: ['бьёшь', 'бьёт', 'бьют'],
  рубить: ['рубишь', 'рубит', 'рубят'],
  задевать: ['задеваешь', 'задевает', 'задевают'],
  полосовать: ['полосуешь', 'полосует', 'полосуют'],
  рассекать: ['рассекаешь', 'рассекает', 'рассекают'],
  обрушивать: ['обрушиваешь', 'обрушивает', 'обрушивают'],
  разрубать: ['разрубаешь', 'разрубает', 'разрубают'],
  колоть: ['колешь', 'колет', 'колют'],
  тыкать: ['тычешь', 'тычет', 'тычут'],
  вонзать: ['вонзаешь', 'вонзает', 'вонзают'],
  вгонять: ['вгоняешь', 'вгоняет', 'вгоняют'],
  пронзать: ['пронзаешь', 'пронзает', 'пронзают'],
  наносить: ['наносишь', 'наносит', 'наносят'],
  промахиваться: ['промахиваешься', 'промахивается', 'промахиваются'],
  замахиваться: ['замахиваешься', 'замахивается', 'замахиваются'],
  уворачиваться: ['уворачиваешься', 'уворачивается', 'уворачиваются'],
  уклоняться: ['уклоняешься', 'уклоняется', 'уклоняются'],
  делать: ['делаешь', 'делает', 'делают'],
  размахиваться: ['размахиваешься', 'размахивается', 'размахиваются'],
  попадать: ['попадаешь', 'попадает', 'попадают'],
  проноситься: ['проносишься', 'проносится', 'проносятся'],
  клацать: ['клацаешь', 'клацает', 'клацают'],
  кусать: ['кусаешь', 'кусает', 'кусают'],
  прихватывать: ['прихватываешь', 'прихватывает', 'прихватывают'],
  впиваться: ['впиваешься', 'впивается', 'впиваются'],
  вгрызаться: ['вгрызаешься', 'вгрызается', 'вгрызаются'],
  рвать: ['рвёшь', 'рвёт', 'рвут'],
  махать: ['машешь', 'машет', 'машут'],
  царапать: ['царапаешь', 'царапает', 'царапают'],
  раздирать: ['раздираешь', 'раздирает', 'раздирают'],
  толкать: ['толкаешь', 'толкает', 'толкают'],
  выдерживать: ['выдерживаешь', 'выдерживает', 'выдерживают'],
  гасить: ['гасишь', 'гасит', 'гасят'],
  отскакивать: ['отскакиваешь', 'отскакивает', 'отскакивают'],
  смягчать: ['смягчаешь', 'смягчает', 'смягчают'],
  принимать: ['принимаешь', 'принимает', 'принимают'],
  кровоточить: ['кровоточишь', 'кровоточит', 'кровоточат'],
  падать: ['падаешь', 'падает', 'падают'],
  испускать: ['испускаешь', 'испускает', 'испускают'],
  погибать: ['погибаешь', 'погибает', 'погибают'],
  валиться: ['валишься', 'валится', 'валятся'],
  двигаться: ['двигаешься', 'двигается', 'двигаются'],
  замедляться: ['замедляешься', 'замедляется', 'замедляются'],
  изнашиваться: ['изнашиваешься', 'изнашивается', 'изнашиваются'],
  ломаться: ['ломаешься', 'ломается', 'ломаются'],
  замечать: ['замечаешь', 'замечает', 'замечают'],
  пытаться: ['пытаешься', 'пытается', 'пытаются'],
  трещать: ['трещишь', 'трещит', 'трещат'],
  искрить: ['искришь', 'искрит', 'искрят'],
  появляться: ['появляешься', 'появляется', 'появляются'],
  пятиться: ['пятишься', 'пятится', 'пятятся'],
  стрелять: ['стреляешь', 'стреляет', 'стреляют'],
  метать: ['метаешь', 'метает', 'метают'],
  пролетать: ['пролетаешь', 'пролетает', 'пролетают'],
  вонзаться: ['вонзаешься', 'вонзается', 'вонзаются'],
  пробивать: ['пробиваешь', 'пробивает', 'пробивают'],
  раскалываться: ['раскалываешься', 'раскалывается', 'раскалываются'],
  ударяться: ['ударяешься', 'ударяется', 'ударяются'],
  выпускать: ['выпускаешь', 'выпускает', 'выпускают'],
  швырять: ['швыряешь', 'швыряет', 'швыряют'],
  изрыгать: ['изрыгаешь', 'изрыгает', 'изрыгают'],
  плевать: ['плюёшь', 'плюёт', 'плюют'],
  призывать: ['призываешь', 'призывает', 'призывают'],
  лечить: ['лечишь', 'лечит', 'лечат'],
  дышать: ['дышишь', 'дышит', 'дышат'],
  держаться: ['держишься', 'держится', 'держатся'],
  шататься: ['шатаешься', 'шатается', 'шатаются'],
}

/** Краткие прилагательные и причастия по роду. */
export const ADJECTIVES: Record<string, Record<Gender, string>> = {
  ушиблен: { m: 'ушиблен', f: 'ушиблена', n: 'ушиблено', pl: 'ушиблены' },
  ранен: { m: 'ранен', f: 'ранена', n: 'ранено', pl: 'ранены' },
  искалечен: { m: 'искалечен', f: 'искалечена', n: 'искалечено', pl: 'искалечены' },
  изувечен: { m: 'изувечен', f: 'изувечена', n: 'изувечено', pl: 'изувечены' },
  поцарапан: { m: 'поцарапан', f: 'поцарапана', n: 'поцарапано', pl: 'поцарапаны' },
  повреждён: { m: 'повреждён', f: 'повреждена', n: 'повреждено', pl: 'повреждены' },
  выведен: { m: 'выведен', f: 'выведена', n: 'выведено', pl: 'выведены' },
  сломан: { m: 'сломан', f: 'сломана', n: 'сломано', pl: 'сломаны' },
  разобран: { m: 'разобран', f: 'разобрана', n: 'разобрано', pl: 'разобраны' },
  выдохся: { m: 'выдохся', f: 'выдохлась', n: 'выдохлось', pl: 'выдохлись' },
}

/** Притяжательное «твой» по роду и падежу (для неодушевлённых: вин. м. р. = им.). */
export const POSSESSIVE: Record<Gender, Record<Case, string>> = {
  m: { nom: 'твой', gen: 'твоего', dat: 'твоему', acc: 'твой', ins: 'твоим', prep: 'твоём' },
  f: { nom: 'твоя', gen: 'твоей', dat: 'твоей', acc: 'твою', ins: 'твоей', prep: 'твоей' },
  n: { nom: 'твоё', gen: 'твоего', dat: 'твоему', acc: 'твоё', ins: 'твоим', prep: 'твоём' },
  pl: { nom: 'твои', gen: 'твоих', dat: 'твоим', acc: 'твои', ins: 'твоими', prep: 'твоих' },
}

export const MATERIAL_NAMES = { organic: 'органика', bionic: 'бионика' } as const

/**
 * Шаблоны по ключу. Ключ ищется от самого точного к общему:
 * hit.<семейство>.<тип урона>.<тяжесть>.<материал> → … → hit.<семейство> → hit.
 * Семейства атак: weapon (оружие), ranged (снаряд), bite (укус), claws (когти), fist (кулак).
 * Магические типы урона (fire, cold, lightning) не зависят от семейства: hit.<тип>.<тяжесть>.<материал>,
 * miss.<тип>, absorbed.<armour|bionic>.<тип>.
 */
export const TEMPLATES: Record<string, string[]> = {
  // ---------- Промахи ----------
  'miss.weapon.slash': [
    '{attacker.nom} {verb:промахиваться}, целясь {weapon.ins} в {tpart.acc}.',
    '{attacker.nom} {verb:замахиваться} {weapon.ins}, но {verb:промахиваться}.',
    '{target.nom} {verb:уворачиваться@target} от {aweapon.gen}.',
  ],
  'miss.weapon.pierce': [
    '{attacker.nom} {verb:делать} выпад {weapon.ins}, но {verb:промахиваться}.',
    '{target.nom} {verb:уклоняться@target} от {aweapon.gen}.',
    '{attacker.nom} {verb:промахиваться}, целясь {weapon.ins} в {tpart.acc}.',
  ],
  'miss.weapon.blunt': [
    '{attacker.nom} {verb:размахиваться} {weapon.ins}, но не {verb:попадать}.',
    '{aweapon.nom} {verb:проноситься@weapon} мимо {target.gen}.',
    '{target.nom} {verb:уворачиваться@target} от {aweapon.gen}.',
  ],
  'miss.ranged': [
    '{weapon.nom} {verb:пролетать@weapon} мимо {target.gen}.',
    '{target.nom} {verb:уворачиваться@target} от {aweapon.gen}.',
    '{aweapon.nom} {verb:пролетать@weapon} совсем рядом с {target.ins}.',
  ],
  'miss.bite': [
    '{attacker.nom} {verb:клацать} зубами, но {verb:промахиваться}.',
    '{target.nom} {verb:уворачиваться@target} от {aweapon.gen}.',
    '{attacker.nom} {verb:пытаться} укусить {target.acc}, но {verb:промахиваться}.',
  ],
  'miss.claws': [
    '{attacker.nom} {verb:махать} когтями мимо {target.gen}.',
    '{target.nom} {verb:уворачиваться@target} от {aweapon.gen}.',
    '{attacker.nom} {verb:пытаться} достать {target.acc} когтями, но {verb:промахиваться}.',
  ],
  'miss.fist': [
    '{attacker.nom} {verb:бить} кулаком, но {verb:промахиваться}.',
    '{target.nom} {verb:уворачиваться@target} от {aweapon.gen}.',
    '{attacker.nom} {verb:замахиваться}, но не {verb:попадать}.',
  ],

  // ---------- Попадания оружием ----------
  'hit.weapon.slash.light': [
    '{attacker.nom} {verb:задевать} {target.acc} {weapon.ins} по {part.dat}.',
    '{attacker.nom} слегка {verb:полосовать} {target.acc} {weapon.ins} по {part.dat}.',
  ],
  'hit.weapon.slash.medium': [
    '{attacker.nom} {verb:рубить} {target.acc} {weapon.ins} по {part.dat}.',
    '{attacker.nom} {verb:рассекать} {tpart.acc} {weapon.ins}.',
  ],
  'hit.weapon.slash.heavy': [
    '{attacker.nom} {verb:обрушивать} {weapon.acc} на {tpart.acc}!',
    '{attacker.nom} глубоко {verb:разрубать} {tpart.acc} {weapon.ins}!',
  ],
  'hit.weapon.pierce.light': [
    '{attacker.nom} {verb:колоть} {target.acc} {weapon.ins} в {part.acc}, но неглубоко.',
    '{attacker.nom} {verb:тыкать} {target.acc} {weapon.ins} в {part.acc}.',
  ],
  'hit.weapon.pierce.medium': [
    '{attacker.nom} {verb:вонзать} {weapon.acc} в {tpart.acc}.',
    '{attacker.nom} {verb:колоть} {target.acc} {weapon.ins} в {part.acc}.',
  ],
  'hit.weapon.pierce.heavy': [
    '{attacker.nom} {verb:вгонять} {weapon.acc} глубоко в {tpart.acc}!',
    '{attacker.nom} {verb:пронзать} {tpart.acc} {weapon.ins}!',
  ],
  'hit.weapon.blunt.light': [
    '{attacker.nom} {verb:задевать} {target.acc} {weapon.ins} по {part.dat}.',
    '{attacker.nom} вскользь {verb:бить} {target.acc} {weapon.ins} по {part.dat}.',
  ],
  'hit.weapon.blunt.medium': [
    '{attacker.nom} {verb:бить} {target.acc} {weapon.ins} по {part.dat}.',
    '{attacker.nom} {verb:наносить} {target.dat} удар {weapon.ins} по {part.dat}.',
  ],
  'hit.weapon.blunt.heavy': [
    '{attacker.nom} со всего маху {verb:бить} {target.acc} {weapon.ins} по {part.dat}!',
    '{attacker.nom} {verb:обрушивать} {weapon.acc} на {tpart.acc}!',
  ],

  // ---------- Попадания снарядами (подлежащее — снаряд) ----------
  'hit.ranged': ['{weapon.nom} {verb:попадать@weapon} {target.dat} в {part.acc}.'],
  'hit.ranged.pierce.light': [
    '{weapon.nom} {verb:задевать@weapon} {tpart.acc}.',
    '{weapon.nom} {verb:царапать@weapon} {target.acc} по {part.dat}.',
  ],
  'hit.ranged.pierce.medium': [
    '{weapon.nom} {verb:вонзаться@weapon} в {tpart.acc}.',
    '{weapon.nom} {verb:попадать@weapon} {target.dat} в {part.acc}.',
  ],
  'hit.ranged.pierce.heavy': [
    '{weapon.nom} глубоко {verb:вонзаться@weapon} в {tpart.acc}!',
    '{weapon.nom} {verb:пробивать@weapon} {tpart.acc}!',
  ],
  'hit.ranged.blunt.light': [
    '{weapon.nom} {verb:задевать@weapon} {tpart.acc}.',
    '{weapon.nom} вскользь {verb:бить@weapon} {target.acc} по {part.dat}.',
  ],
  'hit.ranged.blunt.medium': [
    '{weapon.nom} {verb:бить@weapon} {target.acc} по {part.dat}.',
    '{weapon.nom} {verb:попадать@weapon} {target.dat} в {part.acc}.',
  ],
  'hit.ranged.blunt.heavy': [
    '{weapon.nom} с силой {verb:бить@weapon} {target.acc} по {part.dat}!',
    '{weapon.nom} со всего маху {verb:попадать@weapon} {target.dat} в {part.acc}!',
  ],

  // ---------- Естественные атаки ----------
  'hit.bite.pierce.light': [
    '{attacker.nom} {verb:кусать} {target.acc} за {part.acc}.',
    '{attacker.nom} {verb:прихватывать} {target.acc} зубами за {part.acc}.',
  ],
  'hit.bite.pierce.medium': [
    '{attacker.nom} {verb:впиваться} зубами в {tpart.acc}.',
    '{attacker.nom} больно {verb:кусать} {target.acc} за {part.acc}.',
  ],
  'hit.bite.pierce.heavy': [
    '{attacker.nom} {verb:вгрызаться} в {tpart.acc}!',
    '{attacker.nom} {verb:рвать} зубами {tpart.acc}!',
  ],
  'hit.claws.slash.light': [
    '{attacker.nom} {verb:царапать} {target.acc} по {part.dat}.',
    '{attacker.nom} {verb:задевать} когтями {tpart.acc}.',
  ],
  'hit.claws.slash.medium': [
    '{attacker.nom} {verb:полосовать} когтями {tpart.acc}.',
    '{attacker.nom} {verb:раздирать} когтями {tpart.acc}.',
  ],
  'hit.claws.slash.heavy': [
    '{attacker.nom} глубоко {verb:раздирать} когтями {tpart.acc}!',
    '{attacker.nom} {verb:рвать} когтями {tpart.acc}!',
  ],
  'hit.fist.blunt.light': [
    '{attacker.nom} {verb:толкать} {target.acc} кулаком в {part.acc}.',
    '{attacker.nom} слабо {verb:бить} {target.acc} по {part.dat}.',
  ],
  'hit.fist.blunt.medium': [
    '{attacker.nom} {verb:бить} {target.acc} кулаком по {part.dat}.',
    '{attacker.nom} {verb:наносить} {target.dat} удар кулаком по {part.dat}.',
  ],
  'hit.fist.blunt.heavy': [
    '{attacker.nom} {verb:обрушивать} кулак на {tpart.acc}!',
    '{attacker.nom} со всей силы {verb:бить} {target.acc} по {part.dat}!',
  ],

  // ---------- Магия: огонь, холод, молния (подлежащее — сама стихия) ----------
  'miss.fire': ['Пламя проносится мимо {target.gen}.', 'Огонь опаляет воздух рядом с {target.ins}.'],
  'miss.cold': ['Ледяной вихрь проносится мимо {target.gen}.', 'Холод проходит стороной, не задев {target.acc}.'],
  'miss.lightning': ['Разряд бьёт в пол рядом с {target.ins}.', 'Молния проскакивает мимо {target.gen}.'],
  'hit.fire.light.organic': ['Пламя лижет {tpart.acc}: лёгкий ожог.', 'Жар опаляет {tpart.acc}.'],
  'hit.fire.medium.organic': ['Огонь обжигает {tpart.acc}.', 'Пламя охватывает {tpart.acc}: ожог.'],
  'hit.fire.heavy.organic': [
    'Огонь сжигает кожу на {tpart.prep}: тяжёлый ожог!',
    'Пламя глубоко прожигает {tpart.acc}: тяжёлый ожог!',
  ],
  'hit.fire.light.bionic': ['Жар обдаёт корпус {tpart.gen}.', 'Пламя скользит по обшивке {tpart.gen}.'],
  'hit.fire.medium.bionic': ['Огонь оплавляет обшивку {tpart.gen}.', 'Пламя раскаляет корпус {tpart.gen}.'],
  'hit.fire.heavy.bionic': ['Огонь плавит корпус {tpart.gen}!', 'Обшивка {tpart.gen} оплывает от жара!'],
  'hit.cold.light.organic': ['Холод щиплет {tpart.acc}.', 'Иней ложится на {tpart.acc}.'],
  'hit.cold.medium.organic': ['Мороз жжёт {tpart.acc}: обморожение.', 'Лёд сковывает {tpart.acc}: обморожение.'],
  'hit.cold.heavy.organic': [
    '{tpart.nom} промерзает до кости: тяжёлое обморожение!',
    'Лёд намертво сковывает {tpart.acc}: тяжёлое обморожение!',
  ],
  'hit.cold.light.bionic': ['Иней оседает на корпусе {tpart.gen}.', 'Холод обдаёт обшивку {tpart.gen}.'],
  'hit.cold.medium.bionic': ['Обшивка {tpart.gen} покрывается льдом.', 'Мороз сковывает сервоприводы {tpart.gen}.'],
  'hit.cold.heavy.bionic': ['Лёд намертво сковывает сервоприводы {tpart.gen}!', 'Корпус {tpart.gen} трескается от мороза!'],
  'hit.lightning.light.organic': ['Разряд покалывает {tpart.acc}.', 'Искра разряда жалит {tpart.acc}.'],
  'hit.lightning.medium.organic': ['Разряд бьёт {target.acc} в {part.acc}.', 'Молния прошивает {tpart.acc}: ожог от разряда.'],
  'hit.lightning.heavy.organic': [
    'Мощный разряд прошивает {tpart.acc}, мышцы сводит судорогой!',
    'Молния бьёт {target.acc} в {part.acc}: тело сводит судорогой от разряда!',
  ],
  'hit.lightning.light.bionic': [
    'Разряд пробегает по корпусу {tpart.gen}: мелкий сбой.',
    'Искры пляшут по обшивке {tpart.gen}, датчики сбоят.',
  ],
  'hit.lightning.medium.bionic': ['Разряд выбивает цепи {tpart.gen}: сбой бионики.', 'Молния бьёт в {tpart.acc}: короткое замыкание.'],
  'hit.lightning.heavy.bionic': [
    'Молния выжигает схемы {tpart.gen}: критический сбой бионики!',
    'Разряд перегружает {tpart.acc}: сбой, короткое замыкание!',
  ],
  'absorbed.armour.fire': ['{tarmour.nom} {verb:выдерживать@armour} жар.', 'Пламя бессильно растекается по {tarmour.dat}.'],
  'absorbed.armour.cold': ['{tarmour.nom} {verb:выдерживать@armour} холод.', 'Иней оседает на {tarmour.prep}, не причиняя вреда.'],
  'absorbed.armour.lightning': ['{tarmour.nom} {verb:принимать@armour} разряд на себя.', 'Разряд уходит в {tarmour.acc}.'],
  'absorbed.bionic.fire': ['Жар не пробивает бионический корпус {tpart.gen}.', 'Пламя скользит по корпусу {tpart.gen}, не причиняя вреда.'],
  'absorbed.bionic.cold': ['Иней оседает на корпусе {tpart.gen}, не причиняя вреда.', 'Бионический корпус {tpart.gen} выдерживает холод.'],
  'absorbed.bionic.lightning': ['Изоляция {tpart.gen} гасит разряд.', 'Разряд уходит в заземление {tpart.gen}.'],

  // ---------- Поглощение бронёй ----------
  'absorbed.armour': [
    '{attacker.nom} {verb:попадать} {target.dat} в {part.acc}, но {tarmour.nom} {verb:выдерживать@armour} удар.',
    '{tarmour.nom} полностью {verb:гасить@armour} удар.',
    '{aweapon.nom} {verb:отскакивать@weapon} от {tarmour.gen}.',
  ],
  'absorbed.bionic': [
    '{aweapon.nom} {verb:отскакивать@weapon} от бионического корпуса {tpart.gen}.',
    '{attacker.nom} {verb:попадать} {target.dat} в {part.acc}, но бионический корпус выдерживает.',
  ],
  absorb: ['{tarmour.nom} {verb:смягчать@armour} удар.', '{tarmour.nom} {verb:принимать@armour} на себя часть удара.'],

  // ---------- Колорит тяжёлых попаданий ----------
  'flavor.organic.slash': ['Брызжет кровь.', 'Хлещет кровь.'],
  'flavor.organic.pierce': ['Из раны течёт кровь.', 'Рана глубокая.'],
  'flavor.organic.blunt': ['Слышен хруст.', 'Что-то хрустит.'],
  'flavor.bionic.slash': ['Сыплются искры.', 'Обшивка вспорота, летят искры.'],
  'flavor.bionic.pierce': ['Корпус пробит!', 'Пробита обшивка, сыплются искры.'],
  'flavor.bionic.blunt': ['Сервопривод скрежещет.', 'Корпус сминается, искрит проводка.'],
  'flavor.organic.fire': ['Пахнет палёным.', 'Кожа вздувается волдырями.'],
  'flavor.organic.cold': ['Кожа белеет и немеет.', 'Кровь стынет в жилах.'],
  'flavor.organic.lightning': ['Пахнет озоном.', 'Волосы встают дыбом.'],
  'flavor.bionic.fire': ['Пахнет горелой изоляцией.', 'Капает расплавленный металл.'],
  'flavor.bionic.cold': ['Смазка густеет на морозе.', 'Металл звенит от холода.'],
  'flavor.bionic.lightning': ['Сыплются искры, пахнет горелой проводкой.', 'Индикаторы гаснут и вспыхивают снова.'],

  // ---------- Переход раны в новую стадию ----------
  'wound.organic.bruised': ['{tpart.nom} {adj:ушиблен@part}.', 'На {tpart.prep} наливается синяк.'],
  'wound.organic.wounded': ['{tpart.nom} {verb:кровоточить@part}.', '{tpart.nom} серьёзно {adj:ранен@part}.'],
  'wound.organic.crippled': ['{tpart.nom} {adj:искалечен@part}!', '{tpart.nom} {adj:изувечен@part}!'],
  'wound.bionic.bruised': ['{tpart.nom} {adj:поцарапан@part}.', 'Корпус {tpart.gen} покрыт царапинами.'],
  'wound.bionic.wounded': ['{tpart.nom} {adj:повреждён@part}: пробит корпус.', '{tpart.nom} {verb:искрить@part}.'],
  'wound.bionic.crippled': ['{tpart.nom} {adj:выведен@part} из строя!', 'Сервопривод {tpart.gen} заклинило!'],
  diag: ['[ДИАГНОСТИКА] {^part.nom} ({material}): {label}, повреждение {pct}%.'],
  'diag.heal': ['[ДИАГНОСТИКА] {^part.nom} ({material}): состояние улучшилось — {label}.'],

  // ---------- Смерть ----------
  'death.monster.vital': ['{victim.nom} {verb:падать@victim} замертво.', '{victim.nom} {verb:испускать@victim} дух.'],
  'death.monster.hp': [
    '{victim.nom} {verb:погибать@victim}.',
    '{victim.nom} {verb:валиться@victim} на пол и больше не {verb:двигаться@victim}.',
  ],
  'death.player.vital': ['Ты погибаешь. [ЯДРО] Критическое повреждение: {part.nom}. Отключение систем…'],
  'death.player.hp': ['Ты погибаешь. [ЯДРО] Целостность корпуса 0%. Отключение систем…'],

  // ---------- Снаряжение ----------
  'itemDamaged.player': ['[ДИАГНОСТИКА] {^item.nom}: износ, эффективность {eff}%.'],
  'itemDamaged.monster': ['{oitem.nom} {verb:трещать@item}.', '{oitem.nom} заметно {verb:изнашиваться@item}.'],
  'itemBroken.player': ['[ДИАГНОСТИКА] {^item.nom}: {adj:сломан@item}. Эффективность 0%.'],
  'itemBroken.monster': ['{oitem.nom} {verb:ломаться@item}!'],

  // ---------- Выстрелы ----------
  'shotFired.launcher': ['{attacker.nom} {verb:стрелять} из {weapon.gen}.'],
  'shotFired.thrown': ['{attacker.nom} {verb:метать} {projectile.acc}.'],
  projectileBroken: ['{projectile.nom} {verb:ломаться@projectile}.'],
  'projectileBroken.stone': ['{projectile.nom} {verb:раскалываться@projectile}.'],
  'projectileLanded.wall': ['{projectile.nom} {verb:ударяться@projectile} о стену.'],
  'projectileLanded.floor': ['{projectile.nom} {verb:падать@projectile} на пол.'],

  // ---------- Заклинания монстров ----------
  // spellCast.<id заклинания> → spellCast.<bolt|heal>. Усталость — словами, без чисел и терминов.
  'spellCast.bolt': [
    '{caster.nom} {verb:выпускать@caster} {spell.acc} в {target.acc}.',
    '{caster.nom} {verb:швырять@caster} {spell.acc} в {target.acc}.',
  ],
  'spellCast.lightning': [
    '{caster.nom} {verb:призывать@caster} молнию на {target.acc}.',
    'Между ладоней {caster.gen} вспыхивает молния и бьёт в {target.acc}.',
  ],
  'spellCast.fire_spit': ['{caster.nom} {verb:изрыгать@caster} огонь в {target.acc}.', '{caster.nom} {verb:плевать@caster} огнём в {target.acc}.'],
  'spellCast.heal': ['{caster.nom} {verb:лечить@caster} {target.acc}.', 'Раны {target.gen} затягиваются от заклинания {caster.gen}.'],
  spellFizzled: ['Заклинание {caster.gen} срывается.', 'Чары {caster.gen} рассеиваются впустую.'],
  'casterTired.tired': ['{caster.nom} тяжело {verb:дышать@caster}.', '{caster.nom} {verb:шататься@caster} после заклинания.'],
  'casterTired.exhausted': ['{caster.nom} {adj:выдохся@caster}.', '{caster.nom} едва {verb:держаться@caster} на ногах.'],

  // ---------- Прочее ----------
  monsterNoticed: ['Ты замечаешь {creature.acc}.', 'Впереди {verb:появляться@creature} {creature.nom}.'],
  'creatureSlowed.player': ['Холод сковывает твои движения.', 'Тело немеет от холода, ты двигаешься медленнее.'],
  'creatureSlowed.monster': [
    'Холод сковывает движения {creature.gen}.',
    '{creature.nom} заметно {verb:замедляться@creature} от холода.',
  ],
  'slowEnded.player': ['Холод отступает, ты снова двигаешься свободно.', 'Тело оттаивает, ты снова двигаешься свободно.'],
  'slowEnded.monster': ['{creature.nom} снова {verb:двигаться@creature} свободно.', 'Холод отпускает {creature.acc}.'],
  monsterFlees: ['{creature.nom} {verb:пытаться@creature} отступить.', '{creature.nom} {verb:пятиться@creature} назад.'],
  doorOpened: ['Ты открываешь дверь.'],
  'levelChanged.down': ['Ты спускаешься на уровень {level}.'],
  'levelChanged.up': ['Ты поднимаешься на уровень {level}.'],
  itemsHere: ['Здесь лежит: {list}.'],
  itemPickedUp: ['Ты подбираешь {item.acc}{count}.'],
  'itemDropped.player': ['Ты бросаешь {item.acc}{count}.'],
  'itemDropped.monster': ['{item.nom} {verb:падать@item} на пол.'],
  'itemEquipped.weapon': ['Ты берёшь в руку {item.acc}.'],
  'itemEquipped.armour': ['Ты надеваешь {item.acc}.'],
  'itemUnequipped.weapon': ['Ты убираешь {item.acc}.'],
  'itemUnequipped.armour': ['Ты снимаешь {item.acc}.'],
  bandageApplied: ['Ты перевязываешь {part.acc}. [ДИАГНОСТИКА] {^part.nom}: {label}.'],
  potionDrunk: ['Ты выпиваешь зелье лечения. Раны затягиваются.'],
  itemRepaired: ['[РЕМОНТ] {^item.nom}: прочность восстановлена.'],
  partRepaired: ['[РЕМОНТ] {^part.nom} (бионика): {label}.'],
  itemDisassembled: ['[ЯДРО] {^item.nom} {adj:разобран@item}. Данные внесены в базу: {skill}.'],
  skillUp: ['[ЯДРО] Навык «{skill}»: уровень {level}.'],
  newItemType: ['[ЯДРО] Новый тип {category}: {item.nom}. Анализ начат.'],
  'studyChanged.partial': ['[ЯДРО] Предварительный анализ: {item.nom}. Характеристики оценены приблизительно.'],
  'studyChanged.known': ['[ЯДРО] Анализ завершён: {item.nom}. Характеристики внесены в базу.'],
  // Явления: {code} — условное имя с номером, {partial} — предварительная оценка, {name} — настоящее название.
  phenomenonDiscovered: ['[ЯДРО] Зафиксировано неизвестное явление: {code}.'],
  'phenomenonStudyChanged.partial': ['[ЯДРО] Поступили новые данные: {code}. Предварительная оценка: {partial}.'],
  'phenomenonStudyChanged.known': ['[ЯДРО] Анализ завершён: {code} — {name}. Данные внесены в базу.'],
  recipeUnlocked: ['[ЯДРО] Рецепт открыт: {recipe}. {description} Синтез пока недоступен.'],
  restInterrupted: ['Отдых прерван: рядом враг.'],
  restFinished: ['[ДИАГНОСТИКА] Отдых завершён.'],
  gameWon: ['[ЯДРО] Портал активирован. Возврат во временную линию…'],
  itemsNoticed: ['[ЯДРО] Обнаружено: {list}.'],
  'featureNoticed.stairsDown': ['[ЯДРО] Обнаружена лестница вниз.'],
  'featureNoticed.stairsUp': ['[ЯДРО] Обнаружена лестница вверх.'],
  'featureNoticed.portal': ['[ЯДРО] Обнаружен портал.'],
  exploreFinished: ['[ЯДРО] Уровень исследован.'],
  autoLimitReached: ['[ЯДРО] Маршрут прерван: слишком долгий путь.'],
}

/** Род. п. категории снаряжения для «Новый тип …». */
export const CATEGORY_GEN = { weapon: 'оружия', armour: 'брони', consumable: 'предмета' } as const

/** Тексты отказов (ход не тратится). */
export const REJECT_TEXT: Record<RejectReasonKey, string> = {
  gameOver: 'Партия завершена.',
  invalid: 'Некорректная команда.',
  blocked: 'Туда нельзя.',
  noStairs: 'Здесь нет лестницы.',
  noItem: 'Нет такого предмета.',
  nothingHere: 'Здесь ничего нет.',
  inventoryFull: 'Инвентарь заполнен (20 предметов).',
  cannotEquip: 'Это нельзя надеть.',
  slotEmpty: 'Слот пуст.',
  needTarget: 'Нужно выбрать цель.',
  wrongTarget: 'Неподходящая цель.',
  bandageOnBionic: '[ДИАГНОСТИКА] Бинт бесполезен для бионики — нужен ремкомплект.',
  repairOnOrganic: '[ДИАГНОСТИКА] Ремкомплект не подходит для органики — нужен бинт.',
  notDamaged: 'Чинить или лечить нечего.',
  fullHealth: 'Я полностью здоров.',
  nothingToRepair: 'Чинить нечего.',
  notUsable: 'Это нельзя применить.',
  equippedItem: 'Сначала сними предмет.',
  nothingToExplore: 'Здесь больше нечего исследовать.',
  noRangedWeapon: 'В руке нет оружия дальнего боя.',
  noAmmo: 'Нет боеприпасов.',
  weaponBroken: 'Оружие сломано.',
  outOfRange: 'Цель слишком далеко.',
}
