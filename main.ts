import { escape as regExpEscape } from 'jsr:@std/regexp'

// https://github.com/unicode-org/icu/blob/main/icu4c/source/data/translit/
const dir = './icu/icu4c/source/data/translit'

const x = (await Array.fromAsync(Deno.readDir(dir))).sort((a, b) => a.name.localeCompare(b.name, 'en-US'))

function normalize(str: string) {
	return str.trim().normalize('NFD').toLowerCase()
}

function getSubMap(txt: string) {
	const lines = txt.split('\n')
	const m = new Map<string, string>()
	for (const line of lines) {
		if (!line.trim()) continue
		if (/^\s*#/.test(line)) continue

		const content = line.match(/^.+?(?=#|(?<=[^']);|\$|$)/)?.[0]
		if (!content) continue

		const forwardOrBidi = /[→↔]/

		const [_from, _to] = content.split(forwardOrBidi).map(normalize)

		if (!_from || !_to) continue

		const _ = {
			from: normalize(_from),
			to: normalize(_to),
		}

		if (_.to == null) continue

		for (const [_k, v] of Object.entries(_)) {
			const k = _k as keyof typeof _

			if (/^'[^']+'$/.test(v)) {
				_[k] = v.slice(1, -1)
			}

			try {
				_[k] = JSON.parse(`"${v}"`)
			} catch { /* ignore */ }
		}

		_.to = _.to.replaceAll(/\p{M}/gu, '')

		if (!_.from || !_.to) continue
		// if `to` contains non-ASCII-word chars
		if (/[^0-9a-zA-Z\-]/.test(_.to)) continue
		// if `from` contains ASCII other than word chars, square brackets, and hyphens
		if (/[[\0-~]--[\p{L}\p{M}\p{N}\[\]\-]]/v.test(_.from)) continue

		if (/^\[.+\]$/u.test(_.from)) {
			for (const [ch] of _.from.slice(1, -1).matchAll(/.-.|./gu)) {
				if ([...ch].length === 3) {
					// is range w hyphen
					const [from, to] = ch.split('-').map((x) => x.codePointAt(0)!)
					for (let i = from; i <= to; i++) {
						const ch = String.fromCodePoint(i)
						if (/[\p{L}\p{M}\p{N}]/u.test(ch)) {
							m.set(ch, _.to)
						}
					}
				} else {
					m.set(ch, _.to)
				}
			}
		} else {
			if (/[\[\]]/.test(_.from)) continue
			m.set(_.from, _.to)
		}
	}
	return m
}

let ascii: Map<string, string>
let asciiRe: RegExp

{
	const f = x.find((f) => f.isFile && f.name === 'Latin_ASCII.txt')!
	const path = `${dir}/${f.name}`
	const r = await Deno.readTextFile(path)
	ascii = getSubMap(r)
	asciiRe = new RegExp(
		`(?:${Array.from(ascii.keys()).map((k) => regExpEscape(k)).join('|')})`,
		'gu',
	)
}

const all = new Map<string, string>()

const suffixes = [
	'_Latn.txt',
	'_Latin.txt',
	'_Latn_BGN.txt',
]

const ignores = [
	// Ancient Greek - prefer el_el_Latn_BGN.txt
	'Grek_Latn.txt',
]

for (const f of x) {
	if (!f.isFile) continue
	if (ignores.includes(f.name)) continue

	if (!suffixes.some((suf) => f.name.endsWith(suf))) continue

	const path = `${dir}/${f.name}`
	const r = await Deno.readTextFile(path)
	const m = getSubMap(r)

	for (const [k, v] of m) {
		all.set(
			k,
			normalize(v).replaceAll(/\p{M}/gu, '').replaceAll(
				asciiRe,
				(m) => ascii.get(m) ?? m,
			),
		)
	}
}

for (const [k, v] of ascii) {
	all.set(normalize(k), v)
}

const outRev: Record<string, string[]> = Object.create(null)

for (const [k, v] of all) {
	outRev[v] ??= []
	outRev[v].push(k)
}

const allOut = Object.entries(outRev).sort(([a], [b]) => a.localeCompare(b, 'en-US'))
	.map(([k, v]) => {
		return [k, v.sort((a, b) => a.localeCompare(b, 'en-US')).join(',')] as const
	})

await Deno.writeTextFile(
	'./all.json',
	JSON.stringify(Object.fromEntries(allOut)) + '\n',
)

const all2 = new Map<string, string>()
for (const x of allOut) {
	for (const y of x[1].split(',')) {
		all2.set(y, x[0])
	}
}

import { assertEquals } from 'jsr:@std/assert'
import { slugify } from './slugify.ts'
assertEquals(Object.fromEntries(all), Object.fromEntries(all2))

const wikiTitles = (await import('./wikiTitles.json', { with: { type: 'json' } })).default

const locales = ['ar', 'de', 'el', 'es', 'ja', 'ru', 'th', 'vi', 'zh'] as const

for (const x of locales) {
	const texts = wikiTitles[x as typeof locales[number]].slice(0, 3)

	console.log(`[${x}]`)
	console.log('')
	console.time()
	for (const text of texts) {
		console.log(text)
		console.log(slugify(text))
		console.log(slugify(text, { charMap: all2 }))
		console.log('')
	}
	console.timeEnd()
	console.log('')
}
