# Frontline+ Node Test

This program is a concept for an automatic grade checker using NodeJS. 

### Usage

The program will ask for your credentials via hidden console input and require the following command line arguments:
- `generalParentUrl` - URL prefacing all pages. `https://www.frontline.example/selfserve/EntryPointAction.do` --> `https://www.frontline.example/selfserve/`
- `entryParams` - Any search parameters included at your entry point, formatted as JSON. Example: `{staffMember=N}`