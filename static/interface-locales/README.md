# Menu translations

These files are prepared during development. The app loads JSON labels directly;
changing menu languages never calls a translation provider. Content translation
continues to use the separately selected source and target languages.

`en.json` is the source snapshot exported from the fully loaded browser `COPY.en`.
`th.json` is a snapshot of the existing Thai labels. English and Thai remain
available immediately from the browser scripts. `static/interface-locales.js`
lists the other complete, validated files that can be selected.

To add or refresh translations using the configured provider:

```bash
.venv/bin/python scripts/prepare_interface_locales.py
# Or prepare selected catalog codes:
.venv/bin/python scripts/prepare_interface_locales.py --languages ja,fr,de
# Refresh an existing file after changing its source wording:
.venv/bin/python scripts/prepare_interface_locales.py --languages fr --force
```

The tool sends only fixed menu labels, never user translation content. It reuses
completed files, retains unfinished work in `.data/interface-build/`, validates
all keys, numbers and placeholders, and stops scheduling provider calls on quota
or credential errors. It is an offline development tool, not an app endpoint.

The expanded language files are AI-assisted drafts, not certified translations.
A valid file schema does not establish translation quality. The selected language also sets the page direction and loads a script-specific font from the existing Google Fonts CDN when needed; labels remain local files. Native speakers
should review phrasing, accessibility labels and low-resource languages.

When English labels change, export the new source, update affected locale files
and run `tests/browser/interface.cjs`. Bundled files must match the live labels;
invalid or incomplete files are not applied to the interface.
