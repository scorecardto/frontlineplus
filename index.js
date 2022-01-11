const read = require('read')
const axios = require("axios").default
const fs = require("fs")
const { parse } = require("node-html-parser")
const yargs = require("yargs")
const chalk = require("chalk")

const generateHeaders = (cookie, host, origin, referer) => {
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
        selectedIndexId: -1,
        selectedTable: '',
        smartFormName: "SmartForm",
        focusElement: ''
    })
}

let referer;

const updateReferer = (baseURL, params) => {
    const url = new URL(baseURL)

    Object.entries(params).map(param => {
        url.searchParams.append(param[0], param[1])    
    })

    referer = url.href
    return referer
}

const createEntryPoint = (parentUrl, params) => {
    return new Promise((resolve, reject) => {
        const fullURL = parentUrl + 'EntryPointSignOnAction.do'
        updateReferer(fullURL, params)

        axios.get(fullURL, {
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

const createSignOn = (parentUrl, username, password, sessionCookie) => {
    return new Promise((resolve, reject) => {
        const fullURL = parentUrl + 'SignOnLoginAction.do'
        const params = {"x-tab-id": "undefined"}

        const { origin, host } = new URL(parentUrl)

        const data = generateDefaultBody()
            data.append("userLoginId", username)
            data.append("userPassword", password)
        
        updateReferer(fullURL, params)

        axios.post(fullURL, data, {
            headers: generateHeaders(sessionCookie, host, origin, referer)
        }).then(response => {
            resolve(response)
        }).catch(error => {
            reject(error)
        })

    })
}

const wasValidLoginCompleted  = (html) => { // returns json if correct password, FALSE if incorrect password, UNDEFINED if unknown issue
    const sidekick = html.querySelector("[id$=SidekickJson]")

    if(!sidekick) {
        const pageMessage = html.querySelector("#pageMessageDiv")

        if(pageMessage?.innerText?.includes("incorrect") || pageMessage?.innerText?.includes("invalid")) {
            return false
        }

        return undefined
    };

    const json = JSON.parse(sidekick.innerText)
    
    return {
        name: json.userPersonName,
        envName: json.env?.name
    }
}

const fetchReportCards = (parentUrl, sessionCookie) => {
    return new Promise((resolve, reject) => {
        const fullURL = parentUrl + 'PSSViewReportCardsAction.do'
        const params = {"x-tab-id": "undefined"}
        const { origin, host } = new URL(parentUrl)

        axios.post(fullURL, null, {
            headers: generateHeaders(sessionCookie, host, origin, referer)
        }).then(response => {
            resolve(response)
        }).then(error => {
            reject(error)
        })
    })
}

const main = async (username, password) => {
    if(!yargs.argv.generalParentURL) {
        console.log(chalk.redBright("Missing --generalParentURL in argument list."));
    }
    if(!yargs.argv.entryParams) {
        console.log(chalk.redBright("Missing --entryParams in argument list."));
    }

    const generalParentURL = yargs.argv.generalParentURL
    const entryParams = JSON.parse(yargs.argv.entryParams)

    const entryPoint = await createEntryPoint(generalParentURL, entryParams)

    const signon = await createSignOn(generalParentURL, username, password, entryPoint.sessionCookie);

    const signonValidation = wasValidLoginCompleted(parse(signon.data));

    if(!signonValidation) {
        if(signonValidation === false) {
            console.log(chalk.redBright("Incorrect credentials!"));
        } else {
            console.log(chalk.redBright("Unknown issue."));
        }
        
        return
    }

    const reportCards = await fetchReportCards(generalParentURL, entryPoint.sessionCookie)

    const reportCardsHtml = parse(reportCards.data)

        const courseCollumns = reportCardsHtml
            .querySelector(".studentGradingTopLeft tr")
            ?.querySelectorAll("td")
            .filter((td) => {
                return td.innerText.length > 0
            })
            .map((td) => {
                return td.innerText
            }) ?? []

        const gradingCollumns = reportCardsHtml
            .querySelector(".studentGradingTopRight tr")
            ?.querySelectorAll("td")
            .filter((td) => {
                return td.innerText.length > 0
            })
            .map((td) => {
                return td.innerText
            }) ?? []
        
        const courses = reportCardsHtml.querySelectorAll(".studentGradingBottomLeft #tableHeaderTable tbody > tr:not(:first-child)").map((row) => {
            const course = row.querySelectorAll("td").map((cell) => {
                return cell.textContent;
            })
            return course
        })

        const grades = reportCardsHtml.querySelectorAll(".studentGradingBottomRight #tableHeaderTable tbody > tr:not(:first-child)").map((row) => {
            const grade = row.querySelectorAll("td").map((cell) => {
                return cell.textContent;
            })
            return grade
        })

        const json = JSON.stringify(
            courses.map((course, courseIdx) => {
                return {
                    course: course.map((collumn, idx) => {
                        return {
                            key: courseCollumns[idx],
                            value: collumn
                        }
                    }),
                    grades: grades.map((collumn, idx) => {
                        return {
                            gradingCollumn: gradingCollumns[idx],
                            score: grades[courseIdx][idx]
                        }
                    })
                }
            })
        , null, 4);

        fs.writeFileSync('reportCards.json', json)

        console.log(chalk.greenBright("Exported to reportCards.json"));
}

read({ prompt: chalk.bold.blueBright('🔒 Username: '), silent: false }, (er, username) => {
    read({ prompt: chalk.bold.blueBright('🔒 Password: '), silent: true }, (er, password) => {
        main(username, password)
    })
})