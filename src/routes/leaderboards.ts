import { FastifyInstance, FastifyReply } from "fastify"
import { fetchMultipleStats, fetchRanks, getRankName, getRegionalLeaderboards } from "../client"
import { fetchAllCountries, Player } from "../db"
import { template } from "../util"

function timeSince(date: Date) {
    // @ts-ignore
    var seconds = Math.floor((new Date() - date) / 1000);
  
    var interval = seconds / 31536000;
  
    if (interval > 1) {
      return Math.floor(interval) + " years";
    }
    interval = seconds / 2592000;
    if (interval > 1) {
      return Math.floor(interval) + " months";
    }
    interval = seconds / 86400;
    if (interval > 1) {
      return Math.floor(interval) + " days";
    }
    interval = seconds / 3600;
    if (interval > 1) {
      return Math.floor(interval) + " hours";
    }
    interval = seconds / 60;
    if (interval > 1) {
      return Math.floor(interval) + " minutes";
    }
    return Math.floor(seconds) + " seconds";
}

async function fetchDashboard(reply: FastifyReply) {
    return await template(reply, 'leaderboards/dashboard', {
        countries: await fetchAllCountries()
    })
}

export default function leaderboardsRoute(fastify: FastifyInstance) {
    fastify.get('/leaderboards', async (request, reply) => {
        return await fetchDashboard(reply)
    })
    fastify.get<{
        Params: {
            country: string
        }
    }>('/leaderboards/:country', async (request, reply) => {
        let { country } = request.params

        if (!country) return await fetchDashboard(reply)
        country = country.toUpperCase()

        const regionalLeaderboards = getRegionalLeaderboards()

        const lastUpdated = regionalLeaderboards?.lastUpdated
        const leaderboard = regionalLeaderboards?.leaderboards[country]

        if (!leaderboard) {
          if ((await fetchAllCountries()).includes(country))
            return "Please refresh in a couple of seconds. The leaderboard is still being retrieved."
          else
            return "No leaderboard exists for this country."
        }

        return await template(reply, 'leaderboards/leaderboard', {
            country,
            leaderboard,
            lastUpdated: `${timeSince(lastUpdated)} ago. (${lastUpdated.toUTCString()})`
        })
    })
}