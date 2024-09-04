const wordSegmenter = new Intl.Segmenter('en-US', { granularity: 'word' })

export type SlugifyOptions = {
	/** @default {undefined} */
	charMap: Map<string, string> | undefined
	/** @default {Boolean(options.charMap)} */
	stripNonAscii: boolean
}

const _getTransliterationRegex = () => {
	let _charMap: Map<string, string>
	let _re: RegExp
	return function getTransliterationRegex(charMap: Map<string, string>) {
		if (_re && (charMap === _charMap)) return _re

		_charMap = charMap
		_re = new RegExp(
			`(?:${[...charMap.keys()].join('|')})`,
			'gu',
		)

		return _re
	}
}

const getTransliterationRegex = _getTransliterationRegex()

type TransliterationConfig = {
	transliterate: true
	charMap: Map<string, string>
	re: RegExp
} | {
	transliterate: false
}

function convertWord(word: string, config: TransliterationConfig) {
	return config.transliterate
		? word.replaceAll(/\p{M}/gu, '').replaceAll(config.re, (m) => config.charMap.get(m)!)
		: word
}

export function slugify(str: string, options?: Partial<SlugifyOptions>) {
	const config: TransliterationConfig = options?.charMap
		? {
			transliterate: true as const,
			charMap: options.charMap,
			re: getTransliterationRegex(options.charMap),
		}
		: {
			transliterate: false as const,
		}

	const stripNonAscii = options?.stripNonAscii ?? config.transliterate
	const stripRe = stripNonAscii ? /[^0-9a-zA-Z\-]/g : /[^\p{L}\p{M}\p{N}\-]+/gu

	const words: string[] = []

	for (const s of wordSegmenter.segment(str.trim().normalize('NFD').toLowerCase())) {
		if (s.isWordLike) {
			words.push(s.segment)
		} else if (s.segment.length) {
			words.push('-')
		}
	}

	return words
		.map((word) => convertWord(word, config))
		.join(config.transliterate ? '-' : '')
		.replaceAll(stripRe, '')
		.normalize('NFC')
		.replaceAll(/-{2,}/g, '-')
		.replaceAll(/^-|-$/g, '')
}

// import { assertEquals } from 'jsr:@std/assert'
// import { slugify } from './slugify.ts'
// assertEquals(Object.fromEntries(all), Object.fromEntries(all2))
