/* eslint-disable no-unused-vars */
import type { GridBounds, SharedStrings, Cell, Content, Sheet } from 'types';
import { writeFile, mkdir, rm } from 'fs/promises';
import * as constants from './constants';
import { createWriteStream } from 'fs';
import CONTENT from './content.json';
import archiver from 'archiver';
import chalk from 'chalk';

const convertToChar = (col: number) => String.fromCharCode(97 - 32 + col);

const fetchString = (strings: Set<string>, query: string): number => {
	const iter = strings.values();
	for (let i = 0; i < strings.size; i++) {
		const { value } = iter.next();
		if (value === query) {
			return i;
		}
	}
	return -1;
};

const convertJSONReportCards = (content: Content): Sheet => {
	const classes = Object.keys(content);
	const headers = ['Teacher', 'Course Code', '1Nin', '2Nin'];
	const cells: Array<Array<Cell>> = [[]];

	for (let i = 0; i < headers.length; i++) {
		cells[0][i] = {
			value: headers[i],
			type: 's'
		};
	}

	for (let i = 0; i < classes.length; i++) {
		cells.push([]);

		const c = content[classes[i]];
		const overview = {
			teacher: c.teacher,
			courseCode: c.courseCode,
			grades: Object.keys(c.grades).map(key => ({ [key]: c.grades[key].average }))
		};

		cells[i + 1][0] = {
			value: overview.teacher,
			type: 's'
		};

		cells[i + 1][1] = {
			value: overview.courseCode,
			type: 's'
		};

		for (let j = 0; j < overview.grades.length; j++) {
			cells[i + 1][j + 2] = {
				value: overview.grades[j][headers[j + 2]].toString(),
				type: 'n'
			};
		}
	}

	return {
		name: 'Report Card',
		cells
	};
};

class XLSX {

	private title: string;
	private sheets: Map<string, string>;
	private strings: string;
	private workbook: string;
	private rels: string;

	public constructor(title: string, sheets: Array<Sheet>) {
		this.title = title;
		this.sheets = this.createSheets(sheets);
		this.workbook = this.workbookXML(sheets.map(sheet => sheet.name)).trim();
		this.strings = this.sharedStrings(sheets).xml;
		this.rels = this.relsXML(sheets.map((_, idx) => `sheet${idx + 1}.xml`)).trim();
	}

	public async write(): Promise<void> {
		const ROOT = `./~${this.title}.xlsx`;
		console.log(chalk.green('Preparing for export...'));

		const tree = {
			[`${ROOT}`]: [
				{ name: '[Content_Types].xml', data: constants.CONTENT_TYPES }
			],
			[`${ROOT}/_rels`]: [
				{ name: '.rels', data: constants.BASE_RELS	}
			],
			[`${ROOT}/docProps`]: [
				{ name: 'app.xml', data: constants.DOC_PROPS.APP },
				{ name: 'core.xml',	data: constants.DOC_PROPS.CORE }
			],
			[`${ROOT}/xl`]: [
				{ name: 'workbook.xml', data: this.workbook },
				{ name: 'styles.xml', data: constants.XL.STYLES },
				{ name: 'sharedStrings.xml', data: this.strings }
			],
			[`${ROOT}/xl/_rels`]: [
				{ name: 'workbook.xml.rels', data: this.rels }
			],
			[`${ROOT}/xl/theme`]: [
				{ name: 'theme1.xml', data: constants.XL.THEME }
			],
			[`${ROOT}/xl/worksheets`]: []
		};

		for (const [name, data] of this.sheets) {
			tree[`${ROOT}/xl/worksheets`].push({ name, data });
		}

		console.log(chalk.green('Writing files...'));
		for (const dir of Object.keys(tree)) {
			await mkdir(dir);
			for (const file of tree[dir]) {
				await writeFile(`${dir}/${file.name}`, file.data);
			}
		}

		console.log(chalk.green('Building archive...'));

		const output = createWriteStream(`${this.title}.xlsx`);
		const archive = archiver('zip', {
			zlib: { level: 4 }
		});

		output.on('close', () => {
			console.log(chalk.green(`Exported data to ${this.title}.xlsx: ${archive.pointer()} bytes`));
		});

		archive.pipe(output);
		archive.directory(ROOT, false);

		console.log(chalk.green('Writing archive...'));
		await archive.finalize();

		await rm(ROOT, { recursive: true, force: true });
	}

	private createSheets(sheets: Array<Sheet>): Map<string, string> {
		const { set } = this.sharedStrings(sheets);
		const res = new Map<string, string>();

		for (let i = 1; i <= sheets.length; i++) {
			const name = `sheet${i}.xml`;
			const data = sheets[i - 1];
			const bounds = this.gridBounds(data.cells);
			res.set(name, this.sheetXML(bounds, data.cells, set).trim());
		}

		return res;
	}

	private gridBounds(cells: Array<Array<Cell>>): GridBounds {
		const rowLength = convertToChar(cells.length - 1);

		let colLength = -1000;
		for (let i = 0; i < cells.length; i++) {
			if (cells[i].length > colLength) {
				colLength = cells[i].length;
			}
		}

		return {
			rows: `A1`,
			cols: `${rowLength}${colLength}`
		};
	}


