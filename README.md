# Kitchen Lab

Save recipes, track experiments on them (pass / fail / not tried) and see nutrition per 100 g.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Notes

- All data is stored in this browser only (IndexedDB). Another browser or device starts empty, and clearing site data erases it.
- `npm run build` produces a static site in `dist/`, with relative paths and hash routing so it can be hosted from a GitHub Pages subfolder later.
