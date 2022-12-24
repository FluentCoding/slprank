import { Sequelize, DataTypes } from "sequelize";

const sequelize = new Sequelize('sqlite:players.db')
export const Player = sequelize.define('Player', {
    name: DataTypes.STRING,
    code: DataTypes.STRING,
    countryCode: DataTypes.STRING,
}, {
    timestamps: false
})

Player.sync({ alter: true })

export const fetchAllCountries = (): Promise<[{DISTINCT: string}]> => {
    return Player.aggregate('countryCode', 'DISTINCT', { plain: false })
}