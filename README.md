# website_cv

The code for egecelikel.com. It is a small WordPress plugin that is deployed to WordPress.com.

| URL | Served from |
|---|---|
| `/` | `site/index.html` (CV) |
| `/projects/...` | `site/projects/...` (a folder serves its `index.html`) |
| `/blog/`, posts, `/wp-admin` | WordPress as usual |

## Adding a JavaScript project
1. Create `site/projects/<name>/index.html`, plus any `.js`, `.css` or image files it needs.
2. Add a link to it in `site/projects/index.html`.
3. Commit and push to `main`. WordPress.com deploys it automatically.

Only common web file types are served (HTML, CSS, JS, JSON, images, fonts, audio, video, 3D models, WASM). `.php` files and anything outside `site/` are never served.

Copyright 2025 Ege Çelikel
Licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License.
