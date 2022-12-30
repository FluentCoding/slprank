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

export const fetchAllCountries = async (): Promise<{code: string, amount: number}[]> => {
    const countries = (await Player.findAll({
        attributes: ['countryCode', [Sequelize.fn('count', Sequelize.col('countryCode')), 'amount']],
        group: ['countryCode']
    })).map((e) => ({code: e.dataValues.countryCode, amount: e.dataValues.amount}))
    return [...countries, {code: 'ALL', amount: countries?.reduce((p, c) => p + c.amount, 0) ?? 0}]
}