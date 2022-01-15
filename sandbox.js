const fs = require("fs")
const { parse } = require("node-html-parser")
const chalk = require("chalk")

const assignments = parse(fs.readFileSync("assignments.html", "utf8"));

const gradebookSection = assignments.querySelectorAll(".tblBody")

const parseNumberValue = (str) => {
    const nums = str.match(/^\d+|\d+\b|\d+(?=\w)/g).map(numStr => parseInt(numStr))
    if(nums.length >= 1) {
        return nums[0];
    } else {
        return undefined;   
    }
}

const titles = assignments.querySelectorAll(".sst-title")
const headerRows = assignments.querySelectorAll(".tblHeader")

gradebookSection.forEach((section, idx) => {
    const sectionTitle = titles[idx].childNodes[0].innerText;
    const sectionHeaders = headerRows[idx]

    section.querySelectorAll("tr").forEach(grade => {
        const assignment = grade.querySelector("td").innerText

        const gradeValue = parseNumberValue(grade.querySelector('td[class="${Grade Value-wrap-class}"]').innerText);
        const maxValue = parseNumberValue(grade.querySelector('td[class="${Maximum Value-wrap-class}"]').innerText);
        const scale = parseNumberValue(grade.querySelector('td[class="${Grade Scale-wrap-class}"]').innerText);

        const allCells = grade.querySelectorAll("td").map((cell, idx) => {
            return {
                key: sectionHeaders.querySelectorAll("th")[idx].innerText,
                value: cell.innerText
            }
        })

        console.log(allCells);
        console.log(gradeValue / maxValue);
    })
})
