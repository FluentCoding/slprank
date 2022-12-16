import { FastifyInstance } from "fastify"
import { fetchStats } from "../client"
import { SuffixOptions } from "../types"
import { formattedCodeIfValid } from "../util"

export default function rankRoute(fastify: FastifyInstance) {
    // v1
    fastify.get<{
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
    }>('/rank/:code', async (request, reply) => {
        const { code: urlCode } = request.params
        const query = request.query
    
        const code = formattedCodeIfValid(urlCode)
    
        if (code) {
            const stats = await fetchStats(code)
    
            if (!stats)
                return "Couldn't fetch stats!"
    
            if (query.raw !== undefined) {
                return stats
            }
    
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
    })
}