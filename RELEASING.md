# Releasing and archiving on Zenodo

This project is archived on [Zenodo](https://zenodo.org) through the GitHub integration, so every
GitHub *release* automatically receives a DOI. This file describes the one-time setup and the
per-release routine.

## One-time setup

1. **Push the repository to GitHub** and make sure it is public (Zenodo only archives public
   repositories).
2. **Enable GitHub Pages**: *Settings → Pages → Build and deployment → Source: GitHub Actions*.
   The workflow in `.github/workflows/deploy.yml` then publishes `dist/` on every push to `main`.
3. **Link Zenodo to GitHub**: sign in at <https://zenodo.org> with your GitHub account, open
   <https://zenodo.org/account/settings/github/>, find `pandakingpunc/supernova-simulation` in the
   list and switch it **ON**. (If the repository is missing, click *Sync now*.)
4. Check the metadata files before the first release:
   - `CITATION.cff` – author name, e-mail, optional ORCID, version, release date.
   - `.zenodo.json` – title, description, creators (add `"orcid"` and `"affiliation"` if you have
     them), keywords, version.
   - `LICENSE` – copyright holder.
   Zenodo reads `.zenodo.json` first and falls back to `CITATION.cff`.

## Per-release routine

1. Update the version in `package.json`, `CITATION.cff` (`version` and `date-released`) and
   `.zenodo.json`, and add an entry to `CHANGELOG.md`.
2. Run the checks and the build locally:

   ```bash
   npm ci
   npm run check:physics
   npm run build
   ```

3. Commit and push to `main`.
4. Create a GitHub release: *Releases → Draft a new release → Choose a tag* (for example
   `v1.0.0`, create it on publish) → title `v1.0.0` → paste the changelog entry → **Publish
   release**. Zenodo picks the release up within a few minutes and mints a DOI.
5. After the first release, copy the **concept DOI** (the one that always points to the latest
   version, shown as "Cite all versions" on the Zenodo record) and replace every
   `10.5281/zenodo.XXXXXXX` placeholder in `README.md`. Optionally add the DOI to `CITATION.cff` as
   `doi:` and to `.zenodo.json` as a `related_identifiers` entry with relation `isVersionOf`.
   Commit and push; no new release is needed for that change.

## Notes

- Zenodo archives the source snapshot GitHub attaches to the release (a zip of the repository at
  the tag), not the built `dist/` folder. Anyone can rebuild the site with `npm ci && npm run build`.
- Deleting a Zenodo record is not possible once it is published; check the metadata before
  publishing the GitHub release.
