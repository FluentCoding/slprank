import axios from 'axios'
import { FirebaseOptions, initializeApp } from 'firebase/app'
import { getDatabase, onValue, ref } from 'firebase/database'
import { LeaderboardType } from './types'
import { humanize } from './util'
import { mapper } from './_ranks'

export const fetchStats = async (code: string) => {
    const result = await axios.post('https://gql-gateway-dot-slippi.uc.r.appspot.com/graphql', {
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
        const rankProfile = user.rankedNetplayProfile
        console.log(JSON.stringify(rankProfile))
        const result = {
            displayName: user.displayName,
            continent: humanize(rankProfile?.continent),
            rank: mapper(rankProfile?.ratingOrdinal, rankProfile?.dailyGlobalPlacement && rankProfile?.dailyRegionalPlacement),
            rating: rankProfile?.ratingOrdinal,
            wins: rankProfile?.wins ?? 0,
            losses: rankProfile?.losses ?? 0,
            characters: rankProfile?.characters?.map((character: any) => ({
                characterName: humanize(character.character),
                gameCount: character.gameCount
            }))
        }

        return result
    }
}

export const fetchLeaderboards = (onUpdate: (val: LeaderboardType) => {}) => {
    const firebaseConfig = JSON.parse(process.env.FIREBASE!) as FirebaseOptions;
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
    
        onUpdate(Object.keys(data)
            .filter((k) => !k.startsWith("__"))
            .reduce((a, v) => ({...a, [v]: data?.[v]?.map((profile: any) => profile?.user?.connectCode?.code)}), {}))
    });
}