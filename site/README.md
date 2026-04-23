# HajimeSky Tools install page

This directory is a static Cloudflare Pages payload.

Deploy target:

```powershell
npx wrangler pages deploy .\site --project-name <cloudflare-pages-project>
```

The page copies `installer/bootstrap.js` to the clipboard and opens Scriptable's new-script screen with the script name `Sky Tools Installer`.
