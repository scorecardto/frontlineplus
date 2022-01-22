import * as axios from "axios"
import {HTMLElement, parse} from "node-html-parser"
import * as qs from "qs"
import { encode } from "iconv-lite"
import * as yargs from "yargs"
import * as colors from "colors"
import * as read from "read";
import * as fs from "fs";

const argv = yargs.options({
    generalParentURL: {
        alias: 'g',
        type: "string",
        demandOption: true,
        description: 'URL prefacing all pages'
    },
    entryParams: {
        alias: 'e',
        type: "string",
        demandOption: false,
        description: 'any search parameters included at your entry point, formatted as JSON'
    },
    staffMember: {
        default: false,
        demandOption: false,
        type: "boolean",
        description: 'tries to log in as a staff member'
    },
    parent: {
        default: false,
        demandOption: false,
        type: "boolean",
        description: 'trys to log in as a parent'
    },
    username: {
        alias: 'u',
        type: "string",
        demandOption: false,
        description: 'your username for Frontline'
    },
    password: {
        alias: 'p',
        type: "string",
        demandOption: false,
        description: 'your password for Frontline'
    }
}).parseSync();

const generateHeaders = (cookie: string, host: string, origin: string, referer: string) => {
    return {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'max-age=0',
        'Connection': 'keep-alive',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookie,
        'Host': host,
        'Origin': origin,
        'Referer': referer
    }
}

const generateDefaultBody = () => {
    return new URLSearchParams({
        selectedIndexId: '-1',
        selectedTable: '',
        smartFormName: "SmartForm",
        focusElement: ''
    })
}

let referer: string;

const updateReferer = (baseURL: string | URL, params: {[key: string]: string}) => {
    let url: URL

    try {
        url = new URL(baseURL)
    } catch (TypeError) {
        console.log(colors.bold.red("\n❌  Invalid general parent URL"))
        return null
    }

    Object.entries(params).map(param => {
        url.searchParams.append(param[0], param[1])
    })

    referer = url.href
    return referer
};

const createEntryPoint = (parentUrl: string, params: {[key: string]: string}): Promise<{[sessionCookie: string]: string}> => {
    return new Promise((resolve, reject) => {
        const fullURL = parentUrl + 'EntryPointSignOnAction.do'
        if (updateReferer(fullURL, params) == null) return null

        axios.default.get(fullURL, {
            params
        }).then(response => {
            const cookies = response.headers["set-cookie"]
            resolve({
                sessionCookie: cookies[0]
            })
        }).catch(error => {
            reject(error)
        })
    })
}

const createSignOn = (parentUrl: string, username: string, password: string, sessionCookie: string): Promise<axios.AxiosResponse> => {
    return new Promise((resolve, reject) => {
        const fullURL = parentUrl + 'SignOnLoginAction.do'
        const params = {"x-tab-id": "undefined"}

        const { origin, host } = new URL(parentUrl)

        const data = generateDefaultBody()
        data.append("userLoginId", username)
        data.append("userPassword", password)

        const headers = generateHeaders(sessionCookie, host, origin, referer)

        if (updateReferer(fullURL, params) == null) return null

        axios.default.post(fullURL, data, {
            headers
        }).then(response => {
            resolve(response)
        }).catch(error => {
            reject(error)
        })

    })
}

const wasValidLoginCompleted  = (html: HTMLElement) => { // returns json if correct password, FALSE if incorrect password, UNDEFINED if unknown issue
    const sidekick = html.querySelector("[id$=SidekickJson]")

    if(!sidekick) {
        const pageMessage = html.querySelector("#pageMessageDiv")

        if(pageMessage?.innerText?.includes("incorrect") || pageMessage?.innerText?.includes("invalid")) {
            return false
        }

        return undefined
    }

    const json = JSON.parse(sidekick.innerText)

    return {
        name: json.userPersonName,
        envName: json.env?.name
    }
}

const fetchReportCards = (parentUrl: string, sessionCookie: string): Promise<axios.AxiosResponse> => {
    return new Promise((resolve, reject) => {
        const fullURL = parentUrl + 'PSSViewReportCardsAction.do'
        const params = {"x-tab-id": "undefined"}
        const { origin, host } = new URL(parentUrl)

        const headers = generateHeaders(sessionCookie, host, origin, referer)

        if (updateReferer(fullURL, params) == null) return null

        axios.default.post(fullURL, null, {
            headers
        }).then(response => {
            resolve(response)
        }).then(error => {
            reject(error)
        })

    })
}

const fetchAssignments = (parentUrl: string, courseData: string, sessionCookie: string): Promise<axios.AxiosResponse> => {
    return new Promise((resolve, reject) => {
        const fullURL = parentUrl + 'PSSViewGradeBookEntriesAction.do'
        const params = {"x-tab-id": "undefined"}
        const { origin, host } = new URL(parentUrl)

        const data = `${ generateDefaultBody().toString() }&gradeBookKey=${ courseData }&replaceObjectParam1=&selectedCell=&selectedTdId=`
        // can't use URLSearchParams because of weird formatting of courseData

        const headers = generateHeaders(sessionCookie, host, origin, referer)

        if (updateReferer(fullURL, params) == null) return null

        axios.default.post(fullURL, data, {
            headers
        }).then(response => {
            resolve(response)
        }).then(error => {
            reject(error)
        })
    })
}

