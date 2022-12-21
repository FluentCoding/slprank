import { FastifyInstance } from "fastify"
import { fetchRanks, fetchStats } from "../client"
import { SuffixOptions } from "../types"
import { formattedCodeIfValid } from "../util"

export default function utilRoute(fastify: FastifyInstance) {
    fastify.get('/rank-list', async (request, reply) => {
        const result = await fetchRanks()
        return result?.true.map((rank) => rank.name);
    })
}