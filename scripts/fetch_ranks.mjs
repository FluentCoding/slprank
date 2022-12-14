// Simple script which extracts the current rank mappings function and outputs a js file.
// It might break sooner or later but this helps me to efficiently create mappings
// without having to find them in the source js manually + format them.

import { writeFileSync } from "fs"
import BigNumber from "./bignum.mjs"

const BASE_URL = "https://slippi.gg/"
const matchFirstOr = (base, regex, error) => {
    const match = base.match(regex)?.[0]
    if (!match)
        throw new Error(error)

    return match
}
// converts bronze3 to Bronze 3, grandmaster to Grandmaster, etc.
export function rankCase(str) {
    var splitStr = str.toLowerCase().split(' ');
    for (var i = 0; i < splitStr.length; i++) {
        splitStr[i] = splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);     
    }
    // Directly return the joined string
    const result = splitStr.join(' ');
    if (isNaN(result.charAt(result.length - 1)))
        return result
    else
        return `${result.substr(0, result.length - 1)} ${result.charAt(result.length -1)}`
}

// Step 1: Fetch html page of any slippi profile (we don't care about the dynamic/js
// part of it, we only need the imported script)
const script = await (async () => {
    const html = await fetch(new URL("user/flcd-507", BASE_URL).href).then(res => res.text())
    const includedScript = matchFirstOr(
        html,
        /(?<=<script[a-z1-9"'\/ =]*?src=")\/static\/js(.*?)(?=")/gmi,
        "Couldn't find script tag which referred to static js file used for mappings."
    )

    console.log("[1] Script found")
    return new URL(includedScript, BASE_URL).href
})()

// Step 2: Fetch ranks from script by parsing the function which checks 
const rankFunc = await (async () => {
    console.log(script)
    const js = await fetch(script).then(res => res.text())
    let func = matchFirstOr(js, /(?<=pending:)e.+?bronze1/, "Couldn't find mapping function.")
    const rankNamePrefix = matchFirstOr(func, /[A-z]+?\./g, "Couldn't find prefix of rank names.")
    const ratingVarName = matchFirstOr(func, /[A-z](?=[ >=])/, "Couldn't find variable name of rating")
    // conditional only existed in grandmaster check thus far
    const conditionalVarName = matchFirstOr(func, /(?<=[& ])[A-z]/, "Couldn't find variable name of conditional")

    // format rank names properly
    console.log("[2] Rank function found")
    return `let EU=new Proxy({}, {get: (target, prop) => prop});const mapper=(${ratingVarName}, ${conditionalVarName})=>${func};`
})()

let ranks = {'true': [], 'false': []}
const RANK_STEP = new BigNumber(0.01)

for (let i = 0; i < 2; i++) {
    let secondParamTrue = i % 2;
    let secondParamTrueStr = secondParamTrue ? 'true' : 'false'
    let currentRanksArr = ranks[secondParamTrueStr]
    let lastRankEntry

    for (let i = new BigNumber(3000); i.comparedTo(0) >= 0; i = i.minus(RANK_STEP)) {
        let rankName = eval(`${rankFunc}mapper(${i}, ${secondParamTrueStr})`)

        if (lastRankEntry && lastRankEntry?.name !== rankName)
            lastRankEntry.min = i.plus(RANK_STEP)

        let rankEntry = currentRanksArr.find((rank) => rank.name === rankName)

        if (!rankEntry) {
            rankEntry = {
                name: rankName,
                max: i,
                min: i.plus(RANK_STEP)
            }
            currentRanksArr.push(rankEntry)
        }

        rankEntry.min = rankEntry.min.minus(RANK_STEP)
        lastRankEntry = rankEntry
    }
}

const formattedRanks = {}

Object.keys(ranks).forEach((key) => formattedRanks[key] = ranks[key].map((rankEntry) => ({
    name: rankCase(rankEntry.name),
    max: rankEntry.max.toNumber(),
    min: rankEntry.min.toNumber()
})))

console.log(formattedRanks)
writeFileSync('ranks.json', JSON.stringify(formattedRanks, null, 2))

console.log("[3] Ranks saved")