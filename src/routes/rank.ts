import { FastifyInstance } from "fastify"
import { fetchMultipleStats, fetchStats } from "../client"
import { SuffixOptions } from "../types"
import { formattedCodeIfValid } from "../util"

export default function rankRoute(fastify: FastifyInstance) {
    // v1
    fastify.route<{
        Params: {
            code: string
        }
        Querystring: {
            hideRegion: string
            hideWinLose: string
            roundRating: string
            dontRoundRating: string // legacy, keeping it so links using this work as intended
            raw: string
        } & SuffixOptions
    }>({method: ['GET', 'POST'], url: '/rank/:code', handler: async (request) => {
        const { code: urlCode } = request.params
        const query = request.query
    
        const code = formattedCodeIfValid(urlCode)
    
        // handle post in case u want the raw data for more than one code
        if (query.raw !== undefined) {
            if (code)
                return await fetchStats(code)
            
            if (!Array.isArray(request.body) || request.body.length === 0)
                throw new Error("Body should be a json array with more than 0 entries.")

            const input = request.body.map((code) => {
                let newCode = formattedCodeIfValid(code)
                if (newCode === undefined)
                    throw new Error(`Code ${code} is not valid!`)
                
                return newCode
            })

            // using set so we get unique entries
            return await fetchMultipleStats(...new Set<any>(input))
        }
        if (code) {
            const stats = await fetchStats(code)
    
            if (!stats)
                return "Couldn't fetch stats!"
    
            const rankPrefix = stats.leaderboardPlacement ?
                `Rank ${stats.leaderboardPlacement}${query.hideRegion === undefined ? ` [${stats.leaderboardRegion}]` : ""}` :
                (stats.rank ?? "No rank")
            let suffix = "";
            for (const key of (Object.keys(query) as ((keyof SuffixOptions))[])) {
                switch(key) {
                    case 'profileLink':
                        suffix += ` https://slippi.gg/user/${code.replace("#", "-").toLowerCase()}`
                        break
                    case 'leaderboardLink':
                        // we only want the suffix if we were able to determine the player's region and it's not NA
                        let leaderboardRegionSuffix = !["NA", undefined].includes(stats.leaderboardRegion) ? `?region=${stats.leaderboardRegion!.toLowerCase()}` : ""
                        suffix += ` https://slippi.gg/leaderboards${leaderboardRegionSuffix}`
                        break
                }
            }
            
            return `${rankPrefix} (${stats.rating.toFixed((query.roundRating === undefined && query.dontRoundRating === undefined) ? 2 : 0)}${query.hideWinLose === undefined ? ` - ${stats.wins}W/${stats.losses}L` : ""})${suffix}`
        } else {
            return "Given code is not valid! Please check the URL of the command, the code should be formatted like abc-123 instead of ABC#123."
        }
    }})
}