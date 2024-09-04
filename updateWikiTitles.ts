function getUrl(locale: string) {
	const origin = `https://${locale}.wikipedia.org`
	const url = new URL('/w/api.php', origin)

	for (
		const [k, v] of Object.entries({
			action: 'query',
			format: 'json',
			list: 'random',
			formatversion: 2,
			rnnamespace: 0,
			rnlimit: 50,
		})
	) {
		url.searchParams.set(k, String(v))
	}

	return url
}

const locales = ['ar', 'de', 'el', 'es', 'ja', 'ru', 'th', 'vi', 'zh']

const results = Object.fromEntries(
	await Promise.all(locales.map(async (locale) => {
		const url = getUrl(locale)
		const res = await fetch(url)
		const results: { title: string }[] = (await res.json()).query.random
		const r = results.map((x) => x.title).sort((a, b) => b.length - a.length)

		return [locale, r] as const
	})),
)

await Deno.writeTextFile('./wikiTitles.json', JSON.stringify(results, null, '\t') + '\n')
