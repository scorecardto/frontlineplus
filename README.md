# Export JSON to XLSX

This program is a concept for converting a JSON object in the format

```json
[
  [
    {
      "type": "",
      "value": "",
    }
  ]
]
```

to an XLSX file. It's probably best to require any JSON not in this format to be converted into this format. This way, the program doesn't have to make any assumptions about how to format the spreadsheet.

The program allows for multiple sheets to be created.

# Usage

Run `yarn export` to run to demo. The resulting XLSX file is `Grades.xlsx`.