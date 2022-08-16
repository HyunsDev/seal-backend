const express = require('express')
const mysql = require('mysql2/promise')
const { tokenCheck } = require('../middleware/auth')

const router = express.Router()

const connectPool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_SCHEMA,
    password: process.env.DB_PASSWORD,
});

router.get('/', tokenCheck, async (req, res) => {
    const conn = await connectPool.getConnection()
    const result = await conn.query('SELECT * FROM `post`')

    conn.release()
    
    const editedResult = result[0].map(e => ({
        id: e.id,
        title: e.title,
        category: e.category,
        status: e.status,
        tag: e.tag,
        createdAt: e.createdAt,
        content: e.content,
        condition: JSON.parse(e.condition),
    }))

    res.send({
        posts: editedResult
    })
})

router.get('/:id', tokenCheck, async (req, res) => {
    const postId = req.params.id;

    const conn = await connectPool.getConnection()
    const postResult = await conn.query('SELECT * FROM `post` WHERE id = ?', [postId])
    if (postResult[0].length === 0) {
        res.status(404).send({
            code: 'post_not_found'
        })
        return
    }
    
    const commentResult = await conn.query('SELECT * FROM `comment` WHERE postId = ?', [postId])
    const userResult = await conn.query('SELECT * from `user` WHERE id = ?', [postResult[0][0].userId])

    if (userResult[0].length === 0) {
        res.status(404).send({
            code: 'post_not_found'
        })
        return
    }

    let comment = []
    for (const e of commentResult[0]) {
        const commentAuthor = await conn.query('SELECT * FROM `user` WHERE id = ?', [e.userId])
        comment.push({
            id: e.id,
            author: commentAuthor[0][0].name,
            authorId: e.authorId,
            content: e.content
        })
    }

    const editedResult = {
        id: postResult[0][0].id,
        title: postResult[0][0].title,
        category: postResult[0][0].category,
        status: postResult[0][0].status,
        tag: postResult[0][0].tag,
        createdAt: postResult[0][0].createdAt,
        content: postResult[0][0].content,
        condition: JSON.parse(postResult[0][0].condition),
        contact: postResult[0][0].contact,
        author: {
            id: userResult[0][0].id,
            name: userResult[0][0].name,
            grade: userResult[0][0].grade,
            class: userResult[0][0].class,
            number: userResult[0][0].number
        },
        comment: comment
    }
    conn.release()
    res.send(editedResult)
})

router.post('/', tokenCheck, async (req, res) => {
    const { title, content, category, contact, tag, condition } = req.body
    if (!title || !content || !category || !contact || !condition) {
        res.status(400).send({
            code: 'bad_request'
        })
        return
    }

    const now = new Date()
    const conn = await connectPool.getConnection()
    const result = await conn.query('INSERT INTO `post` (title, content, category, contact, tags, `condition`, createdAt, updatedAt, userId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [title, content, category, contact, tag, JSON.stringify(condition), now, now, req.token.id])
    conn.release()

    res.send({
        id: result[0].insertId
    })
})

router.delete('/:id', tokenCheck, async (req, res) => {
    const postId = req.params.id
    const conn = await connectPool.getConnection()
    
    const post = await conn.query('SELECT * FROM `post` WHERE id = ?', [postId])
    if (post[0].length === 0) {
        res.status(404).send({
            code: 'post_not_found'
        })
        return
    }
    if (post[0].userId !== req.token.id) {
        res.status(403).send({
            code: "forbidden"
        })
        return
    }

    await conn.query('DELETE FROM `post` WHERE id = ?', [ postId ])
    await conn.query('DELETE FROM `comment` WHERE postId = ?', [ postId ])
    conn.release()

    res.status(204).send()
})

router.post('/:id/comment', tokenCheck, async (req, res) => {
    const postId = req.params.id

    const { content } = req.body
    if (!content) {
        res.status(400).send({
            code: 'bad_request'
        })
        return
    }

    const now = new Date()
    const conn = await connectPool.getConnection()

    const postResult = await conn.query('SELECT * FROM `post` WHERE id = ?', [postId]) 
    if (postResult[0].length === 0) {
        res.status(404).send({
            code: 'post_not_found'
        })
        return
    }

    const result = await conn.query('INSERT INTO `comment` (content, userId, postId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?) ', [content, req.token.id, postId, now, now])
    conn.release()

    res.send({
        id: result[0].insertId
    })
})

router.delete('/:id/comment/:commentId', tokenCheck, async (req, res) => {
    const commentId = req.params.commentId
    const conn = await connectPool.getConnection()
    
    const comment = await conn.query('SELECT * FROM `comment` WHERE id = ?', [commentId])
    if (comment[0].length === 0) {
        res.status(404).send({
            code: 'comment_not_found'
        })
        return
    }
    if (comment[0].userId !== req.token.id) {
        res.status(403).send({
            code: "forbidden"
        })
        return
    }

    await conn.query('DELETE FROM `comment` WHERE id = ?', [ commentId ])
    conn.release()

    res.status(204).send()
})

module.exports = router