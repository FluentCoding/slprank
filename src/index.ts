import * as dotenv from 'dotenv'
dotenv.config()

import fastifyFactory from "fastify"
import path from 'path'
import { fetchLeaderboards, fetchStats } from "./client"
import { SuffixOptions } from "./types"
import { formattedCodeIfValid, rankCase } from "./util"
import fastifyStatic from '@fastify/static'

fetchLeaderboards()

const fastify = fastifyFactory()

fastify.register(fastifyStatic, {
    root: path.join(__dirname, '../public'),
})

fastify.get<{
    Params: {
        code: string
    }
    Querystring: {
        hideRegion: string
        hideWinLose: string
        dontRoundRating: string
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
            `Rank ${stats.leaderboardPlacement}${query.hideRegion === undefined ? ` [${stats.rankRegion}]` : ""}` :
            (rankCase(stats.rank) ?? "No rank")
        let suffix = "";
        for (const key of (Object.keys(query) as ((keyof SuffixOptions))[])) {
            switch(key) {
                case 'profileLink':
                    suffix += ` https://slippi.gg/user/${code.replace("#", "-").toLowerCase()}`
                    break
                case 'leaderboardLink':
                    suffix += ` https://slippi.gg/leaderboards`
                    break
            }
        }
        
        return `${rankPrefix} (${stats.rating.toFixed(query.dontRoundRating === undefined ? 2 : 0)}${query.hideWinLose === undefined ? ` - ${stats.wins}W/${stats.losses}L` : ""})${suffix}`
    } else {
        return "Given code is not valid! Please check the URL of the command, the code should be formatted like abc-123 instead of ABC#123."
    }
})

const start = async () => {
try {
    await fastify.listen({ host: "0.0.0.0", port: 80 })
} catch (err) {
    fastify.log.error(err)
    process.exit(1)
}
}
start()