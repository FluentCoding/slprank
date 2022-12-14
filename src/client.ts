import axios from 'axios'
import { CronJob } from 'cron'
import { FirebaseOptions, initializeApp } from 'firebase/app'
import { getDatabase, onValue, ref } from 'firebase/database'
import { readFileSync } from 'fs'
import { fetchAllCountries, Player } from './db'
import { LeaderboardType, RanksType, RegionalLeaderboardsType } from './types'
import { humanize, numberToLowercaseLetter } from './util'

let ranks: RanksType | undefined
let regionalLeaderboards: RegionalLeaderboardsType;
let leaderboards: LeaderboardType = {};
export const fetchStats = async (code: string) => {
    return (await fetchMultipleStats(code))?.[code]
}
export const fetchMultipleStats = async (...codes: string[]) => {
    if (codes.length === 0)
        return;
    
    let result: Record<string, any> = {}

    if (codes.length > 50) {
        result = await fetchMultipleStats(...codes.slice(50)) ?? {}
        codes = codes.slice(0, 50)
    }

    const codeToLetter = codes.map((code, i) => ({code, i: numberToLowercaseLetter(i + 1)}))
    let data
    try {
        data = (await axios.post(process.env.SLIPPI_GRAPHQL!, {
            "operationName": "AccountManagementPageQuery",
            "variables": Object.fromEntries(codeToLetter.map((entry) => ([entry.i, entry.code]))),
            "query": `
                fragment u on User{displayName rankedNetplayProfile{ratingOrdinal wins losses dailyGlobalPlacement dailyRegionalPlacement continent characters{character gameCount}}}
                query AccountManagementPageQuery(${codeToLetter.map((entry) => `$${entry.i}:String`).reduce((p, c) => `${p},${c}`)}){
                    ${codeToLetter.map((entry) => `${entry.i}:getConnectCode(code:$${entry.i}){user {...u}}`)}
                }
            `
        })).data.data
    } catch(e) {
        console.log("Couldn't fetch data from Slippi.")
        return undefined;
    }

    for (const userStats of Object.keys(data)) {
        const stats: any = data[userStats]
        const code = codeToLetter.find((entry) => entry.i === userStats)?.code
        const user = stats?.user

        if (user && code) {
            // Fetch placement from leaderboards
            let rankRegion
            let rankPlacement

            if (leaderboards) {
                for (const region of Object.keys(leaderboards)) {
                    let placement = leaderboards[region].indexOf(code);

                    if (placement !== -1) {
                        rankRegion = region.toUpperCase()
                        rankPlacement = placement + 1
                        break;
                    }
                }
            }

            const rankProfile = user.rankedNetplayProfile
            const rank = await getRankName(rankProfile)

            const userResult = {
                displayName: user.displayName,
                continent: humanize(rankProfile?.continent),
                rank: rank?.name,
                leaderboardPlacement: rankPlacement,
                leaderboardRegion: rankRegion,
                rating: rankProfile?.ratingOrdinal,
                wins: rankProfile?.wins ?? 0,
                losses: rankProfile?.losses ?? 0,
                characters: rankProfile?.characters?.map((character: any) => ({
                    characterName: humanize(character.character),
                    gameCount: character.gameCount
                })),
                dailyGlobalPlacement: rankProfile?.dailyGlobalPlacement ?? 0,
                dailyRegionalPlacement: rankProfile?.dailyRegionalPlacement ?? 0,
            }

            console.log(`${userResult.displayName} fetched (rank: ${userResult.rank}, code: ${code})`)
            result[code] = userResult
        }
    }

    return result
}

export const fetchLeaderboards = () => {
    const firebaseConfig = JSON.parse(process.env.SLIPPI_FIREBASE!) as FirebaseOptions;
    let app = initializeApp(firebaseConfig)
    let db = getDatabase(app)
    
    const leaderboardRef = ref(db, "ranked-leaderboards")
    onValue(leaderboardRef, (snapshot) => {
        if (!snapshot.exists()) {
            console.log("leaderboard data didn't arrive properly")
            return
        }
    
        const data = snapshot.val();
        console.log("new leaderboard arrived")
    
        leaderboards = (Object.keys(data)
            .filter((k) => !k.startsWith("__"))
            .reduce((a, v) => ({...a, [v]: data?.[v]?.map((profile: any) => profile?.user?.connectCode?.code)}), {}))
    });
}

export const fetchRanks = async () => {
    if (!ranks) {
        let result = await readFileSync('ranks.json')
        ranks = JSON.parse(result as any)
    }

    return ranks
}

const fetchRegionalLeaderboards = async () => {
    let leaderboards: RegionalLeaderboardsType['leaderboards'] = {}
    let players = (await Player.findAll()).map((p) => ({
        name: p.dataValues.name,
        code: p.dataValues.code,
        countryCode: p.dataValues.countryCode
    }))
    const stats = await fetchMultipleStats(...players.map((p) => p.code))

    if (!stats) {
        console.log(`Couldn't retrieve stats, skipping this regional leaderboard fetching cycle.`)
        return
    }

    players = players.filter((p) => {
        if (!stats?.[p.code]) {
            console.log(`Couldn't retrieve stats of ${p.name} (${p.code})!`)
            return false
        }

        return true
    })

    // fill data for each country which is present in the db
    for (const country of await fetchAllCountries()) {
        const leaderboard = (await Promise.all(
            players
                .filter((p) => country.code === "ALL" || p.countryCode === country.code)
                .filter((p, i, arr) => arr.findIndex((temp) => temp.code === p.code) === i) // we dont want multiple entries with the same code
                .map(async (p) => {
                    const playerStats = stats?.[p.code]
                    const rating = playerStats?.rating?.toFixed(2) ?? 0
                    const wins = playerStats?.wins
                    const losses = playerStats?.losses
                    
                    return {
                        ...p,
                        rating,
                        wins,
                        losses,
                        country: country.code === "ALL" ? p.countryCode : undefined,
                        rank: (await getRankName({...playerStats, ratingOrdinal: playerStats.rating}))?.name
                    }
                })
        )).sort((a, b) => b?.rating - a?.rating)

        leaderboards[country.code] = leaderboard
    }

    // update
    regionalLeaderboards = {
        lastUpdated: new Date(),
        leaderboards
    }
}
export const startRegionalLeaderboardsRoutine = async () => {
    // we should only be able to start the cronjob when the regional leaderboards are empty
    if (regionalLeaderboards)
        return;
    
    // first fetch
    await fetchRegionalLeaderboards()

    // runs every hour, e.g. 1PM, 2PM, ...
    const job = new CronJob('0 0 */1 * * *', fetchRegionalLeaderboards)
    job.start()
}
export const getRegionalLeaderboards = () => regionalLeaderboards

export const getRankName = async (rankProfile: {
    dailyGlobalPlacement: any
    dailyRegionalPlacement: any
    ratingOrdinal: any
}) => {
    let ranks = await fetchRanks()
    return ranks?.[rankProfile?.dailyGlobalPlacement || rankProfile?.dailyRegionalPlacement ? 'true' : 'false']
        .find((entry) => rankProfile?.ratingOrdinal >= entry.min && rankProfile?.ratingOrdinal <= entry.max)
}