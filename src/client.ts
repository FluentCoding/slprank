import axios from 'axios'
import { FirebaseOptions, initializeApp } from 'firebase/app'
import { getDatabase, onValue, ref } from 'firebase/database'
import { readFileSync } from 'fs'
import { LeaderboardType, RanksType } from './types'
import { humanize } from './util'

let ranks: RanksType | undefined
let leaderboards: LeaderboardType = {};
export const fetchStats = async (code: string) => {
    const result = await axios.post(process.env.SLIPPI_GRAPHQL!, {
        "operationName": "AccountManagementPageQuery",
        "variables": {
            "cc": code,
            "uid": code
        },
        "query": "fragment u on User {displayName rankedNetplayProfile{ratingOrdinal wins losses dailyGlobalPlacement dailyRegionalPlacement continent characters{character gameCount}}}query AccountManagementPageQuery($cc: String!, $uid: String!) {getUser(fbUid: $uid) {...u} getConnectCode(code: $cc) {user {...u}}}"
    })

    const stats: any = result.data
    const user = stats?.data?.getConnectCode?.user
    if (user) {
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

        const result = {
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
            }))
        }

        console.log(`${result.displayName} fetched (rank: ${result.rank}, code: ${code})`)

        return result
    }
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