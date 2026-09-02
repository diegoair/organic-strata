# Organica

Organica is a visual-language system and a set of browser tools to compose,
generate and export it — vector-first, from screen to mural. Built on the idea
of a *flexible visual system*: a grammar of rules that produces endless coherent
variation.

**Live:** <https://theorganicalanguage.vercel.app> — private, invite-only beta.

## This repo

Vanilla HTML/CSS/JS, one file per tool, no build step. Shared code lives in
`shared/`; each tool is its own directory. Auth + per-user cloud sync run on
Supabase; hosting is Vercel.

- **Architecture, conventions, per-tool notes, session history** →
  [`CLAUDE.md`](CLAUDE.md)
- **Design system** (tokens, components) →
  [`docs/DESIGN-SYSTEM.md`](docs/DESIGN-SYSTEM.md) and the live
  [`/design-system/`](https://theorganicalanguage.vercel.app/design-system/)
- **UI shell contract**, vision, roadmap, per-tool manuals → [`docs/`](docs/)
- **Vendored libraries and their licenses** →
  [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md)

## License

Proprietary — all rights reserved. See [`LICENSE`](LICENSE). Not open source;
no rights are granted through this repository or the deployed site.