	private sharedStrings(sheets: Array<Sheet>): SharedStrings {
		let count = 0;
		const set = new Set<string>();
		for (const sheet of sheets) {
			for (const cellRow of sheet.cells) {
				for (const cell of cellRow) {
					if (cell.type === 's') {
						set.add(cell.value);
						count++;
					}
				}
			}
		}

		const iter = set.values();
		const strings: Array<string> = [];
		for (let i = 0; i < set.size; i++) {
			const { value } = iter.next();
			strings.push(value);
		}

		const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${count}" uniqueCount="${set.size}">
${strings.map(str => `<si><t>${str}</t></si>`).join(' ')}
</sst>`;

		return {
			xml,
			set
		};
	}
	private relsXML(sheets: Array<string>) {
		const base = sheets.length;
		return (
			`<?xml version="1.0" encoding="UTF-8"?>
		<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
		${sheets.map((sheet, idx) => `<Relationship Id="rId${idx + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/${sheet}" />`).join('\n\t')}
			<Relationship Id="rId${base + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml" />
			<Relationship Id="rId${base + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml" />
			<Relationship Id="rId${base + 3}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml" />
		</Relationships>`
		);
	}

	private workbookXML(sheets: Array<string>) {
		return `
<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" 
xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" 
xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" 
xmlns:x15="http://schemas.microsoft.com/office/spreadsheetml/2010/11/main" 
xmlns:xr="http://schemas.microsoft.com/office/spreadsheetml/2014/revision" 
xmlns:xr10="http://schemas.microsoft.com/office/spreadsheetml/2016/revision10" 
xmlns:xr2="http://schemas.microsoft.com/office/spreadsheetml/2015/revision2" 
xmlns:xr6="http://schemas.microsoft.com/office/spreadsheetml/2016/revision6" mc:Ignorable="x15 xr xr6 xr10 xr2">
	 <fileVersion appName="xl" lastEdited="7" lowestEdited="7" rupBuild="10111" />
	 <workbookPr defaultThemeVersion="166925" />
	 <mc:AlternateContent>
			<mc:Choice Requires="x15">
				 <x15ac:absPath xmlns:x15ac="http://schemas.microsoft.com/office/spreadsheetml/2010/11/ac" url="/Users/scnewmark/Documents/school/pip.nosync/frontlineplus/" />
			</mc:Choice>
	 </mc:AlternateContent>
	 <xr:revisionPtr revIDLastSave="0" documentId="13_ncr:1_{BFBAE908-ED8A-5341-8573-7A3E6D05DC42}" xr6:coauthVersionLast="47" xr6:coauthVersionMax="47" 
	 xr10:uidLastSave="{00000000-0000-0000-0000-000000000000}" />
	 <bookViews>
			<workbookView xWindow="5160" yWindow="1800" windowWidth="28040" windowHeight="17440" xr2:uid="{4F283C9D-E66B-E14D-878E-22A7C2B9359A}" />
	 </bookViews>
	 <sheets>
			${sheets.map((sheet, idx) => `<sheet name="${sheet}" sheetId="${idx + 1}" r:id="rId${idx + 1}" />`).join('\n')}
	 </sheets>
	 <calcPr calcId="181029" />
	 <extLst>
			<ext uri="{140A7094-0E35-4892-8432-C4D2E57EDEB5}">
				 <x15:workbookPr chartTrackingRefBase="1" />
			</ext>
			<ext xmlns:xcalcf="http://schemas.microsoft.com/office/spreadsheetml/2018/calcfeatures" uri="{B58B0392-4F1F-4190-BB64-5DF3571DCE5F}">
				 <xcalcf:calcFeatures>
						<xcalcf:feature name="microsoft.com:RD" />
						<xcalcf:feature name="microsoft.com:Single" />
						<xcalcf:feature name="microsoft.com:FV" />
						<xcalcf:feature name="microsoft.com:CNMTM" />
						<xcalcf:feature name="microsoft.com:LET_WF" />
				 </xcalcf:calcFeatures>
			</ext>
	 </extLst>
</workbook>`;
	}

	private sheetXML(bounds: GridBounds, cells: Array<Array<Cell>>, strings: Set<string>) {
		const empty = bounds.rows === 'A1' && bounds.cols === 'A0';
		return (
			`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet
	xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
	xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
	xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x14ac xr xr2 xr3"
	xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac"
	xmlns:xr="http://schemas.microsoft.com/office/spreadsheetml/2014/revision"
	xmlns:xr2="http://schemas.microsoft.com/office/spreadsheetml/2015/revision2"
	xmlns:xr3="http://schemas.microsoft.com/office/spreadsheetml/2016/revision3" xr:uid="{17988BDF-51A7-A04F-B540-805467BD523B}">
	<dimension ref="${empty ? 'A1' : `${bounds.rows}:${bounds.cols}`}"/>
	<sheetViews>
		<sheetView tabSelected="1" workbookViewId="0">
			<selection activeCell="A1" sqref="A1"/>
		</sheetView>
	</sheetViews>
	<sheetFormatPr baseColWidth="10" defaultRowHeight="16" x14ac:dyDescent="0.2"/>
	<sheetData>
		${empty ? '' : cells.map((cellRow, ridx) =>
				`<row r="${ridx + 1}" spans="1:${cellRow.length}" x14ac:dyDescent="0.2">
				${cellRow.map((cell, cidx) =>
				`<c r="${convertToChar(cidx)}${ridx + 1}" t="${cell.type === 'n' ? '' : cell.type.valueOf()}">
				<v>${cell.type === 's' ? fetchString(strings, cell.value) : cell.value}</v>
			</c>`).join('\n')}
		</row>`).join('\n')}
	</sheetData>
	<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>
</worksheet>`
		);
	}

}

(async () => {
	const reportCard = convertJSONReportCards(CONTENT);
	const empty: Sheet = {
		name: 'Empty',
		cells: [[]]
	};
	const testing: Sheet = {
		name: 'Testing',
		cells:
			[[
				{
					type: 's',
					value: 'hello world'
				},
				{
					type: 's',
					value: 'hello world'
				}
			]]
	};

	const xlsx = new XLSX('Grades', [reportCard, empty, testing]);
	await xlsx.write();
})();
