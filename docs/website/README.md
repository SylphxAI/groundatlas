# GroundAtlas website

This directory contains a dependency-free static landing page for GroundAtlas.
It is deployed by the GitHub-owned Pages workflow at `.github/workflows/pages.yml`.

Open locally:

```sh
python3 -m http.server 8080 -d docs/website
```

Then visit `http://localhost:8080`.

## Deployment target

GitHub Pages URL after the workflow succeeds:

```text
https://sylphxai.github.io/groundatlas/
```

The workflow uses `contents: read`, `pages: write`, and `id-token: write`; it does not require repository secrets.
