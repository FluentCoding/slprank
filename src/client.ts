import axios from 'axios'
import { CronJob } from 'cron'
import { FirebaseOptions, initializeApp } from 'firebase/app'
import { getDatabase, onValue, ref } from 'firebase/database'
import { readFileSync } from 'fs'
import { fetchAllCountries, Player } from './db'
import { LeaderboardType, RanksType, RegionalLeaderboardsType } from './types'
import { humanize } from './util'

const numberToLowercaseLetter = (num: number) => {
    const base = 'a'.charCodeAt(0);
    const letters = [];
  
    do {
      num -= 1;
      letters.unshift(String.fromCharCode(base + (num % 26)));
      num = Math.floor(num / 26);
    } while (num > 0);
  
    return letters.join('');
}
  

let ranks: RanksType | undefined
let regionalLeaderboards: RegionalLeaderboardsType;
let leaderboards: LeaderboardType = {};
export const fetchStats = async (code: string) => {
    return (await fetchMultipleStats(code))?.[code]
}
export const fetchMultipleStats = async (...codes: string[]) => {
    if (codes.length === 0)
        return;

    const codeToLetter = codes.map((code, i) => ({code, i: numberToLowercaseLetter(i + 1)}))
    const data = (await axios.post(process.env.SLIPPI_GRAPHQL!, {
        "operationName": "AccountManagementPageQuery",
        "variables": Object.fromEntries(codeToLetter.map((entry) => ([entry.i, entry.code]))),
        "query": `
            fragment u on User{displayName rankedNetplayProfile{ratingOrdinal wins losses dailyGlobalPlacement dailyRegionalPlacement continent characters{character gameCount}}}
            query AccountManagementPageQuery(${codeToLetter.map((entry) => `$${entry.i}:String`).reduce((p, c) => `${p},${c}`)}){
                ${codeToLetter.map((entry) => `${entry.i}:getConnectCode(code:$${entry.i}){user {...u}}`)}
            }
        `
    })).data.data

    let result: Record<string, any> = {}

    console.log("---")
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
    console.log("---")

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
    // reset
    regionalLeaderboards = {
        lastUpdated: new Date(),
        leaderboards: {}
    }

    // fill data for each country which is present in the db
    for (const countryContainer of await fetchAllCountries()) {
        const country = countryContainer.DISTINCT;

        const data = await Player.findAll({
            where: { countryCode: country }
        })
        const players = data.map((p) => ({
            name: p.dataValues.name,
            code: p.dataValues.code
        }))
        const stats = await fetchMultipleStats(...players.map((p) => p.code))
        console.log(stats)
        const leaderboard = (await Promise.all(players.map(async (p) => {
            const playerStats = stats?.[p.code]
            if (!playerStats) {
                console.log(`Couldn't retrieve stats of ${p.name} (${p.code})!`)
                return
            }

            const rating = playerStats?.rating?.toFixed(2) ?? 0
            
            return {
                ...p,
                rating,
                rank: (await getRankName({...playerStats, ratingOrdinal: playerStats.rating}))?.name
            }
        }))).sort((a, b) => b?.rating - a?.rating)

        regionalLeaderboards.leaderboards[country] = leaderboard
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
    return ranks?.[rankProfile?.dailyGlobalPlacement && rankProfile?.dailyRegionalPlacement ? 'true' : 'false']
        .find((entry) => rankProfile?.ratingOrdinal >= entry.min && rankProfile?.ratingOrdinal <= entry.max)
}