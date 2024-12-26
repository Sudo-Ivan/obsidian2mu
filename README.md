# Obsidian2Mu

[![CodeQL Security Scan](https://github.com/Sudo-Ivan/obsidian2mu/actions/workflows/codeql.yml/badge.svg)](https://github.com/Sudo-Ivan/obsidian2mu/actions/workflows/codeql.yml)

Convert Obsidian markdown to markup for reticulum and view .mu files

Still work in progress. Feel free to contribute.

## Development

1. Clone the repository
2. Run `npm install`
3. Run `npm run build`
4. Copy the `manifest.json`, `styles.css`, `main.js` files to your Obsidian plugins folder (vault-location/.obsidian/plugins/obsidian2mu)
5. Reload Obsidian and enable the plugin in settings

You can also modify the `build-plugin.sh` and run it to build the plugin and copy it to the Obsidian plugins folder. 

I also recommend you install [hot-reload](https://github.com/pjeby/hot-reload) to automatically reload the plugin when you make changes to the code.