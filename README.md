# Frontline+ Node (TypeScript) Test

This program is a concept for an automatic grade checker using NodeJS. 

### Usage

The program will ask for your credentials via hidden console input and require the following command line arguments:
- `generalParentUrl` - URL prefacing all pages. `https://www.frontline.example/selfserve/EntryPointAction.do` --> `https://www.frontline.example/selfserve/`
- `staffMember` - Tries to log in as a staff member
- `parent` - Tries to log in as a parent
- `entryParams` - Any search parameters included at your entry point, formatted as JSON. Overrides `staffMember` and `parent`. Example: `{staffMember=N}`