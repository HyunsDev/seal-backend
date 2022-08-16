const express = require('express');
const mysql = require('mysql2/promise')
const { tokenCheck } = require('../middleware/auth')
const crypto = require('crypto')

const router = express.Router()

const connectPool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_SCHEMA,
    password: process.env.DB_PASSWORD,
});


router.get('/', tokenCheck, async (req, res) => {
    const conn = await connectPool.getConnection()
    const result = await conn.query('SELECT * FROM `user` WHERE id = ?', [req.token.id])
    if (result[0].length === 0) {
        res.status(404).send({
            code: 'user_not_found'
        })
        return
    }

    const editedResult = {
        id: result[0][0].id,
        userId: result[0][0].userId,
        name: result[0][0].name,
        phone: result[0][0].phone,
        grade: result[0][0].grade,
        class: result[0][0].class,
        number: result[0][0].number,
        year: result[0][0].year,
        type: result[0][0].type,
        createdAt: result[0][0].createdAt,
        role: result[0][0].role
    }

    conn.release()
    res.send(editedResult)
})

router.patch('/', tokenCheck, async (req,res) => {
    const { name, phone, grade, number, type } = req.body

    console.log(req.body)

    if (!name || !phone || !grade || !req.body.class || !number || !type) {
        res.status(400).send({
            code: 'bad_request'
        })
        return
    }


    const conn = await connectPool.getConnection()
    const userResult = await conn.query('SELECT * FROM `user` WHERE id = ?', [req.token.id])
    if (userResult[0].length === 0) {
        res.status(404).send({
            code: 'user_not_found'
        })
        return
    }

    await conn.query('UPDATE `user` SET name = ?, phone = ?, grade = ?, class = ?, `number` = ?, `type` = ? WHERE id = ?', [name, phone, grade, req.body.class, number, type, req.token.id])

    res.status(204).send()
})

router.patch('/password', tokenCheck, async (req,res) => {
    const { password, oldPassword } = req.body

    if (!password || !oldPassword) {
        res.status(400).send({
            code: 'bad_request'
        })
        return
    }

    const conn = await connectPool.getConnection()
    const userResult = await conn.query('SELECT * FROM `user` WHERE id = ?', [req.token.id])
    if (userResult[0].length === 0) {
        res.status(404).send({
            code: 'user_not_found'
        })
        return
    }

    const hashedPassword = crypto.pbkdf2Sync(oldPassword, userResult[0][0].passwordSalt, 8, 64, 'sha512').toString('base64')
    if (hashedPassword !== userResult[0][0].password) {
        res.status(400).json({code: 'wrong_password'})
        return
    }

    const salt = Math.round((new Date().valueOf() * Math.random())) + "";
    const newHashedPassword = crypto.pbkdf2Sync(password, salt, 8, 64, 'sha512').toString('base64')

    await conn.query('UPDATE `user` SET password = ?, passwordSalt = ? WHERE id = ?', [newHashedPassword, salt, req.token.id])

    res.status(204).send({})
})

router.delete('/', tokenCheck, async (req,res) => {
    const conn = await connectPool.getConnection()
    const userResult = await conn.query('SELECT * FROM `user` WHERE id = ?', [req.token.id])
    if (userResult[0].length === 0) {
        res.status(404).send({
            code: 'user_not_found'
        })
        return
    }

    await conn.query('DELETE FROM `user` WHERE id = ?', [req.token.id])
    await conn.query('DELETE FROM `post` WHERE userId = ?', [req.token.id])
    await conn.query('DELETE FROM `comment` WHERE userId = ?', [req.token.id])

    res.status(204).send({})
})

module.exports = router