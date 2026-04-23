const code = await new Request("https://raw.githubusercontent.com/Hajime-Sky/Sky-source/main/installer/SkyToolsInstaller.js").loadString()
await eval(`(async()=>{\n${code}\n})()`)