const main = async (username: string, password: string) => {
    const generalParentURL = argv.generalParentURL;

    let entryParams;
    if (argv.entryParams != undefined) {
        entryParams = JSON.parse(argv.entryParams)
    } else {
        entryParams = '{"parent":"'+argv.parent+'","teamsStaffUser":"'+(argv.staffMember ? "Y" : "N")+'"}'
    }

    const entryPoint = await createEntryPoint(generalParentURL, entryParams)

    if (entryPoint == null) return;

    const signOn = await createSignOn(generalParentURL, username, password, entryPoint.sessionCookie);

    if (signOn == null) return;

    const signOnValidation = wasValidLoginCompleted(parse(signOn.data));

    if(!signOnValidation) {
        if(signOnValidation === false) {
            console.log(colors.bold.red("\n❌  Invalid credentials!"));
        } else {
            console.log(colors.bold.red("\n❌  Unknown issue."));
        }

        return
    }
    console.log(colors.bold.green("✅  Successful login"))

    const reportCards = await fetchReportCards(generalParentURL, entryPoint.sessionCookie)

    const reportCardsHtml = parse(reportCards.data)

    const courseColumns = reportCardsHtml
        .querySelector(".studentGradingTopLeft tr")
        ?.querySelectorAll("td")
        .filter((td) => {
            return td.rawText.length > 0
        })
        .map((td) => {
            return td.rawText
        }) ?? []

    const gradingColumns = reportCardsHtml
        .querySelector(".studentGradingTopRight tr")
        ?.querySelectorAll("td")
        .filter((td) => {
            return td.innerText.replace(/&nbsp;/g, '').length > 0
        })
        .map((td) => {
            return td.innerText.replace(/&nbsp;/g, '')
        }) ?? []

    const courses = reportCardsHtml.querySelectorAll(".studentGradingBottomLeft #tableHeaderTable tbody > tr:not(:first-child)").map((row) => {
        return row.querySelectorAll("td").map((cell) => {
            return cell.textContent;
        })
    })

    const grades = reportCardsHtml.querySelectorAll(".studentGradingBottomRight #tableHeaderTable tbody > tr:not(:first-child)").map((row) => {
        return row.querySelectorAll("td").map((cell) => {
            return {
                grade: cell.textContent,
                courseData: encode(qs.stringify({'': cell.getAttribute("cellkey")}), "win1252").toString().replace(new RegExp(/%20/g), "+").substring(1)
            }
        })
    })

    const json = courses.map((course, courseIdx) => {
        return {
            course: course.map((column, idx) => {
                return {
                    key: courseColumns[idx],
                    value: column
                }
            }),
            grades: grades.map((column, idx) => {
                return {
                    gradingColumn: gradingColumns[idx],
                    score: grades[courseIdx][idx]["grade"],
                    courseData: grades[courseIdx][idx]["courseData"],
                    sections: []
                }
            })
        }
    })

    for (let course=0; course<json.length; course++) {
        for (let grade=0; grade<json[course]["grades"].length; grade++) {
            const courseData = json[course]["grades"][grade]["courseData"];

            if ((await fetchReportCards(generalParentURL, entryPoint.sessionCookie)) == null) return

            const assignments = await fetchAssignments(generalParentURL, courseData, entryPoint.sessionCookie);

            if (assignments == null) return;

            const assignmentsHtml = parse(assignments.data)

            json[course]["grades"][grade]["sections"] = assignmentsHtml.querySelectorAll("#pssViewGradeBookEntriesDiv .panelContainer .tablePanelContainer").map((panel: HTMLElement) => {
                const text = panel.querySelector(".sst-header .sst-title").textContent;
                const assignmentColumns = panel
                    .querySelector(".scrollSortDiv .scrollSortTable tbody tr .ssTable-containing .ssTableWrap .ssTable .tblHeader tr")
                    ?.querySelectorAll("th .table-handle")
                    .filter((th) => {
                        return th.rawText.length > 0
                    })
                    .map((th) => {
                        return th.rawText
                    }) ?? []

                return {
                    section: text.split("Average:  ")[0],
                    weight: text.split("Weight:  ")[1],
                    assignments: panel.querySelectorAll(".scrollSortDiv .scrollSortTable tbody tr .ssTable-containing .ssTableWrap .ssTable .tblBody tr").map((assignment: HTMLElement) => {
                        return assignment.querySelectorAll("td").map((td) => { return td.textContent })
                            .map((column, idx) => {
                                return {
                                    key: assignmentColumns[idx],
                                    value: column
                                }
                            })
                    })
                }
            })
        }
    }

    fs.writeFileSync('reportCards.json', JSON.stringify(json, null, 4).replace(/NBSP/g, " ").replace(/%2C/g, ",").replace(/%3D/g, "=").replace(/&nbsp;/g, " ").replace(/ /g, " "))
    console.log(colors.bold.cyan("\n🖊️Exported to reportCards.json"))
}

const usernameCallback = (er: string, username:string) => {
    if(argv.password != undefined) {
        passwordCallback(er, username, argv.password)
    } else {
        read({ prompt: colors.bold.blue('🔒 Password: '), silent: true }, (er, password) => {
            passwordCallback(er, username, password)
        })
    }
}

const passwordCallback = (er: string, username: string, password: string) => {
    main(username, password).then()
}

if(argv.username != undefined) {
    usernameCallback(undefined, argv.username)
} else {
    read({ prompt: colors.bold.blue('🔒 Username: '), silent: false }, usernameCallback)
}