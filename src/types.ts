type Rank = {name: string, max: number, min: number}
export type RanksType = {'true': Rank[], 'false': Rank[]}

export type LeaderboardType = {[region: string]: string[]}
export type RegionalLeaderboardsType = {
    lastUpdated: Date,
    leaderboards: {
        [country: string]: any
    }
}

export type SuffixOptions = {
    profileLink: string
    leaderboardLink: string
}