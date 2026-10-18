import type { Gender, WordForms } from './types'

/** Компактная запись словоформ: им, род, дат, вин, твор, предл. */
export function w(
  forms: [string, string, string, string, string, string],
  gender: Gender,
  animate = false,
): WordForms {
  const [nom, gen, dat, acc, ins, prep] = forms
  return { nom, gen, dat, acc, ins, prep, gender, ...(animate ? { animate } : {}) }
}

/** Игрок — «ты». Род мужской используется только для согласования прилагательных. */
export const PLAYER_WORDS: WordForms = w(['ты', 'тебя', 'тебе', 'тебя', 'тобой', 'тебе'], 'm', true)
