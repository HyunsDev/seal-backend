const express = require('express')
const mysql = require('mysql2/promise')
const crypto = require('crypto')
const jwt = require('jsonwebtoken')

const router = express.Router()

const connectPool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_SCHEMA,
    password: process.env.DB_PASSWORD,
});


router.get('/', (req, res) => {
    res.send('Hello, world!')
})

router.post('/sign-in', async (req, res) => {
    const body = req.body
    if (!body.id || !body.password) {
        res.status(400).send({
            code: 'bed_request'
        })
        return
    }

    const conn = await connectPool.getConnection()
    const result = await conn.query('SELECT * FROM `user` WHERE userId = ?', [body.id])
    conn.release()

    if (result[0].length === 0) {
        res.status(404).send({
            code: 'user_not_found'
        })
        return
    }

    const hashedPassword = crypto.pbkdf2Sync(body.password, result[0].passwordSalt, 8, 64, 'sha512').toString('base64')
    if (hashedPassword !== user.password) {
        res.status(400).json({code: 'wrong_password'})
        return
    }

    const token = jwt.sign({
        id: result.id
    }, process.env.JWT_SECRET, {
        issuer: 'seal-api.hyuns.dev',
        subject:'user'
    })

    res.send({
        token: token
    })
})

router.post('/sign-up', async (req, res) => {
    const body = req.body
    if (!body?.id || !body?.password || !body?.name || !body?.type) {
        res.status(400).send({
            code: 'bed_request'
        })
        return
    }

    const conn = await connectPool.getConnection()
    const result = await conn.query('SELECT * FROM `user` WHERE userId = ?', [body.id])
    if (result[0].length !== 0) {
        res.status(400).send({
            code: 'account_already_exist'
        })
        return
    }

    const now = new Date()

    const salt = Math.round((new Date().valueOf() * Math.random())) + "";
    const hashedPassword = crypto.pbkdf2Sync(body.password, salt, 8, 64, 'sha512').toString('base64')
    const result2 = await conn.query('INSERT INTO `user` (userId, name, grade, class, number, type, phone, password, passwordSalt, createdAt, updatedAt) value (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [body.id, body.name, body.grade, body.class, body.number, body.type, body.phone, hashedPassword, salt, now, now])
    conn.release()

    const token = jwt.sign({
        id: result2[0].insertId
    }, process.env.JWT_SECRET, {
        issuer: 'seal-api.hyuns.dev',
        subject:'user'
    })

    res.send({
        code: 'signup_successful',
        token: token
    })
})

module.exports = router