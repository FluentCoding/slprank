// Simple script which extracts the current rank mappings function and outputs a js file.
// It might break sooner or later but this helps me to efficiently create mappings
// without having to find them in the source js manually + format them.

import { fstat, write, writeFileSync } from "fs"
import BigNumber from "./include/bignum.mjs"
import sharp from 'sharp'

// Utilities
const BASE_URL = "https://slippi.gg/"
const matchFirstOr = (base, regex, error) => {
    const match = base.match(regex)?.[0]
    if (!match)
        throw new Error(error)

    return match
}
const CUSTOM_RANK_OVERRIDE = {
    'plat': 'platinum'
}
// converts bronze3 to Bronze 3, grandmaster to Grandmaster, etc.
const rankCase = (str) => {
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
const js = await (async () => {
    const html = await fetch(new URL("user/flcd-507", BASE_URL).href).then(res => res.text())
    const includedScript = matchFirstOr(
        html,
        /(?<=<script[a-z1-9"'\/ =]*?src=")\/static\/js(.*?)(?=")/gmi,
        "Couldn't find script tag which referred to static js file used for mappings."
    )

    console.log("[1] Script found")
    return await fetch(new URL(includedScript, BASE_URL).href).then(res => res.text())
})()

// Step 2: Fetch ranks from script by parsing the function which maps rating => rank
// We also want to fetch rank images
const rankFunc = await (async () => {
    let func = matchFirstOr(js, /(?<=pending:)e.+?bronze1/, "Couldn't find mapping function.")
    const rankNamePrefix = matchFirstOr(func, /[A-z]+?(?=\.)/g, "Couldn't find prefix of rank names.")
    const ratingVarName = matchFirstOr(func, /[A-z](?=[ >=])/, "Couldn't find variable name of rating")
    // conditional only existed in grandmaster check thus far
    const conditionalVarName = matchFirstOr(func, /(?<=[& ])[A-z]/, "Couldn't find variable name of conditional")

    // format rank names properly
    console.log("[2] Rank function found")
    return `
        const ${rankNamePrefix}=new Proxy({},{get:(target,prop)=>prop});
        const mapper=(${ratingVarName},${conditionalVarName})=>${func};
    `
})()

let toExecuteInEval = () => {
    let ranks = {'true': [], 'false': []}
    const RANK_STEP = new BigNumber(0.01)
    for (let i = 0; i < 2; i++) {
        let secondParamTrue = i % 2
        let currentRanksArr = ranks[new Boolean(secondParamTrue).toString()]
        let lastRankEntry

        // go through every possible rank (we use 0-3000 for this case)
        for (let i = new BigNumber(3000); i.comparedTo(0) >= 0; i = i.minus(RANK_STEP)) {
            const rankName = mapper(i, secondParamTrue)

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

    return ranks
}

let ranks = eval(`${rankFunc}(${toExecuteInEval.toString()})()`)

const formattedRanks = {}

Object.keys(ranks).forEach((key) => formattedRanks[key] = ranks[key].map((rankEntry) => {
    let override = Object.entries(CUSTOM_RANK_OVERRIDE).find((e) => rankEntry.name.startsWith(e[0]))

    if (override) {
        // apply override (e.g. Plat => Platinum)
        rankEntry.name = rankEntry.name.replace(override[0], override[1])
    }

    return {
        name: rankCase(rankEntry.name),
        max: rankEntry.max.toNumber(),
        min: rankEntry.min.toNumber()
    }
}))

console.log(formattedRanks)
writeFileSync('ranks.json', JSON.stringify(formattedRanks, null, 2))

console.log("[3] Ranks saved")

const rankImagesFunc = await (async () => {
    let imageFunc = matchFirstOr(js, /var uW=.+?static\/media\/rank.+?grandmaster.+?svg"}/g, "Couldn't find image func.")
    
    const imageMap = eval(`
        const n={p:""};
        (()=>{${imageFunc};return jW})();
    `)
    
    for (const key of Object.keys(imageMap)) {
        const svg = await fetch(`${BASE_URL}${imageMap[key]}`).then(res => res.arrayBuffer())
        const filePath = `public/imgs/${rankCase(key)}.png`

        writeFileSync(filePath, await sharp(new Uint8Array(svg)).png().toBuffer())
    }
})()

console.log("[4] Rank images saved and converted to PNG")