import axios from 'axios'
import { FirebaseOptions, initializeApp } from 'firebase/app'
import { getDatabase, onValue, ref } from 'firebase/database'
import { readFileSync } from 'fs'
import { LeaderboardType, RanksType } from './types'
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

            // Fetch rank from json
            let ranks = await fetchRanks()
            let rank = ranks?.[rankProfile?.dailyGlobalPlacement && rankProfile?.dailyRegionalPlacement ? 'true' : 'false']
                .find((entry) => rankProfile?.ratingOrdinal >= entry.min && rankProfile?.ratingOrdinal <= entry.max)

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
                dailyGlobalPlacement: rankProfile?.dailyGlobalPlacement,
                dailyRegionalPlacement: rankProfile?.dailyRegionalPlacement,
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