// Simple script which extracts the current rank mappings function and outputs a js file.
// It might break sooner or later but this helps me to efficiently create mappings
// without having to find them in the source js manually.

import { writeFileSync } from "fs"

const BASE_URL = "https://slippi.gg/"
const matchFirstOr = (base, regex, error) => {
    const match = base.match(regex)?.[0]
    if (!match)
        throw new Error(error)

    return match
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
    return `let EU=new Proxy({}, {get: (target, prop) => prop});export const mapper=(${ratingVarName}, ${conditionalVarName})=>${func};`
})()

writeFileSync('src/_ranks.js', rankFunc)

console.log("[3] Ranks saved")